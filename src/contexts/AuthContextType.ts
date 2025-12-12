import { createContext } from 'react'
import { User } from 'firebase/auth'
import { UserProfile, UserRole } from '@/types'

export interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  profileLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (
    email: string,
    password: string,
    userData: Partial<UserProfile>,
  ) => Promise<{ error: Error | null; userId?: string }>
  signOut: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
