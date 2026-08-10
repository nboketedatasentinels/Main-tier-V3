import { describe, expect, it } from 'vitest'
import { resolveLastActiveAt } from '@/utils/partnerDashboardUtils'

describe('resolveLastActiveAt', () => {
  it('prefers lastActiveAt over updated_at and created_at', () => {
    expect(
      resolveLastActiveAt({
        lastActiveAt: '2026-08-10T10:00:00.000Z',
        updated_at: '2026-08-09T10:00:00.000Z',
        created_at: '2026-08-01T10:00:00.000Z',
      }),
    ).toBe('2026-08-10T10:00:00.000Z')
  })

  it('falls back to updated_at when activity stamp is missing (points awards)', () => {
    expect(
      resolveLastActiveAt({
        updated_at: '2026-08-10T08:00:00.000Z',
        created_at: '2026-08-01T10:00:00.000Z',
      }),
    ).toBe('2026-08-10T08:00:00.000Z')
  })

  it('falls back to signup so engaged learners never show as Never', () => {
    expect(
      resolveLastActiveAt({
        created_at: '2026-08-01T10:00:00.000Z',
      }),
    ).toBe('2026-08-01T10:00:00.000Z')
  })

  it('returns undefined when nothing is available', () => {
    expect(resolveLastActiveAt({})).toBeUndefined()
    expect(resolveLastActiveAt(null)).toBeUndefined()
  })
})
