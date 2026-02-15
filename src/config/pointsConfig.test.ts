import { describe, expect, it } from 'vitest'
import {
  FULL_ACTIVITIES,
  JOURNEY_META,
  getActivitiesForJourney,
  getActivityDefinitionById,
  getJourneyPointsCrossReference,
  resolveCanonicalActivityId,
} from './pointsConfig'

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
    expect(JOURNEY_META['4W'].maxPossiblePoints).toBe(17000)

    expect(byId.get('watch_podcast')?.points).toBe(1000)
    expect(byId.get('watch_podcast')?.activityPolicy?.maxTotal).toBe(3)

    expect(byId.get('impact_log')?.points).toBe(1000)
    expect(byId.get('impact_log')?.activityPolicy?.maxTotal).toBe(2)

    expect(byId.get('webinar_workbook')?.points).toBe(3000)
    expect(byId.get('webinar_workbook')?.activityPolicy?.maxTotal).toBe(1)
    expect(byId.get('ai_tool_review')?.activityPolicy?.maxTotal).toBe(1)
    expect(byId.get('shameless_circle')?.activityPolicy?.maxTotal).toBe(1)
  })

  it('cross-references each journey activity table with configured maximum points', () => {
    ;(['4W', '6W', '3M', '6M', '9M'] as const).forEach((journeyType) => {
      const crossRef = getJourneyPointsCrossReference(journeyType)
      expect(crossRef.computedMaxPoints).toBe(JOURNEY_META[journeyType].maxPossiblePoints)
      expect(crossRef.maxPossiblePoints).toBe(JOURNEY_META[journeyType].maxPossiblePoints)
    })
  })

  it('keeps alternate pass marks/max points for journeys with optional mentor and ambassador support', () => {
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

  it('enforces single-claim book club rules for 6-week journey config', () => {
    const activities = getActivitiesForJourney('6W')
    const bookClub = activities.find((activity) => activity.id === 'book_club')

    expect(bookClub).toBeTruthy()
    expect(bookClub?.activityPolicy?.type).toBe('one_time')
    expect(bookClub?.activityPolicy?.maxTotal).toBe(1)
    expect(bookClub?.activityPolicy?.maxPerWindow).toBe(1)
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
