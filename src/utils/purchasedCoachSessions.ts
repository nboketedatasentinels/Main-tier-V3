/**
 * Purchased Transformation Coaching sessions.
 * Prefer learner override, then org setting, else platform default (5).
 * Orgs usually buy 1 or 5; custom counts (e.g. 10 for one leader) are allowed.
 */

export const MIN_PURCHASED_COACH_SESSIONS = 1
export const MAX_PURCHASED_COACH_SESSIONS = 20
export const DEFAULT_PURCHASED_COACH_SESSIONS = 5

const clampSessions = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n)
  if (rounded < MIN_PURCHASED_COACH_SESSIONS || rounded > MAX_PURCHASED_COACH_SESSIONS) {
    return null
  }
  return rounded
}

export function resolvePurchasedCoachSessions(params: {
  learnerPurchased?: unknown
  orgPurchased?: unknown
  fallback?: number
}): number {
  return (
    clampSessions(params.learnerPurchased) ??
    clampSessions(params.orgPurchased) ??
    clampSessions(params.fallback) ??
    DEFAULT_PURCHASED_COACH_SESSIONS
  )
}

/** Next session index for prep (1-based), capped at purchased total. */
export function nextCoachSessionNumber(params: {
  attendedCount: number
  purchased: number
}): number {
  const purchased = Math.max(MIN_PURCHASED_COACH_SESSIONS, params.purchased)
  return Math.min(purchased, Math.max(1, params.attendedCount + 1))
}
