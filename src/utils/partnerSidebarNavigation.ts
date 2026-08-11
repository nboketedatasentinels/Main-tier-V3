import type { NavigateFunction } from 'react-router-dom'

/** Dedicated partner routes reached from the sidebar (not in-dashboard tabs). */
export const PARTNER_SIDEBAR_ROUTES: Record<string, string> = {
  'partner-assignment': '/partner/partner-assignment',
  'learner-assignments': '/partner/learner-assignments',
  'course-approvals': '/partner/course-approvals',
  'programme-submissions': '/partner/programme-submissions',
  'course-surveys': '/partner/course-surveys',
  overview: '/partner/dashboard',
}

/**
 * Shared sidebar navigation for partner sibling pages + PartnerDashboard.
 * In-dashboard keys (users, organizations, etc.) fall through to ?page=.
 */
export const handlePartnerSidebarNavigate = (
  navigate: NavigateFunction,
  key: string,
  currentKey?: string,
): void => {
  if (currentKey && key === currentKey) return
  const route = PARTNER_SIDEBAR_ROUTES[key]
  if (route) {
    navigate(route)
    return
  }
  navigate(`/partner/dashboard?page=${encodeURIComponent(key)}`)
}
