/**
 * Checklist activities whose marks are issued by partner / mentor / coach
 * after attendance (or partner verification) - learners must not be sent into
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

/** Short CTA / toast title - action first. */
export function getLeadershipAssignedActionTitle(activity: ActivityLike): string {
 switch (activity.id) {
 case 'webinar_workbook':
 return 'Attend the webinar'
 case 'weekly_session':
 return 'Attend the weekly session'
 case 'book_club':
 return 'Attend book club'
 case 'shameless_circle':
 return 'Attend Shameless Circle'
 case 'lift_module':
 return 'Complete the LIFT module'
 case 'mentor_meetup':
 return 'Attend your mentor session'
 case 'ambassador_session':
 return 'Attend your coach session'
 default:
 break
 }
 if (activity.approvalType === 'mentor_issued') return 'Complete with your mentor'
 if (activity.approvalType === 'ambassador_issued') return 'Complete with your coach'
 return 'Complete this activity'
}

/**
 * Same voice for every assigned activity:
 * Attend/complete X. Who assigns points after they confirm - if you don’t, you won’t get those points.
 */
export function getLeadershipAssignedGuidance(activity: ActivityLike): string {
 switch (activity.id) {
 case 'webinar_workbook':
 return 'Attend the live webinar. Your partner assigns the points after they confirm you were there - if you don’t attend, you won’t get those points.'
 case 'weekly_session':
 return 'Attend the weekly session. Your partner assigns the points after they confirm you were there - if you don’t attend, you won’t get those points.'
 case 'book_club':
 return 'Attend the book club session. Your partner assigns the points after they confirm you were there - if you don’t attend, you won’t get those points.'
 case 'shameless_circle':
 return 'Attend Shameless Circle. Your partner assigns the points after they confirm you were there - if you don’t attend, you won’t get those points.'
 case 'lift_module':
 return 'Complete the LIFT module. Your partner assigns the points after they confirm it’s done - if you don’t finish it, you won’t get those points.'
 case 'mentor_meetup':
 return 'Attend your mentorship session. Your mentor assigns +2,000 points after they confirm you were there - if you don’t attend, you won’t get those points.'
 case 'ambassador_session':
 return 'Attend your coaching session. Your coach assigns +2,000 points after they confirm you were there - if you don’t attend, you won’t get those points.'
 default:
 break
 }

 if (activity.approvalType === 'mentor_issued') {
 return 'Complete this with your mentor. Your mentor assigns the points after they confirm it’s done - if you don’t complete it, you won’t get those points.'
 }
 if (activity.approvalType === 'ambassador_issued') {
 return 'Complete this with your coach. Your coach assigns the points after they confirm it’s done - if you don’t complete it, you won’t get those points.'
 }
 return 'Complete this activity. Your partner assigns the points after they confirm it’s done - if you don’t complete it, you won’t get those points.'
}
