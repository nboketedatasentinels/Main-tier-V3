import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getLandingPathForRole } from '@/utils/roleRouting'

/**
 * RoleRedirect component for /app index entry
 * Redirects authenticated users to their appropriate landing path
 * based on their role and profile settings
 */
export default function RoleRedirect() {
  const { loading, profileLoading, user, profile } = useAuth()
  const [searchParams] = useSearchParams()

  // Show nothing while loading
  if (loading || profileLoading) {
    return null
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Redirect to profile missing page if profile doesn't exist
  if (!profile) {
    return <Navigate to="/auth/profile-missing" replace />
  }

  // Compute landing path using centralized logic
  const landingPath = getLandingPathForRole(profile, searchParams)

  // Redirect to the computed landing path
  return <Navigate to={landingPath} replace />
}