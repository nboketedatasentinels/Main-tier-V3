import { db } from '@/services/firebase'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'

type ChecklistActivityEntry = {
  id: string
  status?: string
  hasInteracted?: boolean
  proofUrl?: string | null
  notes?: string | null
  rejectionReason?: string | null
}

type ChecklistDoc = {
  activities?: ChecklistActivityEntry[]
}

type ChecklistActivityPatch = {
  status?: string
  hasInteracted?: boolean
  proofUrl?: string | null
  notes?: string | null
  rejectionReason?: string | null
}

export async function upsertChecklistActivity(params: {
  userId: string
  weekNumber: number
  activityId: string
  patch: ChecklistActivityPatch
}) {
  const checklistRef = doc(db, 'checklists', `${params.userId}_${params.weekNumber}`)

  const snap = await getDoc(checklistRef)
  const existing = (snap.exists() ? (snap.data() as ChecklistDoc).activities : []) ?? []

  const nextActivities = Array.isArray(existing) ? [...existing] : []
  const idx = nextActivities.findIndex((entry) => entry.id === params.activityId)
  const nextEntry = {
    ...(idx >= 0 ? nextActivities[idx] : { id: params.activityId }),
    ...params.patch,
  }

  if (idx >= 0) nextActivities[idx] = nextEntry
  else nextActivities.push(nextEntry)

  await setDoc(
    checklistRef,
    {
      activities: nextActivities,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
