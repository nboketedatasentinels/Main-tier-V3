import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'

export interface PreCourseSurveyState {
  completed: boolean
  completedAt: Date | null
}

const toDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const candidate = value as { toDate?: () => Date }
    if (typeof candidate.toDate === 'function') return candidate.toDate()
  }
  return null
}

const docRef = (uid: string) => doc(db, 'preCourseSurvey', uid)

export function subscribeToPreCourseSurvey(
  uid: string,
  onUpdate: (state: PreCourseSurveyState) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    docRef(uid),
    (snapshot) => {
      const data = (snapshot.data() ?? {}) as DocumentData
      onUpdate({
        completed: Boolean(data.completed),
        completedAt: toDate(data.completedAt),
      })
    },
    (err) => {
      console.error('[preCourseSurveyService] subscribe failed', err)
      onError?.(err)
    },
  )
}

export async function markPreCourseSurveyCompleted(uid: string): Promise<void> {
  await setDoc(
    docRef(uid),
    {
      uid,
      completed: true,
      completedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
