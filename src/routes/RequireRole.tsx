import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { normalizeUserRole } from '@/utils/roles'
import { getDashboardPathForRole } from '@/utils/dashboardPaths'
import { UserRole } from '@/types'

type RequireRoleProps = {
  allow: UserRole[]
}

export const RequireRole: React.FC<RequireRoleProps> = ({ allow }) => {
  const { user, profile, loading } = useAuth()

  if (loading) return null

  if (!user) return <Navigate to="/login" replace />

  const normalizedRole = normalizeUserRole(profile?.role)

  if (!normalizedRole) {
    console.warn(
      `Redirecting user to /auth/profile-missing.`,
      `User: ${user.email}`,
      `Profile:`,
      profile
    )
    return <Navigate to="/auth/profile-missing" replace />
  }

  if (!allow.includes(normalizedRole)) {
    console.warn(
      `Redirecting user due to role mismatch.`,
      `User: ${user.email}`,
      `User Role: ${normalizedRole}`,
      `Allowed Roles: ${allow.join(', ')}`
    )
    return <Navigate to={getDashboardPathForRole(normalizedRole)} replace />
  }

  return <Outlet />
}
