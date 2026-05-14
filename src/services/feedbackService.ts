import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'

export type FeedbackCategory = 'bug' | 'feature_request' | 'general' | 'appreciation'

export type FeedbackStatus = 'new' | 'reviewed' | 'resolved'

export interface FeedbackInput {
  userId: string | null
  userEmail: string | null
  userName: string | null
  category: FeedbackCategory
  message: string
  pageContext?: string | null
}

export interface FeedbackRecord {
  id: string
  userId: string | null
  userEmail: string | null
  userName: string | null
  category: FeedbackCategory
  message: string
  pageContext: string | null
  status: FeedbackStatus
  createdAt: Date | null
  reviewedAt: Date | null
  reviewedBy: string | null
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

export const subscribeToFeedback = (
  onUpdate: (records: FeedbackRecord[]) => void,
  onError?: (err: Error) => void
) => {
  const q = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snapshot) => {
      const records: FeedbackRecord[] = snapshot.docs.map((d) => {
        const data = d.data() as Record<string, unknown>
        return {
          id: d.id,
          userId: (data.userId as string | null) ?? null,
          userEmail: (data.userEmail as string | null) ?? null,
          userName: (data.userName as string | null) ?? null,
          category: (data.category as FeedbackCategory) ?? 'general',
          message: (data.message as string) ?? '',
          pageContext: (data.pageContext as string | null) ?? null,
          status: (data.status as FeedbackStatus) ?? 'new',
          createdAt: toDate(data.createdAt),
          reviewedAt: toDate(data.reviewedAt),
          reviewedBy: (data.reviewedBy as string | null) ?? null,
        }
      })
      onUpdate(records)
    },
    (err) => {
      console.error('[feedbackService] subscribe failed', err)
      onError?.(err)
    }
  )
}

export const updateFeedbackStatus = async (
  feedbackId: string,
  status: FeedbackStatus,
  reviewerId: string | null
): Promise<void> => {
  await updateDoc(doc(db, 'feedback', feedbackId), {
    status,
    reviewedAt: serverTimestamp(),
    reviewedBy: reviewerId,
  })
}
