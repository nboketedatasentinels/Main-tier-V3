import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { normalizeRole } from '@/utils/roleRouting'

type Props = {
  children: React.ReactNode
  requiredRoles?: any[] // UserRole[] but keep tolerant
}

export const ProtectedRoute: React.FC<Props> = ({ children, requiredRoles }) => {
  const { user, profile, loading, profileLoading } = useAuth()
  const location = useLocation()

  // block render until auth + profile are known
  if (loading || profileLoading) return null

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // no role requirements -> allow any authenticated user
  if (!requiredRoles || requiredRoles.length === 0) {
    return <>{children}</>
  }

  const userRole = normalizeRole(profile?.role)
  const allowed = requiredRoles.map(normalizeRole)

  if (!allowed.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
