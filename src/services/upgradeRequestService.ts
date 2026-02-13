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
import { auth, db } from './firebase'
import { RawUpgradeRequest, UpgradeRequest, UpgradeRequestForm, UpgradeRequestStatus } from '@/types/upgrade'
import { AdminDataError } from '@/services/admin/adminErrors'

const REQUEST_COLLECTION = 'upgrade_requests'
const ADMIN_NOTIFICATIONS = 'admin_notifications'
const USERS_COLLECTION = 'users'
const PROFILES_COLLECTION = 'profiles'
const VILLAGES_COLLECTION = 'villages'

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
    villageId: data.villageId ?? null,
    villageName: data.villageName ?? null,
    villageDescription: data.villageDescription ?? null,
    userDetails: data.userDetails ?? null,
    requested_at: data.requested_at?.toDate().toISOString() ?? new Date().toISOString(),
    reviewed_at: data.reviewed_at?.toDate().toISOString() ?? null,
    reviewed_by: data.reviewed_by ?? null,
    contact_preference: data.contact_preference ?? null,
    contact_details: data.contact_details ?? null,
  }
}

export const createUpgradeRequest = async (userId: string, requestData: UpgradeRequestForm) => {
  const userSnapshot = await getDoc(doc(db, USERS_COLLECTION, userId))
  let profileData: Record<string, unknown> | null = null
  if (userSnapshot.exists()) {
    profileData = userSnapshot.data() as Record<string, unknown>
  } else {
    const profileSnapshot = await getDoc(doc(db, PROFILES_COLLECTION, userId))
    if (profileSnapshot.exists()) {
      profileData = profileSnapshot.data() as Record<string, unknown>
    }
  }

  const villageId = (profileData?.villageId as string | undefined) || null
  let villageName: string | null = (profileData?.villageName as string | undefined) || null
  let villageDescription: string | null =
    (profileData?.villageDescription as string | undefined) ||
    (profileData?.villagePurpose as string | undefined) ||
    null

  if (villageId) {
    const villageSnapshot = await getDoc(doc(db, VILLAGES_COLLECTION, villageId))
    if (villageSnapshot.exists()) {
      const villageData = villageSnapshot.data() as { name?: string; description?: string }
      villageName = villageData.name || villageName
      villageDescription = villageData.description || villageDescription
    }
  }

  const userDetails = profileData
    ? {
        fullName: (profileData.fullName as string | undefined) || null,
        firstName: (profileData.firstName as string | undefined) || null,
        lastName: (profileData.lastName as string | undefined) || null,
        email: (profileData.email as string | undefined) || null,
        role: (profileData.role as string | undefined) || null,
        phoneNumber: (profileData.phoneNumber as string | undefined) || null,
        companyId: (profileData.companyId as string | undefined) || null,
        organizationId: (profileData.organizationId as string | undefined) || null,
      }
    : null

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
    villageId,
    villageName,
    villageDescription,
    userDetails,
    requested_at: serverTimestamp(),
  })

  const created = await getDoc(docRef)
  const data = created.data() as RawUpgradeRequest

  await addDoc(collection(db, ADMIN_NOTIFICATIONS), {
    type: 'upgrade_request',
    category: 'upgrade_request',
    message: `New upgrade request from ${userDetails?.fullName || userDetails?.email || 'a user'}`,
    is_read: false,
    read: false,
    target_roles: ['super_admin'],
    metadata: {
      userId,
      userName: userDetails?.fullName || userDetails?.firstName || userDetails?.email || userId,
      userEmail: userDetails?.email || null,
      currentTier: requestData.currentTier ?? null,
      requestedTier: requestData.requestedTier ?? requestData.requestType,
      villageName,
      requestId: docRef.id,
      route: `/super-admin?tab=approvals&requestId=${docRef.id}`,
    },
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
  const constraints = [orderBy('requested_at', 'desc')]
  const runQuery = async () => {
    const q = query(collection(db, REQUEST_COLLECTION), ...constraints)
    return getDocs(q)
  }

  try {
    console.log('🟣 [Admin] upgrade_requests query constraints:', constraints.map((constraint) => String(constraint)))
    const snapshot = await runQuery()
    console.log(
      '🟢 [Admin] upgrade_requests loaded:',
      snapshot.size,
      'docs in',
      Math.round(performance.now() - startedAt),
      'ms'
    )
    return snapshot.docs.map((docSnap) => toUpgradeRequest(docSnap.id, docSnap.data() as RawUpgradeRequest))
  } catch (err) {
    let effectiveError: unknown = err
    let code = (effectiveError as { code?: string })?.code ?? 'unknown'

    if (code === 'permission-denied' && auth.currentUser) {
      try {
        await auth.currentUser.getIdToken(true)
        const retrySnapshot = await runQuery()
        console.log(
          '🟢 [Admin] upgrade_requests loaded after token refresh:',
          retrySnapshot.size,
          'docs in',
          Math.round(performance.now() - startedAt),
          'ms'
        )
        return retrySnapshot.docs.map((docSnap) =>
          toUpgradeRequest(docSnap.id, docSnap.data() as RawUpgradeRequest),
        )
      } catch (retryError) {
        effectiveError = retryError
        code = (effectiveError as { code?: string })?.code ?? code
      }
    }

    const message = (effectiveError as { message?: string })?.message
    console.error('🔴 [Admin] upgrade_requests failed', { code, message, err: effectiveError })

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

