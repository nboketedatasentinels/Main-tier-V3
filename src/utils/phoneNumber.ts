/**
 * Normalizes a phone number by stripping whitespace, dashes, and parentheses,
 * producing a canonical form suitable for uniqueness checks.
 *
 * Examples:
 *   "+27 81 234 5678"  → "+27812345678"
 *   "(081) 234-5678"   → "0812345678"
 */
export function normalizePhoneNumber(raw: string): string {
  return raw.replace(/[\s\-()]/g, '')
}

const PHONE_REGEX = /^\+?[\d]{7,15}$/

/**
 * Returns true when the (already-normalized) phone string looks like a valid
 * E.164-ish number: optional leading +, then 7-15 digits.
 */
export function isValidPhoneNumber(normalized: string): boolean {
  return PHONE_REGEX.test(normalized)
}
