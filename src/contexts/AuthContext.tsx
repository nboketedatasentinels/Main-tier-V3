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
  sendEmailVerification,
  deleteUser,
  signInWithRedirect,
  getAdditionalUserInfo,
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
import { assignFreeCourseToUser, hasFreeCourseAssigned } from '@/services/courseAssignmentService'
import { isFreeUser } from '@/utils/membership'
import { createReferral, generateReferralCode, validateReferralCode } from '@/services/referralService'

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
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
  const enableProfileRealtime = import.meta.env.VITE_ENABLE_PROFILE_REALTIME === 'true'
  const freeCourseAssignmentRef = useRef({ inFlight: false, lastAttemptAt: 0, lastUserId: '' })
  const refreshStateRef = useRef({
    inFlight: false,
    lastRequestAt: 0,
    windowStart: 0,
    requestCount: 0,
    circuitBrokenUntil: 0,
  })
  const pendingCompanyCodeKey = 't4l.pendingCompanyCode'

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

  const areProfilesEquivalent = (previous: UserProfile | null, next: UserProfile | null) => {
    if (previous === next) return true
    if (!previous || !next) return false
    return (
      previous.id === next.id &&
      previous.role === next.role &&
      previous.membershipStatus === next.membershipStatus &&
      previous.accountStatus === next.accountStatus &&
      previous.transformationTier === next.transformationTier &&
      previous.companyId === next.companyId &&
      previous.companyCode === next.companyCode &&
      previous.companyName === next.companyName &&
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
      if (areProfilesEquivalent(prev, nextProfile)) {
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

  const attemptFreeCourseAssignment = useCallback(
    async (userId: string, loadedProfile: UserProfile) => {
      const isFreeTier = isFreeUser(loadedProfile)
      if (!isFreeTier) return

      const now = Date.now()
      const assignmentState = freeCourseAssignmentRef.current
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
        const alreadyAssigned = await hasFreeCourseAssigned(userId)
        if (alreadyAssigned) {
          console.log('🟡 [Auth] Free course already assigned for user', { userId })
          return
        }

        const assigned = await assignFreeCourseToUser(userId)
        if (assigned) {
          console.log('🟢 [Auth] Auto-assigned free course for user', { userId })
        } else {
          console.log('🟠 [Auth] Free course assignment skipped', { userId })
        }
      } catch (error) {
        console.error('🔴 [Auth] Free course assignment failed', {
          userId,
          message: (error as Error)?.message,
          stack: (error as Error)?.stack,
          raw: error,
        })
      } finally {
        assignmentState.inFlight = false
      }
    },
    [assignFreeCourseToUser, hasFreeCourseAssigned]
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
      const profileRef = doc(db, 'users', uid)
      const profileSnap = await getDoc(profileRef)
      if (!profileSnap.exists()) {
        console.warn('🟠 [Auth] fetchProfileOnce: no profile found')
        return null
      }
      const { id: _ignoredId, ...profileData } = profileSnap.data() as UserProfile
      const rawProfile = {
        ...profileData,
        id: uid,
        journeyType: profileData.journeyType || '4W',
      } as UserProfile
      const normalizedRole = normalizeRole(rawProfile.role)
      if (normalizedRole) {
        rawProfile.role = normalizedRole as StandardRole
      }
      console.log('🟣 [Auth] fetchProfileOnce: resolved profile', {
        id: rawProfile.id,
        role: rawProfile.role,
      })
      return rawProfile
    } catch (error) {
      console.error('🔴 [Auth] fetchProfileOnce error', {
        uid,
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
        raw: error,
      })
      return null
    }
  }, [])

  const fetchProfileWithRetry = async (firebaseUser: User, attempts = 3): Promise<UserProfile | null> => {
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

      console.log('🟣 [Auth] Firestore profile exists?', userDocSnap.exists())

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
              role: baseUser.role,
              id: firebaseUser.uid,
              journeyType: extras.journeyType || baseUser.journeyType || '4W',
            }
            console.log('🟣 [Auth] Merged learner profile extras (user doc remains source of truth)')
          }
        } catch (extrasError) {
          console.warn('🟠 [Auth] Unable to merge learner profile extras', extrasError)
        }

        const normalized = normalizeRole(mergedUser.role)
        console.log('🟣 [Auth] Normalized role:', normalized)

        if (normalized) {
          mergedUser.role = normalized as StandardRole
        } else {
          console.warn('🟠 [Auth] Invalid role detected:', mergedUser.role)
        }

        const profileUpdates: Partial<UserProfile> = {}
        if (firebaseUser.photoURL && !mergedUser.avatarUrl) {
          profileUpdates.avatarUrl = firebaseUser.photoURL
          profileUpdates.photoURL = firebaseUser.photoURL
        }
        if (firebaseUser.emailVerified && !mergedUser.emailVerified) {
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

        return mergedUser
      }

      /* ---------------- Create profile ---------------- */
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

      const role = isBootstrapAdmin(firebaseUser.email)
        ? UserRole.SUPER_ADMIN
        : validatedOrganization
          ? UserRole.PAID_MEMBER
          : UserRole.FREE_USER
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

      console.log('🟣 [Auth] Creating new profile with role:', role)

      const profileData: UserProfile = {
        id: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        firstName,
        lastName,
        fullName,
        role,
        membershipStatus: validatedOrganization ? 'paid' : 'free',
        ...(firebaseUser.photoURL ? { avatarUrl: firebaseUser.photoURL } : {}),
        totalPoints: 0,
        level: 1,
        journeyType: '4W',
        referralCount: 0,
        referralCode,
        referredBy: null,
        referralStatus: null,
        isOnboarded: true,
        accountStatus: AccountStatus.ACTIVE,
        transformationTier: validatedOrganization
          ? TransformationTier.CORPORATE_MEMBER
          : TransformationTier.INDIVIDUAL_FREE,
        assignedOrganizations: [],
        companyCode: validatedOrganization?.code ?? null,
        companyId: validatedOrganization?.id ?? null,
        companyName: validatedOrganization?.name ?? null,
        onboardingComplete: false,
        onboardingSkipped: false,
        mustChangePassword: false,
        hasSeenDashboardTour: false,
        dashboardPreferences: {
          defaultRoute: '/app/weekly-glance',
          lockedToFreeExperience: validatedOrganization
            ? false
            : ['user', 'free_user'].includes(normalizeRole(role)),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await setDoc(userDocRef, {
        ...profileData,
        ...(firebaseUser.photoURL ? { avatarUrl: firebaseUser.photoURL } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

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
  }, [getNameParts, pendingCompanyCodeKey])

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
    let isActive = true

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('🟠 [Auth] Auth state changed', currentUser?.email)

      if (unsubscribeProfile) {
        unsubscribeProfile()
        unsubscribeProfile = null
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

      let userProfile = await fetchProfileWithRetry(currentUser)

      if (!userProfile?.role) {
        console.warn('🟠 [Auth] Profile loaded without role, applying fallback role:user')
        userProfile = userProfile
          ? { ...userProfile, role: (normalizeRole(userProfile.role) as StandardRole) || UserRole.USER }
          : null
      }

      if (isActive) {
        const ensuredProfile = userProfile
          ? { ...userProfile, assignedOrganizations: userProfile.assignedOrganizations ?? [] }
          : null
        console.log('🟢 [Auth] Profile resolved', {
          role: ensuredProfile?.role,
          normalized: normalizeRole(ensuredProfile?.role),
        })

        updateProfileState(ensuredProfile, 'auth-state-change')
        recordProfileLoad(ensuredProfile)
        if (ensuredProfile) {
          void attemptFreeCourseAssignment(currentUser.uid, ensuredProfile)
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
      const profileRef = doc(db, 'users', currentUser.uid)
      unsubscribeProfile = onSnapshot(
        profileRef,
        (snap) => {
          if (!snap.exists()) return
          const { id: _ignoredId, ...updatedData } = snap.data() as UserProfile
          const updatedProfile: UserProfile = {
            ...updatedData,
            id: snap.id,
            journeyType: updatedData.journeyType || '4W',
            role: (normalizeRole(updatedData.role) as StandardRole) ?? updatedData.role,
            assignedOrganizations: updatedData.assignedOrganizations ?? [],
          }
          console.log('🔁 [Auth] Profile updated via snapshot', updatedProfile.role)
          updateProfileState(updatedProfile, 'realtime-snapshot')
          recordProfileLoad(updatedProfile)
          void attemptFreeCourseAssignment(currentUser.uid, updatedProfile)
          setProfileStatus('ready')
        },
        (error) => {
          console.error('🔴 [Auth] Realtime profile listener error', error)
        }
      )

      return unsubscribeProfile
    })

    return () => {
      isActive = false
      if (unsubscribeProfile) {
        unsubscribeProfile()
      }
      unsubscribe()
    }
  }, [attemptFreeCourseAssignment, enableProfileRealtime, extractCustomClaims, recordProfileLoad, updateProfileState])

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
      const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
      const firebaseUser = credential.user
      const uid = firebaseUser.uid

      const role = isBootstrapAdmin(firebaseUser.email)
        ? UserRole.SUPER_ADMIN
        : validatedOrganization
          ? UserRole.PAID_MEMBER
          : UserRole.FREE_USER
      const normalizedRole = normalizeRole(role)
      let generatedReferralCode: string | null = null
      try {
        generatedReferralCode = await generateReferralCode(uid)
      } catch (error) {
        console.warn('🟠 [Auth] Unable to generate referral code during signup', error)
      }

      const profileData: UserProfile = {
        id: uid,
        email: normalizedEmail,
        firstName: userData.firstName?.trim() || firebaseUser.displayName?.split(' ')?.[0] || 'User',
        lastName: userData.lastName?.trim() || firebaseUser.displayName?.split(' ')?.slice(1).join(' ') || '',
        fullName:
          userData.fullName?.trim() ||
          firebaseUser.displayName ||
          userData.firstName?.trim() ||
          'User',
        role: normalizedRole,
        membershipStatus: validatedOrganization ? 'paid' : 'free',
        totalPoints: 0,
        level: 1,
        journeyType: '4W',
        referralCount: 0,
        referralCode: generatedReferralCode,
        referredBy: null,
        referralStatus: null,
        isOnboarded: true,
        accountStatus: AccountStatus.ACTIVE,
        transformationTier: validatedOrganization
          ? TransformationTier.CORPORATE_MEMBER
          : TransformationTier.INDIVIDUAL_FREE,
        assignedOrganizations: [],
        onboardingComplete: false,
        onboardingSkipped: false,
        mustChangePassword: false,
        hasSeenDashboardTour: false,
        dashboardPreferences: {
          defaultRoute: '/app/weekly-glance',
          lockedToFreeExperience: validatedOrganization
            ? false
            : normalizedRole === 'user' || normalizedRole === 'free_user',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const profilePayload: UserProfile & {
        gender?: string
        companyId?: string | null
        companyCode?: string | null
        companyName?: string | null
      } = {
        ...profileData,
        ...(validatedOrganization?.id ? { companyId: validatedOrganization.id } : {}),
        ...(validatedOrganization?.code ? { companyCode: validatedOrganization.code } : {}),
        ...(validatedOrganization?.name ? { companyName: validatedOrganization.name } : {}),
        ...(userData.gender ? { gender: userData.gender } : {}),
      }

      try {
        await setDoc(doc(db, 'users', uid), {
          ...profilePayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
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

      // Auto-assign the free course for eligible free-tier users.
      if (isFreeUser(profilePayload)) {
        try {
          const assigned = await assignFreeCourseToUser(uid)
          if (assigned) {
            console.log('🟢 [Auth] Assigned free course after signup', { uid })
          } else {
            console.log('🟠 [Auth] Free course assignment skipped after signup', { uid })
          }
        } catch (assignmentError) {
          console.error('🔴 [Auth] Unable to assign free course after signup', {
            uid,
            message: (assignmentError as Error)?.message,
            stack: (assignmentError as Error)?.stack,
            raw: assignmentError,
          })
        }
      }

      try {
        if (!firebaseUser.emailVerified) {
          await sendEmailVerification(firebaseUser, buildActionCodeSettings('/auth/verify-email'))
        }
      } catch (verificationError) {
        console.warn('🟠 [Auth] Unable to send verification email', verificationError)
        const friendlyMessage = getFriendlyErrorMessage(verificationError)
        setLoading(false)
        setProfileLoading(false)
        return {
          error: new Error(friendlyMessage),
          userId: uid,
        }
      }

      console.log('🟢 [Auth] signUp success', { uid })
      setLoading(false)
      setProfileLoading(false)
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
      return { error: normalizedError, userId: undefined }
    }
  }

  const signOut = async () => {
    console.log('🟡 [Auth] signOut')
    await firebaseSignOut(auth)
    setUser(null)
    setProfile(null)
    setClaimsRole(null)
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
      await updateDoc(doc(db, 'users', user.uid), {
        ...updates,
        updatedAt: serverTimestamp(),
      })
      setProfile((prev) => {
        if (!prev) return prev
        const merged = { ...prev, ...updates }
        return areProfilesEquivalent(prev, merged) ? prev : merged
      })
      return { error: null }
    } catch (error) {
      console.error('🔴 [Auth] updateProfile failed', error)
      const friendlyMessage = getFriendlyErrorMessage(error)
      return { error: new Error(friendlyMessage) }
    }
  }

  const refreshProfile = useCallback(async (options?: { reason?: string }) => {
    const currentUser = auth.currentUser
    const reason = options?.reason || 'manual'
    const now = Date.now()
    const refreshState = refreshStateRef.current

    if (!currentUser) {
      const error = new Error('No authenticated user to refresh')
      console.error('🔴 [Auth] refreshProfile failed', { reason, error })
      setProfileError(error)
      return { error, profile: null as UserProfile | null }
    }

    if (refreshState.circuitBrokenUntil > now) {
      console.warn('🟠 [Auth] refreshProfile circuit breaker engaged', {
        reason,
        resumeAt: new Date(refreshState.circuitBrokenUntil).toISOString(),
      })
      return { error: new Error('Profile refresh temporarily paused to prevent a loop.'), profile: profileRef.current }
    }

    if (refreshState.inFlight) {
      console.warn('🟠 [Auth] refreshProfile skipped: request already in flight', { reason })
      return { error: null, profile: profileRef.current }
    }

    if (now - refreshState.lastRequestAt < 1500) {
      console.warn('🟠 [Auth] refreshProfile debounced', { reason })
      return { error: null, profile: profileRef.current }
    }

    if (now - refreshState.windowStart > 30000) {
      refreshState.windowStart = now
      refreshState.requestCount = 0
    }
    refreshState.requestCount += 1
    if (refreshState.requestCount > 6) {
      refreshState.circuitBrokenUntil = now + 30000
      console.warn('🔴 [Auth] refreshProfile loop detected, opening circuit breaker', {
        reason,
        requestCount: refreshState.requestCount,
      })
      return { error: new Error('Profile refresh paused due to excessive refresh attempts.'), profile: profileRef.current }
    }

    refreshState.inFlight = true
    refreshState.lastRequestAt = now
    console.log('🟡 [Auth] profile refresh requested', { uid: currentUser.uid, reason })

    try {
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
      console.error('🔴 [Auth] refreshProfile error', { reason, error })
      setProfileError(error as Error)
      setProfileLoading(false)
      return { error: error as Error, profile: null as UserProfile | null }
    } finally {
      refreshState.inFlight = false
    }
  }, [fetchOrCreateUserDoc, fetchProfileOnce, recordProfileLoad, updateProfileState])

  /* ------------------------------------------------------------------ */
  /* 🔹 Role Flags (LOGGED)                                              */
  /* ------------------------------------------------------------------ */
  const normalizedRole = normalizeRole(profile?.role)

  const isAdmin = normalizedRole === 'partner' || normalizedRole === 'admin' || normalizedRole === 'super_admin'
  const isSuperAdmin = normalizedRole === 'super_admin'
  const isMentor = normalizedRole === 'mentor'
  const isAmbassador = normalizedRole === 'ambassador'
  const isPaid =
    ['partner', 'admin', 'mentor', 'ambassador', 'team_leader', 'super_admin'].includes(
      normalizedRole ?? ''
    ) ||
    normalizedRole === 'paid_member' ||
    (normalizedRole === 'user' && profile?.membershipStatus === 'paid')

  /* ------------------------------------------------------------------ */
  const value: AuthContextType = {
    user,
    profile,
    userData: profile,
    loading,
    profileLoading,
    profileStatus,
    profileError,
    lastProfileLoadAt: lastProfileLoadAtRef.current,
    signIn,
    signUp,
    signOut,
    signInWithMagicLink,
    signInWithGoogle,
    resetPassword,
    updateProfile,
    hasRole: (r: StandardRole) => normalizedRole === r,
    hasAnyRole: (roles: StandardRole[]) => (normalizedRole ? roles.includes(normalizedRole as StandardRole) : false),
    isAdmin,
    isSuperAdmin,
    isMentor,
    isAmbassador,
    isPaid,
    isCorporateMember:
      profile?.transformationTier?.toLowerCase().includes('corporate') ?? false,
    assignedOrganizations: profile?.assignedOrganizations ?? [],
    hasFullOrganizationAccess: normalizedRole === 'super_admin',
    canAccessOrganization: (organizationId: string) =>
      normalizedRole === 'super_admin' ||
      profile?.assignedOrganizations?.includes(organizationId) === true,
    updateDashboardPreferences: async () => ({ error: null }),
    claimsRole,
    refreshAdminSession,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
