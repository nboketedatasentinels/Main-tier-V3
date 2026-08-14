/**
 * Purchased Transformation Coaching sessions (1–5).
 * Prefer learner override, then org setting, else platform default (5).
 */

const clampSessions = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n)
  if (rounded < 1 || rounded > 5) return null
  return rounded
}

export const DEFAULT_PURCHASED_COACH_SESSIONS = 5

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
