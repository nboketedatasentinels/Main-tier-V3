import { describe, expect, it } from 'vitest'
import { buildMatchWindow, getStoredPeerId } from './peerMatchingUtils'

describe('peerMatchingUtils', () => {
  it('builds the correct weekly window key and dates for Monday preference', () => {
    const window = buildMatchWindow({
      refreshPreference: 'weekly',
      preferredMatchDay: 1,
      timezone: 'UTC',
    }, new Date('2026-02-09T12:00:00.000Z'))

    expect(window.key).toBe('weekly-2026-02-09')
    expect(window.label).toBe('Feb 9 - Feb 15')
    expect(window.startDate?.toISOString()).toBe('2026-02-09T00:00:00.000Z')
    expect(window.endDate?.toISOString()).toBe('2026-02-15T00:00:00.000Z')
    expect(window.nextRefreshAt?.toISOString()).toBe('2026-02-16T00:00:00.000Z')
  })

  it('uses preferredMatchDay when calculating weekly window start', () => {
    const window = buildMatchWindow({
      refreshPreference: 'weekly',
      preferredMatchDay: 0,
      timezone: 'UTC',
    }, new Date('2026-02-09T12:00:00.000Z'))

    expect(window.key).toBe('weekly-2026-02-08')
    expect(window.startDate?.toISOString()).toBe('2026-02-08T00:00:00.000Z')
    expect(window.endDate?.toISOString()).toBe('2026-02-14T00:00:00.000Z')
  })

  it('builds a deterministic biweekly window anchored to Jan 1, 2024', () => {
    const window = buildMatchWindow({
      refreshPreference: 'biweekly',
      preferredMatchDay: 1,
      timezone: 'UTC',
    }, new Date('2026-02-09T12:00:00.000Z'))

    expect(window.key).toBe('biweekly-2026-02-09')
    expect(window.startDate?.toISOString()).toBe('2026-02-09T00:00:00.000Z')
    expect(window.endDate?.toISOString()).toBe('2026-02-22T00:00:00.000Z')
    expect(window.nextRefreshAt?.toISOString()).toBe('2026-02-23T00:00:00.000Z')
  })

  it('keeps users in the same biweekly window across week two of the cycle', () => {
    const window = buildMatchWindow({
      refreshPreference: 'biweekly',
      preferredMatchDay: 1,
      timezone: 'UTC',
    }, new Date('2026-02-16T12:00:00.000Z'))

    expect(window.key).toBe('biweekly-2026-02-09')
  })

  it('returns static windows for disabled and on-demand modes', () => {
    const disabled = buildMatchWindow({
      refreshPreference: 'disabled',
      preferredMatchDay: 1,
      timezone: 'UTC',
    }, new Date('2026-02-09T12:00:00.000Z'))
    const onDemand = buildMatchWindow({
      refreshPreference: 'on-demand',
      preferredMatchDay: 1,
      timezone: 'UTC',
    }, new Date('2026-02-09T12:00:00.000Z'))

    expect(disabled).toMatchObject({
      key: 'disabled',
      label: 'Matching disabled',
      nextRefreshAt: null,
      frequencyLabel: 'Disabled',
    })
    expect(onDemand).toMatchObject({
      key: 'on-demand',
      label: 'On-demand match',
      nextRefreshAt: null,
      frequencyLabel: 'On-demand',
    })
  })

  it('extracts stored peer IDs from both snake_case and camelCase fields', () => {
    expect(getStoredPeerId({ peer_id: 'peer-1' })).toBe('peer-1')
    expect(getStoredPeerId({ peerId: 'peer-2' })).toBe('peer-2')
  })

  it('returns null for missing, blank, or invalid stored peer IDs', () => {
    expect(getStoredPeerId({})).toBeNull()
    expect(getStoredPeerId({ peer_id: '   ' })).toBeNull()
    expect(getStoredPeerId({ peerId: 123 })).toBeNull()
  })
})
