/**
 * Checklist activities whose marks are issued by partner / mentor / coach
 * after attendance (or partner verification) — learners must not be sent into
 * a proof upload / submit flow for these.
 */
import type { ActivityDef } from '@/config/pointsConfig'

const PROGRAMME_COMPONENT_IDS = new Set(['capstone', 'case_study', 'practical'])

/** Attendance / assigned-mark activity ids (plus approval-type fallbacks). */
const ATTENDANCE_ASSIGNED_IDS = new Set([
  'webinar_workbook',
  'weekly_session',
  'mentor_meetup',
  'ambassador_session',
  'book_club',
  'shameless_circle',
  'lift_module',
])

type ActivityLike = Pick<ActivityDef, 'id' | 'approvalType'> & {
  requiresApproval?: boolean
  issuedByPartner?: boolean
}

export function isLeadershipAssignedActivity(activity: ActivityLike): boolean {
  if (!activity?.id || PROGRAMME_COMPONENT_IDS.has(activity.id)) return false
  if (ATTENDANCE_ASSIGNED_IDS.has(activity.id)) return true
  const type = activity.approvalType
  return type === 'partner_issued' || type === 'mentor_issued' || type === 'ambassador_issued'
}

export function getLeadershipAssignedGuidance(activity: ActivityLike): string {
  switch (activity.id) {
    case 'webinar_workbook':
      return 'You don’t need to submit or upload anything here. Your partner will assign marks when you attend the webinar.'
    case 'weekly_session':
      return 'You don’t need to submit or upload anything here. Your partner will assign marks when you attend the weekly session.'
    case 'book_club':
      return 'You don’t need to submit or upload anything here. Your partner will assign marks when you attend the book club session.'
    case 'shameless_circle':
      return 'You don’t need to submit or upload anything here. Your partner will assign marks when you attend the Shameless Circle session.'
    case 'lift_module':
      return 'You don’t need to submit or upload anything here. Your partner will assign marks when this LIFT module is completed and verified.'
    case 'mentor_meetup':
      return 'You don’t need to submit or upload anything here. Your mentor will assign +2,000 points when they confirm you attended the mentorship session.'
    case 'ambassador_session':
      return 'You don’t need to submit or upload anything here. Your coach will assign +2,000 points when they confirm you attended the coaching session.'
    default:
      break
  }

  if (activity.approvalType === 'mentor_issued') {
    return 'You don’t need to submit or upload anything here. Your mentor will assign marks when they confirm your attendance or completion.'
  }
  if (activity.approvalType === 'ambassador_issued') {
    return 'You don’t need to submit or upload anything here. Your coach will assign marks when they confirm your attendance or completion.'
  }
  return 'You don’t need to submit or upload anything here. Your partner will assign marks for this activity when you attend or complete it.'
}
