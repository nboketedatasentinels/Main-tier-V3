import { describe, expect, it } from 'vitest'
import { calculateWindowStatus, calculatePartnerWindowRisk } from '@/utils/windowStatus'
import { calculateUserRiskStatus } from '@/utils/partnerProgress'

describe('calculateWindowStatus', () => {
  it('marks on track at ≥ 100% of window target', () => {
    expect(calculateWindowStatus(12500, 12500)).toBe('on_track')
    expect(calculateWindowStatus(13000, 12500)).toBe('on_track')
  })

  it('marks warning between 75% and 99%', () => {
    expect(calculateWindowStatus(9375, 12500)).toBe('warning')
    expect(calculateWindowStatus(12499, 12500)).toBe('warning')
  })

  it('marks alert below 75%', () => {
    expect(calculateWindowStatus(9374, 12500)).toBe('alert')
    expect(calculateWindowStatus(0, 12500)).toBe('alert')
  })

  it('only recovers when back to ≥ 100% after alert', () => {
    expect(calculateWindowStatus(12500, 12500, 'alert')).toBe('recovery')
    expect(calculateWindowStatus(10000, 12500, 'alert')).toBe('warning')
    expect(calculateWindowStatus(12500, 12500, 'warning')).toBe('on_track')
    expect(calculateWindowStatus(12500, 12500, null)).toBe('on_track')
  })

  it('never invents recovery without prior alert history', () => {
    expect(calculateWindowStatus(13500, 13500, undefined)).toBe('on_track')
  })
})

describe('calculatePartnerWindowRisk', () => {
  const base = {
    journeyType: '3M' as const,
    totalPoints: 10000,
  }

  it('does not flag risk without journey context', () => {
    const result = calculatePartnerWindowRisk({
      journeyType: null,
      currentWeek: 4,
      totalPoints: 0,
      earnedPointsByWeek: { 3: 0, 4: 0 },
    })
    expect(result.status).toBe('on_track')
    expect(result.level).toBe('on_track')
  })

  it('treats passed learners as on track', () => {
    const result = calculatePartnerWindowRisk({
      ...base,
      currentWeek: 8,
      totalPoints: 75000,
      earnedPointsByWeek: { 7: 0, 8: 0 },
    })
    expect(result.status).toBe('on_track')
    expect(result.level).toBe('on_track')
  })

  it('does not false-alarm in week 1', () => {
    const result = calculatePartnerWindowRisk({
      ...base,
      currentWeek: 1,
      totalPoints: 0,
      earnedPointsByWeek: { 1: 0 },
    })
    expect(result.status).toBe('on_track')
    expect(result.level).toBe('on_track')
  })

  it('does not false-alarm when weekly window signal is missing', () => {
    const result = calculatePartnerWindowRisk({
      ...base,
      currentWeek: 4,
      totalPoints: 500,
      earnedPointsByWeek: {},
    })
    expect(result.status).toBe('on_track')
    expect(result.level).toBe('on_track')
  })

  it('keeps early-window alert as warning (not at risk)', () => {
    // Week 3 = week 1 of window 2; 2,000 / 12,500 = 16% → alert math, but not partner at-risk yet
    const result = calculatePartnerWindowRisk({
      ...base,
      currentWeek: 3,
      totalPoints: 2000,
      earnedPointsByWeek: { 3: 2000 },
    })
    expect(result.windowStatus).toBe('alert')
    expect(result.status).toBe('on_track')
    expect(result.level).toBe('warning')
  })

  it('flags at risk only when alert persists into week 2 of the window', () => {
    // Week 4 = week 2 of window 2; 2,000 / 12,500 < 75%
    const result = calculatePartnerWindowRisk({
      ...base,
      currentWeek: 4,
      totalPoints: 2000,
      earnedPointsByWeek: { 3: 1000, 4: 1000 },
    })
    expect(result.windowStatus).toBe('alert')
    expect(result.status).toBe('at_risk')
    expect(result.level).toBe('behind')
  })

  it('keeps warning learners off the at-risk list', () => {
    const result = calculatePartnerWindowRisk({
      ...base,
      currentWeek: 4,
      totalPoints: 20000,
      earnedPointsByWeek: { 3: 5000, 4: 5000 }, // 10,000 / 12,500 = 80%
    })
    expect(result.windowStatus).toBe('warning')
    expect(result.status).toBe('on_track')
    expect(result.level).toBe('warning')
  })

  it('marks on track at full window target', () => {
    const result = calculatePartnerWindowRisk({
      ...base,
      currentWeek: 4,
      totalPoints: 30000,
      earnedPointsByWeek: { 3: 7000, 4: 5500 },
    })
    expect(result.windowStatus).toBe('on_track')
    expect(result.status).toBe('on_track')
  })

  it('marks recovery when returning to ≥ 100% after alert', () => {
    const result = calculatePartnerWindowRisk({
      ...base,
      currentWeek: 4,
      totalPoints: 30000,
      earnedPointsByWeek: { 3: 7000, 4: 5500 },
      previousWindowStatus: 'alert',
    })
    expect(result.windowStatus).toBe('recovery')
    expect(result.status).toBe('on_track')
  })

  it('marks journey-ended below pass as critical', () => {
    const result = calculatePartnerWindowRisk({
      ...base,
      currentWeek: 13,
      totalPoints: 40000,
      earnedPointsByWeek: { 11: 0, 12: 0 },
    })
    expect(result.status).toBe('at_risk')
    expect(result.level).toBe('critical')
  })
})

describe('calculateUserRiskStatus adapter', () => {
  it('uses 6W 13,500 window target for alert math', () => {
    const result = calculateUserRiskStatus(
      4,
      { 3: 1000, 4: 1000 },
      {},
      undefined,
      { journeyType: '6W', totalPoints: 2000 },
    )
    // 2,000 / 13,500 < 75%, week 2 of window → at_risk
    expect(result.status).toBe('at_risk')
    expect(result.windowStatus).toBe('alert')
  })
})
