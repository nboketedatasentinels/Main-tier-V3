import { createContext } from 'react'
import { UserProfile, DashboardPreferences } from '@/types'
import type { StandardRole } from '@/types'

/**
 * Minimal authenticated-user shape exposed to the app.
 *
 * Auth runs on Supabase now, but the codebase reads `user.uid` / `user.email`
 * (and a few others) in ~150 places - the same surface the old Firebase `User`
 * exposed. This shim keeps those consumers working without a sweeping rename:
 * `uid` is the Supabase auth user id (uuid) and `getIdToken()` returns the
 * Supabase access token.
 */
export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
  getIdToken: (forceRefresh?: boolean) => Promise<string>
}

export interface AuthContextType {
  user: AuthUser | null
  profile: UserProfile | null
  userData: UserProfile | null
  loading: boolean
  profileLoading: boolean
  profileStatus: 'loading' | 'ready'
  profileError: Error | null
  lastProfileLoadAt: string | null
  signingOut: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (
    email: string,
    password: string,
    userData: Partial<UserProfile> & {
      gender?: string
      companyCode?: string
      companyId?: string
      companyName?: string
    },
    referralCode?: string
  ) => Promise<{ error: Error | null; userId?: string }>
  signOut: () => Promise<{ error: Error | null }>
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null; isNewUser?: boolean; redirect?: boolean }>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>
  hasRole: (role: StandardRole) => boolean
  hasAnyRole: (roles: StandardRole[]) => boolean
  
  // Role Flags
  isAdmin: boolean
  isSuperAdmin: boolean
  isMentor: boolean
  isAmbassador: boolean
  isPaid: boolean
  isCorporateMember: boolean
  
  // Organization Access
  assignedOrganizations: string[]
  hasFullOrganizationAccess: boolean
  canAccessOrganization: (organizationId: string) => Promise<boolean>
  
  // Dashboard Preferences
  updateDashboardPreferences: (preferences: DashboardPreferences) => Promise<{ error: Error | null }>
  
  // Custom Claims
  claimsRole: string | null
  effectiveRole: StandardRole
  effectiveRoleSource: 'claims' | 'profile' | 'fallback'
  effectiveOrganizationId: string | null
  refreshAdminSession: () => Promise<void>
  refreshProfile: (options?: { reason?: string; isManual?: boolean }) => Promise<{ error: Error | null; profile: UserProfile | null }>

  // Account Linking
  pendingLinkEmail: string | null
  showAccountLinkingModal: boolean
  linkGoogleAccount: (password: string) => Promise<{ error: Error | null }>
  dismissAccountLinking: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
