import { describe, expect, it } from 'vitest'
import { FULL_ACTIVITIES, getActivityDefinitionById, resolveCanonicalActivityId } from './pointsConfig'

describe('pointsConfig module activities', () => {
  it('includes Recognition Over Recall and Von Restorff Effect as explicit activities', () => {
    const activityIds = new Set(FULL_ACTIVITIES.map(activity => activity.id))
    const activityTitles = new Set(FULL_ACTIVITIES.map(activity => activity.title))

    expect(activityIds.has('recognition_over_recall')).toBe(true)
    expect(activityIds.has('von_restorff_effect')).toBe(true)
    expect(activityIds.has('lift_module')).toBe(false)

    expect(activityTitles.has('Recognition Over Recall')).toBe(true)
    expect(activityTitles.has('Von Restorff Effect')).toBe(true)
  })

  it('maps legacy lift_module to recognition_over_recall', () => {
    expect(resolveCanonicalActivityId('lift_module')).toBe('recognition_over_recall')

    const resolved = getActivityDefinitionById({ activityId: 'lift_module', journeyType: '6W' })
    expect(resolved?.id).toBe('recognition_over_recall')
    expect(resolved?.title).toBe('Recognition Over Recall')
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
