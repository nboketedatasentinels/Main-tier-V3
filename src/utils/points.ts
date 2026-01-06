import { collection, getDocs, query, where, type Transaction } from 'firebase/firestore'

import { db } from '@/services/firebase'

const LEVEL_STEP = 500
const MIN_LEVEL = 1

/**
 * Level progression:
 * - Level 1 starts at 0 points.
 * - Each additional 500 points advances one level.
 */
export const calculateLevel = (totalPoints: number, maxLevel?: number): number => {
  const normalizedPoints = Math.max(0, totalPoints)
  const computedLevel = Math.floor(normalizedPoints / LEVEL_STEP) + 1
  const boundedLevel = Math.max(MIN_LEVEL, computedLevel)

  if (typeof maxLevel === 'number') {
    return Math.min(maxLevel, boundedLevel)
  }

  return boundedLevel
}

export const calculateUserTotalPoints = async (
  uid: string,
  options?: { transaction?: Transaction },
): Promise<number> => {
  const ledgerQuery = query(collection(db, 'pointsLedger'), where('uid', '==', uid))
  const snapshot = options?.transaction ? await options.transaction.get(ledgerQuery) : await getDocs(ledgerQuery)

  return snapshot.docs.reduce((sum, doc) => sum + (doc.data().points ?? 0), 0)
}
