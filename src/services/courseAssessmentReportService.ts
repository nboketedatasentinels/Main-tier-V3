import { supabase } from '@/services/supabase'
import {
  listCourseAssessmentsForSubjects,
  type CourseAssessmentOrgAggregateRow,
} from '@/services/courseAssessmentService'
import {
  COURSE_ASSESSMENT_ROLE_MATRIX,
  isPartnerPostWindowSuggested,
  type CourseAssessmentRaterRole,
} from '@/config/courseAssessmentRoles'
import { getJourneyWeeks, isJourneyType } from '@/utils/journeyType'
import type { JourneyType } from '@/config/pointsConfig'

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
  courses: Array<{
    courseKey: string
    courseTitle: string
    preSelf: number | null
    postSelf: number | null
    delta: number | null
    raterPosts: Array<{ role: string; avg: number | null }>
  }>
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

const phaseForLearner = (params: {
  journeyStatus?: string | null
  currentWeek?: number | null
  journeyType?: string | null
}): OrgAssessmentPhase => {
  if (params.journeyStatus === 'completed') return 'completed'
  const jt = isJourneyType(params.journeyType) ? (params.journeyType as JourneyType) : null
  const totalWeeks = jt ? getJourneyWeeks(jt) : null
  if (
    isPartnerPostWindowSuggested({
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

const buildCourseCards = (
  learnerId: string,
  rows: CourseAssessmentOrgAggregateRow[],
): LearnerAssessmentReportCard['courses'] => {
  const mine = rows.filter((r) => r.subject_user_id === learnerId)
  const byCourse = new Map<string, CourseAssessmentOrgAggregateRow[]>()
  for (const row of mine) {
    const list = byCourse.get(row.course_key) ?? []
    list.push(row)
    byCourse.set(row.course_key, list)
  }

  return Array.from(byCourse.entries()).map(([courseKey, courseRows]) => {
    const title = courseRows[0]?.course_title || courseKey
    const preSelf =
      courseRows.find((r) => r.kind === 'pre' && r.audience === 'self')?.score_avg ?? null
    const postSelf =
      courseRows.find((r) => r.kind === 'post' && r.audience === 'self')?.score_avg ?? null
    const raterPosts = courseRows
      .filter((r) => r.kind === 'post' && r.audience === 'external_rater')
      .map((r) => ({
        role:
          (r.rater_role && COURSE_ASSESSMENT_ROLE_MATRIX[r.rater_role as CourseAssessmentRaterRole]
            ?.label) ||
          r.rater_role ||
          'Rater',
        avg: r.score_avg,
      }))
    const delta =
      typeof preSelf === 'number' && typeof postSelf === 'number'
        ? Math.round((postSelf - preSelf) * 100) / 100
        : null
    return {
      courseKey,
      courseTitle: title,
      preSelf,
      postSelf,
      delta,
      raterPosts,
    }
  })
}

export const buildLearnerAssessmentReportCards = async (params: {
  learners: Array<{
    id: string
    name: string
    email?: string | null
    journeyStatus?: string | null
    currentWeek?: number | null
    journeyType?: string | null
  }>
}): Promise<LearnerAssessmentReportCard[]> => {
  const ids = params.learners.map((l) => l.id).filter(Boolean)
  const rows = await listCourseAssessmentsForSubjects(ids)

  return params.learners.map((learner) => {
    const jt = isJourneyType(learner.journeyType)
      ? (learner.journeyType as JourneyType)
      : null
    const phase = phaseForLearner(learner)
    const courses = buildCourseCards(learner.id, rows)
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
      courses,
    }
  })
}

export const buildOrgReportHtml = (params: {
  organizationName: string
  cards: LearnerAssessmentReportCard[]
}): { html: string; text: string; preview: string } => {
  const lines: string[] = []
  lines.push(`<p><strong>${params.organizationName}</strong> — combined Pre/Post course assessment report</p>`)
  lines.push(`<p>${params.cards.length} learner(s). Generated ${new Date().toLocaleString()}.</p>`)

  for (const card of params.cards) {
    lines.push(`<h3 style="margin:20px 0 8px">${card.learnerName}</h3>`)
    if (!card.courses.length) {
      lines.push(`<p style="color:#6b7280">No assessment submissions yet.</p>`)
      continue
    }
    lines.push(
      `<table style="width:100%;border-collapse:collapse;font-size:13px" border="1" cellpadding="6">
        <thead><tr style="background:#f8fafc"><th align="left">Course</th><th>Pre</th><th>Post</th><th>Δ</th><th align="left">Raters (Post)</th></tr></thead><tbody>`,
    )
    for (const course of card.courses) {
      const raters =
        course.raterPosts.map((r) => `${r.role}: ${r.avg ?? '—'}`).join('; ') || '—'
      lines.push(
        `<tr><td>${course.courseTitle}</td><td align="center">${course.preSelf ?? '—'}</td><td align="center">${course.postSelf ?? '—'}</td><td align="center">${course.delta ?? '—'}</td><td>${raters}</td></tr>`,
      )
    }
    lines.push(`</tbody></table>`)
  }

  const html = lines.join('\n')
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const preview = text.slice(0, 280)
  return { html, text, preview }
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
  cards: LearnerAssessmentReportCard[]
}): Promise<{ success: boolean; status: 'sent' | 'partial' | 'failed'; error?: string }> => {
  const recipients = params.recipients
    .map((r) => ({ email: r.email.trim().toLowerCase(), role: r.role }))
    .filter((r) => Boolean(r.email))

  if (!recipients.length) {
    return { success: false, status: 'failed', error: 'Add at least one recipient email' }
  }

  const { html, text, preview } = buildOrgReportHtml({
    organizationName: params.organizationName,
    cards: params.cards,
  })
  const subject = `${params.organizationName} — Course assessment report`

  let status: 'sent' | 'partial' | 'failed' = 'failed'
  let errorMessage: string | null = null

  try {
    const { data, error } = await supabase.functions.invoke<{
      success?: boolean
      partial?: boolean
      failed?: number
    }>('send-course-assessment-report', {
      body: {
        recipients,
        subject,
        organizationName: params.organizationName,
        htmlBody: html,
        textBody: text,
      },
    })
    if (error) throw error
    if (data?.success) status = 'sent'
    else if (data?.partial) status = 'partial'
    else status = 'failed'
    if (status !== 'sent') {
      errorMessage = 'One or more emails failed to send'
    }
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
      learnerCount: params.cards.length,
      learnerIds: params.cards.map((c) => c.learnerId),
    },
    learner_count: params.cards.length,
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
