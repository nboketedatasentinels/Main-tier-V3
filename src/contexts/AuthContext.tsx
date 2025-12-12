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
import { AuthContext, AuthContextType } from './AuthContextType'
import { getSafeRole, isValidUserRole } from '@/utils/roles'

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [roleDebugEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('roleDebug') === 'true'
  })

  const logRoleEvent = (
    level: 'log' | 'warn' | 'error' | 'debug',
    message: string,
    payload: Record<string, unknown>
  ) => {
    if (level === 'debug' && !roleDebugEnabled) return

    const timestamp = new Date().toISOString()
    const userId = payload.userId ?? user?.uid ?? 'unknown-user'
    const entry = { timestamp, userId, ...payload }

    if (level === 'warn') console.warn(`[AuthContext] ${message}`, entry)
    else if (level === 'error') console.error(`[AuthContext] ${message}`, entry)
    else if (level === 'debug') console.debug(`[AuthContext] ${message}`, entry)
    else console.log(`[AuthContext] ${message}`, entry)
  }

  // Fetch user profile from Firestore
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const docRef = doc(db, 'profiles', userId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile
        const normalizedRole = getSafeRole(data.role)

        logRoleEvent('log', 'Fetched raw role from Firestore', {
          rawRole: data.role,
          userId: userId,
        })

        if (!isValidUserRole(data.role)) {
          logRoleEvent('warn', 'Received invalid role from Firestore', {
            rawRole: data.role,
            normalizedRole,
            userId: userId,
          })
        }

        logRoleEvent('debug', 'Normalized role from Firestore', {
          rawRole: data.role,
          normalizedRole,
          userId: userId,
        })

        return { ...data, role: normalizedRole }
      }

      return null
    } catch (error) {
      logRoleEvent('error', 'Error fetching profile', { error })
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

    if (updates.role !== undefined) {
      const normalizedRole = getSafeRole(updates.role)
      if (!normalizedRole) {
        logRoleEvent('warn', 'Blocked profile update with invalid role', {
          attemptedRole: updates.role,
          userId: user.uid,
        })
        return { error: new Error('Invalid role provided. Please choose a valid role.') }
      }

      const currentRole = getSafeRole(profile?.role)
      const isAdmin =
        currentRole === UserRole.SUPER_ADMIN || currentRole === UserRole.COMPANY_ADMIN
      if (!isAdmin) {
        logRoleEvent('warn', 'Non-admin attempted to change a role', {
          attemptedRole: updates.role,
          userId: user.uid,
          currentRole,
        })
        return { error: new Error('Only admins can change user roles.') }
      }

      updates.role = normalizedRole
      logRoleEvent('log', 'Role update prepared', {
        newRole: normalizedRole,
        userId: user.uid,
      })
    }

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
    return profile?.role ? roles.includes(profile.role) : false
  }

  const value: AuthContextType = {
    user,
    profile,
    loading,
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
