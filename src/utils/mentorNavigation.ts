export type MentorDashboardSection =
  | 'overview'
  | 'mentees'
  | 'schedule'
  | 'pre-assessments'
  | 'assessments'

export type MentorNavDestination =
  | { kind: 'route'; path: string }
  | { kind: 'section'; section: MentorDashboardSection }

const DASHBOARD_SECTIONS = new Set<MentorDashboardSection>([
  'overview',
  'mentees',
  'schedule',
  'pre-assessments',
  'assessments',
])

export const resolveMentorNavDestination = (key: string): MentorNavDestination => {
  if (key === 'guidelines') {
    return { kind: 'route', path: '/mentor/guidelines' }
  }
  if (key === 'notifications') {
    return { kind: 'route', path: '/mentor/notifications' }
  }
  if (DASHBOARD_SECTIONS.has(key as MentorDashboardSection)) {
    return { kind: 'section', section: key as MentorDashboardSection }
  }
  return { kind: 'route', path: '/mentor/dashboard' }
}
