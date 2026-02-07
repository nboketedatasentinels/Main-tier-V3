import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getLandingPathForRole } from '@/utils/roleRouting'
import { getDashboardPathForRole } from '@/utils/dashboardPaths'
import type { StandardRole } from '@/types'

type RequireRoleProps = {
  allow: StandardRole[]
}

export const RequireRole: React.FC<RequireRoleProps> = ({ allow }) => {
  const { user, profile, loading, effectiveRole, effectiveRoleSource } = useAuth()

  if (loading) return null

  if (!user) return <Navigate to="/login" replace />

  if (!profile || effectiveRoleSource === 'fallback') {
    console.warn(
      `Redirecting user to /auth/profile-missing.`,
      `User: ${user.email}`,
      `Profile:`,
      profile
    )
    return <Navigate to="/auth/profile-missing" replace />
  }

  const normalizedRole: StandardRole = effectiveRole

  if (!allow.includes(normalizedRole)) {
    console.log("ROLE_REDIRECT", {
      rawRole: profile?.role,
      normalized: normalizedRole,
      landing: getDashboardPathForRole(normalizedRole),
    })
    console.warn(
      `Redirecting user due to role mismatch.`,
      `User: ${user.email}`,
      `User Role: ${normalizedRole}`,
      `Allowed Roles: ${allow.join(', ')}`,
      `Profile state at time of check:`,
      profile
    )
    return <Navigate to={getLandingPathForRole({ ...profile, role: normalizedRole })} replace />
  }

  return <Outlet />
}
