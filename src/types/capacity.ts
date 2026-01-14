import type { Timestamp } from 'firebase/firestore'

export type CapacityThresholdLevel = 75 | 90 | 95 | 100

export type CapacityAlertSeverity = 'info' | 'warning' | 'critical'

export interface OrganizationCapacityMetrics {
  organizationId: string
  organizationName: string
  currentMembers: number
  teamSize: number
  availableLicenses?: number
  licenseAllocationByRole?: Record<string, number>
  capacityPercentage: number
  lastCalculated?: Timestamp | string | Date | null
}

export interface OrganizationCapacityAlert {
  id: string
  organizationId: string
  organizationName: string
  currentMembers: number
  teamSize: number
  capacityPercentage: number
  threshold: CapacityThresholdLevel
  severity: CapacityAlertSeverity
  createdAt?: Timestamp | string | Date | null
  resolvedAt?: Timestamp | string | Date | null
}
