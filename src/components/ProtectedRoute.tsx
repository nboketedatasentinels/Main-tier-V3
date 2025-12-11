import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'
import { Box, Spinner, Center } from '@chakra-ui/react'
import { getDashboardPathForRole } from '@/utils/dashboardPaths'
import { normalizeUserRole } from '@/utils/roles'

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
  const normalizedRole = normalizeUserRole(profile?.role)

  if (loading) {
    return (
      <Center h="100vh" bg="brand.deepPlum">
        <Spinner size="xl" color="brand.gold" thickness="4px" />
      </Center>
    )
  }

  const isMentor = normalizedRole === UserRole.MENTOR

  // Not authenticated
  if (requireAuth && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (isMentor && location.pathname.startsWith('/app')) {
    return <Navigate to="/mentor/dashboard" replace />
  }

  if (
    (normalizedRole === UserRole.SUPER_ADMIN || normalizedRole === UserRole.COMPANY_ADMIN) &&
    location.pathname.startsWith('/app')
  ) {
    return <Navigate to={getDashboardPathForRole(normalizedRole)} replace />
  }

  // Role check
  if (requiredRoles && normalizedRole && !requiredRoles.includes(normalizedRole)) {
    return <Navigate to="/unauthorized" replace />
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

  if (loading) {
    return (
      <Box p={4}>
        <Spinner color="brand.gold" />
      </Box>
    )
  }

  if (!profile || !allowedRoles.includes(profile.role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
