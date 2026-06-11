/**
 * Holds a visitor's LIFT answers in the browser between taking the public
 * assessment (logged out) and creating/!signing into an account. The
 * post-login gate reads this, scores + saves it against the new account, and
 * shows the results - so the visitor never retakes the assessment.
 */
import type { IntakeAnswers, ItemScores } from '@/utils/liftScoring'

const KEY = 't4l.pendingLift'

export interface PendingLift {
  intake: IntakeAnswers
  itemScores: ItemScores
}

export const savePendingLift = (pending: PendingLift): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(pending))
  } catch {
    /* storage unavailable - non-fatal */
  }
}

export const readPendingLift = (): PendingLift | null => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingLift
    if (!parsed?.itemScores || Object.keys(parsed.itemScores).length === 0) return null
    return parsed
  } catch {
    return null
  }
}

export const clearPendingLift = (): void => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}
