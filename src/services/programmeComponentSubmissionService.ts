import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore'
import { db } from './firebase'

export type ProgrammeComponentType = 'capstone' | 'case_study' | 'practical'

export type ProgrammeSubmissionStatus =
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'needs_revision'

export interface ProgrammeComponentSubmission {
  /** Firestore doc id - format: `{uid}__{componentId}`. */
  id: string
  uid: string
  email: string | null
  displayName: string | null
  organizationId: string | null
  componentId: string
  componentType: ProgrammeComponentType | null
  componentTitle: string | null
  pillar: string | null
  partId: string | null
  partTitle: string | null
  answers: Record<string, string>
  answerCount: number
  status: ProgrammeSubmissionStatus
  submittedAt: Date | null
  lastUpdatedAt: Date | null
  resubmittedAt: Date | null
  sourcePage: string | null
  // Partner review fields
  reviewedAt: Date | null
  reviewedBy: string | null
  reviewerName: string | null
  partnerNotes: string | null
  score: number | null
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

const sanitizeAnswers = (raw: unknown): Record<string, string> => {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string> = {}
  Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
    if (typeof v === 'string') out[k] = v
    else if (v !== null && v !== undefined) out[k] = String(v)
  })
  return out
}

const fromSnapshot = (id: string, data: DocumentData): ProgrammeComponentSubmission => ({
  id,
  uid: typeof data.uid === 'string' ? data.uid : id.split('__')[0] ?? '',
  email: typeof data.email === 'string' ? data.email : null,
  displayName: typeof data.displayName === 'string' ? data.displayName : null,
  organizationId: typeof data.organizationId === 'string' ? data.organizationId : null,
  componentId: typeof data.componentId === 'string' ? data.componentId : '',
  componentType: (['capstone', 'case_study', 'practical'] as const).includes(data.componentType)
    ? (data.componentType as ProgrammeComponentType)
    : null,
  componentTitle: typeof data.componentTitle === 'string' ? data.componentTitle : null,
  pillar: typeof data.pillar === 'string' ? data.pillar : null,
  partId: typeof data.partId === 'string' ? data.partId : null,
  partTitle: typeof data.partTitle === 'string' ? data.partTitle : null,
  answers: sanitizeAnswers(data.answers),
  answerCount: typeof data.answerCount === 'number' ? data.answerCount : 0,
  status:
    data.status === 'in_review' ||
    data.status === 'approved' ||
    data.status === 'needs_revision'
      ? (data.status as ProgrammeSubmissionStatus)
      : 'submitted',
  submittedAt: toDate(data.submittedAt),
  lastUpdatedAt: toDate(data.lastUpdatedAt),
  resubmittedAt: toDate(data.resubmittedAt),
  sourcePage: typeof data.sourcePage === 'string' ? data.sourcePage : null,
  reviewedAt: toDate(data.reviewedAt),
  reviewedBy: typeof data.reviewedBy === 'string' ? data.reviewedBy : null,
  reviewerName: typeof data.reviewerName === 'string' ? data.reviewerName : null,
  partnerNotes: typeof data.partnerNotes === 'string' ? data.partnerNotes : null,
  score: typeof data.score === 'number' ? data.score : null,
})

const sortByLastUpdatedDesc = (
  a: ProgrammeComponentSubmission,
  b: ProgrammeComponentSubmission,
): number => {
  const aT = (a.lastUpdatedAt ?? a.submittedAt)?.getTime() ?? 0
  const bT = (b.lastUpdatedAt ?? b.submittedAt)?.getTime() ?? 0
  return bT - aT
}

/**
 * Subscribe to all submissions for a set of organization ids. Firestore
 * `in` queries cap at 30 values per request; we chunk and merge.
 */
export function subscribeToSubmissionsByOrgIds(
  organizationIds: string[],
  onUpdate: (rows: ProgrammeComponentSubmission[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const ids = Array.from(new Set(organizationIds.filter((id) => Boolean(id))))
  if (ids.length === 0) {
    onUpdate([])
    return () => undefined
  }

  const CHUNK = 30
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    chunks.push(ids.slice(i, i + CHUNK))
  }

  const buffers: ProgrammeComponentSubmission[][] = chunks.map(() => [])
  const colRef = collection(db, 'programmeComponentSubmissions')

  const emit = () => {
    const merged = new Map<string, ProgrammeComponentSubmission>()
    buffers.flat().forEach((row) => merged.set(row.id, row))
    onUpdate(Array.from(merged.values()).sort(sortByLastUpdatedDesc))
  }

  const unsubscribers = chunks.map((chunk, index) => {
    const q = query(colRef, where('organizationId', 'in', chunk))
    return onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        buffers[index] = snap.docs.map((d) => fromSnapshot(d.id, d.data()))
        emit()
      },
      (err) => {
        console.error('[programmeComponentSubmissionService] subscribe failed', err)
        onError?.(err)
      },
    )
  })

  return () => unsubscribers.forEach((u) => u())
}

export interface ReviewUpdate {
  status: ProgrammeSubmissionStatus
  partnerNotes: string | null
  score: number | null
  reviewerId: string
  reviewerName: string
}

export async function updateSubmissionReview(
  submissionId: string,
  update: ReviewUpdate,
): Promise<void> {
  const ref = doc(db, 'programmeComponentSubmissions', submissionId)
  await updateDoc(ref, {
    status: update.status,
    partnerNotes: update.partnerNotes,
    score: update.score,
    reviewedBy: update.reviewerId,
    reviewerName: update.reviewerName,
    reviewedAt: serverTimestamp(),
    lastUpdatedAt: serverTimestamp(),
  })
}
