import React, { useEffect, useState, useMemo } from 'react'
import { User } from 'firebase/auth'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  sendEmailVerification,
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
import { UserProfile, DashboardPreferences, AccountStatus, TransformationTier, UserRole } from '@/types'
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

  // Fetch user profile from Firestore or create one if it doesn't exist
  const fetchOrCreateProfile = async (
    firebaseUser: User
  ): Promise<UserProfile | null> => {
    try {
      console.log('🟣 fetchOrCreateProfile: Starting for user', {
        uid: firebaseUser.uid,
        email: firebaseUser.email
      });
      
      const docRef = doc(db, 'profiles', firebaseUser.uid)
      const docSnap = await getDoc(docRef)
      
      console.log('🟣 fetchOrCreateProfile: Firestore document check', {
        exists: docSnap.exists()
      });

      if (docSnap.exists()) {
        const profileData = docSnap.data() as UserProfile
        console.log('🟣 fetchOrCreateProfile: Profile found in Firestore', {
          id: profileData.id,
          email: profileData.email,
          role: profileData.role,
          roleType: typeof profileData.role,
          fullName: profileData.fullName,
          onboardingComplete: profileData.onboardingComplete,
          transformationTier: profileData.transformationTier
        });
        
        // Backwards compatibility: remap 'partner' to 'company_admin'
        if ((profileData.role as string) === 'partner') {
          console.log('🟣 fetchOrCreateProfile: Remapping "partner" to UserRole.COMPANY_ADMIN');
          profileData.role = UserRole.COMPANY_ADMIN
          console.log('🟣 fetchOrCreateProfile: After remap, role is:', profileData.role);
        }

        if (!profileData.role || !Object.values(UserRole).includes(profileData.role)) {
          console.warn(
            `🟣 fetchOrCreateProfile: User profile for UID ${firebaseUser.uid} has a missing or invalid role:`,
            profileData.role
          )
        }
        
        console.log('🟣 fetchOrCreateProfile: Returning profile with role:', profileData.role);
        return profileData
      }

      console.log('🟣 fetchOrCreateProfile: No profile found, creating new one');
      const role = isBootstrapAdmin(firebaseUser.email)
        ? UserRole.SUPER_ADMIN
        : UserRole.USER;

      if (role === 'super_admin') {
        console.log(
          `🟣 fetchOrCreateProfile: Assigning SUPER_ADMIN role to bootstrap admin: ${firebaseUser.email}`
        )
      }

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
          lockedToFreeExperience: role === 'user',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log('🟣 fetchOrCreateProfile: Creating new profile with role:', role);
      await setDoc(docRef, {
        ...profileData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      return profileData
    } catch (error: any) {
      console.error('🟣 fetchOrCreateProfile: Error fetching/creating profile:', {
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

  // Extract custom claims from user token
  const extractCustomClaims = async (user: User) => {
    try {
      const idTokenResult = await user.getIdTokenResult()
      const role = idTokenResult.claims.role as string | undefined
      setClaimsRole(role || null)
      return role
    } catch (error) {
      console.error('Error extracting custom claims:', error)
      return null
    }
  }

  // Refresh admin session to sync custom claims
  const refreshAdminSession = async () => {
    if (!user) return
    try {
      await user.getIdToken(true) // Force token refresh
      const role = await extractCustomClaims(user)
      console.log('Admin session refreshed, claims role:', role)
    } catch (error) {
      console.error('Error refreshing admin session:', error)
    }
  }

  // Monitor for role mismatch and auto-sync
  useEffect(() => {
    if (!user || !profile) return

    const checkRoleMismatch = async () => {
      const tokenRole = await extractCustomClaims(user)
      if (tokenRole && tokenRole !== profile.role) {
        console.warn(
          `Role mismatch detected! Claims: ${tokenRole}, Profile: ${profile.role}`
        )
        // Auto-sync by refreshing token
        await refreshAdminSession()
      }
    }

    checkRoleMismatch()

    // Auto-refresh for super admins every 5 minutes
    if (profile.role === 'super_admin') {
      const interval = setInterval(() => {
        refreshAdminSession()
      }, 5 * 60 * 1000) // 5 minutes

      return () => clearInterval(interval)
    }
  }, [user, profile])

  // Initialize auth state with real-time profile listener
  useEffect(() => {
    console.log('🟠 AuthContext: Setting up onAuthStateChanged listener');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🟠 AuthContext: onAuthStateChanged triggered', {
        user: user ? { uid: user.uid, email: user.email } : null
      });
      
      setLoading(true)
      setUser(user)

      console.log("Am here")

      if (!user) {
        console.log('🟠 AuthContext: No user, clearing profile');
        setProfile(null)
        setProfileLoading(false)
        setLoading(false)
        setClaimsRole(null)
        return
      }

      setProfileLoading(true)
      console.log('🟠 AuthContext: User detected, starting profile load...');

      // Extract custom claims
      console.log('🟠 AuthContext: Extracting custom claims...');
      await extractCustomClaims(user)

      console.log('🟠 AuthContext: Fetching profile from Firestore...');
      const userProfile = await fetchOrCreateProfile(user)
      console.log('🟠 AuthContext: Profile fetched', {
        profile: userProfile ? {
          id: userProfile.id,
          email: userProfile.email,
          role: userProfile.role,
          fullName: userProfile.fullName,
          onboardingComplete: userProfile.onboardingComplete,
          transformationTier: userProfile.transformationTier,
          dashboardPreferences: userProfile.dashboardPreferences
        } : null
      });
      
      setProfile(userProfile)
      setProfileLoading(false)
      console.log('🟠 AuthContext: Profile loading complete, profileLoading set to false');
      
      if (userProfile && [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN].includes(userProfile.role)) {
        console.log(`🟠 AuthContext: Admin user detected: ${userProfile.email}, role: ${userProfile.role}`)
      }
      setLoading(false)

      // Set up real-time listener for profile updates
      if (userProfile) {
        const profileRef = doc(db, 'profiles', user.uid)
        const unsubscribeProfile = onSnapshot(profileRef, (doc) => {
          if (doc.exists()) {
            const updatedProfile = doc.data() as UserProfile
            console.log('🟠 AuthContext: Profile updated via snapshot', {
              role: updatedProfile.role,
              email: updatedProfile.email
            });
            setProfile(updatedProfile)
          }
        }, (error) => {
          console.error('🟠 AuthContext: Error listening to profile updates:', error)
        })

        return unsubscribeProfile
      }
    })

    return () => unsubscribe()
  }, [])

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      console.log('🟡 AuthContext.signIn: Calling Firebase signInWithEmailAndPassword', { email });
      await signInWithEmailAndPassword(auth, email, password)
      console.log('🟡 AuthContext.signIn: Firebase auth successful');
      return { error: null }
    } catch (error) {
      console.error('🟡 AuthContext.signIn: Firebase auth failed', error);
      return { error: error as Error }
    }

    const profileData = snap.data() as UserProfile
    setProfile(profileData)

    console.log('[AUTH] Profile loaded:', profileData)

    return { error: null }
  } catch (error) {
    console.error('[AUTH] Sign-in failed:', error)
    return { error: error as Error }
  } finally {
    setLoading(false)
    setProfileLoading(false)
  }
}


  const signUp = async (
  email: string,
  password: string,
  userData: Partial<UserProfile>
) => {
  setLoading(true)
  setProfileLoading(true)

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const u = cred.user

    console.log('[AUTH] Signed up:', {
      uid: u.uid,
      email: u.email,
    })

    const profileData: UserProfile = {
      id: u.uid,
      email,
      firstName: userData.firstName || 'User',
      lastName: userData.lastName || '',
      fullName:
        userData.fullName ||
        `${userData.firstName ?? 'User'} ${userData.lastName ?? ''}`.trim(),
      role: UserRole.USER,
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
        lockedToFreeExperience: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const profileRef = doc(db, 'profiles', u.uid)

    await setDoc(profileRef, {
      ...profileData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    setUser(u)
    setProfile(profileData)

    console.log('[AUTH] Profile created:', profileData)

    return { error: null, userId: u.uid }
  } catch (error) {
    console.error('[AUTH] Sign-up failed:', error)
    return { error: error as Error }
  } finally {
    setLoading(false)
    setProfileLoading(false)
  }
}


  // Sign out
  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
      setUser(null)
      setProfile(null)
      setClaimsRole(null)
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

  // Update dashboard preferences
  const updateDashboardPreferences = async (preferences: DashboardPreferences) => {
    if (!user) return { error: new Error('No user logged in') }

    try {
      const profileRef = doc(db, 'profiles', user.uid)
      const updatedPreferences = {
        ...preferences,
        lastUpdatedAt: new Date().toISOString(),
      }
      
      await updateDoc(profileRef, {
        dashboardPreferences: updatedPreferences,
        updatedAt: serverTimestamp(),
      })

      if (profile) {
        setProfile({ 
          ...profile, 
          dashboardPreferences: updatedPreferences 
        })
      }

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  // Role checking utilities
  const hasRole = (role: StandardRole): boolean => {
    return profile ? normalizeRole(profile.role) === role : false
  }

  const hasAnyRole = (roles: StandardRole[]): boolean => {
    return profile ? roles.some(r => normalizeRole(profile.role) === r) : false
  }

  // Computed role flags
  const isAdmin = useMemo(() => {
    if (!profile?.role) return false
    const normalized = normalizeRole(profile.role)
    return ['partner', 'super_admin'].includes(normalized)
  }, [profile?.role])

  const isSuperAdmin = useMemo(() => {
    return normalizeRole(profile?.role) === 'super_admin'
  }, [profile?.role])

  const isMentor = useMemo(() => {
    return normalizeRole(profile?.role) === 'mentor'
  }, [profile?.role])

  const isAmbassador = useMemo(() => {
    return normalizeRole(profile?.role) === 'ambassador'
  }, [profile?.role])

  const isPaid = useMemo(() => {
    if (!profile?.role) return false
    const normalized = normalizeRole(profile.role)
    return [
      'partner',
      'mentor',
      'ambassador',
      'team_leader',
    ].includes(normalized) || (normalized === 'user' && profile.membershipStatus === 'paid') // Added explicit check for paid user
  }, [profile?.role, profile?.membershipStatus])



  const isCorporateMember = useMemo(() => {
    if (!profile?.transformationTier) return false
    const tier = profile.transformationTier.toString().toLowerCase()
    return tier.includes('corporate')
  }, [profile?.transformationTier])

  // Organization access control
  const assignedOrganizations = useMemo(() => {
    return profile?.assignedOrganizations || []
  }, [profile?.assignedOrganizations])

  const hasFullOrganizationAccess = useMemo(() => {
    return normalizeRole(profile?.role) === 'super_admin'
  }, [profile?.role])

  const canAccessOrganization = (orgCode: string): boolean => {
    if (!profile) return false
    if (normalizeRole(profile.role) === 'super_admin') return true
    return assignedOrganizations.includes(orgCode)
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
    isAdmin,
    isSuperAdmin,
    isMentor,
    isAmbassador,
    isPaid,
    isCorporateMember,
    assignedOrganizations,
    hasFullOrganizationAccess,
    canAccessOrganization,
    updateDashboardPreferences,
    claimsRole,
    refreshAdminSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
