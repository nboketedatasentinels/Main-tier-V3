import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

vi.mock('@/services/mentorshipService', () => ({
  completeMentorshipSession: vi.fn(),
}))

vi.mock('@/services/ambassadorSessionService', () => ({
  markAttendance: vi.fn(),
}))

import {
  describeQuota,
  listPendingCoachAwards,
  listPendingMentorAwards,
  type SessionPointsQuota,
} from '@/services/sessionPointsService'
import type { MentorshipSession } from '@/services/mentorshipService'
import type { CoachBooking } from '@/services/ambassadorSessionService'

const baseQuota = (overrides: Partial<SessionPointsQuota> = {}): SessionPointsQuota => ({
  activityId: 'mentor_meetup',
  activityTitle: 'Mentor Meet Up',
  pointsEach: 2000,
  maxAwards: 3,
  awardedCount: 1,
  remaining: 2,
  journeyType: '3M',
  ...overrides,
})

describe('sessionPointsService helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('describes journey quota clearly', () => {
    expect(describeQuota(baseQuota())).toContain('1 of 3 awards used')
    expect(describeQuota(baseQuota({ journeyType: null }))).toMatch(/No active journey/i)
    expect(describeQuota(baseQuota({ maxAwards: 0 }))).toMatch(/not part of this journey/i)
  })

  it('lists mentor sessions that still need points', () => {
    const sessions = [
      {
        id: 's1',
        learnerId: 'u1',
        learnerName: 'Ada',
        topic: 'Kickoff',
        status: 'scheduled',
        pointsAwarded: false,
        scheduledAt: new Date('2026-01-02'),
        proposedAt: null,
      },
      {
        id: 's2',
        learnerId: 'u1',
        learnerName: 'Ada',
        topic: 'Done',
        status: 'completed',
        pointsAwarded: true,
        scheduledAt: new Date('2026-01-01'),
        proposedAt: null,
      },
      {
        id: 's3',
        learnerId: 'u1',
        learnerName: 'Ada',
        topic: 'Need points',
        status: 'completed',
        pointsAwarded: false,
        scheduledAt: new Date('2026-01-03'),
        proposedAt: null,
      },
    ] as MentorshipSession[]

    const pending = listPendingMentorAwards(sessions)
    expect(pending.map((p) => p.sessionId)).toEqual(['s3', 's1'])
  })

  it('lists coach bookings that still need points', () => {
    const bookings = [
      {
        id: 'b1',
        learnerId: 'u1',
        learnerName: 'Ada',
        slotTitle: 'Session 1',
        status: 'booked',
        pointsAwarded: false,
        slotScheduledAt: new Date('2026-02-01'),
      },
      {
        id: 'b2',
        learnerId: 'u1',
        learnerName: 'Ada',
        slotTitle: 'Session 2',
        status: 'attended',
        pointsAwarded: true,
        slotScheduledAt: new Date('2026-02-02'),
      },
    ] as CoachBooking[]

    const pending = listPendingCoachAwards(bookings)
    expect(pending).toHaveLength(1)
    expect(pending[0]?.bookingId).toBe('b1')
  })
})
