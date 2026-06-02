import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore'
import { db } from './firebase'

export interface PreCourseSurveyAnswers {
  email: string
  firstName: string
  lastName: string
  organization: string
}

/**
 * Denormalized identity/org context written alongside the answers so partners
 * can query their learners' submissions by organization (see
 * `subscribeToPreCourseSurveysByOrgIds`) without joining against profiles.
 */
export interface PreCourseSurveyMeta {
  organizationId: string | null
  companyId: string | null
  displayName: string | null
}

export interface PreCourseSurveyState {
  completed: boolean
  completedAt: Date | null
  answers: PreCourseSurveyAnswers | null
}

/** One learner's submission, as consumed by the partner review page. */
export interface PreCourseSurveyResponse {
  uid: string
  organizationId: string | null
  companyId: string | null
  displayName: string | null
  email: string
  firstName: string
  lastName: string
  organization: string
  submittedAt: Date | null
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

const toAnswers = (value: unknown): PreCourseSurveyAnswers | null => {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return {
    email: typeof data.email === 'string' ? data.email : '',
    firstName: typeof data.firstName === 'string' ? data.firstName : '',
    lastName: typeof data.lastName === 'string' ? data.lastName : '',
    organization: typeof data.organization === 'string' ? data.organization : '',
  }
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
        answers: toAnswers(data.answers),
      })
    },
    (err) => {
      console.error('[preCourseSurveyService] subscribe failed', err)
      onError?.(err)
    },
  )
}

/**
 * Persist the learner's pre-course survey answers and mark the survey
 * complete in a single write. Answers live in the same per-user document so
 * the existing `preCourseSurvey/{uid}` rules (owner write, owner + partner
 * read) cover both the gate state and the response data. `organizationId` is
 * denormalized so the learner's partner can find the submission.
 */
export async function completePreCourseSurvey(
  uid: string,
  answers: PreCourseSurveyAnswers,
  meta: PreCourseSurveyMeta,
): Promise<void> {
  await setDoc(
    docRef(uid),
    {
      uid,
      completed: true,
      completedAt: serverTimestamp(),
      organizationId: meta.organizationId,
      companyId: meta.companyId,
      displayName: meta.displayName,
      answers: {
        email: answers.email.trim(),
        firstName: answers.firstName.trim(),
        lastName: answers.lastName.trim(),
        organization: answers.organization.trim(),
      },
      submittedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

const toResponse = (uid: string, data: DocumentData): PreCourseSurveyResponse => {
  const answers = toAnswers(data.answers) ?? {
    email: '',
    firstName: '',
    lastName: '',
    organization: '',
  }
  return {
    uid: typeof data.uid === 'string' ? data.uid : uid,
    organizationId: typeof data.organizationId === 'string' ? data.organizationId : null,
    companyId: typeof data.companyId === 'string' ? data.companyId : null,
    displayName: typeof data.displayName === 'string' ? data.displayName : null,
    email: answers.email,
    firstName: answers.firstName,
    lastName: answers.lastName,
    organization: answers.organization,
    submittedAt: toDate(data.submittedAt),
    completedAt: toDate(data.completedAt),
  }
}

/**
 * Subscribe to all pre-course survey submissions for a set of organization ids.
 * Mirrors `subscribeToSubmissionsByOrgIds`: Firestore `in` queries cap at 30
 * values, so we chunk and merge. Only submissions that recorded an
 * `organizationId` (i.e. completed after this field shipped) are returned.
 */
export function subscribeToPreCourseSurveysByOrgIds(
  organizationIds: string[],
  onUpdate: (rows: PreCourseSurveyResponse[]) => void,
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

  const buffers: PreCourseSurveyResponse[][] = chunks.map(() => [])
  const colRef = collection(db, 'preCourseSurvey')

  const emit = () => {
    const merged = new Map<string, PreCourseSurveyResponse>()
    buffers.flat().forEach((row) => merged.set(row.uid, row))
    onUpdate(
      Array.from(merged.values()).sort(
        (a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0),
      ),
    )
  }

  const unsubscribers = chunks.map((chunk, index) => {
    const q = query(colRef, where('organizationId', 'in', chunk))
    return onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        buffers[index] = snap.docs.map((d) => toResponse(d.id, d.data()))
        emit()
      },
      (err) => {
        console.error('[preCourseSurveyService] org subscribe failed', err)
        onError?.(err)
      },
    )
  })

  return () => unsubscribers.forEach((u) => u())
}
