import { UserProfile } from '@/types'

/**
 * Check if user needs to complete onboarding
 */
export const needsOnboarding = (profile: UserProfile | null): boolean => {
  if (!profile) return false
  
  // User can skip onboarding
  if (profile.onboardingSkipped) return false
  
  // Check if onboarding is complete
  if (profile.onboardingComplete) return false
  
  // If neither complete nor skipped, needs onboarding
  return true
}

/**
 * Check if user has completed onboarding
 */
export const hasCompletedOnboarding = (profile: UserProfile | null): boolean => {
  if (!profile) return false
  return profile.onboardingComplete === true || profile.onboardingSkipped === true
}

/**
 * Get onboarding status for display
 */
export const getOnboardingStatus = (profile: UserProfile | null): 'complete' | 'skipped' | 'incomplete' => {
  if (!profile) return 'incomplete'
  
  if (profile.onboardingComplete) return 'complete'
  if (profile.onboardingSkipped) return 'skipped'
  return 'incomplete'
}
