/** How long after opening a test before result selection unlocks. */
export const TEST_RESULT_UNLOCK_MS = 60 * 60 * 1000 // 1 hour

export type TestUnlockStatus = 'not_started' | 'waiting' | 'unlocked'

export type TestUnlockState = {
  status: TestUnlockStatus
  remainingMs: number
}

export const getTestUnlockState = (
  startedAt: string | null | undefined,
  now: number = Date.now(),
): TestUnlockState => {
  if (!startedAt) {
    return { status: 'not_started', remainingMs: TEST_RESULT_UNLOCK_MS }
  }

  const startedMs = new Date(startedAt).getTime()
  if (!Number.isFinite(startedMs)) {
    return { status: 'not_started', remainingMs: TEST_RESULT_UNLOCK_MS }
  }

  const remainingMs = startedMs + TEST_RESULT_UNLOCK_MS - now
  if (remainingMs <= 0) {
    return { status: 'unlocked', remainingMs: 0 }
  }

  return { status: 'waiting', remainingMs }
}

/** Human-readable wait, e.g. "42 minutes" or "1 hour". */
export const formatRemainingWait = (remainingMs: number): string => {
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000))
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60)
    const mins = totalMinutes % 60
    if (mins === 0) return hours === 1 ? '1 hour' : `${hours} hours`
    return `${hours}h ${mins}m`
  }
  return totalMinutes === 1 ? '1 minute' : `${totalMinutes} minutes`
}

export const buildTestUnlockMessage = (
  state: TestUnlockState,
  testLabel: string,
): string => {
  if (state.status === 'not_started') {
    return `Open and finish your ${testLabel} first. Results do not auto-fill — after 1 hour you must come back here and select what you got.`
  }
  if (state.status === 'waiting') {
    return `Wait ${formatRemainingWait(state.remainingMs)}, then select your ${testLabel} results here. Nothing populates automatically.`
  }
  return `Unlocked — select your ${testLabel} results now so your mentor and coach can see them.`
}
