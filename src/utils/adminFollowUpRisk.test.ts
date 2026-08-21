import { describe, expect, it } from 'vitest'
import {
  evaluateAdminFollowUpRisk,
  pendingInviteFollowUpRisk,
} from '@/utils/adminFollowUpRisk'

describe('evaluateAdminFollowUpRisk', () => {
  it('flags learners who never joined', () => {
    const risk = evaluateAdminFollowUpRisk({
      lastActive: null,
      points: 5000,
      membershipStatus: 'paid',
      createdAt: new Date('2026-01-01'),
    })
    expect(risk.atRisk).toBe(true)
    expect(risk.reasons).toContain('never_joined')
  })

  it('flags low points against journey pace', () => {
    const risk = evaluateAdminFollowUpRisk(
      {
        lastActive: new Date('2026-08-01'),
        points: 100,
        membershipStatus: 'paid',
        createdAt: new Date('2026-01-01'),
      },
      {
        journeyType: '3M',
        cohortStartDate: '2026-01-01',
        now: new Date('2026-08-01'),
      },
    )
    expect(risk.atRisk).toBe(true)
    expect(risk.reasons).toContain('low_points')
  })

  it('keeps healthy active learners disabled for follow-up', () => {
    const risk = evaluateAdminFollowUpRisk(
      {
        lastActive: new Date('2026-08-20'),
        points: 200000,
        membershipStatus: 'paid',
        createdAt: new Date('2026-01-01'),
      },
      {
        journeyType: '3M',
        cohortStartDate: '2026-07-01',
        now: new Date('2026-08-01'),
      },
    )
    expect(risk.atRisk).toBe(false)
  })

  it('treats pending invites as at risk', () => {
    expect(pendingInviteFollowUpRisk().atRisk).toBe(true)
  })
})
