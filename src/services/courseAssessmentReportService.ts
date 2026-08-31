import { supabase } from '@/services/supabase'
import {
 listCourseAssessmentResponsesForSubjects,
 type CourseAssessmentResponseRow,
} from '@/services/courseAssessmentService'
import {
 computeCohortReportMath,
 type CohortReportMath,
 type IntegrityFlag,
} from '@/services/courseAssessmentReportMath'
import { isPartnerPostWindowSuggested as softWindow } from '@/config/courseAssessmentRoles'
import { getJourneyWeeks, isJourneyType, getJourneyLabel } from '@/utils/journeyType'
import type { JourneyType } from '@/config/pointsConfig'
import {
 buildCourseAssessmentHtmlReport,
 type ReportLearnerProfile,
} from '@/reports/courseAssessmentHtmlReport'
import {
 detectIdentityDuplicates,
 fetchEngagementSnapshots,
 type IdentityDupeFlag,
 type LearnerEngagementSnapshot,
} from '@/services/courseAssessmentReportNarratives'
import { PERSONALITY_TYPES } from '@/config/personality-data'
import { ageRangeLabel } from '@/config/demographics'

export type ReportAudienceRole = 'sponsor' | 'hr' | 'senior_mgmt' | 'line_manager' | 'other'

export const REPORT_AUDIENCE_OPTIONS: { id: ReportAudienceRole; label: string }[] = [
 { id: 'sponsor', label: 'Sponsor' },
 { id: 'hr', label: 'HR' },
 { id: 'senior_mgmt', label: 'Senior management' },
 { id: 'line_manager', label: 'Line manager' },
 { id: 'other', label: 'Other' },
]

export type OrgAssessmentPhase = 'early' | 'near_end' | 'completed'

export interface LearnerAssessmentReportCard {
 learnerId: string
 learnerName: string
 email?: string | null
 journeyStatus?: string | null
 currentWeek?: number | null
 totalWeeks?: number | null
 phase: OrgAssessmentPhase
 partnerPostDone: boolean
 overallObserverGrowth: number | null
 overallObserverPre: number | null
 overallObserverPost: number | null
 courses: Array<{
 courseKey: string
 courseTitle: string
 preSelf: number | null
 postSelf: number | null
 delta: number | null
 observerPre: number | null
 observerPost: number | null
 observerMatchedGrowth: number | null
 bandEnd: string | null
 raterPosts: Array<{ role: string; avg: number | null }>
 flags: IntegrityFlag[]
 }>
 flags: IntegrityFlag[]
}

export interface CourseAssessmentReportSendRow {
 id: string
 organization_id: string
 organization_name: string | null
 sent_by: string
 recipients: Array<{ email: string; role?: string }>
 recipient_roles: string[]
 subject: string
 body_preview: string | null
 learner_count: number
 status: 'sent' | 'partial' | 'failed'
 error_message: string | null
 sent_at: string
}

export interface BuiltAssessmentReportWorkspace {
 cards: LearnerAssessmentReportCard[]
 cohort: CohortReportMath
 profiles: ReportLearnerProfile[]
 orgPhase: OrgAssessmentPhase
 partnerHtml: string
 offlineFlags: IntegrityFlag[]
 engagementByLearner: Record<string, LearnerEngagementSnapshot>
 identityFlags: IdentityDupeFlag[]
}

// Re-export soft window helper name used by pages
export { softWindow as isPartnerPostWindowSuggested }
const phaseForLearner = (params: {
 journeyStatus?: string | null
 currentWeek?: number | null
 journeyType?: string | null
}): OrgAssessmentPhase => {
 if (params.journeyStatus === 'completed') return 'completed'
 const jt = isJourneyType(params.journeyType) ? (params.journeyType as JourneyType) : null
 const totalWeeks = jt ? getJourneyWeeks(jt) : null
 if (
 softWindow({
 journeyStatus: params.journeyStatus,
 currentWeek: params.currentWeek,
 totalWeeks,
 })
 ) {
 return 'near_end'
 }
 return 'early'
}

export const resolveOrgAssessmentPhase = (
 learnerPhases: OrgAssessmentPhase[],
): OrgAssessmentPhase => {
 if (!learnerPhases.length) return 'early'
 if (learnerPhases.every((p) => p === 'completed')) return 'completed'
 if (learnerPhases.some((p) => p === 'near_end' || p === 'completed')) return 'near_end'
 return 'early'
}

const personalityLabel = (type?: string | null): string | null => {
 if (!type) return null
 const hit = PERSONALITY_TYPES.find((p) => p.type === type)
 return hit ? hit.name : null
}

const toInitials = (name: string): string =>
 name
 .split(/\s+/)
 .filter(Boolean)
 .slice(0, 2)
 .map((p) => p[0]?.toUpperCase() ?? '')
 .join('') || '?'

export interface ReportLearnerInput {
 id: string
 name: string
 email?: string | null
 journeyStatus?: string | null
 currentWeek?: number | null
 journeyType?: string | null
 roleLabel?: string | null
 ageRange?: string | null
 personalityType?: string | null
 coreValues?: string[]
 totalPoints?: number | null
}

export const buildAssessmentReportWorkspace = async (params: {
 organizationName: string
 learners: ReportLearnerInput[]
 mode?: 'partner' | 'learner'
 viewerLearnerId?: string
}): Promise<BuiltAssessmentReportWorkspace> => {
 const ids = params.learners.map((l) => l.id).filter(Boolean)
 const rows: CourseAssessmentResponseRow[] = await listCourseAssessmentResponsesForSubjects(ids)
 const cohort = computeCohortReportMath({ learnerIds: ids, rows })
 const mathById = new Map(cohort.learners.map((l) => [l.learnerId, l]))

 const profiles: ReportLearnerProfile[] = params.learners.map((l) => ({
 id: l.id,
 name: l.name,
 initials: toInitials(l.name),
 email: l.email,
 roleLabel: l.roleLabel,
 ageRange: l.ageRange ? ageRangeLabel(l.ageRange) || l.ageRange : null,
 personalityType: l.personalityType,
 personalityLabel: personalityLabel(l.personalityType),
 coreValues: l.coreValues,
 totalPoints: l.totalPoints,
 }))

 const cards: LearnerAssessmentReportCard[] = params.learners.map((learner) => {
 const jt = isJourneyType(learner.journeyType)
 ? (learner.journeyType as JourneyType)
 : null
 const phase = phaseForLearner(learner)
 const math = mathById.get(learner.id)
 const partnerPostDone = rows.some(
 (r) =>
 r.subject_user_id === learner.id &&
 r.kind === 'post' &&
 r.rater_role === 'partner',
 )

 return {
 learnerId: learner.id,
 learnerName: learner.name,
 email: learner.email,
 journeyStatus: learner.journeyStatus,
 currentWeek: learner.currentWeek,
 totalWeeks: jt ? getJourneyWeeks(jt) : null,
 phase,
 partnerPostDone,
 overallObserverGrowth: math?.overallObserverGrowth ?? null,
 overallObserverPre: math?.overallObserverPre ?? null,
 overallObserverPost: math?.overallObserverPost ?? null,
 courses: (math?.courses ?? []).map((c) => ({
 courseKey: c.courseKey,
 courseTitle: c.courseTitle,
 preSelf: c.selfPre,
 postSelf: c.selfPost,
 delta: c.selfMatchedGrowth,
 observerPre: c.observerPre,
 observerPost: c.observerPost,
 observerMatchedGrowth: c.observerMatchedGrowth,
 bandEnd: c.bandEnd,
 raterPosts: c.raters
 .filter((r) => r.raterRole !== 'learner')
 .map((r) => ({ role: r.roleLabel, avg: r.postAvg })),
 flags: c.flags,
 })),
 flags: math?.flags ?? [],
 }
 })

 const orgPhase = resolveOrgAssessmentPhase(cards.map((c) => c.phase))
 const journeyTypes = params.learners
 .map((l) => l.journeyType)
 .filter((t): t is string => Boolean(t))
 const primaryJourney = journeyTypes[0]
 const journeyLabel =
 primaryJourney && isJourneyType(primaryJourney)
 ? getJourneyLabel(primaryJourney)
 : primaryJourney || 'Journey'

 const engagementByLearner = await fetchEngagementSnapshots({
 learners: params.learners.map((l) => ({
 id: l.id,
 totalPoints: l.totalPoints,
 journeyType: l.journeyType,
 })),
 })

 const identityFlags = detectIdentityDuplicates(
 params.learners.map((l) => ({ id: l.id, name: l.name })),
 )

 const identityOffline: IntegrityFlag[] = identityFlags.map((f) => ({
 code: 'offline_required',
 severity: 'blocker',
 message: f.message,
 offline: true,
 }))

 const { html: partnerHtml } = buildCourseAssessmentHtmlReport({
 organizationName: params.organizationName,
 journeyLabel,
 mode: params.mode === 'learner' ? 'learner' : 'partner',
 viewerLearnerId: params.viewerLearnerId,
 profiles,
 cohort,
 enrolledCount: params.learners.length,
 engagementByLearner,
 identityFlags,
 })

 const offlineFlags = [
 ...cohort.flags.filter((f) => f.offline),
 ...identityOffline,
 ]

 return {
 cards,
 cohort,
 profiles,
 orgPhase,
 partnerHtml,
 offlineFlags,
 engagementByLearner,
 identityFlags,
 }
}

/** @deprecated Prefer buildAssessmentReportWorkspace - kept for simple card lists */
export const buildLearnerAssessmentReportCards = async (params: {
 learners: ReportLearnerInput[]
 organizationName?: string
}): Promise<LearnerAssessmentReportCard[]> => {
 const workspace = await buildAssessmentReportWorkspace({
 organizationName: params.organizationName || 'Organization',
 learners: params.learners,
 })
 return workspace.cards
}

export const buildOrgReportHtml = (params: {
 organizationName: string
 cards: LearnerAssessmentReportCard[]
 cohort?: CohortReportMath
 profiles?: ReportLearnerProfile[]
}): { html: string; text: string; preview: string } => {
 if (params.cohort && params.profiles) {
 return buildCourseAssessmentHtmlReport({
 organizationName: params.organizationName,
 mode: 'partner',
 profiles: params.profiles,
 cohort: params.cohort,
 enrolledCount: params.profiles.length,
 })
 }
 // Fallback minimal table if cohort not supplied
 const lines = [
 `<p><strong>${params.organizationName}</strong> - course assessment report</p>`,
 ...params.cards.map((card) => {
 const growth = card.overallObserverGrowth
 return `<h3>${card.learnerName}</h3><p>Observer growth: ${growth ?? '-'}</p>`
 }),
 ]
 const html = lines.join('\n')
 const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
 return { html, text, preview: text.slice(0, 280) }
}

export const listReportSendLog = async (
 organizationId: string,
): Promise<CourseAssessmentReportSendRow[]> => {
 const { data, error } = await supabase
 .from('course_assessment_report_sends')
 .select('*')
 .eq('organization_id', organizationId)
 .order('sent_at', { ascending: false })
 .limit(50)

 if (error) throw error
 return (data as CourseAssessmentReportSendRow[]) ?? []
}

export const emailOrgAssessmentReport = async (params: {
 organizationId: string
 organizationName: string
 sentBy: string
 recipients: Array<{ email: string; role: ReportAudienceRole }>
 html: string
 text?: string
 learnerCount: number
 learnerIds: string[]
 offlineFlags?: IntegrityFlag[]
}): Promise<{ success: boolean; status: 'sent' | 'partial' | 'failed'; error?: string }> => {
 const recipients = params.recipients
 .map((r) => ({ email: r.email.trim().toLowerCase(), role: r.role }))
 .filter((r) => Boolean(r.email))

 if (!recipients.length) {
 return { success: false, status: 'failed', error: 'Add at least one recipient email' }
 }

 const text =
 params.text ||
 params.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
 const preview = text.slice(0, 280)
 const subject = `${params.organizationName} - Course assessment performance report`

 let status: 'sent' | 'partial' | 'failed' = 'failed'
 let errorMessage: string | null = null

 try {
 const { data, error } = await supabase.functions.invoke<{
 success?: boolean
 partial?: boolean
 }>('send-course-assessment-report', {
 body: {
 recipients,
 subject,
 organizationName: params.organizationName,
 htmlBody: params.html,
 textBody: text,
 },
 })
 if (error) throw error
 if (data?.success) status = 'sent'
 else if (data?.partial) status = 'partial'
 else status = 'failed'
 if (status !== 'sent') errorMessage = 'One or more emails failed to send'
 } catch (err) {
 status = 'failed'
 errorMessage = err instanceof Error ? err.message : String(err)
 }

 const { error: logError } = await supabase.from('course_assessment_report_sends').insert({
 organization_id: params.organizationId,
 organization_name: params.organizationName,
 sent_by: params.sentBy,
 recipients,
 recipient_roles: recipients.map((r) => r.role),
 subject,
 body_preview: preview,
 report_snapshot: {
 learnerCount: params.learnerCount,
 learnerIds: params.learnerIds,
 offlineFlags: params.offlineFlags ?? [],
 },
 learner_count: params.learnerCount,
 status,
 error_message: errorMessage,
 sent_at: new Date().toISOString(),
 })

 if (logError) {
 console.warn('[emailOrgAssessmentReport] send log insert failed', logError)
 }

 return {
 success: status === 'sent',
 status,
 error: errorMessage ?? undefined,
 }
}
