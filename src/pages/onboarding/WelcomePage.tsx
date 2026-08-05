import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getLandingPathForRole } from '@/utils/roleRouting'

/**
 * Free-user welcome/onboarding page removed — send anyone hitting /welcome
 * straight to their role landing path (free dashboard for free users).
 */
export const WelcomePage: React.FC = () => {
  const { profile } = useAuth()
  return <Navigate to={getLandingPathForRole(profile)} replace />
}
