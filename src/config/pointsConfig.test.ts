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

    expect(JOURNEY_META['4W'].windowTarget).toBe(7500)
    expect(JOURNEY_META['4W'].passMarkPoints).toBe(9000)
    expect(JOURNEY_META['4W'].maxPossiblePoints).toBe(16500)

    expect(byId.get('watch_podcast')?.points).toBe(1000)
    expect(byId.get('watch_podcast')?.activityPolicy?.maxTotal).toBe(3)

    expect(byId.get('impact_log')?.points).toBe(1000)
    expect(byId.get('impact_log')?.activityPolicy?.maxTotal).toBe(2)

    expect(byId.get('webinar_workbook')?.points).toBe(2000)
    expect(byId.get('webinar_workbook')?.activityPolicy?.maxTotal).toBe(1)
    expect(byId.get('book_club')?.points).toBe(1000)
    expect(byId.get('shameless_circle')?.points).toBe(1500)
    expect(byId.get('ai_tool_review')?.activityPolicy?.maxTotal).toBe(1)
    expect(byId.get('shameless_circle')?.activityPolicy?.maxTotal).toBe(1)
  })

  it('uses a 14,000 point two-week target for the 6-week journey', () => {
    expect(JOURNEY_META['6W'].weeklyTarget).toBe(7000)
    expect(JOURNEY_META['6W'].windowTarget).toBe(14000)
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
    // the point values — the 6W activity table (capstone x2, case_study x2,
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
          maxPossiblePoints: 90500,
          passMarkPoints: 67000,
        }),
        expect.objectContaining({
          key: 'without_mentor_or_ambassador',
          maxPossiblePoints: 96500,
          passMarkPoints: 71000,
        }),
      ]),
    )

    expect(sixMonth.pointVariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'without_mentor_and_ambassador',
          maxPossiblePoints: 181000,
          passMarkPoints: 135000,
        }),
        expect.objectContaining({
          key: 'without_mentor_or_ambassador',
          maxPossiblePoints: 193000,
          passMarkPoints: 143000,
        }),
      ]),
    )

    expect(nineMonth.pointVariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'without_mentor_and_ambassador',
          maxPossiblePoints: 271500,
          passMarkPoints: 203000,
        }),
        expect.objectContaining({
          key: 'without_mentor_or_ambassador',
          maxPossiblePoints: 289500,
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

  it('weekly session attendance is partner-issued (no learner proof flow)', () => {
    const weeklySession = getActivityDefinitionById({ activityId: 'weekly_session', journeyType: '6W' })

    expect(weeklySession).toBeTruthy()
    expect(weeklySession?.approvalType).toBe('partner_issued')
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
