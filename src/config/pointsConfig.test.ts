import { describe, expect, it } from 'vitest'
import {
  FULL_ACTIVITIES,
  JOURNEY_META,
  getActivitiesForJourney,
  getActivityDefinitionById,
  getJourneyPointsCrossReference,
  resolveCanonicalActivityId,
} from './pointsConfig'
import { PILLAR_OPTIONS } from '@/types/pillar'

describe('pointsConfig module activities', () => {
  it('uses lift_module as the canonical module activity', () => {
    const activityIds = new Set(FULL_ACTIVITIES.map(activity => activity.id))

    expect(activityIds.has('lift_module')).toBe(true)
    expect(activityIds.has('recognition_over_recall')).toBe(false)
    expect(activityIds.has('von_restorff_effect')).toBe(false)
  })

  it('maps legacy module aliases to lift_module', () => {
    expect(resolveCanonicalActivityId('lift_module')).toBe('lift_module')
    expect(resolveCanonicalActivityId('recognition_over_recall')).toBe('lift_module')
    expect(resolveCanonicalActivityId('von_restorff_effect')).toBe('lift_module')
    expect(resolveCanonicalActivityId('partner_spotlight')).toBe('lift_module')

    const resolved = getActivityDefinitionById({ activityId: 'recognition_over_recall', journeyType: '6W' })
    expect(resolved?.id).toBe('lift_module')
    expect(resolved?.title).toBe('LIFT Course Module Completed')
  })

  it('matches uploaded 4-week intro points and checklist frequencies', () => {
    const activities = getActivitiesForJourney('4W')
    const byId = new Map(activities.map((activity) => [activity.id, activity]))
    const crossRef = getJourneyPointsCrossReference('4W')
    const crossById = new Map(crossRef.activityBreakdown.map((row) => [row.activityId, row]))

    expect(JOURNEY_META['4W'].windowTarget).toBe(7500)
    expect(JOURNEY_META['4W'].passMarkPoints).toBe(9000)
    expect(JOURNEY_META['4W'].maxPossiblePoints).toBe(15000)
    expect(byId.has('peer_to_peer')).toBe(false)

    expect(byId.get('watch_podcast')?.points).toBe(1000)
    expect(byId.get('watch_podcast')?.activityPolicy?.maxTotal).toBe(3)

    expect(byId.get('impact_log')?.points).toBe(1000)
    expect(byId.get('impact_log')?.activityPolicy?.maxTotal).toBe(2)

    expect(byId.get('webinar_workbook')?.points).toBe(3000)
    expect(byId.get('webinar_workbook')?.title).toBe('Attend Webinar')
    expect(byId.get('webinar_workbook')?.approvalType).toBe('partner_approved')
    expect(byId.get('webinar_workbook')?.activityPolicy?.maxTotal).toBe(1)

    expect(byId.get('lift_module')?.points).toBe(3000)
    expect(byId.get('lift_module')?.title).toBe('LIFT Course Module Completed')
    expect(byId.get('book_club')?.points).toBe(1500)
    expect(byId.get('book_club')?.title).toBe('Attend Book Club Session')
    expect(byId.get('shameless_circle')?.points).toBe(1500)
    expect(byId.get('shameless_circle')?.title).toBe('Attend Shameless Circle Session')
    expect(byId.get('ai_tool_review')?.points).toBe(1000)
    expect(byId.get('ai_tool_review')?.title).toBe('Submit an AI Tool for Review')
    expect(byId.get('ai_tool_review')?.activityPolicy?.maxTotal).toBe(1)
    expect(byId.get('shameless_circle')?.activityPolicy?.maxTotal).toBe(1)

    // Starter Kit programme components (same parts as My Courses / pillar cards).
    expect(byId.get('capstone')?.title).toBe('Combined Capstone')
    expect(byId.get('capstone')?.points).toBe(0)
    expect(byId.get('capstone')?.activityPolicy?.maxTotal).toBe(3)
    expect(byId.get('case_study')?.title).toBe('Combined Case Studies')
    expect(byId.get('case_study')?.points).toBe(0)
    expect(byId.get('case_study')?.activityPolicy?.maxTotal).toBe(4)
    expect(byId.get('practical')?.title).toBe('Practicals Portfolio')
    expect(byId.get('practical')?.points).toBe(0)
    expect(byId.get('practical')?.activityPolicy?.maxTotal).toBe(6)

    expect(crossById.get('watch_podcast')).toMatchObject({ frequency: 3, pointsEach: 1000, maxPoints: 3000 })
    expect(crossById.get('webinar_workbook')).toMatchObject({ frequency: 1, pointsEach: 3000, maxPoints: 3000 })
    expect(crossById.get('impact_log')).toMatchObject({ frequency: 2, pointsEach: 1000, maxPoints: 2000 })
    expect(crossById.get('lift_module')).toMatchObject({ frequency: 1, pointsEach: 3000, maxPoints: 3000 })
    expect(crossById.get('book_club')).toMatchObject({ frequency: 1, pointsEach: 1500, maxPoints: 1500 })
    expect(crossById.get('shameless_circle')).toMatchObject({ frequency: 1, pointsEach: 1500, maxPoints: 1500 })
    expect(crossById.get('ai_tool_review')).toMatchObject({ frequency: 1, pointsEach: 1000, maxPoints: 1000 })
    expect(crossById.get('capstone')).toMatchObject({ frequency: 3, pointsEach: 0, maxPoints: 0 })
    expect(crossById.get('case_study')).toMatchObject({ frequency: 4, pointsEach: 0, maxPoints: 0 })
    expect(crossById.get('practical')).toMatchObject({ frequency: 6, pointsEach: 0, maxPoints: 0 })
  })

  it('uses a 13,500 point two-week target for the 6-week journey', () => {
    expect(JOURNEY_META['6W'].weeklyTarget).toBe(6750)
    expect(JOURNEY_META['6W'].windowTarget).toBe(13500)
  })

  it('cross-references each journey activity table with configured maximum points', () => {
    (['4W', '6W', '3M', '6M', '9M'] as const).forEach((journeyType) => {
      const crossRef = getJourneyPointsCrossReference(journeyType)
      expect(crossRef.computedMaxPoints).toBe(JOURNEY_META[journeyType].maxPossiblePoints)
      expect(crossRef.maxPossiblePoints).toBe(JOURNEY_META[journeyType].maxPossiblePoints)
    })
  })

  it('6-week journey totals exactly 60,000 points for every pillar', () => {
    // Pillars only change the week split (3+3, 1+5, 2+4) and course names, not
    // the point values - the 6W activity table (capstone x2, case_study x2,
    // practical x6 @ 0 pts, lift_module x2 @ 7,000, etc.) is identical across
    // pillars. This locks the invariant that the weekly-checklist total is
    // 60,000 no matter the pillar.
    const sixWeekTotal = getJourneyPointsCrossReference('6W').computedMaxPoints
    expect(sixWeekTotal).toBe(60000)

    PILLAR_OPTIONS.forEach((pillar) => {
      expect(sixWeekTotal, `6W total must be 60,000 for pillar "${pillar}"`).toBe(60000)
    })
  })

  it('matches the handwritten 6W weekly-checklist occurrence table', () => {
    const activities = getActivitiesForJourney('6W')
    const byId = new Map(activities.map((activity) => [activity.id, activity]))

    const expectActivity = (
      id: string,
      points: number,
      maxTotal: number,
    ) => {
      expect(byId.get(id)?.points, id).toBe(points)
      expect(byId.get(id)?.activityPolicy?.maxTotal, id).toBe(maxTotal)
    }

    expectActivity('webinar_workbook', 4500, 1)
    expectActivity('linkedin', 500, 3)
    expectActivity('impact_log', 2000, 4)
    expectActivity('peer_to_peer', 1000, 3)
    expectActivity('case_study', 1000, 2)
    expectActivity('capstone', 1500, 2)
    expectActivity('podcast_workbook', 1000, 3)
    expectActivity('weekly_session', 3000, 6)
    expectActivity('challenger', 500, 3)
    expectActivity('peer_matching', 500, 3)
    expectActivity('lift_module', 7000, 2)
    // Practicals are on the checklist like case study / capstone, but 0 pts.
    expectActivity('practical', 0, 6)
  })

  it('keeps alternate pass marks/max points for journeys with optional mentor and coach support', () => {
    const threeMonth = getJourneyPointsCrossReference('3M')
    const sixMonth = getJourneyPointsCrossReference('6M')
    const nineMonth = getJourneyPointsCrossReference('9M')

    expect(threeMonth.pointVariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'without_mentor_and_ambassador',
          maxPossiblePoints: 101000,
          passMarkPoints: 67000,
        }),
        expect.objectContaining({
          key: 'without_mentor_or_ambassador',
          maxPossiblePoints: 107000,
          passMarkPoints: 71000,
        }),
      ]),
    )

    expect(sixMonth.pointVariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'without_mentor_and_ambassador',
          maxPossiblePoints: 202000,
          passMarkPoints: 135000,
        }),
        expect.objectContaining({
          key: 'without_mentor_or_ambassador',
          maxPossiblePoints: 214000,
          passMarkPoints: 143000,
        }),
      ]),
    )

    expect(nineMonth.pointVariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'without_mentor_and_ambassador',
          maxPossiblePoints: 303000,
          passMarkPoints: 203000,
        }),
        expect.objectContaining({
          key: 'without_mentor_or_ambassador',
          maxPossiblePoints: 321000,
          passMarkPoints: 215000,
        }),
      ]),
    )
  })

  it('matches the 3-month weekly-checklist product table', () => {
    const crossRef = getJourneyPointsCrossReference('3M')
    const byId = new Map(crossRef.activityBreakdown.map((row) => [row.activityId, row]))

    expect(crossRef.maxPossiblePoints).toBe(113000)
    expect(crossRef.passMarkPoints).toBe(75000)
    expect(crossRef.computedMaxPoints).toBe(113000)

    expect(byId.get('podcast_workbook')).toMatchObject({ frequency: 9, pointsEach: 2000, maxPoints: 18000 })
    expect(byId.get('weekly_session')).toMatchObject({ frequency: 12, pointsEach: 1500, maxPoints: 18000 })
    expect(byId.get('webinar_workbook')).toMatchObject({
      title: 'Attend Webinar',
      frequency: 3,
      pointsEach: 4000,
      maxPoints: 12000,
      approvalType: 'partner_approved',
    })
    expect(byId.get('peer_to_peer')).toMatchObject({ frequency: 9, pointsEach: 1000, maxPoints: 9000 })
    expect(byId.get('impact_log')).toMatchObject({ frequency: 6, pointsEach: 1000, maxPoints: 6000 })
    expect(byId.get('lift_module')).toMatchObject({ frequency: 3, pointsEach: 3000, maxPoints: 9000 })
    expect(byId.get('linkedin')).toMatchObject({ frequency: 7, pointsEach: 500, maxPoints: 3500 })
    expect(byId.get('book_club')).toMatchObject({ frequency: 3, pointsEach: 2500, maxPoints: 7500 })
    expect(byId.get('peer_matching')).toMatchObject({ frequency: 12, pointsEach: 1000, maxPoints: 12000 })
    expect(byId.get('challenger')).toMatchObject({ frequency: 6, pointsEach: 1000, maxPoints: 6000 })
    expect(byId.get('mentor_meetup')).toMatchObject({
      frequency: 3,
      pointsEach: 2000,
      maxPoints: 6000,
      approvalType: 'mentor_issued',
    })
    expect(byId.get('ambassador_session')).toMatchObject({
      title: 'Coach Session',
      frequency: 3,
      pointsEach: 2000,
      maxPoints: 6000,
      approvalType: 'ambassador_issued',
    })
    // Month-local pillar components (0 pts) - content follows that month's course.
    expect(byId.get('capstone')).toMatchObject({ frequency: 3, pointsEach: 0, maxPoints: 0 })
    expect(byId.get('case_study')).toMatchObject({ frequency: 3, pointsEach: 0, maxPoints: 0 })
    expect(byId.get('practical')).toMatchObject({ frequency: 3, pointsEach: 0, maxPoints: 0 })
  })

  it('matches the 6-month weekly-checklist product table', () => {
    const crossRef = getJourneyPointsCrossReference('6M')
    const byId = new Map(crossRef.activityBreakdown.map((row) => [row.activityId, row]))

    expect(crossRef.maxPossiblePoints).toBe(226000)
    expect(crossRef.passMarkPoints).toBe(150000)
    expect(crossRef.computedMaxPoints).toBe(226000)

    expect(byId.get('podcast_workbook')).toMatchObject({ frequency: 18, pointsEach: 2000, maxPoints: 36000 })
    expect(byId.get('weekly_session')).toMatchObject({ frequency: 24, pointsEach: 1500, maxPoints: 36000 })
    expect(byId.get('webinar_workbook')).toMatchObject({
      title: 'Attend Webinar',
      frequency: 6,
      pointsEach: 4000,
      maxPoints: 24000,
      approvalType: 'partner_approved',
    })
    expect(byId.get('peer_to_peer')).toMatchObject({ frequency: 18, pointsEach: 1000, maxPoints: 18000 })
    expect(byId.get('impact_log')).toMatchObject({ frequency: 12, pointsEach: 1000, maxPoints: 12000 })
    expect(byId.get('lift_module')).toMatchObject({ frequency: 6, pointsEach: 3000, maxPoints: 18000 })
    expect(byId.get('linkedin')).toMatchObject({ frequency: 14, pointsEach: 500, maxPoints: 7000 })
    expect(byId.get('book_club')).toMatchObject({ frequency: 6, pointsEach: 2500, maxPoints: 15000 })
    expect(byId.get('peer_matching')).toMatchObject({ frequency: 24, pointsEach: 1000, maxPoints: 24000 })
    expect(byId.get('challenger')).toMatchObject({ frequency: 12, pointsEach: 1000, maxPoints: 12000 })
    expect(byId.get('mentor_meetup')).toMatchObject({
      frequency: 6,
      pointsEach: 2000,
      maxPoints: 12000,
      approvalType: 'mentor_issued',
    })
    expect(byId.get('ambassador_session')).toMatchObject({
      title: 'Coach Session',
      frequency: 6,
      pointsEach: 2000,
      maxPoints: 12000,
      approvalType: 'ambassador_issued',
    })
    expect(byId.get('capstone')).toMatchObject({ frequency: 6, pointsEach: 0, maxPoints: 0 })
    expect(byId.get('case_study')).toMatchObject({ frequency: 6, pointsEach: 0, maxPoints: 0 })
    expect(byId.get('practical')).toMatchObject({ frequency: 6, pointsEach: 0, maxPoints: 0 })
  })

  it('matches the 9-month weekly-checklist product table', () => {
    const crossRef = getJourneyPointsCrossReference('9M')
    const byId = new Map(crossRef.activityBreakdown.map((row) => [row.activityId, row]))

    expect(crossRef.maxPossiblePoints).toBe(339000)
    expect(crossRef.passMarkPoints).toBe(227000)
    expect(crossRef.computedMaxPoints).toBe(339000)

    expect(byId.get('podcast_workbook')).toMatchObject({ frequency: 27, pointsEach: 2000, maxPoints: 54000 })
    expect(byId.get('weekly_session')).toMatchObject({ frequency: 36, pointsEach: 1500, maxPoints: 54000 })
    expect(byId.get('webinar_workbook')).toMatchObject({
      title: 'Attend Webinar',
      frequency: 9,
      pointsEach: 4000,
      maxPoints: 36000,
      approvalType: 'partner_approved',
    })
    expect(byId.get('peer_to_peer')).toMatchObject({ frequency: 27, pointsEach: 1000, maxPoints: 27000 })
    expect(byId.get('impact_log')).toMatchObject({ frequency: 18, pointsEach: 1000, maxPoints: 18000 })
    expect(byId.get('lift_module')).toMatchObject({ frequency: 9, pointsEach: 3000, maxPoints: 27000 })
    expect(byId.get('linkedin')).toMatchObject({ frequency: 21, pointsEach: 500, maxPoints: 10500 })
    expect(byId.get('book_club')).toMatchObject({ frequency: 9, pointsEach: 2500, maxPoints: 22500 })
    expect(byId.get('peer_matching')).toMatchObject({ frequency: 36, pointsEach: 1000, maxPoints: 36000 })
    expect(byId.get('challenger')).toMatchObject({ frequency: 18, pointsEach: 1000, maxPoints: 18000 })
    expect(byId.get('mentor_meetup')).toMatchObject({
      frequency: 9,
      pointsEach: 2000,
      maxPoints: 18000,
      approvalType: 'mentor_issued',
    })
    expect(byId.get('ambassador_session')).toMatchObject({
      title: 'Coach Session',
      frequency: 9,
      pointsEach: 2000,
      maxPoints: 18000,
      approvalType: 'ambassador_issued',
    })
    expect(byId.get('capstone')).toMatchObject({ frequency: 9, pointsEach: 0, maxPoints: 0 })
    expect(byId.get('case_study')).toMatchObject({ frequency: 9, pointsEach: 0, maxPoints: 0 })
    expect(byId.get('practical')).toMatchObject({ frequency: 9, pointsEach: 0, maxPoints: 0 })

    expect(crossRef.pointVariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'without_mentor_and_ambassador',
          maxPossiblePoints: 303000,
          passMarkPoints: 203000,
        }),
        expect.objectContaining({
          key: 'without_mentor_or_ambassador',
          maxPossiblePoints: 321000,
          passMarkPoints: 215000,
        }),
      ]),
    )
  })

  it('replaces book club with the 4500-point webinar in the 6-week journey config', () => {
    const activities = getActivitiesForJourney('6W')
    const byId = new Map(activities.map((activity) => [activity.id, activity]))

    expect(byId.get('book_club')).toBeUndefined()
    expect(byId.get('webinar_workbook')?.points).toBe(4500)
    expect(byId.get('webinar_workbook')?.activityPolicy?.maxTotal).toBe(1)
  })

  it('weekly session attendance requires partner marks (pending until partner assigns)', () => {
    const weeklySession = getActivityDefinitionById({ activityId: 'weekly_session', journeyType: '6W' })

    expect(weeklySession).toBeTruthy()
    expect(weeklySession?.approvalType).toBe('partner_approved')
    expect(weeklySession?.requiresApproval).toBe(true)
    expect(weeklySession?.verification).toBe('partner_approval')
  })

  it('resolves special activity ids as canonical ids', () => {
    expect(resolveCanonicalActivityId('referral_bonus')).toBe('referral_bonus')
    expect(resolveCanonicalActivityId('peer_session_confirmation')).toBe('peer_session_confirmation')
    expect(resolveCanonicalActivityId('peer_session_no_show_report')).toBe('peer_session_no_show_report')

    expect(getActivityDefinitionById({ activityId: 'referral_bonus', journeyType: '6W' })?.id).toBe('referral_bonus')
    expect(getActivityDefinitionById({ activityId: 'peer_session_confirmation', journeyType: '6W' })?.id).toBe('peer_session_confirmation')
    expect(getActivityDefinitionById({ activityId: 'peer_session_no_show_report', journeyType: '6W' })?.id).toBe('peer_session_no_show_report')
  })
})
