import type { NavigateFunction } from 'react-router-dom'

/** Dedicated admin routes reached from the sidebar (not in-dashboard tabs). */
export const ADMIN_SIDEBAR_ROUTES: Record<string, string> = {
  'programme-submissions': '/admin/programme-submissions',
  'course-approvals': '/admin/course-approvals',
  'learner-assignments': '/admin/learner-assignments',
  'partner-assignment': '/admin/partner-assignment',
  'lift-assessments': '/admin/lift-assessments',
  organizations: '/admin/organizations',
  approvals: '/admin/approvals',
  overview: '/admin/dashboard',
}

/**
 * Shared sidebar navigation for admin sibling pages + SuperAdminDashboard.
 * In-dashboard keys (users, messaging, etc.) fall through to ?page=.
 */
export const handleAdminSidebarNavigate = (
  navigate: NavigateFunction,
  key: string,
  currentKey?: string,
): void => {
  if (currentKey && key === currentKey) return
  const route = ADMIN_SIDEBAR_ROUTES[key]
  if (route) {
    navigate(route)
    return
  }
  navigate(`/admin/dashboard?page=${encodeURIComponent(key)}`)
}
