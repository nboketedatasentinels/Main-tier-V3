import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function RoleRedirect() {
  const navigate = useNavigate()
  const { user, profile, loading, profileLoading } = useAuth()

  useEffect(() => {
    if (loading || profileLoading) return

    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    if (!profile?.role) {
      // IMPORTANT: profile missing should not downgrade to “normal user”
      navigate('/auth/profile-missing', { replace: true })
      return
    }

    navigate('/app/weekly-glance', { replace: true })
  }, [loading, profileLoading, user, profile?.role, navigate])

  return null
}
