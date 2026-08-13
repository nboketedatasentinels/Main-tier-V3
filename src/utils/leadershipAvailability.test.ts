import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  resolveLeadershipAvailability,
  fetchLeadershipAvailability,
} from '@/utils/leadershipAvailability'
import { calculatePassMark } from '@/utils/completion'

const rpcMock = vi.fn()

vi.mock('@/services/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

describe('resolveLeadershipAvailability', () => {
  it('treats org assigned mentor as available even without profile mentorId', () => {
    const result = resolveLeadershipAvailability({
      organizationData: { assignedMentorId: 'mentor-1' },
      profile: { mentorId: null },
    })
    expect(result).toEqual({ hasMentor: true, hasAmbassador: false })
  })

  it('treats org assigned coach as available', () => {
    const result = resolveLeadershipAvailability({
      organizationData: { assignedAmbassadorId: 'coach-1' },
      profile: {},
    })
    expect(result).toEqual({ hasMentor: false, hasAmbassador: true })
  })
})

describe('3M checklist grade with mentor/coach', () => {
  it('adds 6000 when only mentor is available (DS case)', () => {
    const none = calculatePassMark('3M', false, false)
    const mentorOnly = calculatePassMark('3M', true, false)

    expect(none.totalTarget).toBe(101000)
    expect(mentorOnly.totalTarget).toBe(107000)
    expect(mentorOnly.totalTarget - none.totalTarget).toBe(6000)
    expect(mentorOnly.adjustedThreshold).toBe(71000)
  })

  it('adds another 6000 when coach is also available', () => {
    const mentorOnly = calculatePassMark('3M', true, false)
    const both = calculatePassMark('3M', true, true)

    expect(both.totalTarget).toBe(113000)
    expect(both.totalTarget - mentorOnly.totalTarget).toBe(6000)
    expect(both.adjustedThreshold).toBe(75000)
  })
})

describe('fetchLeadershipAvailability', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('maps Supabase org mentor assignment into hasMentor', async () => {
    rpcMock.mockResolvedValue({
      data: {
        assignments: { mentorId: 'org-mentor', ambassadorId: null },
        pending: { mentorEmail: null, ambassadorEmail: null },
      },
      error: null,
    })

    const result = await fetchLeadershipAvailability({
      profile: { mentorId: null, ambassadorId: null },
    })

    expect(rpcMock).toHaveBeenCalledWith('get_my_organization_leadership')
    expect(result).toEqual({ hasMentor: true, hasAmbassador: false })
  })
})
