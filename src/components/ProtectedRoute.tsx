import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'
import { Box, Center } from '@chakra-ui/react'
import { getDashboardPathForRole } from '@/utils/dashboardPaths'
import { normalizeUserRole } from '@/utils/roles'
import { LoadingAnimation } from './loading/LoadingAnimation'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: UserRole[]
  requireAuth?: boolean
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  requireAuth = true,
}) => {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const normalizedRole = profile ? normalizeUserRole(profile.role) : null
  const isAwaitingProfile = requireAuth && user && (!profile || profile.role === undefined)
  const timestamp = new Date().toISOString()

  console.debug('[ProtectedRoute] Evaluating access', {
    path: location.pathname,
    requiredRoles,
    normalizedRole,
    rawRole: profile?.role,
    userId: profile?.id ?? user?.uid,
    timestamp,
  })

  if (loading || isAwaitingProfile) {
    return (
      <Center h="100vh" bg="brand.deepPlum">
        <LoadingAnimation label="Loading your access..." />
      </Center>
    )
  }

  const isMentor = normalizedRole === UserRole.MENTOR

  // Not authenticated
  if (requireAuth && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!normalizedRole && requiredRoles) {
    console.warn('[ProtectedRoute] Missing or invalid role; redirecting to unauthorized', {
      path: location.pathname,
      requiredRoles,
      rawRole: profile?.role,
      userId: profile?.id ?? user?.uid,
      timestamp: new Date().toISOString(),
    })
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{ reason: 'missing-role', rawRole: profile?.role }}
      />
    )
  }

  if (isMentor && location.pathname.startsWith('/app')) {
    return <Navigate to="/mentor/dashboard" replace />
  }

  if (
    (normalizedRole === UserRole.SUPER_ADMIN || normalizedRole === UserRole.COMPANY_ADMIN) &&
    location.pathname.startsWith('/app')
  ) {
    console.debug('[ProtectedRoute] Redirecting admin away from /app', {
      normalizedRole,
      target: getDashboardPathForRole(normalizedRole),
    })
    return <Navigate to={getDashboardPathForRole(normalizedRole)} replace />
  }

  // Role check
  if (requiredRoles && normalizedRole && !requiredRoles.includes(normalizedRole)) {
    console.warn('[ProtectedRoute] Role mismatch; redirecting to unauthorized', {
      normalizedRole,
      requiredRoles,
      path: location.pathname,
      userId: profile?.id ?? user?.uid,
      timestamp: new Date().toISOString(),
    })
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{ reason: 'role-mismatch', normalizedRole, requiredRoles }}
      />
    )
  }

  return <>{children}</>
}

interface RoleBasedRouteProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  fallback?: React.ReactNode
}

export const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({
  children,
  allowedRoles,
  fallback = null,
}) => {
  const { profile, loading } = useAuth()
  const normalizedRole = profile?.role ? normalizeUserRole(profile.role) : null

  if (loading) {
    return (
      <Box p={4}>
        <LoadingAnimation label="Checking access..." compact />
      </Box>
    )
  }

  if (!normalizedRole || !allowedRoles.includes(normalizedRole)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
