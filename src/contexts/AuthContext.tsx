import React, { useEffect, useState } from 'react'
import { FirebaseError } from 'firebase/app'
import { User } from 'firebase/auth'
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore'

import {
  UserProfile,
  AccountStatus,
  TransformationTier,
  UserRole,
} from '@/types'
import type { StandardRole } from '@/types'
import { normalizeRole } from '@/utils/role'
import { isBootstrapAdmin } from '@/utils/bootstrap'
import { auth, db } from '@/services/firebase'
import { AuthContext, AuthContextType } from './AuthContextType'

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [claimsRole, setClaimsRole] = useState<string | null>(null)
  const enableProfileRealtime = import.meta.env.VITE_ENABLE_PROFILE_REALTIME === 'true'

  const recordProfileLoad = (loadedProfile: UserProfile | null) => {
    if (typeof window === 'undefined') return
    if (!loadedProfile?.id) return
    const timestamp = new Date().toISOString()
    localStorage.setItem('lastProfileLoadAt', timestamp)
    console.log('🟣 [Auth] Recorded profile load timestamp', { id: loadedProfile.id, timestamp })
  }

  const fetchProfileOnce = async (uid: string): Promise<UserProfile | null> => {
    try {
      console.log('🟣 [Auth] fetchProfileOnce:start', { uid })
      const profileRef = doc(db, 'users', uid)
      const profileSnap = await getDoc(profileRef)
      if (!profileSnap.exists()) {
        console.warn('🟠 [Auth] fetchProfileOnce: no profile found')
        return null
      }
      const rawProfile = { id: uid, ...(profileSnap.data() as UserProfile) } as UserProfile
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
  }

  /* ------------------------------------------------------------------ */
  /* 🔹 Fetch or Create User Doc                                         */
  /* ------------------------------------------------------------------ */
  const fetchOrCreateUserDoc = async (
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
        const baseUser = {
          id: firebaseUser.uid,
          ...(userDocSnap.data() as UserProfile),
        } satisfies UserProfile

        console.log('🟣 [Auth] Raw profile loaded', {
          role: baseUser.role,
          membershipStatus: baseUser.membershipStatus,
          transformationTier: baseUser.transformationTier,
        })

        // Optionally merge learner-facing extras from profiles/{uid}
        try {
          const profileExtrasSnap = await getDoc(doc(db, 'profiles', firebaseUser.uid))
          if (profileExtrasSnap.exists()) {
            const extras = profileExtrasSnap.data() as Partial<UserProfile>
            Object.assign(baseUser, { ...extras, ...baseUser, role: baseUser.role, id: firebaseUser.uid })
            console.log('🟣 [Auth] Merged learner profile extras (user doc remains source of truth)')
          }
        } catch (extrasError) {
          console.warn('🟠 [Auth] Unable to merge learner profile extras', extrasError)
        }

        const normalized = normalizeRole(baseUser.role)
        console.log('🟣 [Auth] Normalized role:', normalized)

        if (normalized) {
          baseUser.role = normalized as StandardRole
        } else {
          console.warn('🟠 [Auth] Invalid role detected:', baseUser.role)
        }

        return baseUser
      }

      /* ---------------- Create profile ---------------- */
      const role = isBootstrapAdmin(firebaseUser.email)
        ? UserRole.SUPER_ADMIN
        : UserRole.USER

      console.log('🟣 [Auth] Creating new profile with role:', role)

      const profileData: UserProfile = {
        id: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        firstName: firebaseUser.displayName?.split(' ')?.[0] ?? 'User',
        lastName: firebaseUser.displayName?.split(' ')?.slice(1).join(' ') ?? '',
        fullName: firebaseUser.displayName ?? 'User',
        role,
        membershipStatus: 'free',
        totalPoints: 0,
        level: 1,
        referralCount: 0,
        referralCode: null,
        referredBy: null,
        isOnboarded: true,
        accountStatus: AccountStatus.ACTIVE,
        transformationTier: TransformationTier.INDIVIDUAL_FREE,
        assignedOrganizations: [],
        onboardingComplete: false,
        onboardingSkipped: false,
        mustChangePassword: false,
        hasSeenDashboardTour: false,
        dashboardPreferences: {
          defaultRoute: '/app/weekly-glance',
          lockedToFreeExperience: normalizeRole(role) === 'user',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await setDoc(userDocRef, {
        ...profileData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

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
  }

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

      if (!currentUser) {
        console.log('🟠 [Auth] No user → clearing state')
        setProfile(null)
        setClaimsRole(null)
        setLoading(false)
        setProfileLoading(false)
        return
      }

      setProfileLoading(true)

      await extractCustomClaims(currentUser)

      let userProfile = await fetchOrCreateUserDoc(currentUser)

      if (!userProfile) {
        console.warn('🟠 [Auth] Profile null on first attempt, retrying with direct fetch')
        userProfile = await fetchProfileOnce(currentUser.uid)
      }

      if (!userProfile?.role) {
        console.warn('🟠 [Auth] Profile loaded without role, applying fallback role:user')
        userProfile = userProfile
          ? { ...userProfile, role: (normalizeRole(userProfile.role) as StandardRole) || UserRole.USER }
          : null
      }

      if (isActive) {
        console.log('🟢 [Auth] Profile resolved', {
          role: userProfile?.role,
          normalized: normalizeRole(userProfile?.role),
        })

        setProfile(userProfile)
        recordProfileLoad(userProfile)
        setProfileLoading(false)
        setLoading(false)
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
          const updated = snap.data() as UserProfile
          updated.role = normalizeRole(updated.role) as StandardRole
          console.log('🔁 [Auth] Profile updated via snapshot', updated.role)
          setProfile(updated)
          recordProfileLoad(updated)
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
  }, [enableProfileRealtime])

  /* ------------------------------------------------------------------ */
  /* 🔹 Auth Actions                                                     */
  /* ------------------------------------------------------------------ */
  const signIn = async (email: string, password: string) => {
    console.log('🟡 [Auth] signIn:start', email)
    setLoading(true)
    setProfileLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      console.log('🟢 [Auth] signIn success')
      return { error: null }
    } catch (error) {
      console.error('🔴 [Auth] signIn failed', error)
      setLoading(false)
      setProfileLoading(false)
      return { error: error as Error }
    }
  }

  const signInWithMagicLink = async (email: string) => {
    console.log('🟡 [Auth] signInWithMagicLink requested', email)
    return { error: new Error('Magic link sign-in is currently disabled') }
  }

  const signUp = async (
    email: string,
    _password: string,
    _userData: Partial<UserProfile>
  ) => {
    console.warn('🟠 [Auth] signUp attempted but not implemented in this context', { email })
    return { error: new Error('Sign up is not available'), userId: undefined }
  }

  const signOut = async () => {
    console.log('🟡 [Auth] signOut')
    await firebaseSignOut(auth)
    setUser(null)
    setProfile(null)
    setClaimsRole(null)
  }

  const resetPassword = async (email: string) =>
    sendPasswordResetEmail(auth, email)

  const updateProfile = async (_updates: Partial<UserProfile>) => {
    console.warn('🟠 [Auth] updateProfile stub invoked')
    return { error: null }
  }

  const refreshProfile = async () => {
    const currentUser = auth.currentUser
    console.log('🟡 [Auth] Manual profile refresh requested', { uid: currentUser?.uid })

    if (!currentUser) {
      const error = new Error('No authenticated user to refresh')
      console.error('🔴 [Auth] refreshProfile failed', error)
      return { error, profile: null as UserProfile | null }
    }

    try {
      setProfileLoading(true)
      const refreshed = (await fetchProfileOnce(currentUser.uid)) ?? (await fetchOrCreateUserDoc(currentUser))
      if (refreshed) {
        setProfile(refreshed)
        recordProfileLoad(refreshed)
      }
      setProfileLoading(false)
      return { error: null, profile: refreshed }
    } catch (error) {
      console.error('🔴 [Auth] refreshProfile error', error)
      setProfileLoading(false)
      return { error: error as Error, profile: null as UserProfile | null }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 🔹 Role Flags (LOGGED)                                              */
  /* ------------------------------------------------------------------ */
  const normalizedRole = useMemo(() => {
    const r = normalizeRole(profile?.role)
    console.log('🔵 [Auth] normalizedRole computed:', r)
    return r
  }, [profile?.role])

  const isAdmin = normalizedRole === 'partner' || normalizedRole === 'super_admin'
  const isSuperAdmin = normalizedRole === 'super_admin'
  const isMentor = normalizedRole === 'mentor'
  const isAmbassador = normalizedRole === 'ambassador'
  const isPaid =
    ['partner', 'mentor', 'ambassador', 'team_leader', 'super_admin'].includes(
      normalizedRole ?? ''
    ) ||
    (normalizedRole === 'user' && profile?.membershipStatus === 'paid')

  /* ------------------------------------------------------------------ */
  const value: AuthContextType = {
    user,
    profile,
    loading,
    profileLoading,
    signIn,
    signUp,
    signOut,
    signInWithMagicLink,
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
    canAccessOrganization: (code: string) =>
      normalizedRole === 'super_admin' ||
      profile?.assignedOrganizations?.includes(code) === true,
    updateDashboardPreferences: async () => ({ error: null }),
    claimsRole,
    refreshAdminSession,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
