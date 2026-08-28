/**
 * ESG unit rates — same auto-calculation used by the legacy Impact Log.
 * V2 ESG entries must use this so dollar estimates stay consistent.
 */
import { ESGCategory } from '@/types'

export const VOLUNTEER_HOURLY_RATE = 33.49
export const DEFAULT_ESG_UNIT_RATE = 150

type EsgRateConfig = {
  unit: string
  rate: number
  sasbTopic: string
  /** Keys matched against V2 metric labels / legacy activity types. */
  match: string[]
}

const ESG_RATE_ROWS: Record<ESGCategory, EsgRateConfig[]> = {
  [ESGCategory.ENVIRONMENTAL]: [
    {
      unit: 'Trees planted',
      rate: 5.0,
      sasbTopic: 'Ecological Impacts',
      match: ['tree', 'planting'],
    },
    {
      unit: 'Kg waste collected',
      rate: 2.5,
      sasbTopic: 'Waste & Hazardous Materials',
      match: ['waste', 'landfill', 'clean-up', 'cleanup'],
    },
    {
      unit: 'Tonnes CO2 avoided',
      rate: 50.0,
      sasbTopic: 'GHG Emissions',
      match: ['emission', 'co2', 'carbon'],
    },
    {
      unit: 'Litres saved',
      rate: 0.005,
      sasbTopic: 'Water & Wastewater Mgmt',
      match: ['water'],
    },
    {
      unit: 'kWh generated',
      rate: 0.1,
      sasbTopic: 'Energy Management',
      match: ['energy', 'kwh', 'renewable'],
    },
    {
      unit: 'Reams',
      rate: 2.0,
      sasbTopic: 'Waste & Hazardous Materials',
      match: ['paper'],
    },
  ],
  [ESGCategory.SOCIAL]: [
    {
      unit: 'People trained',
      rate: 150.0,
      sasbTopic: 'Human Capital Development',
      match: ['trained', 'training', 'graduates', 'youth'],
    },
    {
      unit: 'People mentored',
      rate: 500.0,
      sasbTopic: 'Human Capital Development',
      match: ['mentor', 'women in technical'],
    },
    {
      unit: 'People reached',
      rate: 25.0,
      sasbTopic: 'Community Relations',
      match: ['community'],
    },
    {
      unit: 'Volunteer hours',
      rate: VOLUNTEER_HOURLY_RATE,
      sasbTopic: 'Community Relations',
      match: ['community hours', 'volunteer'],
    },
    {
      unit: 'Incidents avoided',
      rate: 500.0,
      sasbTopic: 'Employee Health & Safety',
      match: ['safety'],
    },
  ],
  [ESGCategory.GOVERNANCE]: [
    {
      unit: 'Policies created',
      rate: 3000.0,
      sasbTopic: 'Business Ethics',
      match: ['policy', 'standard'],
    },
    {
      unit: 'Findings closed',
      rate: 1500.0,
      sasbTopic: 'Business Ethics',
      match: ['control', 'audit', 'finding'],
    },
    {
      unit: 'Governance steps',
      rate: 2000.0,
      sasbTopic: 'Systemic Risk Mgmt',
      match: ['data or ai governance', 'governance'],
    },
    {
      unit: 'Supplier improvements',
      rate: 1000.0,
      sasbTopic: 'Supply Chain Management',
      match: ['supplier'],
    },
    {
      unit: 'Risk items retired',
      rate: 2500.0,
      sasbTopic: 'Systemic Risk Mgmt',
      match: ['risk register'],
    },
  ],
}

export function resolveEsgRate(params: {
  esgCategory: ESGCategory
  metricLabel: string
}): { unitRate: number; unitLabel: string; sasbTopic: string; activityType: string } {
  const rows = ESG_RATE_ROWS[params.esgCategory] || []
  const needle = params.metricLabel.toLowerCase()
  const match = rows.find((row) => row.match.some((m) => needle.includes(m)))
  if (match) {
    return {
      unitRate: match.rate,
      unitLabel: match.unit,
      sasbTopic: match.sasbTopic,
      activityType: match.unit,
    }
  }
  return {
    unitRate: DEFAULT_ESG_UNIT_RATE,
    unitLabel: 'Units',
    sasbTopic: 'General',
    activityType: 'Other',
  }
}

/** Same formula as legacy Impact Log: qty × unit rate (+ volunteer hours if any). */
export function computeEsgUsdValue(params: {
  esgCategory: ESGCategory
  metricLabel: string
  quantity: number
  hours?: number
}): number {
  const { unitRate } = resolveEsgRate({
    esgCategory: params.esgCategory,
    metricLabel: params.metricLabel,
  })
  const qty = Number(params.quantity) || 0
  const hours = Number(params.hours) || 0
  return qty * unitRate + hours * VOLUNTEER_HOURLY_RATE
}
