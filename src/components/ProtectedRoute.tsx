import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { UserRole } from '@/types'
import { Box, Spinner, Center } from '@chakra-ui/react'
import { getDashboardRouteForRole } from '@/utils/auth'

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
  const isOnboardingRoute = location.pathname.startsWith('/onboarding')

  if (loading) {
    return (
      <Center h="100vh" bg="brand.deepPlum">
        <Spinner size="xl" color="brand.gold" thickness="4px" />
      </Center>
    )
  }

  // Not authenticated
  if (requireAuth && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Missing profile (should complete onboarding)
  if (requireAuth && user && !profile && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />
  }

  if (requireAuth && profile && !profile.isOnboarded && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />
  }

  if (isOnboardingRoute && profile?.isOnboarded) {
    return <Navigate to={getDashboardRouteForRole(profile.role)} replace />
  }

  // Role check
  if (requiredRoles && profile && !requiredRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}

interface PublicRouteProps {
  children: React.ReactNode
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Center h="100vh" bg="brand.deepPlum">
        <Spinner size="xl" color="brand.gold" thickness="4px" />
      </Center>
    )
  }

  if (user && !profile) {
    return <Navigate to="/onboarding" replace />
  }

  if (user && profile) {
    if (!profile.isOnboarded) {
      return <Navigate to="/onboarding" replace />
    }

    const target = location.state?.from?.pathname || getDashboardRouteForRole(profile.role)
    return <Navigate to={target} replace />
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
