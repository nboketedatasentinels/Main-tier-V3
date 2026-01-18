/**
 * Date and Timestamp Normalization Utilities
 * Centralized logic for handling Firestore Timestamps and various date formats
 */

import { Timestamp } from 'firebase/firestore'

/**
 * Normalize a Firestore Timestamp to ISO string
 * Handles Timestamp, Date, string, and undefined values
 *
 * @param value - The value to normalize
 * @returns ISO string representation or empty string if invalid
 */
export function normalizeTimestampToString(value?: Timestamp | string | Date | null): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if ('toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  return ''
}

/**
 * Parse various date formats into a JavaScript Date object
 * Handles Timestamp, Date, number (milliseconds), string, and unknown objects
 *
 * @param value - The value to parse
 * @returns Date object or null if invalid
 */
export function parseDateValue(value?: unknown): Date | null {
  if (!value) return null

  // Handle Firestore Timestamp
  if (value instanceof Timestamp) {
    return value.toDate()
  }

  // Handle existing Date object
  if (value instanceof Date) {
    return value
  }

  // Handle number (milliseconds since epoch)
  if (typeof value === 'number') {
    return new Date(value)
  }

  // Handle string
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  // Handle objects with toDate method (Firestore-like)
  const maybeTimestamp = value as { toDate?: () => Date }
  if (typeof maybeTimestamp.toDate === 'function') {
    return maybeTimestamp.toDate()
  }

  return null
}

/**
 * Convert Firestore Timestamp to Date, handling null/undefined
 *
 * @param timestamp - Firestore Timestamp
 * @returns Date object or null
 */
export function timestampToDate(timestamp?: Timestamp | null): Date | null {
  if (!timestamp) return null
  if ('toDate' in timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate()
  }
  return null
}

/**
 * Format a date value to a human-readable string
 *
 * @param value - Date value to format
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string or 'Unknown'
 */
export function formatDate(
  value?: Date | Timestamp | string | null,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }
): string {
  const date = parseDateValue(value)
  if (!date) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, options).format(date)
}

/**
 * Check if a date value is valid
 *
 * @param value - Value to check
 * @returns true if valid date, false otherwise
 */
export function isValidDate(value?: unknown): boolean {
  const date = parseDateValue(value)
  return date !== null && !Number.isNaN(date.getTime())
}

/**
 * Get the difference between two dates in days
 *
 * @param date1 - First date
 * @param date2 - Second date (defaults to now)
 * @returns Number of days difference
 */
export function getDaysDifference(
  date1: Date | Timestamp | string,
  date2: Date | Timestamp | string = new Date()
): number {
  const d1 = parseDateValue(date1)
  const d2 = parseDateValue(date2)

  if (!d1 || !d2) return 0

  const diffMs = Math.abs(d2.getTime() - d1.getTime())
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}
