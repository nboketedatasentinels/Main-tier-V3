import { describe, expect, it } from 'vitest'
import {
  FULL_ACTIVITIES,
  JOURNEY_META,
  getActivitiesForJourney,
  getActivityDefinitionById,
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
    expect(JOURNEY_META['4W'].maxPossiblePoints).toBe(15000)

    expect(byId.get('watch_podcast')?.points).toBe(1000)
    expect(byId.get('watch_podcast')?.activityPolicy?.maxTotal).toBe(3)

    expect(byId.get('impact_log')?.points).toBe(1000)
    expect(byId.get('impact_log')?.activityPolicy?.maxTotal).toBe(2)

    expect(byId.get('webinar_workbook')?.points).toBe(3000)
    expect(byId.get('webinar_workbook')?.activityPolicy?.maxTotal).toBe(1)
    expect(byId.get('ai_tool_review')?.activityPolicy?.maxTotal).toBe(1)
    expect(byId.get('shameless_circle')?.activityPolicy?.maxTotal).toBe(1)
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
