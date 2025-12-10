import React, { useEffect, useState } from 'react'
import { User } from 'firebase/auth'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
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
import { AuthContext, AuthContextType } from './AuthContextType'

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const googleProvider = new GoogleAuthProvider()

  const buildProfileFromUser = (firebaseUser: User): UserProfile => {
    const [firstName = 'User', lastName = ''] = (firebaseUser.displayName || 'User')
      .split(' ')
      .filter(Boolean)

    return {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      firstName,
      lastName,
      fullName: firebaseUser.displayName || `${firstName} ${lastName}`.trim(),
      role: UserRole.FREE_USER,
      avatarUrl: firebaseUser.photoURL || undefined,
      totalPoints: 0,
      level: 1,
      isOnboarded: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  const ensureProfileExists = async (firebaseUser: User) => {
    const profileRef = doc(db, 'profiles', firebaseUser.uid)
    const profileSnap = await getDoc(profileRef)

    if (!profileSnap.exists()) {
      const profileData = buildProfileFromUser(firebaseUser)
      await setDoc(profileRef, profileData)
      return profileData
    }

    const existingProfile = profileSnap.data() as UserProfile

    if (!existingProfile.avatarUrl && firebaseUser.photoURL) {
      await updateDoc(profileRef, {
        avatarUrl: firebaseUser.photoURL,
        updatedAt: serverTimestamp(),
      })
    }

    return { ...existingProfile, avatarUrl: existingProfile.avatarUrl || firebaseUser.photoURL || undefined }
  }

  // Fetch user profile from Firestore
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const docRef = doc(db, 'profiles', userId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return docSnap.data() as UserProfile
      }

      return null
    } catch (error) {
      console.error('Error fetching profile:', error)
      return null
    }
  }

  // Initialize auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)

      if (user) {
        const userProfile = await fetchProfile(user.uid)
        setProfile(userProfile)
      } else {
        setProfile(null)
      }

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
        isOnboarded: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await setDoc(doc(db, 'profiles', user.uid), profileData)
      setProfile(profileData)

      return { error: null }
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

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const firebaseUser = result.user

      const userProfile = await ensureProfileExists(firebaseUser)
      setProfile(userProfile)

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
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    signInWithMagicLink,
    resetPassword,
    updateProfile,
    hasRole,
    hasAnyRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
