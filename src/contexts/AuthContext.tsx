import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { FirebaseError } from 'firebase/app'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { UserProfile, UserRole } from '@/types'
import { auth, db, logFirebaseAuthHealth } from '@/services/firebase'
import { AuthContext, AuthContextType } from './AuthContextType'
import { splitFullName } from '@/utils/auth'

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const hasLoggedFirebaseStatus = useRef(false)

  const googleProvider = useMemo(() => {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    return provider
  }, [])

  const logAuthHealth = useCallback(() => {
    logFirebaseAuthHealth()
  }, [])

  const buildProfileFromUser = useCallback((firebaseUser: User): UserProfile => {
    const baseName =
      firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User'
    const { firstName, lastName, fullName } = splitFullName(baseName)

    return {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      firstName: firstName || 'User',
      lastName,
      fullName: fullName || `${firstName} ${lastName}`.trim(),
      role: UserRole.FREE_USER,
      avatarUrl: firebaseUser.photoURL || undefined,
      totalPoints: 0,
      level: 1,
      isOnboarded: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }, [])

  const ensureProfileExists = useCallback(
    async (firebaseUser: User) => {
      const profileRef = doc(db, 'profiles', firebaseUser.uid)
      const profileSnap = await getDoc(profileRef)

      if (!profileSnap.exists()) {
        const profileData = buildProfileFromUser(firebaseUser)
        await setDoc(profileRef, profileData)
        return profileData
      }

      const existingProfile = profileSnap.data() as UserProfile
      const updates: Partial<UserProfile> = {}

      if (!existingProfile.avatarUrl && firebaseUser.photoURL) {
        updates.avatarUrl = firebaseUser.photoURL
      }

      if (!existingProfile.firstName || !existingProfile.lastName || !existingProfile.fullName) {
        const baseName =
          firebaseUser.displayName || existingProfile.fullName || firebaseUser.email?.split('@')[0] || 'User'
        const { firstName, lastName, fullName } = splitFullName(baseName)
        updates.firstName = firstName || existingProfile.firstName
        updates.lastName = lastName || existingProfile.lastName
        updates.fullName = fullName || existingProfile.fullName
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(profileRef, {
          ...updates,
          updatedAt: serverTimestamp(),
        })
      }

      return {
        ...existingProfile,
        ...updates,
        avatarUrl: updates.avatarUrl || existingProfile.avatarUrl || firebaseUser.photoURL || undefined,
      }
    },
    [buildProfileFromUser]
  )

  // Fetch user profile from Firestore
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
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
  }, [])

  // Initialize auth state
  useEffect(() => {
    if (!hasLoggedFirebaseStatus.current) {
      hasLoggedFirebaseStatus.current = true
      logAuthHealth()
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)

      if (user) {
        const userProfile = (await fetchProfile(user.uid)) || (await ensureProfileExists(user))
        setProfile(userProfile)
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [ensureProfileExists, fetchProfile, logAuthHealth])

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
      const authDiagnostics = auth as unknown as {
        config?: { authDomain?: string }
        _popupRedirectResolver?: unknown
      }

      console.info('[Auth] Starting Google sign-in flow', {
        authDomain: authDiagnostics.config?.authDomain,
        popupRedirectResolverConfigured: Boolean(authDiagnostics._popupRedirectResolver),
      })

      const result = await signInWithPopup(auth, googleProvider)
      const firebaseUser = result.user

      console.info('[Auth] Google sign-in succeeded', {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        emailVerified: firebaseUser.emailVerified,
      })

      console.info('[Auth] Ensuring profile exists for Google user', {
        uid: firebaseUser.uid,
      })

      const userProfile = await ensureProfileExists(firebaseUser)
      setProfile(userProfile)

      console.info('[Auth] Profile ready after Google sign-in', {
        uid: userProfile.id,
        hasAvatar: Boolean(userProfile.avatarUrl),
        hasName: Boolean(userProfile.fullName),
      })

      return { error: null }
    } catch (error) {
      const firebaseError = error as FirebaseError
      console.error('[Auth] Google sign-in failed', {
        code: firebaseError.code,
        message: firebaseError.message,
        name: firebaseError.name,
        stack: firebaseError.stack,
        rawError: error,
      })
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
