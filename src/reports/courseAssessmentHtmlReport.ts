/**
 * HTML Performance Report — partner (full cohort) vs learner (own page only).
 * Layout/structure mirrors the Environmental Systems sample document.
 */
import {
  SCORE_BANDS,
  scoreBandLabel,
  type CohortReportMath,
  type CourseReportMath,
  type IntegrityFlag,
  type LearnerReportMath,
} from '@/services/courseAssessmentReportMath'
import type {
  IdentityDupeFlag,
  LearnerEngagementSnapshot,
  PersonNarrative,
} from '@/services/courseAssessmentReportNarratives'
import {
  buildCohortPatterns,
  buildGrowthBarChartSvg,
  buildPersonNarrative,
  buildPersonSparkSvg,
} from '@/services/courseAssessmentReportNarratives'

export interface ReportLearnerProfile {
  id: string
  name: string
  initials: string
  email?: string | null
  roleLabel?: string | null
  ageRange?: string | null
  personalityType?: string | null
  personalityLabel?: string | null
  coreValues?: string[]
  totalPoints?: number | null
}

export interface BuildHtmlReportParams {
  organizationName: string
  journeyLabel?: string | null
  coursePillarLabel?: string | null
  /** Partner = everyone; learner = filter to one id */
  mode: 'partner' | 'learner'
  viewerLearnerId?: string
  profiles: ReportLearnerProfile[]
  cohort: CohortReportMath
  enrolledCount?: number
  generatedAt?: Date
  engagementByLearner?: Record<string, LearnerEngagementSnapshot>
  identityFlags?: IdentityDupeFlag[]
}

const esc = (value: string | null | undefined): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const fmt = (n: number | null | undefined, digits = 2): string => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

const fmtDelta = (n: number | null | undefined): string => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}`
}

const REPORT_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #f2f4f8; font-family: Inter, system-ui, sans-serif; padding: 40px 20px; display: flex; flex-direction: column; align-items: center; color: #1d3349; }
.report-container { max-width: 1100px; width: 100%; background: white; box-shadow: 0 20px 40px rgba(0,0,0,0.08), 0 6px 12px rgba(0,0,0,0.05); border-radius: 28px; padding: 40px 48px; margin-bottom: 30px; }
.page-divider { margin: 48px 0 32px 0; border-bottom: 1px solid #e6edf4; }
.title-1 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; color: #0b1c2e; }
.title-2 { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; color: #1d2b3f; margin-top: 8px; }
.eyebrow { font-size: 13px; font-weight: 600; color: #3e6b9c; text-transform: uppercase; letter-spacing: 0.5px; }
.badge { background: #eef3f9; color: #1e3a5f; padding: 4px 14px; border-radius: 40px; font-size: 13px; font-weight: 600; display: inline-block; }
.score-band { background: #eef3f9; border-radius: 40px; padding: 2px 12px; font-weight: 600; font-size: 13px; color: #1e3a5f; }
.highlight-box { background: #f5f9ff; border-left: 4px solid #2a5f8a; padding: 14px 20px; border-radius: 8px; margin: 16px 0; }
.person-card { background: #f9fbfd; border-radius: 20px; padding: 18px 20px 20px; margin: 24px 0 12px; border: 1px solid #e5edf5; }
.person-header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.person-name { font-size: 20px; font-weight: 700; color: #0e1f30; }
.person-role { font-size: 14px; color: #3a5772; background: #e3ecf5; padding: 3px 14px; border-radius: 40px; }
.pill { background: #d9e3ef; padding: 2px 14px; border-radius: 30px; font-size: 12px; font-weight: 600; color: #1d3f62; }
.values-list { display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 10px 0 4px; font-size: 13px; color: #1d3752; }
.two-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.three-col-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
.narrative-box { background: #fff; border: 1px solid #e2e9f0; border-radius: 14px; padding: 14px 16px; }
.narrative-box h4 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #3e6b9c; margin-bottom: 8px; }
.narrative-box ul { list-style: none; padding: 0; font-size: 13px; line-height: 1.55; color: #1d3349; }
.narrative-box li { margin: 0 0 6px; padding-left: 12px; position: relative; }
.narrative-box li::before { content: "•"; position: absolute; left: 0; color: #2a5f8a; }
.engagement-row { display: flex; flex-wrap: wrap; gap: 8px 12px; margin: 10px 0 14px; }
.engagement-chip { background: #eef3f9; color: #1e3a5f; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.data-table { width: 100%; border-collapse: collapse; font-size: 14px; background: #fafbfc; border-radius: 16px; overflow: hidden; margin: 18px 0; }
.data-table th { background: #eef3f9; color: #1d2b3f; font-weight: 600; padding: 12px 16px; text-align: left; border-bottom: 1px solid #d4dfea; }
.data-table td { padding: 12px 16px; border-bottom: 1px solid #e2e9f0; vertical-align: top; }
.data-table tr:last-child td { border-bottom: none; }
.img-placeholder { background: #e9edf3; border-radius: 16px; min-height: 100px; display: flex; align-items: center; justify-content: center; color: #1e3a5f; font-weight: 500; font-size: 14px; padding: 18px 20px; border: 1px dashed #b6c9de; text-align: center; margin: 14px 0; }
.img-placeholder.medium { min-height: 120px; }
.flag { background: #fff7ed; border: 1px solid #fdba74; color: #9a3412; padding: 8px 12px; border-radius: 10px; font-size: 13px; margin: 6px 0; }
.flag.blocker { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
.method-note { background: #f3f7fc; padding: 18px 22px; border-radius: 20px; margin: 22px 0; }
.strong { font-weight: 600; }
.rec-item { background: #f8fafc; border: 1px solid #e2e9f0; border-radius: 14px; padding: 14px 16px; margin: 10px 0; }
@media (max-width: 700px) {
  .report-container { padding: 24px 16px; }
  .two-col-grid, .three-col-grid { grid-template-columns: 1fr; }
}
`

const initialsFrom = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?'

const courseRowsHtml = (course: CourseReportMath): string => {
  const raters =
    course.raters
      .filter((r) => r.postAvg != null || r.preAvg != null)
      .map((r) => {
        const parts = [`${esc(r.roleLabel)}`]
        if (r.preAvg != null) parts.push(`Pre ${fmt(r.preAvg)}`)
        if (r.postAvg != null) parts.push(`Post ${fmt(r.postAvg)}`)
        if (r.matchedGrowth != null) parts.push(`Δ ${fmtDelta(r.matchedGrowth)}`)
        if (r.invalid) parts.push('(excluded)')
        return parts.join(' · ')
      })
      .join('<br>') || '—'

  return `<tr>
    <td>${esc(course.courseTitle)}</td>
    <td>${fmt(course.observerPre)} <span class="pill">obs</span><br><span style="color:#4b6985;font-size:12px">Self ${fmt(course.selfPre)}</span></td>
    <td>${fmt(course.observerPost)} <span class="pill">obs</span><br><span style="color:#4b6985;font-size:12px">Self ${fmt(course.selfPost)}</span></td>
    <td><strong>${fmtDelta(course.observerMatchedGrowth)}</strong><br><span style="color:#4b6985;font-size:12px">Self ${fmtDelta(course.selfMatchedGrowth)}</span></td>
    <td>${scoreBandLabel(course.observerEndState ?? course.observerPost)}</td>
    <td style="font-size:12px">${raters}</td>
  </tr>`
}

const engagementChips = (eng?: LearnerEngagementSnapshot | null): string => {
  if (!eng) return ''
  const chips = [
    `Points ${eng.totalPoints.toLocaleString()}${eng.passMark != null ? ` / ${eng.passMark.toLocaleString()}` : ''}`,
    `Sessions ${eng.liveSessions}`,
    `Modules ${eng.modules}`,
    `Impact logs ${eng.impactLogs}`,
    `Peer ${eng.peerToPeer}`,
    `Capstone ${eng.capstone}`,
  ]
  return `<div class="engagement-row">${chips
    .map((c) => `<span class="engagement-chip">${esc(c)}</span>`)
    .join('')}</div>`
}

const narrativeHtml = (narrative: PersonNarrative): string => `
  <div class="three-col-grid" style="margin:14px 0">
    <div class="narrative-box">
      <h4>Strengths</h4>
      <ul>${narrative.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    </div>
    <div class="narrative-box">
      <h4>Gaps</h4>
      <ul>${narrative.gaps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    </div>
    <div class="narrative-box">
      <h4>Next steps</h4>
      <ul>${narrative.nextSteps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    </div>
  </div>
`

const personPageHtml = (
  profile: ReportLearnerProfile,
  math: LearnerReportMath | undefined,
  engagement?: LearnerEngagementSnapshot | null,
): string => {
  const emptyMath: LearnerReportMath = {
    learnerId: profile.id,
    courses: [],
    overallObserverPre: null,
    overallObserverPost: null,
    overallObserverGrowth: null,
    flags: [],
  }
  const safeMath = math ?? emptyMath
  const narrative = buildPersonNarrative({
    name: profile.name,
    math: safeMath,
    engagement,
  })
  const values = (profile.coreValues || []).slice(0, 6)
  const flags = (safeMath.flags || []).filter((f) => f.severity !== 'info')

  return `
  <div class="person-card">
    <div class="person-header">
      <div style="background:#dbe4ef;width:44px;height:44px;border-radius:40px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#1a3754">${esc(profile.initials || initialsFrom(profile.name))}</div>
      <span class="person-name">${esc(profile.name)}</span>
      ${profile.roleLabel ? `<span class="person-role">${esc(profile.roleLabel)}</span>` : ''}
      ${profile.ageRange ? `<span class="pill">${esc(profile.ageRange)}</span>` : ''}
      ${profile.personalityType ? `<span class="pill">${esc(profile.personalityType)}${profile.personalityLabel ? ` · ${esc(profile.personalityLabel)}` : ''}</span>` : ''}
    </div>
    ${
      values.length
        ? `<div class="values-list">${values.map((v) => `<span>${esc(v)}</span>`).join('')}</div>`
        : ''
    }
    <p style="margin:8px 0 4px;font-weight:600;background:#e2ebf5;padding:6px 16px;border-radius:40px;display:inline-block">
      ${esc(narrative.headline)}
    </p>
    ${engagementChips(engagement)}
    ${buildPersonSparkSvg(safeMath.courses)}
    ${narrativeHtml(narrative)}
    ${flags
      .map(
        (f) =>
          `<div class="flag ${f.severity === 'blocker' ? 'blocker' : ''}">${esc(f.message)}${f.offline ? ' · Offline review flagged' : ''}</div>`,
      )
      .join('')}
    <table class="data-table">
      <thead>
        <tr>
          <th>Course</th>
          <th>Pre</th>
          <th>Post</th>
          <th>Matched Δ</th>
          <th>Band</th>
          <th>Rater detail</th>
        </tr>
      </thead>
      <tbody>
        ${safeMath.courses.map(courseRowsHtml).join('') || `<tr><td colspan="6">No assessment submissions yet.</td></tr>`}
      </tbody>
    </table>
    <p style="font-size:13px;color:#4b6985;margin-top:8px">
      Personality types and personal values are self-reported preferences for coaching context only — they are not inputs to the performance verdict.
      Engagement chips come from points_ledger claims (sessions, modules, impact, peer, capstone).
    </p>
  </div>`
}

const cohortPatternsHtml = (params: {
  cohort: CohortReportMath
  enrolledCount: number
  profiles: ReportLearnerProfile[]
  engagementByLearner?: Record<string, LearnerEngagementSnapshot>
}): string => {
  const mathById = new Map(params.cohort.learners.map((l) => [l.learnerId, l]))
  const patterns = buildCohortPatterns({
    enrolledCount: params.enrolledCount,
    courseGrowth: params.cohort.courseGrowth,
    learners: params.profiles.map((p) => ({
      id: p.id,
      name: p.name,
      math: mathById.get(p.id) ?? {
        learnerId: p.id,
        courses: [],
        overallObserverPre: null,
        overallObserverPost: null,
        overallObserverGrowth: null,
        flags: [],
      },
      engagement: params.engagementByLearner?.[p.id] ?? null,
    })),
  })

  return `
  <div>
    <h2 class="title-2">Cohort Patterns &amp; Recommendations</h2>
    <p style="font-size:15px;margin:6px 0 16px">Data-driven patterns from matched observer growth and engagement claims — not free-form opinion.</p>
    <div class="two-col-grid">
      <div class="narrative-box">
        <h4>What's working</h4>
        <ul>${(patterns.working.length ? patterns.working : ['Insufficient assessed data yet.']).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
      <div class="narrative-box">
        <h4>Where gaps remain</h4>
        <ul>${(patterns.gaps.length ? patterns.gaps : ['No major cohort gaps flagged yet.']).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
    </div>
    <div class="highlight-box" style="margin-top:18px">
      <p class="strong">Highest-value next move</p>
      <p style="font-size:14px;line-height:1.6;margin-top:6px">${esc(patterns.highestValueMove)}</p>
    </div>
    <div style="margin-top:16px">
      <p class="strong" style="margin-bottom:8px">Recommendations</p>
      ${patterns.recommendations
        .map(
          (r, i) =>
            `<div class="rec-item"><p class="strong">${i + 1}. ${esc(r.action)}</p><p style="font-size:13px;color:#4b6985;margin-top:4px">${esc(r.why)}</p></div>`,
        )
        .join('')}
    </div>
  </div>`
}

const methodologyHtml = (
  cohort: CohortReportMath,
  enrolledCount: number,
  identityFlags: IdentityDupeFlag[],
): string => {
  const assessed = cohort.learners.filter((l) => l.courses.length > 0).length
  const alphaRows = cohort.cronbachAlphaByCourse
    .map((c) => {
      if (c.alpha == null) {
        return `<tr><td>${esc(c.courseKey)}</td><td>Insufficient n (${c.n}) — flagged for offline if required</td></tr>`
      }
      return `<tr><td>${esc(c.courseKey)}</td><td>${fmt(c.alpha)} (n=${c.n} observer Post submissions)</td></tr>`
    })
    .join('')

  const offlineFlags = uniqueFlags([
    ...cohort.flags.filter((f) => f.offline),
    ...identityFlags.map(
      (f): IntegrityFlag => ({
        code: 'offline_required',
        severity: 'blocker',
        message: f.message,
        offline: true,
      }),
    ),
  ])

  return `
  <div>
    <h2 class="title-2">Methodology &amp; Data Integrity</h2>
    <p style="font-size:15px;margin:6px 0 16px">This section documents how the scores were produced so the report withstands external scrutiny.</p>

    <div style="background:#f5f9fe;padding:16px 20px;border-radius:20px">
      <p class="strong">Design</p>
      <ul style="list-style:none;padding:0;font-size:14px;line-height:1.7">
        <li>• 360-degree, pre/post. Self, Manager and Transformation Partner (plus Mentor/Coach when present) rate observable behaviors on a 1–10 scale before and/or after each course.</li>
        <li>• Construct alignment. Items map to course learning outcomes from the native assessment catalog (prefer ~5–15 rating items; mega-forms are deprioritized).</li>
        <li>• Reliability. Internal consistency (Cronbach's α) is computed in-app on observer Post item matrices when n ≥ 3; otherwise flagged for offline.</li>
        <li>• Matched estimand. Each person's <em>growth</em> uses only raters present at both Pre and Post. The observer composite (Manager + Partner [+ Mentor/Coach]) anchors the verdict.</li>
        <li>• Independent of self-report. The headline verdict rests on observer ratings; self-ratings are a self-awareness lens only.</li>
        <li>• Engagement context. Live sessions, modules, impact logs, peer claims and capstone come from points_ledger — descriptive context, not part of the rating formula.</li>
      </ul>
    </div>

    <div style="margin:16px 0">
      <p class="strong">Score bands</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px 24px;background:#f0f5fc;padding:12px 18px;border-radius:16px;margin-top:8px">
        ${SCORE_BANDS.map(
          (b) =>
            `<span><span class="score-band">${b.min}–${b.max}</span> ${esc(b.label)} — ${esc(b.description)}</span>`,
        ).join('')}
      </div>
    </div>

    <div style="background:#eaf0f8;padding:18px 22px;border-radius:20px;margin:16px 0">
      <p class="strong">Data integrity rules applied in-app</p>
      <ul style="list-style:none;padding:0;font-size:14px;line-height:1.7">
        <li>• <span class="strong">Duplicate submissions.</span> Same rater × course × kind → item scores averaged.</li>
        <li>• <span class="strong">Instrument alignment.</span> Pre/Post growth uses overlapping like-for-like rating items only (by question text when available).</li>
        <li>• <span class="strong">Invalid response flagged.</span> Near-uniform floor/ceiling patterns are excluded from matched growth.</li>
        <li>• <span class="strong">Post-only observers.</span> Included in end-state proficiency, not in matched growth.</li>
        <li>• <span class="strong">Identity duplicates.</span> Same normalized display name on multiple profile ids → offline merge flag.</li>
      </ul>
      <table class="data-table" style="background:white;margin-top:12px">
        <tr><th>Course scale</th><th>Cronbach's α (observer Post)</th></tr>
        ${alphaRows || '<tr><td colspan="2">No observer Post data yet</td></tr>'}
      </table>
    </div>

    <div class="method-note">
      <p class="strong">Limitations (stated plainly)</p>
      <ul style="list-style:none;padding:0;font-size:14px;line-height:1.7">
        <li>• ${assessed} of ${enrolledCount || assessed} enrolled practitioners have assessment rows in this report; conclusions describe assessed learners and are not yet generalizable.</li>
        <li>• Self-assessment data may be sparse; self-versus-observer comparisons exist only where matched self Pre/Post exist.</li>
        <li>• Observer ratings are not blinded; reported as descriptive change, not tested for statistical significance when samples are small.</li>
        <li>• No control group; this is a single cohort.</li>
        <li>• Personality and values are self-reported preferences used only for coaching context, never as assessment inputs.</li>
        <li>• Strengths / Gaps / Next steps text is template language derived from the numbers above — not hand-written case notes.</li>
      </ul>
    </div>

    ${
      offlineFlags.length
        ? `<div class="highlight-box" style="border-left-color:#c2410c;background:#fff7ed">
            <p class="strong">Offline review required</p>
            <ul style="list-style:none;padding:0;font-size:14px;line-height:1.7;margin-top:8px">
              ${offlineFlags.map((f) => `<li>• ${esc(f.message)}</li>`).join('')}
            </ul>
            <p style="font-size:13px;margin-top:8px">App numbers use only mathematically valid matched data. Do not publish α or growth claims for flagged items until offline QA confirms them.</p>
          </div>`
        : ''
    }
  </div>`
}

const uniqueFlags = (flags: IntegrityFlag[]): IntegrityFlag[] => {
  const seen = new Set<string>()
  const out: IntegrityFlag[] = []
  for (const f of flags) {
    const key = `${f.code}:${f.message}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out
}

export const buildCourseAssessmentHtmlReport = (
  params: BuildHtmlReportParams,
): { html: string; text: string; preview: string } => {
  const generatedAt = params.generatedAt ?? new Date()
  const profileById = new Map(params.profiles.map((p) => [p.id, p]))
  const mathById = new Map(params.cohort.learners.map((l) => [l.learnerId, l]))
  const identityFlags = params.identityFlags ?? []
  const enrolledCount = params.enrolledCount ?? params.profiles.length

  let learnerIds =
    params.mode === 'learner' && params.viewerLearnerId
      ? [params.viewerLearnerId]
      : params.profiles.map((p) => p.id)

  if (params.mode === 'partner') {
    learnerIds = [...learnerIds].sort((a, b) => {
      const ac = mathById.get(a)?.courses.length ?? 0
      const bc = mathById.get(b)?.courses.length ?? 0
      return bc - ac
    })
  }

  const growthBars = params.cohort.courseGrowth
    .filter((c) => c.meanObserverGrowth != null)
    .map((c) => ({
      label: c.courseTitle,
      value: c.meanObserverGrowth as number,
    }))

  const growthBadges = params.cohort.courseGrowth
    .filter((c) => c.meanObserverGrowth != null)
    .map(
      (c) =>
        `<div><span class="badge">${esc(c.courseTitle)} ${fmtDelta(c.meanObserverGrowth)}</span></div>`,
    )
    .join('')

  const execSummary =
    params.mode === 'partner'
      ? `
    <div>
      <h2 class="title-2" style="font-size:22px">Executive Summary</h2>
      <p style="margin:10px 0 6px;font-size:15px;line-height:1.5">
        Growth is measured the same way a serious evaluator would expect: by observers
        (Manager and Transformation Partner, plus Mentor/Coach when present) rating the
        <em>same behaviors</em> before and after on a 10-point scale. Only matched raters
        contribute to growth. Self-ratings are shown separately as a self-awareness lens.
      </p>
      ${buildGrowthBarChartSvg(growthBars)}
      <div style="display:flex;flex-wrap:wrap;gap:16px 40px;margin:16px 0 10px">${growthBadges || '<span class="badge">Awaiting matched observer Pre/Post</span>'}</div>
      <div class="highlight-box">
        <p style="font-size:15px;line-height:1.6">
          <span class="strong">The plain-language story.</span>
          Numbers below are calculated in-app from native Pre/Post submissions and points_ledger engagement.
          Anything that cannot be proven correct (e.g. Cronbach's α with too few observers, identity duplicates)
          is flagged for offline review — published figures must stay right.
        </p>
      </div>
      <div style="margin-top:20px;background:#f1f6fc;border-radius:18px;padding:18px 22px">
        <p style="font-weight:600;color:#0a233b">What to read on each person's page</p>
        <div style="display:flex;flex-wrap:wrap;gap:12px 24px;margin-top:8px">
          ${SCORE_BANDS.map(
            (b) =>
              `<span><span class="score-band">${b.min}–${b.max}</span> ${esc(b.label)}</span>`,
          ).join('')}
        </div>
      </div>
    </div>
    <div class="page-divider"></div>`
      : `
    <div>
      <h2 class="title-2" style="font-size:22px">Your assessment report</h2>
      <p style="margin:10px 0 6px;font-size:15px;line-height:1.5">
        This page shows <strong>only your</strong> Pre/Post results. Observer ratings
        (Manager / Partner) drive the headline growth; your self-ratings are a self-awareness check.
      </p>
    </div>
    <div class="page-divider"></div>`

  const peopleHtml = learnerIds
    .map((id) => {
      const profile =
        profileById.get(id) ??
        ({
          id,
          name: id.slice(0, 8),
          initials: '?',
        } satisfies ReportLearnerProfile)
      return personPageHtml(
        profile,
        mathById.get(id),
        params.engagementByLearner?.[id] ?? null,
      )
    })
    .join('')

  const body = `
  <div class="report-container">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <span class="eyebrow">T4L · Transformation Leader</span>
        <h1 class="title-1" style="margin-top:4px">${esc(params.organizationName)}</h1>
        <p class="title-2" style="font-weight:400;color:#2b4a6b">
          ${esc(params.journeyLabel || 'Journey')} outcomes review
          ${params.mode === 'partner' ? ' for senior leadership' : ' — personal report card'}.
          ${params.coursePillarLabel ? esc(params.coursePillarLabel) : ''}
        </p>
      </div>
      <div style="background:#eef3f9;padding:6px 18px;border-radius:40px;font-weight:600;font-size:14px;color:#1d3f62">Confidential</div>
    </div>
    <div class="page-divider"></div>
    ${execSummary}
    ${peopleHtml}
    ${
      params.mode === 'partner'
        ? `<div class="page-divider"></div>${cohortPatternsHtml({
            cohort: params.cohort,
            enrolledCount,
            profiles: params.profiles,
            engagementByLearner: params.engagementByLearner,
          })}`
        : ''
    }
    <div class="page-divider"></div>
    ${
      params.mode === 'partner'
        ? methodologyHtml(params.cohort, enrolledCount, identityFlags)
        : `
      <div class="method-note">
        <p class="strong">How to read your scores</p>
        <p style="font-size:14px;line-height:1.7;margin-top:8px">
          Matched growth uses only observers who rated you both before and after.
          Score bands: ${SCORE_BANDS.map((b) => `${b.min}–${b.max} ${b.label}`).join(' · ')}.
          Full methodology is in the organization report held by your Transformation Partner.
        </p>
      </div>
    `
    }
    <p style="font-size:14px;color:#1e3f61;margin-top:20px;border-top:1px solid #dae2ec;padding-top:20px">
      Prepared by Transformation Leader (T4L) for ${esc(params.organizationName)}. Confidential.
      Generated ${esc(generatedAt.toLocaleString())}.
      ${params.mode === 'partner' ? 'Individual learner reports are provided separately to each participant.' : 'Partners see the full cohort report.'}
    </p>
  </div>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(params.organizationName)} · T4L Performance Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap" rel="stylesheet" />
  <style>${REPORT_CSS}</style>
</head>
<body>${body}</body>
</html>`

  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return { html, text, preview: text.slice(0, 320) }
}
