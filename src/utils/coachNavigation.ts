export type CoachDashboardSection =
  | 'overview'
  | 'coachees'
  | 'schedule'
  | 'assessments'
  | 'guidelines'

export type CoachNavDestination =
  | { kind: 'route'; path: string }
  | { kind: 'section'; section: CoachDashboardSection }

const DASHBOARD_SECTIONS = new Set<CoachDashboardSection>([
  'overview',
  'coachees',
  'schedule',
  'assessments',
])

export const resolveCoachNavDestination = (key: string): CoachNavDestination => {
  if (key === 'guidelines') {
    return { kind: 'route', path: '/coach/guidelines' }
  }
  if (key === 'notifications') {
    return { kind: 'route', path: '/coach/notifications' }
  }
  // Legacy Pre nav → Post assessments section
  if (key === 'pre-assessments') {
    return { kind: 'section', section: 'assessments' }
  }
  if (DASHBOARD_SECTIONS.has(key as CoachDashboardSection)) {
    return { kind: 'section', section: key as CoachDashboardSection }
  }
  return { kind: 'route', path: '/coach/dashboard' }
}
