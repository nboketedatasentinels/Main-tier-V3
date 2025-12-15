import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getLandingPathForRole } from '@/utils/roleRouting'

export default function RoleRedirect() {
  const { loading, profileLoading, user, profile } = useAuth()

  useEffect(() => {
    // In case of any async race conditions, though useAuth should handle this
  }, [loading, profileLoading, user, profile])

  if (loading || profileLoading) {
    return null // Or a loading spinner
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return <Navigate to="/auth/profile-missing" replace />
  }

  // Centralized routing logic
  const landingPath = getLandingPathForRole(profile.role, profile)
  
  return <Navigate to={landingPath} replace />
}