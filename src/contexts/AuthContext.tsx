import React, { useEffect, useState } from 'react'
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
} from 'firebase/firestore'
import { UserProfile, UserRole } from '@/types'
import { auth, db } from '@/services/firebase'
import { isBootstrapAdmin } from '@/utils/bootstrap'
import { AuthContext, AuthContextType } from './AuthContextType'

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)

  // Fetch user profile from Firestore or create one if it doesn't exist
  const fetchOrCreateProfile = async (
    firebaseUser: User
  ): Promise<UserProfile | null> => {
    try {
      const docRef = doc(db, 'profiles', firebaseUser.uid)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const profileData = docSnap.data() as UserProfile
        if (!profileData.role || !Object.values(UserRole).includes(profileData.role)) {
          console.warn(
            `User profile for UID ${firebaseUser.uid} has a missing or invalid role:`,
            profileData.role
          )
        }
        return profileData
      }

      const role = isBootstrapAdmin(firebaseUser.email)
        ? UserRole.SUPER_ADMIN
        : UserRole.FREE_USER

      if (role === UserRole.SUPER_ADMIN) {
        console.log(
          `Assigning SUPER_ADMIN role to bootstrap admin: ${firebaseUser.email}`
        )
      }

      const profileData: UserProfile = {
        id: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        firstName: firebaseUser.displayName?.split(' ')?.[0] ?? 'User',
        lastName: firebaseUser.displayName?.split(' ')?.slice(1).join(' ') ?? '',
        fullName: firebaseUser.displayName ?? 'User',
        role,
        totalPoints: 0,
        level: 1,
        referralCount: 0,
        referralCode: null,
        referredBy: null,
        isOnboarded: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await setDoc(docRef, {
        ...profileData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      return profileData
    } catch (error: any) {
      console.error('Error fetching/creating profile:', {
        message: error.message,
        code: error.code,
        uid: firebaseUser.uid,
      })

      if (error.code === 'permission-denied') {
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

  // Initialize auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true)
      setUser(user)

      if (!user) {
        setProfile(null)
        setProfileLoading(false)
        setLoading(false)
        return
      }

      setProfileLoading(true)

      const userProfile = await fetchOrCreateProfile(user)
      setProfile(userProfile)
      setProfileLoading(false)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  // Sign up
  const signUp = async (email: string, password: string, userData: Partial<UserProfile>) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Create profile in Firestore
      const profileData: UserProfile = {
        id: user.uid,
        email,
        firstName: userData.firstName || 'User',
        lastName: userData.lastName || '',
        fullName: userData.fullName || 'User',
        role: UserRole.FREE_USER,
        totalPoints: 0,
        level: 1,
        referralCount: 0,
        referralCode: null,
        referredBy: null,
        isOnboarded: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await setDoc(doc(db, 'profiles', user.uid), profileData)

      return { error: null, userId: user.uid }
    } catch (error) {
      return { error: error as Error }
    }
  }

  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
      setUser(null)
      setProfile(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Magic link sign in (email link)
  const signInWithMagicLink = async (email: string) => {
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/auth/callback`,
        handleCodeInApp: true,
      }

      await sendSignInLinkToEmail(auth, email, actionCodeSettings)
      // Store email for verification
      window.localStorage.setItem('emailForSignIn', email)
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email)
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  // Update profile
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('No user logged in') }

    try {
      const profileRef = doc(db, 'profiles', user.uid)
      await updateDoc(profileRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      })

      if (profile) {
        setProfile({ ...profile, ...updates })
      }

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  // Role checking utilities
  const hasRole = (role: UserRole): boolean => {
    return profile?.role === role
  }

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return profile ? roles.includes(profile.role) : false
  }

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
    hasRole,
    hasAnyRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
