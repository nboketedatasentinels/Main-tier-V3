import { createContext } from 'react'
import { User } from 'firebase/auth'
import { UserProfile, DashboardPreferences } from '@/types'
import type { StandardRole } from '@/types'

export interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  userData: UserProfile | null
  loading: boolean
  profileLoading: boolean
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
  ) => Promise<{ error: Error | null; userId?: string }>
  signOut: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null; isNewUser?: boolean }>
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
  canAccessOrganization: (orgCode: string) => boolean
  
  // Dashboard Preferences
  updateDashboardPreferences: (preferences: DashboardPreferences) => Promise<{ error: Error | null }>
  
  // Custom Claims
  claimsRole: string | null
  refreshAdminSession: () => Promise<void>
  refreshProfile: () => Promise<{ error: Error | null; profile: UserProfile | null }>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
