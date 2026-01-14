import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { RawUpgradeRequest, UpgradeRequest, UpgradeRequestForm, UpgradeRequestStatus } from '@/types/upgrade'
import { AdminDataError } from '@/services/admin/adminErrors'

const REQUEST_COLLECTION = 'upgrade_requests'
const ADMIN_NOTIFICATIONS = 'admin_notifications'

const toUpgradeRequest = (snapshotId: string, data: RawUpgradeRequest): UpgradeRequest => {
  return {
    id: snapshotId,
    user_id: data.user_id,
    request_type: data.request_type,
    current_tier: data.current_tier ?? null,
    requested_tier: data.requested_tier ?? null,
    status: data.status,
    message: data.message ?? null,
    admin_notes: data.admin_notes ?? null,
    requested_at: data.requested_at?.toDate().toISOString() ?? new Date().toISOString(),
    reviewed_at: data.reviewed_at?.toDate().toISOString() ?? null,
    reviewed_by: data.reviewed_by ?? null,
    contact_preference: data.contact_preference ?? null,
    contact_details: data.contact_details ?? null,
  }
}

export const createUpgradeRequest = async (userId: string, requestData: UpgradeRequestForm) => {
  const docRef = await addDoc(collection(db, REQUEST_COLLECTION), {
    user_id: userId,
    request_type: requestData.requestType,
    current_tier: requestData.currentTier ?? null,
    requested_tier: requestData.requestedTier ?? null,
    status: 'pending',
    message: requestData.message ?? null,
    admin_notes: null,
    contact_preference: requestData.contactPreference ?? null,
    contact_details: requestData.contactDetails ?? null,
    requested_at: serverTimestamp(),
  })

  const created = await getDoc(docRef)
  const data = created.data() as RawUpgradeRequest

  await addDoc(collection(db, ADMIN_NOTIFICATIONS), {
    type: 'upgrade_request',
    message: 'New upgrade request submitted',
    metadata: { userId, requestedTier: requestData.requestedTier ?? requestData.requestType },
    created_at: serverTimestamp(),
  })

  return toUpgradeRequest(docRef.id, data)
}

export const getUserUpgradeRequests = async (userId: string): Promise<UpgradeRequest[]> => {
  const q = query(
    collection(db, REQUEST_COLLECTION),
    where('user_id', '==', userId),
    orderBy('requested_at', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => toUpgradeRequest(docSnap.id, docSnap.data() as RawUpgradeRequest))
}

export const checkPendingRequest = async (userId: string): Promise<UpgradeRequest | null> => {
  const q = query(
    collection(db, REQUEST_COLLECTION),
    where('user_id', '==', userId),
    where('status', '==', 'pending'),
    orderBy('requested_at', 'desc'),
    limit(1)
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  const docSnap = snapshot.docs[0]
  return toUpgradeRequest(docSnap.id, docSnap.data() as RawUpgradeRequest)
}

export const getAllUpgradeRequests = async (): Promise<UpgradeRequest[]> => {
  const startedAt = performance.now()
  try {
    const constraints = [orderBy('requested_at', 'desc')]
    console.log('🟣 [Admin] upgrade_requests query constraints:', constraints.map((constraint) => String(constraint)))

    const q = query(collection(db, REQUEST_COLLECTION), ...constraints)
    const snapshot = await getDocs(q)
    console.log(
      '🟢 [Admin] upgrade_requests loaded:',
      snapshot.size,
      'docs in',
      Math.round(performance.now() - startedAt),
      'ms'
    )
    return snapshot.docs.map((docSnap) => toUpgradeRequest(docSnap.id, docSnap.data() as RawUpgradeRequest))
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'unknown'
    const message = (err as { message?: string })?.message
    console.error('🔴 [Admin] upgrade_requests failed', { code, message, err })

    if (code === 'failed-precondition') {
      throw new AdminDataError(
        'Upgrade requests query needs a Firestore composite index (status + requested_at).',
        code,
        { hint: 'Open Firebase console error logs to create the index link automatically.' }
      )
    }

    if (code === 'permission-denied') {
      throw new AdminDataError('You do not have permission to view upgrade requests.', code)
    }

    throw new AdminDataError('Failed to load upgrade requests.', code)
  }
}

export const getPendingUpgradeRequests = async (): Promise<UpgradeRequest[]> => {
  const q = query(
    collection(db, REQUEST_COLLECTION),
    where('status', '==', 'pending'),
    orderBy('requested_at', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => toUpgradeRequest(docSnap.id, docSnap.data() as RawUpgradeRequest))
}

export const updateUpgradeRequestStatus = async (
  requestId: string,
  status: UpgradeRequestStatus,
  notes?: string,
  reviewedBy?: string
) => {
  const requestRef = doc(db, REQUEST_COLLECTION, requestId)
  await updateDoc(requestRef, {
    status,
    admin_notes: notes ?? null,
    reviewed_by: reviewedBy ?? null,
    reviewed_at: serverTimestamp(),
  })

  const updated = await getDoc(requestRef)
  const data = updated.data() as RawUpgradeRequest
  return toUpgradeRequest(requestId, data)
}

export const getUserRequestsForAdmin = async (userId: string): Promise<UpgradeRequest[]> => {
  const q = query(
    collection(db, REQUEST_COLLECTION),
    where('user_id', '==', userId),
    orderBy('requested_at', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => toUpgradeRequest(docSnap.id, docSnap.data() as RawUpgradeRequest))
}
