import { describe, expect, it, vi } from 'vitest'
import type { ActivityDef } from '@/config/pointsConfig'
import { awardChecklistPoints } from '@/services/pointsService'
import { handleActivityCompletion } from './activityRouter'

vi.mock('@/services/pointsService', () => ({
  awardChecklistPoints: vi.fn(async () => undefined),
}))

const awardChecklistPointsMock = vi.mocked(awardChecklistPoints)

const makeActivity = (overrides: Partial<ActivityDef> = {}): ActivityDef => ({
  id: 'weekly_session',
  baseId: 'weekly_session',
  title: 'Weekly Session',
  description: 'Attend weekly session',
  points: 1500,
  maxPerMonth: 2,
  activityPolicy: { type: 'window_limited', maxPerWindow: 2 },
  approvalType: 'partner_issued',
  week: 1,
  category: 'Community',
  flexibleWeeks: true,
  ...overrides,
})

describe('handleActivityCompletion partner-issued flow', () => {
  it('does not award points before partner issues the activity', async () => {
    const onSuccess = vi.fn(async () => undefined)
    const onProofRequired = vi.fn()
    const onError = vi.fn()

    await handleActivityCompletion({
      uid: 'user-1',
      journeyType: '6W',
      weekNumber: 1,
      activity: makeActivity(),
      onProofRequired,
      onSuccess,
      onError,
    })

    expect(awardChecklistPointsMock).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onProofRequired).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('awards points once a partner-issued activity has been issued', async () => {
    const onSuccess = vi.fn(async () => undefined)
    const onProofRequired = vi.fn()
    const onError = vi.fn()

    await handleActivityCompletion({
      uid: 'user-1',
      journeyType: '6W',
      weekNumber: 1,
      activity: { ...makeActivity(), issuedByPartner: true } as ActivityDef & { issuedByPartner: boolean },
      onProofRequired,
      onSuccess,
      onError,
    })

    expect(awardChecklistPointsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'user-1',
        journeyType: '6W',
        weekNumber: 1,
        source: 'instant:partner-issued-claim',
      }),
    )
    expect(onSuccess).toHaveBeenCalledWith('completed')
    expect(onError).not.toHaveBeenCalled()
  })
})
