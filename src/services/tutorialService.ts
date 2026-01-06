import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { TutorialCompletion } from '@/types'

const TUTORIAL_COMPLETIONS_COLLECTION = 'tutorial_completions'

const toTutorialCompletion = (id: string, data: Record<string, unknown>): TutorialCompletion => {
  const completedAt = data.completed_at as Timestamp | undefined
  const createdAt = data.created_at as Timestamp | undefined

  return {
    id,
    user_id: data.user_id as string,
    tutorial_id: data.tutorial_id as string,
    completed_at: completedAt?.toDate().toISOString() ?? new Date().toISOString(),
    created_at: createdAt?.toDate().toISOString() ?? new Date().toISOString(),
  }
}

export const checkTutorialCompletion = async (
  userId: string,
  tutorialId: string,
): Promise<TutorialCompletion | null> => {
  try {
    const completionsQuery = query(
      collection(db, TUTORIAL_COMPLETIONS_COLLECTION),
      where('user_id', '==', userId),
      where('tutorial_id', '==', tutorialId),
    )
    const snapshot = await getDocs(completionsQuery)
    if (snapshot.empty) return null

    const docSnap = snapshot.docs[0]
    return toTutorialCompletion(docSnap.id, docSnap.data())
  } catch (error) {
    console.error('Failed to check tutorial completion:', error)
    throw error
  }
}

export const markTutorialComplete = async (
  userId: string,
  tutorialId: string,
): Promise<TutorialCompletion> => {
  try {
    const existing = await checkTutorialCompletion(userId, tutorialId)
    if (existing) return existing

    const docRef = await addDoc(collection(db, TUTORIAL_COMPLETIONS_COLLECTION), {
      user_id: userId,
      tutorial_id: tutorialId,
      completed_at: serverTimestamp(),
      created_at: serverTimestamp(),
    })

    return {
      id: docRef.id,
      user_id: userId,
      tutorial_id: tutorialId,
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Failed to mark tutorial complete:', error)
    throw error
  }
}
