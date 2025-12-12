import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getDashboardPathForRole } from '@/utils/dashboardPaths'

const RoleRedirect = () => {
  const navigate = useNavigate()
  const { user, profile, loading, profileLoading } = useAuth()

  useEffect(() => {
    if (loading || profileLoading) return

    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    if (!profile) {
      navigate('/auth/profile-missing', { replace: true })
      return
    }

    const dashboardPath = getDashboardPathForRole(profile.role)
    navigate(dashboardPath, { replace: true })
  }, [loading, profileLoading, user, profile, navigate])

  return null
}

export default RoleRedirect
