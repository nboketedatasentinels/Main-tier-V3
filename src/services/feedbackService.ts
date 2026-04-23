import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

export type FeedbackCategory = 'bug' | 'feature_request' | 'general' | 'appreciation'

export interface FeedbackInput {
  userId: string | null
  userEmail: string | null
  userName: string | null
  category: FeedbackCategory
  message: string
  pageContext?: string | null
}

export const submitFeedback = async (input: FeedbackInput): Promise<string> => {
  const docRef = await addDoc(collection(db, 'feedback'), {
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    category: input.category,
    message: input.message.trim(),
    pageContext: input.pageContext ?? null,
    status: 'new',
    createdAt: serverTimestamp(),
  })
  return docRef.id
}
