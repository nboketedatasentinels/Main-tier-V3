/**
 * Data-driven narrative + engagement helpers for performance reports.
 * Narratives are template text from computed numbers - not free-form invention.
 */
import type { LearnerReportMath, CourseReportMath } from '@/services/courseAssessmentReportMath'
import { scoreBandLabel } from '@/services/courseAssessmentReportMath'
import { JOURNEY_META, type JourneyType } from '@/config/pointsConfig'
import { isJourneyType } from '@/utils/journeyType'

export interface LearnerEngagementSnapshot {
 userId: string
 totalPoints: number
 passMark: number | null
 liveSessions: number
 modules: number
 impactLogs: number
 peerToPeer: number
 capstone: number
 webinar: number
}

export interface IdentityDupeFlag {
 learnerIds: string[]
 names: string[]
 message: string
}

export interface PersonNarrative {
 headline: string
 strengths: string[]
 gaps: string[]
 nextSteps: string[]
 selfAwarenessNote: string | null
}

const PAGE_SIZE = 1000
const UID_BATCH = 200

const chunk = <T,>(items: T[], size: number): T[][] => {
 const out: T[][] = []
 for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
 return out
}

const normalizeActivityId = (raw: string): string => {
 const id = raw.trim().toLowerCase()
 if (id === 'weekly_session' || id.startsWith('weekly_session_')) return 'weekly_session'
 if (id === 'lift_module' || id.startsWith('lift_module_')) return 'lift_module'
 if (id === 'impact_log' || id.startsWith('impact_log_')) return 'impact_log'
 if (id === 'capstone' || id.startsWith('capstone_')) return 'capstone'
 if (id === 'peer_to_peer' || id.startsWith('peer_to_peer_')) return 'peer_to_peer'
 if (id === 'webinar_workbook' || id.startsWith('webinar')) return 'webinar_workbook'
 return id
}

export const fetchEngagementSnapshots = async (params: {
 learners: Array<{ id: string; totalPoints?: number | null; journeyType?: string | null }>
}): Promise<Record<string, LearnerEngagementSnapshot>> => {
 const { supabase } = await import('@/services/supabase')
 const out: Record<string, LearnerEngagementSnapshot> = {}
 for (const learner of params.learners) {
 const jt =
 learner.journeyType && isJourneyType(learner.journeyType)
 ? (learner.journeyType as JourneyType)
 : null
 out[learner.id] = {
 userId: learner.id,
 totalPoints: learner.totalPoints ?? 0,
 passMark: jt ? JOURNEY_META[jt].passMarkPoints : null,
 liveSessions: 0,
 modules: 0,
 impactLogs: 0,
 peerToPeer: 0,
 capstone: 0,
 webinar: 0,
 }
 }

 const userIds = params.learners.map((l) => l.id).filter(Boolean)
 if (!userIds.length) return out

 for (const batch of chunk(userIds, UID_BATCH)) {
 let from = 0
 for (;;) {
 const { data, error } = await supabase
 .from('points_ledger')
 .select('uid, activity_id, points')
 .in('uid', batch)
 .order('id', { ascending: true })
 .range(from, from + PAGE_SIZE - 1)
 if (error) {
 console.warn('[fetchEngagementSnapshots]', error.message)
 break
 }
 const page = (data ?? []) as Array<{
 uid: string | null
 activity_id: string | null
 points: number | null
 }>
 for (const row of page) {
 if (!row.uid || !row.activity_id) continue
 if ((row.points ?? 0) <= 0) continue
 const snap = out[row.uid]
 if (!snap) continue
 const id = normalizeActivityId(row.activity_id)
 if (id === 'weekly_session') snap.liveSessions += 1
 else if (id === 'lift_module') snap.modules += 1
 else if (id === 'impact_log') snap.impactLogs += 1
 else if (id === 'peer_to_peer') snap.peerToPeer += 1
 else if (id === 'capstone') snap.capstone += 1
 else if (id === 'webinar_workbook') snap.webinar += 1
 }
 if (page.length < PAGE_SIZE) break
 from += PAGE_SIZE
 }
 }

 return out
}

const normalizePersonName = (name: string): string =>
 name
 .toLowerCase()
 .replace(/[^a-z\s]/g, ' ')
 .replace(/\s+/g, ' ')
 .trim()

/** Flag likely duplicate identities (same normalized name, different ids). */
export const detectIdentityDuplicates = (
 learners: Array<{ id: string; name: string }>,
): IdentityDupeFlag[] => {
 const byName = new Map<string, Array<{ id: string; name: string }>>()
 for (const learner of learners) {
 const key = normalizePersonName(learner.name)
 if (!key || key.length < 4) continue
 const list = byName.get(key) ?? []
 list.push(learner)
 byName.set(key, list)
 }
 const flags: IdentityDupeFlag[] = []
 for (const [, group] of byName) {
 const uniqueIds = Array.from(new Set(group.map((g) => g.id)))
 if (uniqueIds.length < 2) continue
 flags.push({
 learnerIds: uniqueIds,
 names: Array.from(new Set(group.map((g) => g.name))),
 message: `Possible duplicate identity: ${group.map((g) => g.name).join(' / ')} (${uniqueIds.length} profile ids). Confirm and merge offline before publishing.`,
 })
 }
 return flags
}

const fmtDelta = (n: number | null | undefined): string => {
 if (typeof n !== 'number' || !Number.isFinite(n)) return '-'
 return `${n > 0 ? '+' : ''}${n.toFixed(2)}`
}

const fmt = (n: number | null | undefined): string => {
 if (typeof n !== 'number' || !Number.isFinite(n)) return '-'
 return n.toFixed(2)
}

export const buildPersonNarrative = (params: {
 name: string
 math: LearnerReportMath
 engagement?: LearnerEngagementSnapshot | null
 cohortRankByGrowth?: number | null
 cohortSize?: number | null
}): PersonNarrative => {
 const { name, math, engagement } = params
 const courses = math.courses
 const growth = math.overallObserverGrowth
 const pre = math.overallObserverPre
 const post = math.overallObserverPost

 const ranked = [...courses].sort(
 (a, b) => (b.observerMatchedGrowth ?? -99) - (a.observerMatchedGrowth ?? -99),
 )
 const best = ranked[0]
 const weakest = [...courses].sort(
 (a, b) => (a.observerEndState ?? a.observerPost ?? 99) - (b.observerEndState ?? b.observerPost ?? 99),
 )[0]

 const strengths: string[] = []
 const gaps: string[] = []
 const nextSteps: string[] = []

 if (growth != null && pre != null && post != null) {
 strengths.push(
 `Observed growth ${fmtDelta(growth)} (${fmt(pre)} → ${fmt(post)}) across assessed courses, using matched observer Pre/Post only.`,
 )
 }
 if (best?.observerMatchedGrowth != null && best.observerMatchedGrowth > 0) {
 strengths.push(
 `Largest course lift on ${best.courseTitle} (${fmtDelta(best.observerMatchedGrowth)}; end-state ${scoreBandLabel(best.observerEndState ?? best.observerPost)}).`,
 )
 }
 if (engagement) {
 if (engagement.modules > 0) {
 strengths.push(`Module claims logged: ${engagement.modules}.`)
 }
 if (engagement.liveSessions > 0) {
 strengths.push(`Live session claims logged: ${engagement.liveSessions}.`)
 }
 }

 if (weakest && (weakest.observerEndState ?? weakest.observerPost) != null) {
 const end = weakest.observerEndState ?? weakest.observerPost
 if (end != null && end < 7) {
 gaps.push(
 `${weakest.courseTitle} ended in the ${scoreBandLabel(end)} band (${fmt(end)}); planning/application depth is a likely next frontier.`,
 )
 }
 }

 const selfGapCourses = courses.filter(
 (c) => c.selfVsObserverGap != null && Math.abs(c.selfVsObserverGap) >= 1.5,
 )
 let selfAwarenessNote: string | null = null
 if (selfGapCourses.length) {
 const c = selfGapCourses[0]
 const gap = c.selfVsObserverGap!
 if (gap > 0) {
 selfAwarenessNote = `Self-versus-observer gap: rates higher than observers on ${c.courseTitle} (self ${fmt(c.selfPost)} vs observed ${fmt(c.observerEndState)}; gap ${fmtDelta(gap)}). Calibration is the priority.`
 gaps.push(selfAwarenessNote)
 } else {
 selfAwarenessNote = `Self-versus-observer gap: rates lower than observers on ${c.courseTitle} (self ${fmt(c.selfPost)} vs observed ${fmt(c.observerEndState)}; gap ${fmtDelta(gap)}). Confidence building is the priority.`
 gaps.push(selfAwarenessNote)
 }
 } else if (courses.every((c) => c.selfMatchedGrowth == null)) {
 selfAwarenessNote =
 'No matched self Pre/Post on file. Recommend capturing a valid self-assessment next cycle.'
 gaps.push(selfAwarenessNote)
 }

 if (engagement) {
 if (engagement.impactLogs === 0 && engagement.capstone === 0) {
 gaps.push('No impact-log or capstone claims yet - learning has not yet converted into application evidence.')
 }
 if (engagement.passMark != null && engagement.totalPoints < engagement.passMark) {
 gaps.push(
 `Engagement points ${engagement.totalPoints.toLocaleString()} are below the journey pass mark (${engagement.passMark.toLocaleString()}).`,
 )
 }
 }

 if (!strengths.length) {
 strengths.push('Assessment data is still incomplete; strengths will firm up once matched observer Pre/Post exist.')
 }
 if (!gaps.length) {
 gaps.push('No major numerical gaps flagged from current matched observer data.')
 }

 nextSteps.push(
 'Assign a live transformation micro-project with a required impact log so new behaviors produce a visible result.',
 )
 if (engagement && engagement.modules < 2) {
 nextSteps.push('Complete remaining course modules and keep live-session participation consistent.')
 }
 if (selfGapCourses.length) {
 nextSteps.push('Run a short manager calibration conversation on self-versus-observer ratings.')
 }
 if (best && (best.observerEndState ?? 0) >= 7) {
 nextSteps.push(
 `Given strong end-state on ${best.courseTitle}, consider a peer-facilitation or emerging-leader stretch.`,
 )
 }

 const headline =
 growth != null && pre != null && post != null
 ? `Overall observed growth ${fmtDelta(growth)} (${fmt(pre)} → ${fmt(post)}) across assessed courses.`
 : `Observer matched growth not yet computable for ${name} - complete Manager/Partner Pre and Post.`

 return { headline, strengths, gaps, nextSteps, selfAwarenessNote }
}

export const buildCohortPatterns = (params: {
 learners: Array<{
 id: string
 name: string
 math: LearnerReportMath
 engagement?: LearnerEngagementSnapshot | null
 }>
 enrolledCount: number
 courseGrowth: Array<{ courseKey: string; courseTitle: string; meanObserverGrowth: number | null }>
}): {
 working: string[]
 gaps: string[]
 highestValueMove: string
 recommendations: Array<{ action: string; why: string }>
} => {
 const assessed = params.learners.filter((l) => l.math.courses.length > 0)
 const improved = assessed.filter((l) => (l.math.overallObserverGrowth ?? 0) > 0)
 const topCourse = [...params.courseGrowth].sort(
 (a, b) => (b.meanObserverGrowth ?? -99) - (a.meanObserverGrowth ?? -99),
 )[0]

 const working: string[] = []
 const gaps: string[] = []

 if (improved.length && improved.length === assessed.length) {
 working.push(
 `Universal observed improvement among assessed learners (${improved.length}/${assessed.length}) on matched Manager/Partner ratings.`,
 )
 } else if (improved.length) {
 working.push(
 `${improved.length} of ${assessed.length} assessed learners show positive matched observer growth.`,
 )
 }

 if (topCourse?.meanObserverGrowth != null) {
 working.push(
 `${topCourse.courseTitle} produced the largest collective lift (${fmtDelta(topCourse.meanObserverGrowth)}).`,
 )
 }

 const selfDirected = assessed.filter((l) => (l.engagement?.modules ?? 0) >= 2 && (l.engagement?.liveSessions ?? 0) <= 2)
 if (selfDirected.length) {
 working.push(
 `${selfDirected.length} learner(s) show module follow-through with relatively low live-session claims - capacity to learn independently.`,
 )
 }

 const noApplication = assessed.filter(
 (l) => (l.engagement?.impactLogs ?? 0) === 0 && (l.engagement?.capstone ?? 0) === 0,
 )
 if (noApplication.length) {
 gaps.push(
 `Learning hasn't yet become delivery for ${noApplication.length} assessed learner(s): impact logs and capstone claims sit at zero.`,
 )
 }

 const overUnder = assessed.filter((l) =>
 l.math.courses.some((c) => c.selfVsObserverGap != null && Math.abs(c.selfVsObserverGap) >= 1.5),
 )
 if (overUnder.length) {
 gaps.push(
 `${overUnder.length} learner(s) show a material self-versus-observer gap (≥1.5). Both over- and under-rating are coachable.`,
 )
 }

 const missingAssess = params.enrolledCount - assessed.length
 if (missingAssess > 0) {
 gaps.push(
 `Assessment-completion gap: ${assessed.length} of ${params.enrolledCount} enrolled have assessment rows (${missingAssess} missing).`,
 )
 }

 const belowPass = assessed.filter(
 (l) => l.engagement?.passMark != null && l.engagement.totalPoints < l.engagement.passMark,
 )
 if (belowPass.length) {
 const topPts = Math.max(...assessed.map((l) => l.engagement?.totalPoints ?? 0), 0)
 gaps.push(
 `${belowPass.length} assessed learner(s) remain below journey pass mark (top points among assessed: ${topPts.toLocaleString()}).`,
 )
 }

 const highestValueMove =
 'Put each practitioner on a small, real transformation task with a required impact-log and a capstone. That is where ownership and project behavior convert into measurable results - and where points (and evidence) compound past the pass line.'

 const recommendations = [
 {
 action:
 'Assign each graduate a live transformation micro-project with a required impact log and capstone.',
 why: 'Converts behavior change into delivered outcomes; closes the application gap.',
 },
 {
 action: 'Run a short manager calibration on rating consistency and over/under self-rating patterns.',
 why: 'Sharpens feedback quality and individual self-awareness.',
 },
 {
 action: 'Make Pre, Post and self assessments mandatory completion gates next cohort; one stable ID per person.',
 why: 'Closes completion gaps and prevents identity/data errors.',
 },
 {
 action:
 'Stream talent: high end-state / high-growth learners to an emerging-leader track; targeted coaching for the rest.',
 why: 'Matches development to demonstrated readiness from matched observer scores.',
 },
 {
 action: 'Re-run with the full cohort and a locked instrument; resolve any offline-flagged α or identity issues first.',
 why: 'Strengthens the evidence base for future investment decisions.',
 },
 ]

 return { working, gaps, highestValueMove, recommendations }
}

/** Simple SVG bar chart for course growth (no external deps). */
export const buildGrowthBarChartSvg = (
 bars: Array<{ label: string; value: number }>,
): string => {
 if (!bars.length) {
 return `<div class="img-placeholder">Awaiting matched observer growth</div>`
 }
 const width = 640
 const height = 180
 const pad = 28
 const max = Math.max(...bars.map((b) => Math.abs(b.value)), 0.5)
 const barW = Math.min(80, (width - pad * 2) / bars.length - 12)
 const zeroY = height / 2

 const rects = bars
 .map((b, i) => {
 const x = pad + i * ((width - pad * 2) / bars.length) + 6
 const h = (Math.abs(b.value) / max) * (height / 2 - 20)
 const y = b.value >= 0 ? zeroY - h : zeroY
 const label = b.label.length > 22 ? `${b.label.slice(0, 20)}…` : b.label
 return `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 2)}" fill="${b.value >= 0 ? '#2a5f8a' : '#c2410c'}" rx="4"/>
 <text x="${x + barW / 2}" y="${b.value >= 0 ? y - 6 : y + h + 14}" text-anchor="middle" font-size="11" fill="#1d2b3f">${b.value >= 0 ? '+' : ''}${b.value.toFixed(2)}</text>
 <text x="${x + barW / 2}" y="${height - 8}" text-anchor="middle" font-size="10" fill="#4b6985">${label.replace(/&/g, '&amp;')}</text>`
 })
 .join('')

 return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Cohort growth chart" style="background:#f5f9ff;border-radius:16px;border:1px solid #d4dfea">
 <line x1="${pad}" y1="${zeroY}" x2="${width - pad}" y2="${zeroY}" stroke="#b6c9de" />
 ${rects}
 </svg>`
}

export const buildPersonSparkSvg = (courses: CourseReportMath[]): string => {
 const points = courses
 .filter((c) => c.observerPre != null && c.observerPost != null)
 .map((c) => ({ label: c.courseTitle, pre: c.observerPre!, post: c.observerPost! }))
 if (!points.length) {
 return `<div class="img-placeholder medium">Observer Pre→Post chart - awaiting matched data</div>`
 }
 const width = 520
 const height = 120
 const pad = 24
 const max = 10
 const groupW = (width - pad * 2) / points.length

 const bars = points
 .map((p, i) => {
 const x0 = pad + i * groupW + 8
 const preH = (p.pre / max) * (height - 36)
 const postH = (p.post / max) * (height - 36)
 const base = height - 20
 return `<rect x="${x0}" y="${base - preH}" width="14" height="${preH}" fill="#8fb0d1" rx="2"/>
 <rect x="${x0 + 18}" y="${base - postH}" width="14" height="${postH}" fill="#2a5f8a" rx="2"/>
 <text x="${x0 + 16}" y="${height - 4}" text-anchor="middle" font-size="9" fill="#4b6985">${p.label.slice(0, 14).replace(/&/g, '&amp;')}</text>`
 })
 .join('')

 return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" style="background:#f5f9ff;border-radius:12px;border:1px solid #d4dfea">
 <text x="${pad}" y="14" font-size="10" fill="#4b6985">Pre (light) → Post (dark) · observer</text>
 ${bars}
 </svg>`
}
