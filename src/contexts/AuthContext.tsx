import React, { useCallback, useEffect, useRef, useState } from 'react'
import { FirebaseError } from 'firebase/app'
import { User } from 'firebase/auth'
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithRedirect,
  getAdditionalUserInfo,
  linkWithCredential,
  OAuthCredential,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, updateDoc } from 'firebase/firestore'

import {
  UserProfile,
  AccountStatus,
  TransformationTier,
  UserRole,
} from '@/types'
import type { StandardRole } from '@/types'
import { normalizeRole } from '@/utils/role'
import { isBootstrapAdmin } from '@/utils/bootstrap'
import { auth, db, firebaseConfigStatus } from '@/services/firebase'
import { AuthContext, AuthContextType } from './AuthContextType'
import { getFriendlyErrorMessage } from '@/utils/authErrors'
import { incrementOrganizationMemberCount, validateCompanyCode } from '@/services/organizationService'
import { buildActionCodeSettings } from '@/utils/authActionCodeSettings'
import {
  assignComplementaryCoursesToUser,
  hasComplementaryCourseAssigned,
} from '@/services/courseAssignmentService'
import { canAccessOrganization } from '@/services/organizationAccessService'
import { createReferral, generateReferralCode, validateReferralCode } from '@/services/referralService'
import { JOURNEY_META, type JourneyType } from '@/config/pointsConfig'
import { resolveEffectiveOrganization, resolveEffectiveRole } from '@/utils/authz'

interface AuthProviderProps {
  children: React.ReactNode
}

const normalizeRoleKey = (role: unknown) => {
  if (!role) return ''
  return role.toString().trim().toLowerCase().replace(/[-\s]+/g, '_')
}

const roleAliasKeys = new Set([
  'company_admin',
  'admin',
  'administrator',
  'partner',
  'super_admin',
  'superadmin',
  'super',
  'mentor',
  'ambassador',
  'free_user',
  'paid_member',
  'user',
])

const resolveInitialJourneyType = (params: {
  isFreeTierUser: boolean
  organizationJourneyType?: JourneyType | null
}): JourneyType => {
  if (params.organizationJourneyType) return params.organizationJourneyType
  return params.isFreeTierUser ? '4W' : '6W'
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileStatus, setProfileStatus] = useState<'loading' | 'ready'>('loading')
  const [profileError, setProfileError] = useState<Error | null>(null)
  const [claimsRole, setClaimsRole] = useState<string | null>(null)
  const profileRef = useRef<UserProfile | null>(null)
  const initialLastProfileLoadAt = (() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('lastProfileLoadAt')
  })()
  const lastProfileLoadAtRef = useRef<string | null>(initialLastProfileLoadAt)
  const roleNormalizationRef = useRef({ userId: '', role: '' })
  const enableProfileRealtime = import.meta.env.VITE_ENABLE_PROFILE_REALTIME === 'true'
  const complementaryCourseAssignmentRef = useRef({ inFlight: false, lastAttemptAt: 0, lastUserId: '' })
  const refreshStateRef = useRef({
    inFlight: false,
    lastRequestAt: 0,
    windowStart: 0,
    requestCount: 0,
    circuitBrokenUntil: 0,
    lastManualAttemptAt: 0,
  })
  const pendingCompanyCodeKey = 't4l.pendingCompanyCode'
  const offlineErrorMessage = 'Network error. Please check your connection.'

  // Account linking state
  const [pendingLinkCredential, setPendingLinkCredential] = useState<OAuthCredential | null>(null)
  const [pendingLinkEmail, setPendingLinkEmail] = useState<string | null>(null)
  const [showAccountLinkingModal, setShowAccountLinkingModal] = useState(false)

  const buildOfflineError = useCallback(() => new Error(offlineErrorMessage), [offlineErrorMessage])

  const isOfflineError = useCallback((error: unknown) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
    const code = error instanceof FirebaseError
      ? error.code
      : typeof error === 'object' && error && 'code' in error
        ? (error as { code?: string }).code
        : undefined
    if (code === 'unavailable' || code === 'auth/network-request-failed') return true
    if (error instanceof Error && /offline/i.test(error.message)) return true
    return false
  }, [])

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  const recordProfileLoad = useCallback((loadedProfile: UserProfile | null) => {
    if (typeof window === 'undefined') return
    if (!loadedProfile?.id) return
    const timestamp = new Date().toISOString()
    localStorage.setItem('lastProfileLoadAt', timestamp)
    lastProfileLoadAtRef.current = timestamp
    console.log('🟣 [Auth] Recorded profile load timestamp', { id: loadedProfile.id, timestamp })
  }, [])

  const serializeAssignments = (assignments?: string[]) => {
    if (!assignments?.length) return ''
    return [...assignments].sort().join('|')
  }

  const maybeNormalizeStoredRole = useCallback(
    async (profileToNormalize: UserProfile, userId: string) => {
      const rawRole = profileToNormalize.role
      if (!rawRole) return

      const normalized = normalizeRole(rawRole)
      const aliasKey = normalizeRoleKey(rawRole)
      const shouldNormalize =
        aliasKey &&
        roleAliasKeys.has(aliasKey) &&
        rawRole.toString() !== normalized &&
        (roleNormalizationRef.current.userId !== userId || roleNormalizationRef.current.role !== rawRole.toString())

      if (!shouldNormalize) return

      roleNormalizationRef.current = { userId, role: rawRole.toString() }

      try {
        await Promise.all([
          updateDoc(doc(db, 'profiles', userId), {
            role: normalized,
            updatedAt: serverTimestamp(),
          }),
          updateDoc(doc(db, 'users', userId), {
            role: normalized,
            updatedAt: serverTimestamp(),
          }),
        ])
        console.log('🟣 [Auth] Normalized stored role value', { userId, from: rawRole, to: normalized })
      } catch (error) {
        console.warn('🟠 [Auth] Unable to normalize stored role value', {
          userId,
          message: (error as Error)?.message,
          stack: (error as Error)?.stack,
          raw: error,
        })
      }
    },
    []
  )

  const areProfilesEquivalent = (previous: UserProfile | null, next: UserProfile | null) => {
    if (previous === next) return true
    if (!previous || !next) return false
    return (
      previous.id === next.id &&
      previous.role === next.role &&
      normalizeRole(previous.role) === normalizeRole(next.role) &&
      previous.membershipStatus === next.membershipStatus &&
      previous.accountStatus === next.accountStatus &&
      previous.transformationTier === next.transformationTier &&
      previous.companyId === next.companyId &&
      previous.organizationId === next.organizationId &&
      previous.companyCode === next.companyCode &&
      previous.companyName === next.companyName &&
      previous.villageId === next.villageId &&
      previous.corporateVillageId === next.corporateVillageId &&
      previous.clusterId === next.clusterId &&
      previous.email === next.email &&
      previous.firstName === next.firstName &&
      previous.lastName === next.lastName &&
      previous.fullName === next.fullName &&
      previous.journeyType === next.journeyType &&
      previous.avatarUrl === next.avatarUrl &&
      previous.photoURL === next.photoURL &&
      previous.emailVerified === next.emailVerified &&
      previous.totalPoints === next.totalPoints &&
      previous.level === next.level &&
      previous.onboardingComplete === next.onboardingComplete &&
      previous.onboardingSkipped === next.onboardingSkipped &&
      serializeAssignments(previous.assignedOrganizations) === serializeAssignments(next.assignedOrganizations)
    )
  }

  const updateProfileState = useCallback((nextProfile: UserProfile | null, reason: string) => {
    setProfile((prev) => {
      const shouldUpdateProfile = (() => {
        if (!prev && !nextProfile) return false
        if (!prev || !nextProfile) return true
        const prevNormalizedRole = normalizeRole(prev.role)
        const nextNormalizedRole = normalizeRole(nextProfile.role)
        return (
          prev.id !== nextProfile.id ||
          prev.role !== nextProfile.role ||
          prevNormalizedRole !== nextNormalizedRole ||
          !areProfilesEquivalent(prev, nextProfile)
        )
      })()

      if (!shouldUpdateProfile) {
        console.log('🟢 [Auth] Profile unchanged, skipping state update', { reason })
        return prev
      }
      console.log('🟢 [Auth] Profile updated', { reason, role: nextProfile?.role })
      return nextProfile
    })
  }, [])

  useEffect(() => {
    if (enableProfileRealtime) return
    console.warn(
      '[Auth] Real-time profile updates are disabled. Set VITE_ENABLE_PROFILE_REALTIME=true for live updates.'
    )
  }, [enableProfileRealtime])

  const attemptComplementaryCourseAssignment = useCallback(
    async (userId: string) => {
      const now = Date.now()
      const assignmentState = complementaryCourseAssignmentRef.current
      if (
        assignmentState.inFlight ||
        (assignmentState.lastUserId === userId && now - assignmentState.lastAttemptAt < 15000)
      ) {
        return
      }

      assignmentState.inFlight = true
      assignmentState.lastAttemptAt = now
      assignmentState.lastUserId = userId

      try {
        const alreadyAssigned = await hasComplementaryCourseAssigned(userId)
        if (alreadyAssigned) {
          console.log('🟡 [Auth] Complementary courses already assigned for user', { userId })
          return
        }

        const assigned = await assignComplementaryCoursesToUser(userId)
        if (assigned) {
          console.log('🟢 [Auth] Auto-assigned complementary courses for user', { userId })
        } else {
          console.log('🟠 [Auth] Complementary course assignment skipped', { userId })
        }
      } catch (error) {
        console.error('🔴 [Auth] Complementary course assignment failed', {
          userId,
          message: (error as Error)?.message,
          stack: (error as Error)?.stack,
          raw: error,
        })
      } finally {
        assignmentState.inFlight = false
      }
    },
    [assignComplementaryCoursesToUser, hasComplementaryCourseAssigned]
  )

  const extractCustomClaims = useCallback(async (firebaseUser: User) => {
    try {
      const tokenResult = await firebaseUser.getIdTokenResult()
      const rawRole =
        (tokenResult.claims?.role as string | undefined) ??
        (tokenResult.claims?.claimsRole as string | undefined) ??
        (tokenResult.claims?.customRole as string | undefined)
      if (rawRole) {
        console.log('🟣 [Auth] Custom claims role detected', rawRole)
        setClaimsRole(rawRole)
      } else {
        setClaimsRole(null)
      }
    } catch (error) {
      console.warn('🟠 [Auth] Unable to read custom claims', error)
      setClaimsRole(null)
    }
  }, [])

  const getNameParts = useCallback((displayName?: string | null, email?: string | null) => {
    const fallbackBase = email?.split('@')?.[0] || 'User'
    const cleanedName = displayName?.trim() || fallbackBase
    const parts = cleanedName.split(/\s+/).filter(Boolean)
    return {
      firstName: parts[0] || 'User',
      lastName: parts.slice(1).join(' '),
      fullName: cleanedName,
    }
  }, [])

  const fetchProfileOnce = useCallback(async (uid: string): Promise<UserProfile | null> => {
    try {
      console.log('🟣 [Auth] fetchProfileOnce:start', { uid })
      
      // First, try to fetch from users collection (primary source)
      const usersRef = doc(db, 'users', uid)
      const usersSnap = await getDoc(usersRef)
      if (usersSnap.exists()) {
        const { id: _ignoredId, ...profileData } = usersSnap.data() as UserProfile
        const rawProfile = {
          ...profileData,
          id: uid,
          journeyType: profileData.journeyType || '4W',
        } as UserProfile
        const rawRole = rawProfile.role ?? UserRole.USER
        const normalizedRole = normalizeRole(rawRole)
        rawProfile.role = normalizedRole as StandardRole
        console.log('🟣 [Auth] fetchProfileOnce: resolved profile from users collection', {
          id: rawProfile.id,
          role: rawProfile.role,
        })
        return rawProfile
      }
      
      console.warn('🟠 [Auth] fetchProfileOnce: no profile found in users collection, trying profiles collection...')
      
      // Fallback: try to fetch from profiles collection (legacy or sync source)
      const profilesRef = doc(db, 'profiles', uid)
      const profilesSnap = await getDoc(profilesRef)
      if (profilesSnap.exists()) {
        const { id: _ignoredId, ...profileData } = profilesSnap.data() as UserProfile
        const rawProfile = {
          ...profileData,
          id: uid,
          journeyType: profileData.journeyType || '4W',
        } as UserProfile
        const rawRole = rawProfile.role ?? UserRole.USER
        const normalizedRole = normalizeRole(rawRole)
        rawProfile.role = normalizedRole as StandardRole
        console.log('🟣 [Auth] fetchProfileOnce: resolved profile from profiles collection (fallback)', {
          id: rawProfile.id,
          role: rawProfile.role,
        })
        // Sync this profile back to users collection to prevent future fallbacks
        try {
          await setDoc(usersRef, rawProfile, { merge: true })
          console.log('🟣 [Auth] fetchProfileOnce: synced profile from profiles to users collection')
        } catch (syncError) {
          console.warn('🟠 [Auth] fetchProfileOnce: failed to sync profile to users collection', syncError)
        }
        return rawProfile
      }
      
      console.warn('🟠 [Auth] fetchProfileOnce: no profile found in either collection')
      return null
    } catch (error) {
      if (isOfflineError(error)) {
        console.warn('🟠 [Auth] fetchProfileOnce offline', { uid })
        throw buildOfflineError()
      }
      console.error('🔴 [Auth] fetchProfileOnce error', {
        uid,
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
        raw: error,
      })
      return null
    }
  }, [buildOfflineError, isOfflineError])

  const fetchProfileWithRetry = async (firebaseUser: User, attempts = 3): Promise<UserProfile | null> => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const offlineError = buildOfflineError()
      setProfileError(offlineError)
      return null
    }

    let lastError: Error | null = null
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const delayMs = Math.min(500 * 2 ** (attempt - 1), 3000)
      try {
        const resolved = await fetchOrCreateUserDoc(firebaseUser)
        if (resolved) {
          setProfileError(null)
          return resolved
        }
        const fallback = await fetchProfileOnce(firebaseUser.uid)
        if (fallback) {
          setProfileError(null)
          return fallback
        }
        lastError = new Error('Profile unavailable after fetch attempt.')
      } catch (error) {
        if (isOfflineError(error)) {
          lastError = buildOfflineError()
          break
        }
        lastError = error instanceof Error ? error : new Error('Profile fetch failed.')
      }

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    if (lastError) {
      setProfileError(lastError)
    }

    return null
  }

  /* ------------------------------------------------------------------ */
  /* 🔹 Fetch or Create User Doc                                         */
  /* ------------------------------------------------------------------ */
  const fetchOrCreateUserDoc = useCallback(async (
    firebaseUser: User
  ): Promise<UserProfile | null> => {
    try {
      console.log('🟣 [Auth] fetchOrCreateProfile:start', {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
      })

      const userDocRef = doc(db, 'users', firebaseUser.uid)
      const userDocSnap = await getDoc(userDocRef)

      console.log('🟣 [Auth] Firestore profile exists in users collection?', userDocSnap.exists())

      if (userDocSnap.exists()) {
        const { id: _ignoredId, ...storedUser } = userDocSnap.data() as UserProfile
        const baseUser: UserProfile = {
          ...storedUser,
          id: firebaseUser.uid,
          journeyType: storedUser.journeyType || '4W',
        }
        let mergedUser = baseUser

        console.log('🟣 [Auth] Raw profile loaded', {
          role: mergedUser.role,
          membershipStatus: mergedUser.membershipStatus,
          transformationTier: mergedUser.transformationTier,
        })

        // Optionally merge learner-facing extras from profiles/{uid}
        try {
          const profileExtrasSnap = await getDoc(doc(db, 'profiles', firebaseUser.uid))
          if (profileExtrasSnap.exists()) {
            const extras = profileExtrasSnap.data() as Partial<UserProfile>
            mergedUser = {
              ...baseUser,
              ...extras,
              id: firebaseUser.uid,
              journeyType: extras.journeyType || baseUser.journeyType || '4W',
            }

            // Keep users/{uid} aligned with admin-facing canonical fields (stored in profiles/{uid})
            // so role/membership/org info stays consistent across dashboards.
            try {
              const canonicalKeys = [
                'role',
                'membershipStatus',
                'transformationTier',
                'companyId',
                'companyCode',
                'companyName',
                'organizationId',
                'assignedOrganizations',
                'accountStatus',
              ] as const satisfies ReadonlyArray<keyof UserProfile>

              type CanonicalKey = typeof canonicalKeys[number]
              const payload: Partial<Record<CanonicalKey, UserProfile[CanonicalKey]>> = {}
              canonicalKeys.forEach((key) => {
                const nextValue = mergedUser[key]
                if (typeof nextValue !== 'undefined' && nextValue !== baseUser[key]) {
                  payload[key] = nextValue as UserProfile[CanonicalKey]
                }
              })

              if (Object.keys(payload).length) {
                await updateDoc(userDocRef, { ...payload, updatedAt: serverTimestamp() })
              }
            } catch (syncError) {
              console.warn('[Auth] Unable to sync canonical profile fields from profiles → users', syncError)
            }
            console.log('🟣 [Auth] Merged learner profile extras (user doc remains source of truth)')
          }
        } catch (extrasError) {
          console.warn('🟠 [Auth] Unable to merge learner profile extras', extrasError)
        }

        const rawRole = mergedUser.role ?? UserRole.USER
        const normalizedRole = normalizeRole(rawRole)
        console.log('🟣 [Auth] Normalized role:', { raw: rawRole, normalized: normalizedRole })
        mergedUser.role = normalizedRole as StandardRole

        const profileUpdates: Partial<UserProfile> = {}
        if (firebaseUser.photoURL && !mergedUser.avatarUrl) {
          profileUpdates.avatarUrl = firebaseUser.photoURL
          profileUpdates.photoURL = firebaseUser.photoURL
        }
        if (mergedUser.emailVerified !== true) {
          profileUpdates.emailVerified = true
        }

        if (Object.keys(profileUpdates).length > 0) {
          try {
            await updateDoc(userDocRef, {
              ...profileUpdates,
              updatedAt: serverTimestamp(),
            })
            mergedUser = { ...mergedUser, ...profileUpdates }
          } catch (updateError) {
            console.warn('🟠 [Auth] Unable to update profile extras from Google account', updateError)
          }
        }

        const pendingCompanyCode =
          typeof window !== 'undefined' ? localStorage.getItem(pendingCompanyCodeKey)?.trim() : null
        const normalizedPendingCompanyCode = pendingCompanyCode?.toUpperCase() || null

        if (normalizedPendingCompanyCode) {
          const previousCompanyId = mergedUser.companyId ?? null
          try {
            const validationResult = await validateCompanyCode(normalizedPendingCompanyCode)
            if (validationResult.valid && validationResult.organization) {
              const organization = validationResult.organization
              const normalizedCurrentRole = normalizeRole(mergedUser.role)
              const roleUpdates =
                normalizedCurrentRole === 'free_user' || normalizedCurrentRole === 'paid_member'
                  ? { role: 'user' as const }
                  : {}

              const nextAssignedOrganizations = Array.isArray(mergedUser.assignedOrganizations)
                ? Array.from(
                    new Set([
                      ...mergedUser.assignedOrganizations.filter(
                        (id): id is string => typeof id === 'string' && id.trim().length > 0,
                      ),
                      organization.id,
                    ]),
                  )
                : [organization.id]

              const nextDashboardPreferences = {
                ...(mergedUser.dashboardPreferences && typeof mergedUser.dashboardPreferences === 'object'
                  ? mergedUser.dashboardPreferences
                  : {}),
                lockedToFreeExperience: false,
              }

              const upgradeUpdates: Partial<UserProfile> = {
                membershipStatus: 'paid',
                companyId: organization.id,
                organizationId: organization.id,
                companyCode: organization.code,
                companyName: organization.name,
                transformationTier: TransformationTier.CORPORATE_MEMBER,
                assignedOrganizations: nextAssignedOrganizations,
                dashboardPreferences: nextDashboardPreferences,
                ...roleUpdates,
              }

              const profileDocRef = doc(db, 'profiles', firebaseUser.uid)
              await Promise.all([
                updateDoc(userDocRef, {
                  ...upgradeUpdates,
                  updatedAt: serverTimestamp(),
                }),
                setDoc(
                  profileDocRef,
                  {
                    ...upgradeUpdates,
                    updatedAt: serverTimestamp(),
                  },
                  { merge: true },
                ),
              ])

              mergedUser = {
                ...mergedUser,
                ...upgradeUpdates,
                updatedAt: new Date().toISOString(),
              }

              if (organization.id && organization.id !== previousCompanyId) {
                try {
                  await incrementOrganizationMemberCount(organization.id)
                } catch (incrementError) {
                  console.warn(
                    'ðŸŸ  [Auth] Unable to increment organization member count after company code apply',
                    incrementError,
                  )
                }
              }
            }
          } catch (validationError) {
            console.warn('ðŸŸ  [Auth] Unable to validate pending company code (existing profile)', validationError)
          } finally {
            if (typeof window !== 'undefined') {
              localStorage.removeItem(pendingCompanyCodeKey)
            }
          }
        }

        return mergedUser
      }

      /* -------- Check profiles collection as fallback -------- */
      console.log('🟠 [Auth] Profile not found in users collection, checking profiles collection...')
      try {
        const profileDocRef = doc(db, 'profiles', firebaseUser.uid)
        const profileDocSnap = await getDoc(profileDocRef)
        
        if (profileDocSnap.exists()) {
          console.log('🟡 [Auth] Profile found in profiles collection (fallback), syncing to users collection...')
          const { id: _ignoredId, ...storedProfile } = profileDocSnap.data() as UserProfile
          const baseProfile: UserProfile = {
            ...storedProfile,
            id: firebaseUser.uid,
            journeyType: storedProfile.journeyType || '4W',
          }
          
          // Sync to users collection for consistency
          try {
            await setDoc(userDocRef, baseProfile, { merge: true })
            console.log('🟣 [Auth] Profile synced from profiles to users collection')
          } catch (syncError) {
            console.warn('🟠 [Auth] Failed to sync profile to users collection, continuing anyway', syncError)
          }
          
          return baseProfile
        }
      } catch (fallbackError) {
        console.warn('🟠 [Auth] Failed to check profiles collection fallback', fallbackError)
      }

      /* -------- Create new profile if doesn't exist -------- */
      let validatedOrganization:
        | Awaited<ReturnType<typeof validateCompanyCode>>['organization']
        | null = null
      const pendingCompanyCode =
        typeof window !== 'undefined' ? localStorage.getItem(pendingCompanyCodeKey)?.trim() : null
      const normalizedPendingCompanyCode = pendingCompanyCode?.toUpperCase() || null

      if (normalizedPendingCompanyCode) {
        try {
          const validationResult = await validateCompanyCode(normalizedPendingCompanyCode)
          if (validationResult.valid && validationResult.organization) {
            validatedOrganization = validationResult.organization
          }
        } catch (validationError) {
          console.warn('🟠 [Auth] Unable to validate pending company code', validationError)
        } finally {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(pendingCompanyCodeKey)
          }
        }
      }

      const role = isBootstrapAdmin(firebaseUser.email) ? UserRole.SUPER_ADMIN : UserRole.USER
      const normalizedRole = normalizeRole(role || UserRole.USER)
      const { firstName, lastName, fullName } = getNameParts(
        firebaseUser.displayName,
        firebaseUser.email
      )
      let referralCode: string | null = null
      try {
        referralCode = await generateReferralCode(firebaseUser.uid)
      } catch (error) {
        console.warn('🟠 [Auth] Unable to generate referral code', error)
      }

      const resolvedJourneyType = resolveInitialJourneyType({
        isFreeTierUser: !validatedOrganization,
        organizationJourneyType: validatedOrganization?.journeyType ?? null,
      })
      const programDurationWeeks = JOURNEY_META[resolvedJourneyType].weeks
      const journeyStartDate = validatedOrganization?.cohortStartDate ?? null

      console.log('🟣 [Auth] Creating new profile with role:', role)

      const profileData: UserProfile = {
        id: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        firstName,
        lastName,
        fullName,
        role: normalizedRole,
        membershipStatus: validatedOrganization ? 'paid' : 'free',
        ...(firebaseUser.photoURL ? { avatarUrl: firebaseUser.photoURL } : {}),
        totalPoints: 0,
        level: 1,
        journeyType: resolvedJourneyType,
        programDurationWeeks,
        journeyStartDate,
        referralCount: 0,
        referralCode,
        referredBy: null,
        referralStatus: null,
        isOnboarded: true,
        emailVerified: true,
        accountStatus: AccountStatus.ACTIVE,
        transformationTier: validatedOrganization
          ? TransformationTier.CORPORATE_MEMBER
          : TransformationTier.INDIVIDUAL_FREE,
        assignedOrganizations: validatedOrganization?.id ? [validatedOrganization.id] : [],
        organizationId: validatedOrganization?.id ?? null,
        companyCode: validatedOrganization?.code ?? null,
        companyId: validatedOrganization?.id ?? null,
        companyName: validatedOrganization?.name ?? null,
        onboardingComplete: false,
        onboardingSkipped: false,
        mustChangePassword: false,
        hasSeenDashboardTour: false,
        dashboardPreferences: {
          defaultRoute: '/app/weekly-glance',
          lockedToFreeExperience: !validatedOrganization,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const profileRef = doc(db, 'profiles', firebaseUser.uid)

      await Promise.all([
        setDoc(userDocRef, {
          ...profileData,
          ...(firebaseUser.photoURL ? { avatarUrl: firebaseUser.photoURL } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        setDoc(
          profileRef,
          {
            ...profileData,
            ...(firebaseUser.photoURL ? { avatarUrl: firebaseUser.photoURL } : {}),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        ),
      ])

      if (validatedOrganization?.id) {
        try {
          await incrementOrganizationMemberCount(validatedOrganization.id)
        } catch (incrementError) {
          console.warn('🟠 [Auth] Unable to increment organization member count', incrementError)
        }
      }

      const pendingReferralCode =
        typeof window !== 'undefined' ? localStorage.getItem('pending_ref')?.trim() : null
      if (pendingReferralCode) {
        const referrerUid = await validateReferralCode(pendingReferralCode)
        if (referrerUid) {
          const { success, error } = await createReferral(
            firebaseUser.uid,
            referrerUid,
            pendingReferralCode
          )
          if (!success && error) {
            console.warn('🟠 [Auth] Unable to create referral for new user', error)
          }
        } else {
          console.warn('🟠 [Auth] Pending referral code is invalid or inactive', pendingReferralCode)
        }
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pending_ref')
        }
      }

      console.log('🟣 [Auth] Profile created successfully')

      return profileData
    } catch (error: unknown) {
      if (isOfflineError(error)) {
        console.warn('🟠 [Auth] fetchOrCreateProfile offline', { uid: firebaseUser.uid })
        throw buildOfflineError()
      }
      const message = error instanceof Error ? error.message : 'Unknown error'
      const code = error instanceof FirebaseError ? error.code : 'unknown'

      console.error('Error fetching/creating profile:', {
        message,
        code,
        uid: firebaseUser.uid,
      })

      if (error instanceof FirebaseError && error.code === 'permission-denied') {
        console.error(
          'Firestore Security Rules Permission Denied:',
          'The rules blocked the request to fetch the user profile.',
          'Please ensure the rules allow users to read their own profile.',
          'Full error:',
          error
        )
      } else {
        console.error(
          'An unexpected error occurred during profile fetch/create:',
          error
        )
      }
      return null
    }
  }, [buildOfflineError, getNameParts, isOfflineError, pendingCompanyCodeKey])

  const refreshAdminSession = async () => {
    if (!user) return
    console.log('🟡 [Auth] Forcing token refresh...')
    await user.getIdToken(true)
    await extractCustomClaims(user)
  }

  /* ------------------------------------------------------------------ */
  /* 🔹 Auth State Listener                                              */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    console.log('🟠 [Auth] Setting up onAuthStateChanged')

    let unsubscribeProfile: (() => void) | null = null
    let unsubscribeProfileExtras: (() => void) | null = null
    let isActive = true

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('🟠 [Auth] Auth state changed', currentUser?.email)

      if (unsubscribeProfile) {
        unsubscribeProfile()
        unsubscribeProfile = null
      }
      if (unsubscribeProfileExtras) {
        unsubscribeProfileExtras()
        unsubscribeProfileExtras = null
      }

      setLoading(true)
      setUser(currentUser)
      setProfileStatus('loading')

      if (!currentUser) {
        console.log('🟠 [Auth] No user → clearing state')
        setProfile(null)
        setClaimsRole(null)
        setProfileError(null)
        setLoading(false)
        setProfileLoading(false)
        setProfileStatus('ready')
        return
      }

      setProfileLoading(true)

      await extractCustomClaims(currentUser)

      const userProfile = await fetchProfileWithRetry(currentUser)

      if (isActive) {
        const ensuredProfile = userProfile
          ? { ...userProfile, assignedOrganizations: userProfile.assignedOrganizations ?? [] }
          : null
        console.log('🟢 [Auth] Profile resolved', {
          role: ensuredProfile?.role,
          normalized: ensuredProfile?.role,
        })

        updateProfileState(ensuredProfile, 'auth-state-change')
        recordProfileLoad(ensuredProfile)
        if (ensuredProfile) {
          void maybeNormalizeStoredRole(ensuredProfile, currentUser.uid)
          void attemptComplementaryCourseAssignment(currentUser.uid)
        }
        setProfileLoading(false)
        setLoading(false)
        setProfileStatus('ready')
      }

      if (!userProfile || !isActive) return

      if (!enableProfileRealtime) {
        console.log('🟠 [Auth] Realtime profile updates disabled')
        return
      }

      /* -------- realtime updates (optional) -------- */
      const userProfileDocRef = doc(db, 'users', currentUser.uid)
      unsubscribeProfile = onSnapshot(
        userProfileDocRef,
        (snap) => {
          if (!snap.exists()) return
          const { id: _ignoredId, ...updatedData } = snap.data() as UserProfile
          const rawRole = updatedData.role ?? UserRole.USER
          const normalizedRole = normalizeRole(rawRole)
          const updatedProfile: UserProfile = {
            ...updatedData,
            id: snap.id,
            journeyType: updatedData.journeyType || '4W',
            role: normalizedRole as StandardRole,
            assignedOrganizations: updatedData.assignedOrganizations ?? [],
          }
          console.log('🔁 [Auth] Profile updated via snapshot', updatedProfile.role)
          updateProfileState(updatedProfile, 'realtime-snapshot')
          recordProfileLoad(updatedProfile)
          void maybeNormalizeStoredRole(updatedProfile, currentUser.uid)
          void attemptComplementaryCourseAssignment(currentUser.uid)
          setProfileStatus('ready')
        },
        (error) => {
          console.error('🔴 [Auth] Realtime profile listener error', error)
        }
      )

      // Also listen to profiles/{uid} so role/membership/org changes written there are reflected
      // immediately in the signed-in user experience (users/{uid} is still used elsewhere).
      const profileExtrasDocRef = doc(db, 'profiles', currentUser.uid)
      unsubscribeProfileExtras = onSnapshot(
        profileExtrasDocRef,
        (snap) => {
          if (!snap.exists()) return
          const { id: _ignoredId, ...updatedData } = snap.data() as UserProfile

          const base = profileRef.current
          const merged: UserProfile = {
            ...(base || {}),
            ...updatedData,
            id: snap.id,
            journeyType: updatedData.journeyType || base?.journeyType || '4W',
            assignedOrganizations: updatedData.assignedOrganizations ?? base?.assignedOrganizations ?? [],
          }

          const rawRole = merged.role ?? UserRole.USER
          merged.role = normalizeRole(rawRole) as StandardRole

          updateProfileState(merged, 'realtime-snapshot:profiles')
          recordProfileLoad(merged)
          void maybeNormalizeStoredRole(merged, currentUser.uid)
          void attemptComplementaryCourseAssignment(currentUser.uid)
          setProfileStatus('ready')
        },
        (error) => {
          console.error('[Auth] Realtime profiles listener error', error)
        },
      )

      return unsubscribeProfile
    })

    return () => {
      isActive = false
      if (unsubscribeProfile) {
        unsubscribeProfile()
      }
      if (unsubscribeProfileExtras) {
        unsubscribeProfileExtras()
      }
      unsubscribe()
    }
  }, [
    attemptComplementaryCourseAssignment,
    enableProfileRealtime,
    extractCustomClaims,
    maybeNormalizeStoredRole,
    recordProfileLoad,
    updateProfileState,
// Note: `auth` is intentionally excluded - it's a stable Firebase instance
  ])

  /* ------------------------------------------------------------------ */
  /* 🔹 Auth Actions                                                     */
  /* ------------------------------------------------------------------ */
  const ensureFirebaseConfigured = () => {
    if (firebaseConfigStatus.isValid) return null

    const missingKeysList = firebaseConfigStatus.missingKeys.join(', ')
    return new Error(
      `Authentication is not available because required Firebase environment variables are missing: ${missingKeysList}.`
    )
  }

  const signIn = async (email: string, password: string) => {
    console.log('🟡 [Auth] signIn:start', email)
    setLoading(true)
    setProfileLoading(true)

    const configError = ensureFirebaseConfigured()
    if (configError) {
      console.error('🔴 [Auth] signIn blocked due to missing Firebase config', {
        missingKeys: firebaseConfigStatus.missingKeys,
      })
      setLoading(false)
      setProfileLoading(false)
      return { error: configError }
    }

    try {
      await signInWithEmailAndPassword(auth, email, password)
      console.log('🟢 [Auth] signIn success')
      return { error: null }
    } catch (error) {
      console.error('🔴 [Auth] signIn failed', error)
      const friendlyMessage = getFriendlyErrorMessage(error)
      const normalizedError =
        error instanceof Error && error.message === friendlyMessage
          ? error
          : new Error(friendlyMessage)
      setLoading(false)
      setProfileLoading(false)
      return { error: normalizedError }
    }
  }

  const signInWithMagicLink = async (email: string) => {
    console.log('🟡 [Auth] signInWithMagicLink requested', email)
    return { error: new Error('Magic link sign-in is currently disabled') }
  }

  const signInWithGoogle = async () => {
    console.log('🟡 [Auth] signInWithGoogle:start')
    setLoading(true)
    setProfileLoading(true)

    const configError = ensureFirebaseConfigured()
    if (configError) {
      console.error('🔴 [Auth] signInWithGoogle blocked due to missing Firebase config', {
        missingKeys: firebaseConfigStatus.missingKeys,
      })
      setLoading(false)
      setProfileLoading(false)
      return { error: configError }
    }

    const provider = new GoogleAuthProvider()
    provider.addScope('email')
    provider.addScope('profile')

    try {
      const credential = await signInWithPopup(auth, provider)
      const additionalInfo = getAdditionalUserInfo(credential)
      console.log('🟢 [Auth] signInWithGoogle success', {
        uid: credential.user.uid,
        isNewUser: additionalInfo?.isNewUser,
      })
      return { error: null, isNewUser: additionalInfo?.isNewUser }
    } catch (error) {
      console.error('🔴 [Auth] signInWithGoogle failed', error)

      // Handle account exists with different credential - offer to link accounts
      if (error instanceof FirebaseError && error.code === 'auth/account-exists-with-different-credential') {
        console.warn('🟠 [Auth] Account exists with different credential. Prompting for account linking.')
        const credential = GoogleAuthProvider.credentialFromError(error)
        const email = (error as FirebaseError & { customData?: { email?: string } }).customData?.email

        if (credential && email) {
          setPendingLinkCredential(credential)
          setPendingLinkEmail(email)
          setShowAccountLinkingModal(true)
          setLoading(false)
          setProfileLoading(false)
          // Return a specific error that indicates linking is needed
          return { error: new Error('Account linking required. Please enter your password to link your Google account.') }
        }
      }

      if (error instanceof FirebaseError && error.code === 'auth/popup-blocked') {
        console.warn('🟠 [Auth] Popup blocked. Falling back to redirect sign-in.')
        try {
          await signInWithRedirect(auth, provider)
          return { error: null, redirect: true }
        } catch (redirectError) {
          console.error('🔴 [Auth] signInWithRedirect failed', redirectError)
          const friendlyMessage = getFriendlyErrorMessage(redirectError)
          const normalizedError =
            redirectError instanceof Error && redirectError.message === friendlyMessage
              ? redirectError
              : new Error(friendlyMessage)
          setLoading(false)
          setProfileLoading(false)
          return { error: normalizedError }
        }
      }

      const friendlyMessage = getFriendlyErrorMessage(error)
      const normalizedError =
        error instanceof Error && error.message === friendlyMessage
          ? error
          : new Error(friendlyMessage)
      setLoading(false)
      setProfileLoading(false)
      return { error: normalizedError }
    }
  }

  const signUp = async (
    email: string,
    password: string,
    userData: Partial<UserProfile> & {
      gender?: string
      companyCode?: string
      companyId?: string
      companyName?: string
    },
    referralCode?: string
  ) => {
    console.log('🟡 [Auth] signUp:start', email)
    setLoading(true)
    setProfileLoading(true)

    const configError = ensureFirebaseConfigured()
    if (configError) {
      console.error('🔴 [Auth] signUp blocked due to missing Firebase config', {
        missingKeys: firebaseConfigStatus.missingKeys,
      })
      setLoading(false)
      setProfileLoading(false)
      return { error: configError, userId: undefined }
    }

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedCompanyCode = userData.companyCode?.trim().toUpperCase()
    const normalizedFullName = userData.fullName?.trim() || ''
    const shouldTrackPendingCompanyCode = Boolean(normalizedCompanyCode)

    if (!normalizedFullName) {
      setLoading(false)
      setProfileLoading(false)
      return {
        error: new Error('Full name is required.'),
        userId: undefined,
      }
    }

    let validatedOrganization:
      | Awaited<ReturnType<typeof validateCompanyCode>>['organization']
      | null = null

    if (normalizedCompanyCode) {
      try {
        const validationResult = await validateCompanyCode(normalizedCompanyCode)
        if (!validationResult.valid || !validationResult.organization) {
          setLoading(false)
          setProfileLoading(false)
          return {
            error: new Error(validationResult.error || 'Company code is invalid or inactive.'),
            userId: undefined,
          }
        }
        validatedOrganization = validationResult.organization
      } catch (validationError) {
        const friendlyMessage = getFriendlyErrorMessage(validationError)
        setLoading(false)
        setProfileLoading(false)
        return {
          error: new Error(friendlyMessage),
          userId: undefined,
        }
      }
    }

    try {
      if (shouldTrackPendingCompanyCode && typeof window !== 'undefined') {
        localStorage.setItem(pendingCompanyCodeKey, normalizedCompanyCode as string)
      }
      const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
      const firebaseUser = credential.user
      const uid = firebaseUser.uid
      const { firstName, lastName } = getNameParts(normalizedFullName, normalizedEmail)

      try {
        await updateFirebaseProfile(firebaseUser, { displayName: normalizedFullName })
      } catch (displayNameError) {
        console.warn('🟠 [Auth] Unable to set auth displayName during signup', displayNameError)
      }

      const role = isBootstrapAdmin(firebaseUser.email) ? UserRole.SUPER_ADMIN : UserRole.USER
      const normalizedRole = normalizeRole(role || UserRole.USER)
      let generatedReferralCode: string | null = null
      try {
        generatedReferralCode = await generateReferralCode(uid)
      } catch (error) {
        console.warn('🟠 [Auth] Unable to generate referral code during signup', error)
      }

      const resolvedJourneyType = resolveInitialJourneyType({
        isFreeTierUser: !validatedOrganization,
        organizationJourneyType: validatedOrganization?.journeyType ?? null,
      })
      const programDurationWeeks = JOURNEY_META[resolvedJourneyType].weeks
      const journeyStartDate = validatedOrganization?.cohortStartDate ?? null

      const profileData: UserProfile = {
        id: uid,
        email: normalizedEmail,
        firstName,
        lastName,
        fullName: normalizedFullName,
        role: normalizedRole,
        membershipStatus: validatedOrganization ? 'paid' : 'free',
        totalPoints: 0,
        level: 1,
        journeyType: resolvedJourneyType,
        programDurationWeeks,
        journeyStartDate,
        referralCount: 0,
        referralCode: generatedReferralCode,
        referredBy: null,
        referralStatus: null,
        isOnboarded: true,
        emailVerified: true,
        accountStatus: AccountStatus.ACTIVE,
        transformationTier: validatedOrganization
          ? TransformationTier.CORPORATE_MEMBER
          : TransformationTier.INDIVIDUAL_FREE,
        assignedOrganizations: validatedOrganization?.id ? [validatedOrganization.id] : [],
        organizationId: validatedOrganization?.id ?? null,
        onboardingComplete: false,
        onboardingSkipped: false,
        mustChangePassword: false,
        hasSeenDashboardTour: false,
        dashboardPreferences: {
          defaultRoute: '/app/weekly-glance',
          lockedToFreeExperience: validatedOrganization
            ? false
            : true,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const profilePayload: UserProfile & {
        gender?: string
        companyId?: string | null
        organizationId?: string | null
        companyCode?: string | null
        companyName?: string | null
      } = {
        ...profileData,
        ...(validatedOrganization?.id ? { companyId: validatedOrganization.id } : {}),
        ...(validatedOrganization?.id ? { organizationId: validatedOrganization.id } : {}),
        ...(validatedOrganization?.code ? { companyCode: validatedOrganization.code } : {}),
        ...(validatedOrganization?.name ? { companyName: validatedOrganization.name } : {}),
        ...(userData.gender ? { gender: userData.gender } : {}),
      }

      try {
        // Write to both users and profiles collections for consistency
        // Users collection is primary, profiles is used by admin dashboards
        await Promise.all([
          setDoc(doc(db, 'users', uid), {
            ...profilePayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
          setDoc(
            doc(db, 'profiles', uid),
            {
              ...profilePayload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          ),
        ])
      } catch (profileError) {
        await deleteUser(firebaseUser).catch((cleanupError) => {
          console.error('🔴 [Auth] Failed to cleanup auth user after profile error', cleanupError)
        })
        throw profileError
      }

      if (validatedOrganization?.id) {
        try {
          await incrementOrganizationMemberCount(validatedOrganization.id)
        } catch (incrementError) {
          console.warn('🟠 [Auth] Unable to increment organization member count', incrementError)
        }
      }

      if (referralCode) {
        const trimmedReferralCode = referralCode.trim()
        if (trimmedReferralCode) {
          const referrerUid = await validateReferralCode(trimmedReferralCode)
          if (!referrerUid) {
            console.warn('🟠 [Auth] Referral code invalid or inactive during signup', trimmedReferralCode)
          } else {
            const { success, error } = await createReferral(uid, referrerUid, trimmedReferralCode)
            if (!success && error) {
              console.warn('🟠 [Auth] Unable to create referral during signup', error)
            }
          }
        }
      }

      // Auto-assign complementary courses so every member can track progress.
      try {
        const assigned = await assignComplementaryCoursesToUser(uid)
        if (assigned) {
          console.log('🟢 [Auth] Assigned complementary courses after signup', { uid })
        } else {
          console.log('🟠 [Auth] Complementary course assignment skipped after signup', { uid })
        }
      } catch (assignmentError) {
        console.error('🔴 [Auth] Unable to assign complementary courses after signup', {
          uid,
          message: (assignmentError as Error)?.message,
          stack: (assignmentError as Error)?.stack,
          raw: assignmentError,
        })
      }

      console.log('🟢 [Auth] signUp success', { uid })
      setLoading(false)
      setProfileLoading(false)
      if (shouldTrackPendingCompanyCode && typeof window !== 'undefined') {
        localStorage.removeItem(pendingCompanyCodeKey)
      }
      return { error: null, userId: uid }
    } catch (error) {
      console.error('🔴 [Auth] signUp failed', error)
      const friendlyMessage = getFriendlyErrorMessage(error)
      const normalizedError =
        error instanceof Error && error.message === friendlyMessage
          ? error
          : new Error(friendlyMessage)
      setLoading(false)
      setProfileLoading(false)
      if (shouldTrackPendingCompanyCode && typeof window !== 'undefined') {
        localStorage.removeItem(pendingCompanyCodeKey)
      }
      return { error: normalizedError, userId: undefined }
    }
  }

  const signOut = async () => {
    const timestamp = new Date().toISOString()
    if (signingOut) {
      console.warn(`[${timestamp}] 🟡 [Auth] signOut: already in progress (guard triggered)`)
      return { error: new Error('Sign out already in progress') }
    }

    setSigningOut(true)
    console.log(`[${timestamp}] 🟡 [Auth] signOut:start`, { uid: user?.uid, email: user?.email })

    const timeoutId = setTimeout(() => {
      const timeoutTs = new Date().toISOString()
      console.warn(`[${timeoutTs}] 🟠 [Auth] signOut: timeout fallback (5s) triggered. Forcing navigation.`)
      window.location.href = '/login'
    }, 5000)

    try {
      // Logic to preserve preferences if needed before clearing state
      if (profile?.companyCode) {
        console.log(`[${new Date().toISOString()}] 🟣 [Auth] Preserving companyCode in localStorage`, profile.companyCode)
        localStorage.setItem('t4l.lastSelectedOrg', profile.companyCode)
      }

      if (profile?.dashboardPreferences) {
        console.log(`[${new Date().toISOString()}] 🟣 [Auth] Preserving dashboardPreferences in localStorage`)
        localStorage.setItem('t4l.dashboardPreferences', JSON.stringify(profile.dashboardPreferences))
      }

      console.log(`[${new Date().toISOString()}] 🟡 [Auth] Calling Firebase signOut...`)
      await firebaseSignOut(auth)

      console.log(`[${new Date().toISOString()}] 🟢 [Auth] Firebase signOut success`)

      setUser(null)
      setProfile(null)
      setClaimsRole(null)

      console.log(`[${new Date().toISOString()}] 🚀 [Auth] Redirecting to /login via window.location.href (current: ${window.location.pathname})`)

      // Clear timeout before navigation
      clearTimeout(timeoutId)

      window.location.href = '/login'
      return { error: null }
    } catch (error) {
      const errorTs = new Date().toISOString()
      console.error(`[${errorTs}] 🔴 [Auth] signOut failed`, error)

      // Clear timeout on error too
      clearTimeout(timeoutId)

      // Navigate anyway on failure to ensure user isn't stuck
      console.log(`[${errorTs}] 🚀 [Auth] Fallback redirecting to /login after error`)
      window.location.href = '/login'
      return { error: error instanceof Error ? error : new Error('Sign out failed') }
    } finally {
      // We don't strictly need to setSigningOut(false) if the page is redirecting,
      // but it's good practice for any components that might stay mounted
      setSigningOut(false)
    }
  }

  const resetPassword = async (email: string) => {
    const configError = ensureFirebaseConfigured()
    if (configError) {
      console.error('🔴 [Auth] resetPassword blocked due to missing Firebase config')
      return { error: configError }
    }

    try {
      await sendPasswordResetEmail(auth, email, buildActionCodeSettings('/reset-password'))
      return { error: null }
    } catch (error) {
      const friendlyMessage = getFriendlyErrorMessage(error)
      const normalizedError =
        error instanceof Error && error.message === friendlyMessage
          ? error
          : new Error(friendlyMessage)
      return { error: normalizedError }
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) {
      return { error: new Error('No authenticated user available to update') }
    }

    try {
      const sanitizedUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (typeof value !== 'undefined') {
          ;(acc as Record<string, unknown>)[key] = value
        }
        return acc
      }, {} as Partial<UserProfile>)

      await Promise.all([
        setDoc(doc(db, 'users', user.uid), {
          ...sanitizedUpdates,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
        setDoc(doc(db, 'profiles', user.uid), {
          ...sanitizedUpdates,
          updatedAt: serverTimestamp(),
        }, { merge: true }),
      ])
      setProfile((prev) => {
        if (!prev) return prev
        const merged = { ...prev, ...sanitizedUpdates }
        return areProfilesEquivalent(prev, merged) ? prev : merged
      })
      return { error: null }
    } catch (error) {
      console.error('🔴 [Auth] updateProfile failed', error)
      const friendlyMessage = getFriendlyErrorMessage(error)
      return { error: new Error(friendlyMessage) }
    }
  }
  const refreshProfile = useCallback(async (options?: { reason?: string; isManual?: boolean }) => {
    const currentUser = auth.currentUser
    const reason = options?.reason || 'manual'
    const isManual = options?.isManual ?? reason.includes('manual')
    const now = Date.now()
    const refreshState = refreshStateRef.current
    const maxRequests = isManual ? 10 : 6
    const windowMs = isManual ? 45000 : 30000
    const circuitBreakerMs = isManual ? 20000 : 30000
    const manualCooldownMs = 10000

    if (!currentUser) {
      const error = new Error('No authenticated user to refresh')
      console.error('🔴 [Auth] refreshProfile failed', { reason, error })
      setProfileError(error)
      return { error, profile: null as UserProfile | null }
    }

    if (refreshState.circuitBrokenUntil > now) {
      if (isManual) {
        const timeSinceManualAttempt = now - refreshState.lastManualAttemptAt
        if (timeSinceManualAttempt < manualCooldownMs) {
          const error = new Error('Please wait a few seconds before retrying your profile refresh.')
          console.warn('🟠 [Auth] refreshProfile manual retry blocked by cooldown', {
            reason,
            waitMs: manualCooldownMs - timeSinceManualAttempt,
          })
          setProfileError(error)
          setProfileLoading(false)
          return { error, profile: profileRef.current }
        }
        console.info('🟢 [Auth] refreshProfile manual retry resetting circuit breaker', { reason })
        refreshState.circuitBrokenUntil = 0
        refreshState.requestCount = 0
        refreshState.windowStart = now
      } else {
        const error = new Error('Profile refresh paused to prevent repeated attempts. Please wait and try again.')
        console.warn('🟠 [Auth] refreshProfile circuit breaker engaged', {
          reason,
          resumeAt: new Date(refreshState.circuitBrokenUntil).toISOString(),
        })
        setProfileError(error)
        setProfileLoading(false)
        return { error, profile: profileRef.current }
      }
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const offlineError = buildOfflineError()
      console.warn('🟠 [Auth] refreshProfile offline (preflight)', { reason })
      setProfileError(offlineError)
      setProfileLoading(false)
      return { error: offlineError, profile: null as UserProfile | null }
    }

    if (refreshState.inFlight) {
      console.warn('🟠 [Auth] refreshProfile skipped: request already in flight', { reason })
      return { error: null, profile: profileRef.current }
    }

    if (now - refreshState.lastRequestAt < 1500) {
      console.warn('🟠 [Auth] refreshProfile debounced', { reason })
      return { error: null, profile: profileRef.current }
    }

    if (now - refreshState.windowStart > windowMs) {
      refreshState.windowStart = now
      refreshState.requestCount = 0
    }
    refreshState.requestCount += 1
    console.info('🧭 [Auth] refreshProfile attempt recorded', {
      reason,
      requestCount: refreshState.requestCount,
      isManual,
    })
    if (refreshState.requestCount > maxRequests) {
      refreshState.circuitBrokenUntil = now + circuitBreakerMs
      console.warn('🔴 [Auth] refreshProfile loop detected, opening circuit breaker', {
        reason,
        requestCount: refreshState.requestCount,
      })
      const error = new Error('Too many profile refresh attempts. Please wait a moment and try again.')
      setProfileError(error)
      setProfileLoading(false)
      return { error, profile: profileRef.current }
    }

    refreshState.inFlight = true
    refreshState.lastRequestAt = now
    if (isManual) {
      refreshState.lastManualAttemptAt = now
    }
    console.log('🟡 [Auth] profile refresh requested', { uid: currentUser.uid, reason, isManual })

    try {
      setProfileError(null)
      setProfileLoading(true)
      const refreshedRaw = (await fetchProfileOnce(currentUser.uid)) ?? (await fetchOrCreateUserDoc(currentUser))
      const refreshed = refreshedRaw
        ? { ...refreshedRaw, assignedOrganizations: refreshedRaw.assignedOrganizations ?? [] }
        : null
      if (refreshed) {
        updateProfileState(refreshed, `manual-refresh:${reason}`)
        recordProfileLoad(refreshed)
        setProfileError(null)
      }
      setProfileLoading(false)
      return { error: null, profile: refreshed }
    } catch (error) {
      if (isOfflineError(error)) {
        const offlineError = buildOfflineError()
        console.warn('🟠 [Auth] refreshProfile offline', { reason })
        setProfileError(offlineError)
        setProfileLoading(false)
        return { error: offlineError, profile: null as UserProfile | null }
      }
      console.error('🔴 [Auth] refreshProfile error', { reason, error })
      setProfileError(error as Error)
      setProfileLoading(false)
      return { error: error as Error, profile: null as UserProfile | null }
    } finally {
      refreshState.inFlight = false
    }
  }, [buildOfflineError, fetchOrCreateUserDoc, fetchProfileOnce, isOfflineError, recordProfileLoad, updateProfileState])

  /* ------------------------------------------------------------------ */
  /* 🔹 Account Linking                                                  */
  /* ------------------------------------------------------------------ */
  const linkGoogleAccount = useCallback(async (password: string): Promise<{ error: Error | null }> => {
    if (!pendingLinkCredential || !pendingLinkEmail) {
      return { error: new Error('No pending account to link') }
    }

    console.log('🟡 [Auth] linkGoogleAccount:start', { email: pendingLinkEmail })
    setLoading(true)

    try {
      // First, sign in with email/password to get the existing user
      const emailCredential = await signInWithEmailAndPassword(auth, pendingLinkEmail, password)
      console.log('🟢 [Auth] Email sign-in successful, linking Google credential')

      // Link the Google credential to the existing account
      await linkWithCredential(emailCredential.user, pendingLinkCredential)
      console.log('🟢 [Auth] Account linking successful', { uid: emailCredential.user.uid })

      // Clear pending link state
      setPendingLinkCredential(null)
      setPendingLinkEmail(null)
      setShowAccountLinkingModal(false)
      setLoading(false)

      return { error: null }
    } catch (error) {
      console.error('🔴 [Auth] linkGoogleAccount failed', error)
      setLoading(false)

      const friendlyMessage = getFriendlyErrorMessage(error)
      return { error: new Error(friendlyMessage) }
    }
  }, [pendingLinkCredential, pendingLinkEmail])

  const dismissAccountLinking = useCallback(() => {
    setPendingLinkCredential(null)
    setPendingLinkEmail(null)
    setShowAccountLinkingModal(false)
  }, [])

  /* ------------------------------------------------------------------ */
  /* 🔹 Role Flags (LOGGED)                                              */
  /* ------------------------------------------------------------------ */
  const { role: effectiveRole, source: effectiveRoleSource } = resolveEffectiveRole({
    claimsRole,
    profileRole: profile?.role,
    fallback: 'user',
  })
  const { organizationId: effectiveOrganizationId } = resolveEffectiveOrganization(profile)

  const isAdmin = effectiveRole === 'partner' || effectiveRole === 'super_admin'
  const isSuperAdmin = effectiveRole === 'super_admin'
  const isMentor = effectiveRole === 'mentor'
  const isAmbassador = effectiveRole === 'ambassador'
  const isPaid =
    ['partner', 'mentor', 'ambassador', 'super_admin'].includes(
      effectiveRole ?? ''
    ) ||
    effectiveRole === 'paid_member' ||
    (effectiveRole === 'user' && profile?.membershipStatus === 'paid')

  /* ------------------------------------------------------------------ */
  const value: AuthContextType = {
    user,
    profile,
    userData: profile,
    loading,
    profileLoading,
    profileStatus,
    profileError,
    signingOut,
    lastProfileLoadAt: lastProfileLoadAtRef.current,
    signIn,
    signUp,
    signOut,
    signInWithMagicLink,
    signInWithGoogle,
    resetPassword,
    updateProfile,
    hasRole: (r: StandardRole) => effectiveRole === r,
    hasAnyRole: (roles: StandardRole[]) => roles.includes(effectiveRole),
    isAdmin,
    isSuperAdmin,
    isMentor,
    isAmbassador,
    isPaid,
    isCorporateMember:
      profile?.transformationTier?.toLowerCase().includes('corporate') ?? false,
    assignedOrganizations: profile?.assignedOrganizations ?? [],
    hasFullOrganizationAccess: effectiveRole === 'super_admin',
    canAccessOrganization: async (organizationId: string) => {
      if (!organizationId || !user?.uid) return false
      return canAccessOrganization({
        role: effectiveRole,
        userId: user.uid,
        organizationId,
      })
    },
    updateDashboardPreferences: async () => ({ error: null }),
    claimsRole,
    effectiveRole,
    effectiveRoleSource,
    effectiveOrganizationId,
    refreshAdminSession,
    refreshProfile,
    // Account Linking
    pendingLinkEmail,
    showAccountLinkingModal,
    linkGoogleAccount,
    dismissAccountLinking,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
