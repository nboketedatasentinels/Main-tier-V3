import { FirebaseError } from 'firebase/app'

const errorMessages: Record<string, string> = {
  'auth/email-already-in-use': 'This email is already registered',
  'auth/invalid-email': 'Please enter a valid email address',
  'auth/weak-password': 'Password must be at least 8 characters',
  'auth/network-request-failed': 'Network error. Please check your connection',
  'auth/user-disabled': 'This account has been disabled. Please contact support',
  'auth/user-not-found': 'No account found with these credentials',
  'auth/wrong-password': 'Incorrect password. Please try again',
  'auth/invalid-credential': 'Invalid email or password. Please try again or reset your password',
  'auth/too-many-requests': 'Too many attempts. Please try again later',
  'auth/operation-not-allowed': 'This sign in method is currently disabled',
  'auth/popup-blocked': 'Popup was blocked. Please allow popups for this site and try again',
  'auth/cancelled-popup-request': 'Sign-in popup was closed before completing. Please try again',
  'auth/popup-closed-by-user': 'Sign-in popup was closed before completing. Please try again',
  'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method',
  'auth/credential-already-in-use': 'These credentials are already linked to another account',
}

export const getFriendlyErrorMessage = (error: unknown): string => {
  if (!error) return 'Something went wrong. Please try again.'

  if (error instanceof FirebaseError) {
    const message = errorMessages[error.code]
    if (message) return message
  }

  if (typeof error === 'object' && error && 'code' in error) {
    const message = errorMessages[(error as { code?: string }).code ?? '']
    if (message) return message
  }

  if (error instanceof Error) {
    return error.message || 'Something went wrong. Please try again.'
  }

  return 'Something went wrong. Please try again.'
}
