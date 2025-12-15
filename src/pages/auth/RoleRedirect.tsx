import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getLandingPathForRole } from '@/utils/roleRouting'
import { AccountStatus } from '@/types'

export default function RoleRedirect() {
  const navigate = useNavigate()
  const { user, profile, loading, profileLoading } = useAuth()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (loading || profileLoading) return

    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    if (!profile) {
      // Profile missing should redirect to profile creation
      navigate('/auth/profile-missing', { replace: true })
      return
    }

    if (!profile.role) {
      // IMPORTANT: profile missing role should not downgrade to "normal user"
      navigate('/auth/profile-missing', { replace: true })
      return
    }

    // Check account status
    const accountStatus = profile.accountStatus?.toString().toLowerCase()
    if (accountStatus === AccountStatus.INACTIVE || accountStatus === 'inactive') {
      navigate('/login', { replace: true, state: { error: 'Account is inactive' } })
      return
    }
    
    if (accountStatus === AccountStatus.SUSPENDED || accountStatus === 'suspended') {
      navigate('/suspended', { replace: true })
      return
    }

    // Check for redirectUrl in query params (external flows like payment)
    const redirectUrl = searchParams.get('redirectUrl')
    
    // Get preferred dashboard route from profile
    const preferredRoute = profile.dashboardPreferences?.defaultRoute || profile.defaultDashboardRoute
    
    // Determine landing path with priority logic
    const landingPath = getLandingPathForRole(profile.role, profile, redirectUrl || preferredRoute || undefined)
    
    navigate(landingPath, { replace: true })
  }, [loading, profileLoading, user, profile, navigate, searchParams])

  return null
}
