import { UserRole } from '@/types'

export const mapFirebaseAuthError = (code?: string): string => {
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.'
    case 'auth/user-not-found':
      return 'No account found with this email.'
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.'
    case 'auth/email-already-in-use':
      return 'An account already exists with this email.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/popup-closed-by-user':
      return 'The sign-in window was closed before completing. Please try again.'
    case 'auth/cancelled-popup-request':
      return 'Another sign-in request was cancelled. Please try again.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Please allow popups and try again.'
    case 'auth/account-exists-with-different-credential':
      return 'An account exists with the same email using a different sign-in method.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

export const getDashboardRouteForRole = (role: UserRole): string => {
  switch (role) {
    case UserRole.PAID_MEMBER:
      return '/dashboard/member'
    case UserRole.MENTOR:
      return '/dashboard/mentor'
    case UserRole.AMBASSADOR:
      return '/dashboard/ambassador'
    case UserRole.COMPANY_ADMIN:
      return '/dashboard/company-admin'
    case UserRole.SUPER_ADMIN:
      return '/dashboard/super-admin'
    case UserRole.FREE_USER:
    default:
      return '/dashboard/free'
  }
}

export const splitFullName = (fullName: string) => {
  const parts = fullName.trim().split(' ').filter(Boolean)
  const firstName = parts.shift() || ''
  const lastName = parts.join(' ')
  return { firstName, lastName, fullName: `${firstName} ${lastName}`.trim() }
}
