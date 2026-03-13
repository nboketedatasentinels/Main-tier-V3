import { collection, addDoc, getDocs, query, where, writeBatch, doc } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { getUserJourney, updateUserJourneyPoints, getCurrentWindowId, type UserJourney } from './userJourneyService'

export type PointsSourceType =
  | 'impact_log_entry'
  | 'podcast'
  | 'webinar'
  | 'weekly_session'
  | 'lift_module'
  | 'linkedin_post'
  | 'book_club'
  | 'peer_session'
  | 'challenger'
  | 'mentor_meetup'
  | 'ambassador_session'

export interface PointsTransaction {
  userId: string
  sourceType: PointsSourceType
  sourceId: string
  pointsAwarded: number
  journeyType: UserJourney['journeyType']
  windowId: string
  awardedAt: string
}

const getMaxEntriesForJourney = (journeyType: UserJourney['journeyType']): number => {
  switch (journeyType) {
    case '6-week':
      return 12
    case '3-month':
      return 18
    case '6-month':
      return 36
    case '9-month':
      return 54
    case '4-week':
    default:
      return 8
  }
}

const countImpactLogEntriesInJourney = async (userId: string): Promise<number> => {
  const snap = await getDocs(query(collection(db, 'impact_logs'), where('userId', '==', userId)))
  return snap.size
}

export const awardPointsForImpactLog = async (userId: string, impactLogEntryId: string): Promise<void> => {
  if (!userId || !impactLogEntryId) return

  const journey = await getUserJourney(userId)

  // Default points per entry; 6-week intensives earn more
  let pointsToAward = 1000
  if (journey.journeyType === '6-week') {
    pointsToAward = 2000
  }

  const entriesThisJourney = await countImpactLogEntriesInJourney(userId)
  const maxEntries = getMaxEntriesForJourney(journey.journeyType)

  if (entriesThisJourney >= maxEntries) {
    // Respect journey caps; don't award additional engagement points
    return
  }

  const windowId = getCurrentWindowId(journey)
  const nowIso = new Date().toISOString()

  const transaction: PointsTransaction = {
    userId,
    sourceType: 'impact_log_entry',
    sourceId: impactLogEntryId,
    pointsAwarded: pointsToAward,
    journeyType: journey.journeyType,
    windowId,
    awardedAt: nowIso,
  }

  await addDoc(collection(db, 'points_transactions'), transaction)
  await updateUserJourneyPoints(userId, pointsToAward)
}

/**
 * One-time backfill: create points_transactions for existing impact_log entries
 * that don't have a transaction yet. Call on dashboard load so existing users see correct points.
 */
export const backfillImpactLogPointsForUser = async (
  userId: string,
): Promise<{ created: number; totalPointsAwarded: number }> => {
  if (!userId) return { created: 0, totalPointsAwarded: 0 }

  const journey = await getUserJourney(userId)
  const pointsPerEntry = journey.journeyType === '6-week' ? 2000 : 1000
  const windowId = getCurrentWindowId(journey)
  const nowIso = new Date().toISOString()

  const [entriesSnap, txSnap] = await Promise.all([
    getDocs(query(collection(db, 'impact_logs'), where('userId', '==', userId))),
    getDocs(
      query(
        collection(db, 'points_transactions'),
        where('userId', '==', userId),
        where('sourceType', '==', 'impact_log_entry'),
      ),
    ),
  ])

  const processedEntryIds = new Set(txSnap.docs.map((d) => (d.data() as PointsTransaction).sourceId))
  const entriesToProcess = entriesSnap.docs.filter((d) => !processedEntryIds.has(d.id))

  if (entriesToProcess.length === 0) {
    return { created: 0, totalPointsAwarded: 0 }
  }

  // Firestore batch limit 500; process in chunks
  const BATCH_SIZE = 450
  let totalAwarded = 0

  for (let i = 0; i < entriesToProcess.length; i += BATCH_SIZE) {
    const chunk = entriesToProcess.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)
    for (const entryDoc of chunk) {
      const txRef = doc(collection(db, 'points_transactions'))
      batch.set(txRef, {
        userId,
        sourceType: 'impact_log_entry' as const,
        sourceId: entryDoc.id,
        pointsAwarded: pointsPerEntry,
        journeyType: journey.journeyType,
        windowId,
        awardedAt: nowIso,
      })
      totalAwarded += pointsPerEntry
    }
    await batch.commit()
  }

  if (totalAwarded > 0) {
    await updateUserJourneyPoints(userId, totalAwarded)
  }

  return { created: entriesToProcess.length, totalPointsAwarded: totalAwarded }
}

