import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getLandingPathForRole } from '@/utils/roleRouting'

export default function RoleRedirect() {
  const { user, profile, loading, profileLoading } = useAuth()

  if (loading || profileLoading) {
    return null // Or a loading spinner
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return <Navigate to="/auth/profile-missing" replace />
  }

  if (profile.accountStatus && profile.accountStatus !== 'active') {
    // You might want a dedicated page for suspended or pending accounts
    return <Navigate to="/login" replace />
  }

  const landingPath = getLandingPathForRole(profile)

  return <Navigate to={landingPath} replace />
}