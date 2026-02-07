import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, orderBy, doc, setDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { triggerNudgeByStatus } from './nudgeTriggerService'

export async function detectStatusChangeAndNudge(params: {
  uid: string
  journeyType: string
  previousStatus: string
  currentStatus: string
  pointsEarned: number
  windowTarget: number
}) {
  const { uid, journeyType, previousStatus, currentStatus, pointsEarned, windowTarget } = params

  // 1. Log transition for audit/effectiveness
  await logStatusTransition(params)

  // 2. Determine if we should trigger a nudge
  // We trigger if:
  // - Status has improved (e.g. alert -> recovery, alert -> warning, warning -> on_track)
  // - Status has declined (e.g. on_track -> warning, warning -> alert)
  // - Status remains same but it's a significant enough event? (Usually just on change)

  if (previousStatus === currentStatus) return

  // 3. Trigger nudge based on new status
  // triggerNudgeByStatus will handle cooldowns internally
  await triggerNudgeByStatus({
    uid,
    journeyType,
    status: currentStatus as any,
    previousStatus: previousStatus as any,
    pointsEarned,
    windowTarget,
  })
}

async function logStatusTransition(params: {
  uid: string
  journeyType: string
  previousStatus: string
  currentStatus: string
  pointsEarned: number
  windowTarget: number
}) {
  try {
    await addDoc(collection(db, 'nudge_status_transitions'), {
      user_id: params.uid,
      journey_type: params.journeyType,
      previous_status: params.previousStatus,
      current_status: params.currentStatus,
      points_earned: params.pointsEarned,
      window_target: params.windowTarget,
      changed_at: serverTimestamp(),
    })
  } catch (error) {
    console.error('[NudgeMonitor] Error logging status transition:', error)
  }
}

export async function checkNudgeCooldown(uid: string, statusType: string, cooldownHours: number): Promise<boolean> {
  try {
    const cooldownDoc = await getDocs(query(
      collection(db, 'nudge_cooldowns'),
      where('user_id', '==', uid),
      where('status_type', '==', statusType),
      orderBy('last_nudge_at', 'desc'),
      limit(1)
    ))

    if (cooldownDoc.empty) return true

    const lastNudge = cooldownDoc.docs[0].data()
    if (!lastNudge.last_nudge_at) return true

    const lastNudgeAt = lastNudge.last_nudge_at.toMillis()
    const now = Date.now()
    const diffHours = (now - lastNudgeAt) / (1000 * 60 * 60)

    return diffHours >= cooldownHours
  } catch (error) {
    console.error('[NudgeMonitor] Error checking cooldown:', error)
    return true // Default to allowing if error
  }
}

export async function updateNudgeCooldown(uid: string, statusType: string) {
  try {
    const cooldownId = `${uid}__${statusType}`
    await setDoc(doc(db, 'nudge_cooldowns', cooldownId), {
      user_id: uid,
      status_type: statusType,
      last_nudge_at: serverTimestamp(),
    }, { merge: true })
  } catch (error) {
    console.error('[NudgeMonitor] Error updating cooldown:', error)
  }
}
