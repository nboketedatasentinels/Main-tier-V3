/**
 * Utility functions for Partner Dashboard
 */

// ============================================================================
// FIX #11: Type-safe Firestore Timestamp handling
// ============================================================================
interface FirestoreTimestamp {
  toDate: () => Date
}

export function isFirestoreTimestamp(value: unknown): value is FirestoreTimestamp {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as FirestoreTimestamp).toDate === 'function'
  )
}

export const normalizeTimestamp = (value?: unknown): string | null => {
  if (!value) return null

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString()
  }

  if (typeof value === 'number') {
    const dateValue = new Date(value)
    return isNaN(dateValue.getTime()) ? null : dateValue.toISOString()
  }

  if (isFirestoreTimestamp(value)) {
    const dateValue = value.toDate()
    return isNaN(dateValue.getTime()) ? null : dateValue.toISOString()
  }

  if (typeof value === 'string') {
    const dateValue = new Date(value)
    return isNaN(dateValue.getTime()) ? null : dateValue.toISOString()
  }

  return null
}

// ============================================================================
// FIX #10: Conditional logging that respects environment
// ============================================================================
const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  debug: (message: string, data?: unknown) => {
    if (isDevelopment) {
      console.debug(message, data)
    }
  },
  warn: (message: string, data?: unknown) => {
    if (isDevelopment) {
      console.warn(message, data)
    }
  },
  error: (message: string, error?: unknown) => {
    // Always log errors, but with less detail in production
    if (isDevelopment) {
      console.error(message, error)
    } else {
      console.error(message)
    }
  },
  table: (data: unknown[]) => {
    if (isDevelopment && data.length > 0) {
      console.table(data)
    }
  },
}

// ============================================================================
// FIX #12: Proper types instead of `any`
// ============================================================================
export interface MismatchSample {
  id: string
  userOrgKeys: string[]
  assignedKeys?: string[]
  reason: string
}

export interface DashboardDebugInfo {
  totalInSnapshot: number
  keptCount: number
  rejectedNoMatch: number
  rejectedSelectedOrg: number
  mismatchSamples: MismatchSample[]
  assignedOrgKeys: string[]
}

// ============================================================================
// FIX #6: Centralized organization key normalization
// ============================================================================
export const normalizeOrgKey = (key: string | undefined | null): string | null => {
  if (!key || typeof key !== 'string') return null
  const trimmed = key.trim()
  return trimmed.length > 0 ? trimmed.toLowerCase() : null
}

export const normalizeOrgKeys = (keys: (string | undefined | null)[]): string[] => {
  return keys
    .map(normalizeOrgKey)
    .filter((key): key is string => key !== null)
}

export const createOrgKeySet = (keys: (string | undefined | null)[]): Set<string> => {
  return new Set(normalizeOrgKeys(keys))
}
