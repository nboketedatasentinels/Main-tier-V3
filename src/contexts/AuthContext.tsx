import React, { useEffect, useMemo, useState } from 'react'
import { User } from 'firebase/auth'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'

import {
  UserProfile,
  DashboardPreferences,
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

  /* ------------------------------------------------------------------ */
  /* 🔹 Fetch or Create Profile                                          */
  /* ------------------------------------------------------------------ */
  const fetchOrCreateProfile = async (
    firebaseUser: User
  ): Promise<UserProfile | null> => {
    try {
      console.log('🟣 [Auth] fetchOrCreateProfile:start', {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
      })

      const docRef = doc(db, 'profiles', firebaseUser.uid)
      const docSnap = await getDoc(docRef)

      console.log('🟣 [Auth] Firestore profile exists?', docSnap.exists())

      if (docSnap.exists()) {
        const profileData = docSnap.data() as UserProfile
       console.log('here',docSnap.data())
        console.log('🟣 [Auth] Raw profile loaded', {
          role: profileData.role,
          membershipStatus: profileData.membershipStatus,
          transformationTier: profileData.transformationTier,
        })

        const normalized = normalizeRole(profileData.role)
        console.log('🟣 [Auth] Normalized role:', normalized)

        if (normalized) {
          profileData.role = normalized as any
        } else {
          console.warn('🟠 [Auth] Invalid role detected:', profileData.role)
        }

        return profileData
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

      await setDoc(docRef, {
        ...profileData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      console.log('🟣 [Auth] Profile created successfully')

      return profileData
    } catch (error: any) {
      console.error('🔴 [Auth] fetchOrCreateProfile error', error)
      return null
    }
  }

  /* ------------------------------------------------------------------ */
  /* 🔹 Custom Claims                                                    */
  /* ------------------------------------------------------------------ */
  const extractCustomClaims = async (u: User) => {
    try {
      const token = await u.getIdTokenResult()
      const role = token.claims.role as string | undefined
      console.log('🟡 [Auth] Token claims role:', role)
      setClaimsRole(role ?? null)
      return role ?? null
    } catch (err) {
      console.error('🔴 [Auth] extractCustomClaims failed', err)
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

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('🟠 [Auth] Auth state changed', currentUser?.email)

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

      const userProfile = await fetchOrCreateProfile(currentUser)

      console.log('🟢 [Auth] Profile resolved', {
        role: userProfile?.role,
        normalized: normalizeRole(userProfile?.role),
      })

      setProfile(userProfile)
      setProfileLoading(false)
      setLoading(false)

      if (!userProfile) return

      /* -------- realtime updates -------- */
      const profileRef = doc(db, 'profiles', currentUser.uid)
      return onSnapshot(profileRef, (snap) => {
        if (!snap.exists()) return
        const updated = snap.data() as UserProfile
        updated.role = normalizeRole(updated.role) as any
        console.log('🔁 [Auth] Profile updated via snapshot', updated.role)
        setProfile(updated)
      })
    })

    return () => unsubscribe()
  }, [])

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
      return { error: error as Error }
    } finally {
      setLoading(false)
      setProfileLoading(false)
    }
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
    signOut,
    resetPassword,
    hasRole: (r: StandardRole) => normalizedRole === r,
    hasAnyRole: (roles: StandardRole[]) => roles.includes(normalizedRole as any),
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
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
