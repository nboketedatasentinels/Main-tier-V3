import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import { createOrganizationWithInvitations } from '@/services/organizationService'
import { createInAppNotification } from '@/services/notificationService'
import type { OrganizationRecord } from '@/types/admin'

const REQUEST_COLLECTION = 'upgrade_requests'
const USERS_COLLECTION = 'users'
const PROFILES_COLLECTION = 'profiles'
const ADMIN_ACTIVITY_COLLECTION = 'admin_activity_log'
const VILLAGES_COLLECTION = 'villages'

type ApprovalContext = {
  requestId: string
  adminId?: string | null
  adminName?: string | null
  notes?: string
  sendWelcomeEmail?: boolean
}

const getUserProfileRefs = (userId: string) => ({
  usersRef: doc(db, USERS_COLLECTION, userId),
  profilesRef: doc(db, PROFILES_COLLECTION, userId),
})

export const transferVillageToOrganization = async (villageId?: string | null, organizationId?: string | null) => {
  if (!villageId || !organizationId) return
  const villageRef = doc(db, VILLAGES_COLLECTION, villageId)
  const villageSnap = await getDoc(villageRef)
  if (!villageSnap.exists()) return
  const data = villageSnap.data() as { companyId?: string | null }
  if (data.companyId === organizationId) return
  await updateDoc(villageRef, { companyId: organizationId, updatedAt: serverTimestamp() })
}

export const approveUpgradeRequestWithOrganizationAssignment = async (
  params: ApprovalContext & { organizationId: string },
) => {
  const { requestId, organizationId, adminId, adminName, notes, sendWelcomeEmail } = params

  const result = await runTransaction(db, async (transaction) => {
    const requestRef = doc(db, REQUEST_COLLECTION, requestId)
    const requestSnap = await transaction.get(requestRef)
    if (!requestSnap.exists()) {
      throw new Error('Upgrade request not found.')
    }
    const requestData = requestSnap.data() as { user_id?: string; villageId?: string | null }
    const userId = requestData.user_id
    if (!userId) {
      throw new Error('Upgrade request missing user.')
    }

    const orgRef = doc(db, ORG_COLLECTION, organizationId)
    const orgSnap = await transaction.get(orgRef)
    if (!orgSnap.exists()) {
      throw new Error('Organization not found.')
    }
    const orgData = orgSnap.data() as { name?: string; status?: string }
    if (orgData.status && orgData.status !== 'active') {
      throw new Error('Organization is not active.')
    }

    const { usersRef, profilesRef } = getUserProfileRefs(userId)
    const userSnap = await transaction.get(usersRef)
    const profileSnap = await transaction.get(profilesRef)
    const userData = (userSnap.exists() ? userSnap.data() : profileSnap.data()) as {
      role?: string
      organizationId?: string | null
      companyId?: string | null
      villageId?: string | null
    } | undefined

    if (!userData) {
      throw new Error('User profile not found.')
    }
    if (userData.organizationId || userData.companyId) {
      throw new Error('User is already assigned to an organization.')
    }
    if (userData.role && userData.role !== 'free_user') {
      throw new Error('User is not eligible for upgrade.')
    }

    const updates = {
      role: 'paid_member',
      membershipStatus: 'paid',
      organizationId,
      companyId: organizationId,
      updatedAt: serverTimestamp(),
      lastModifiedBy: adminId ?? null,
      lastModifiedAt: serverTimestamp(),
    }

    transaction.set(usersRef, updates, { merge: true })
    transaction.set(profilesRef, updates, { merge: true })
    transaction.update(requestRef, {
      status: 'approved',
      reviewed_by: adminId ?? null,
      reviewed_at: serverTimestamp(),
      admin_notes: notes ?? null,
    })

    const activityRef = doc(collection(db, ADMIN_ACTIVITY_COLLECTION))
    transaction.set(activityRef, {
      action: 'upgrade_request_approved',
      admin_id: adminId ?? null,
      admin_name: adminName ?? null,
      user_id: userId,
      organization_id: organizationId,
      organization_name: orgData.name ?? 'Organization',
      previous_role: userData.role ?? 'unknown',
      new_role: 'paid_member',
      village_id: userData.villageId ?? requestData.villageId ?? null,
      notes: notes ?? null,
      createdAt: serverTimestamp(),
      metadata: {
        requestId,
        sendWelcomeEmail: Boolean(sendWelcomeEmail),
        approvalType: 'existing_organization',
      },
    })

    return {
      userId,
      organizationName: orgData.name ?? 'Organization',
      villageId: userData.villageId ?? requestData.villageId ?? null,
    }
  })

  await transferVillageToOrganization(result.villageId, organizationId)

  await createInAppNotification({
    userId: result.userId,
    type: 'approval',
    title: 'Your upgrade request has been approved!',
    message: `You've been added to ${result.organizationName}. Access your new dashboard now.`,
    metadata: {
      organizationName: result.organizationName,
      actionLabel: 'Go to Dashboard',
      actionUrl: '/dashboard',
    },
  })

  return result
}

export const approveUpgradeRequestWithNewOrganization = async (
  params: ApprovalContext & { organizationData: OrganizationRecord },
) => {
  const { requestId, organizationData, adminId, adminName, notes, sendWelcomeEmail } = params

  const { organizationId } = await createOrganizationWithInvitations(organizationData, [], {
    adminId: adminId ?? undefined,
    adminName: adminName ?? undefined,
  })

  const result = await approveUpgradeRequestWithOrganizationAssignment({
    requestId,
    organizationId,
    adminId,
    adminName,
    notes,
    sendWelcomeEmail,
  })

  return { ...result, organizationId }
}

export const rejectUpgradeRequest = async (params: {
  requestId: string
  userId: string
  adminId?: string | null
  adminName?: string | null
  reason?: string | null
}) => {
  const { requestId, userId, adminId, adminName, reason } = params
  const requestRef = doc(db, REQUEST_COLLECTION, requestId)
  await updateDoc(requestRef, {
    status: 'rejected',
    reviewed_by: adminId ?? null,
    reviewed_at: serverTimestamp(),
    admin_notes: reason ?? null,
  })

  await setDoc(
    doc(collection(db, ADMIN_ACTIVITY_COLLECTION)),
    {
      action: 'upgrade_request_rejected',
      admin_id: adminId ?? null,
      admin_name: adminName ?? null,
      user_id: userId,
      createdAt: serverTimestamp(),
      notes: reason ?? null,
      metadata: { requestId },
    },
    { merge: true },
  )

  await createInAppNotification({
    userId,
    type: 'approval',
    title: 'Your upgrade request needs attention',
    message: reason || 'Please review the requested changes and contact support for assistance.',
    metadata: {
      requestId,
      actionLabel: 'Contact Support',
      actionUrl: '/support',
    },
  })
}
