import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import {
  BulkInvitationResult,
  InvitationMethod,
  InvitationPayload,
  InvitationResultEntry,
  OrganizationRecord,
} from '@/types/admin'
import { normalizeEmail } from '@/utils/email'
import { checkCapacityThresholds } from './capacityService'

const invitationsCollection = collection(db, 'invitations')
const usersCollection = collection(db, 'users')
const profilesCollection = collection(db, 'profiles')
const organizationsCollection = collection(db, ORG_COLLECTION)

const codeChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

const LICENSE_CONSUMING_ROLES = new Set(['user', 'mentor', 'ambassador'])

const isLicenseConsumingRole = (role?: string | null) => {
  if (!role) return false
  return LICENSE_CONSUMING_ROLES.has(role)
}

const isActiveAccountStatus = (status?: string | null) => {
  if (!status) return true
  const normalized = status.toLowerCase()
  return normalized !== 'suspended' && normalized !== 'inactive'
}

const getOrganizationLicenseSnapshot = async (organizationId: string) => {
  const orgSnap = await getDoc(doc(organizationsCollection, organizationId))
  if (!orgSnap.exists()) {
    throw new Error('Organization not found for invitation validation.')
  }
  const data = orgSnap.data() as OrganizationRecord
  return {
    teamSize: data.teamSize ?? 0,
  }
}

const getActiveLicenseMemberCount = async (organizationId: string) => {
  const snapshot = await getDocs(query(usersCollection, where('assignedOrganizations', 'array-contains', organizationId)))
  return snapshot.docs.filter((docSnap) => {
    const data = docSnap.data() as { role?: string; accountStatus?: string | null }
    return isLicenseConsumingRole(data.role) && isActiveAccountStatus(data.accountStatus)
  }).length
}

export const generateOneTimeCode = () => {
  return Array.from({ length: 8 })
    .map(() => codeChars[Math.floor(Math.random() * codeChars.length)])
    .join('')
}

export const createInvitation = async (data: {
  name: string
  email?: string
  role: string
  organizationId: string
  method: InvitationMethod
  expiresAt?: Date
  code?: string
}) => {
  return addDoc(invitationsCollection, {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp(),
    expiresAt: data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
}

const findExistingUserByEmail = async (email: string) => {
  const normalizedEmail = normalizeEmail(email)

  // Prefer profiles as the canonical user record (Super Admin user management reads from this collection).
  const profileSnapshot = await getDocs(query(profilesCollection, where('email', '==', normalizedEmail)))
  if (!profileSnapshot.empty) {
    const docSnap = profileSnapshot.docs[0]
    return { id: docSnap.id, source: 'profiles' as const }
  }

  // Fallback for legacy/user-access records stored in `users`.
  const userSnapshot = await getDocs(query(usersCollection, where('email', '==', normalizedEmail)))
  if (userSnapshot.empty) return null
  const docSnap = userSnapshot.docs[0]
  return { id: docSnap.id, source: 'users' as const }
}

const createOrUpdateUser = async (
  payload: Omit<InvitationPayload, 'method' | 'organizationId'> & { organizationId: string },
) => {
  const normalizedEmail = payload.email ? normalizeEmail(payload.email) : undefined
  const existing = normalizedEmail ? await findExistingUserByEmail(normalizedEmail) : null

  if (existing?.id) {
    const userId = existing.id

    // Keep the profile role in sync so Super Admin user management reflects assigned roles.
    if (existing.source === 'profiles') {
      await updateDoc(doc(db, 'profiles', userId), { role: payload.role, updatedAt: serverTimestamp() })
    } else {
      const profileRef = doc(db, 'profiles', userId)
      const profileSnap = await getDoc(profileRef)
      if (profileSnap.exists()) {
        await updateDoc(profileRef, { role: payload.role, updatedAt: serverTimestamp() })
      }
    }

    // Ensure `users/{userId}` holds org assignments for access checks + license accounting.
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    const existingAssignments = userSnap.exists()
      ? ((userSnap.data() as { assignedOrganizations?: unknown })?.assignedOrganizations as unknown)
      : undefined

    const assignedOrganizations = Array.isArray(existingAssignments)
      ? Array.from(
          new Set([
            ...existingAssignments.filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
            payload.organizationId,
          ]),
        )
      : [payload.organizationId]

    if (userSnap.exists()) {
      await updateDoc(userRef, { role: payload.role, assignedOrganizations, updatedAt: serverTimestamp() })
    } else {
      await setDoc(
        userRef,
        {
          name: payload.name,
          email: normalizedEmail,
          role: payload.role,
          assignedOrganizations,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    }

    return userId
  }

  const docRef = await addDoc(usersCollection, {
    name: payload.name,
    email: normalizedEmail,
    role: payload.role,
    assignedOrganizations: [payload.organizationId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export const inviteUsersBulk = async (
  invitations: InvitationPayload[],
  context: { organizationId: string; organizationName: string },
): Promise<BulkInvitationResult> => {
  const results: InvitationResultEntry[] = []
  const { teamSize } = await getOrganizationLicenseSnapshot(context.organizationId)
  if (!teamSize || teamSize <= 0) {
    throw new Error('Cohort size must be set before inviting users.')
  }
  const currentMembers = await getActiveLicenseMemberCount(context.organizationId)
  const requestedSeats = invitations.filter((invite) => isLicenseConsumingRole(invite.role)).length
  const availableSeats = Math.max(teamSize - currentMembers, 0)
  if (requestedSeats > availableSeats) {
    throw new Error(
      `Cannot add ${requestedSeats} members. ${currentMembers} of ${teamSize} licenses already in use. Only ${availableSeats} licenses available.`,
    )
  }
  for (const invitation of invitations) {
    try {
      if (invitation.method === 'email') {
        if (!invitation.email) throw new Error('Email is required for email invitations')
        const normalizedEmail = normalizeEmail(invitation.email)
        const userId = await createOrUpdateUser({ ...invitation, email: normalizedEmail })
        await createInvitation({
          name: invitation.name,
          email: normalizedEmail,
          role: invitation.role,
          method: 'email',
          organizationId: context.organizationId,
        })
        results.push({
          id: userId,
          name: invitation.name,
          email: normalizedEmail,
          role: invitation.role,
          method: 'email',
          status: 'success',
          message: 'Invitation email queued',
        })
      } else {
        const normalizedEmail = invitation.email ? normalizeEmail(invitation.email) : undefined
        const code = generateOneTimeCode()
        await createInvitation({
          name: invitation.name,
          email: normalizedEmail,
          role: invitation.role,
          method: 'one_time_code',
          organizationId: context.organizationId,
          code,
        })
        results.push({
          id: `${invitation.name}-${code}`,
          name: invitation.name,
          email: normalizedEmail,
          role: invitation.role,
          method: 'one_time_code',
          status: 'success',
          code,
        })
      }
    } catch (error) {
      results.push({
        id: invitation.email || invitation.name,
        name: invitation.name,
        email: invitation.email,
        role: invitation.role,
        method: invitation.method,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const success = results.filter((item) => item.status === 'success').length
  const failed = results.length - success

  if (success > 0) {
    await checkCapacityThresholds(context.organizationId)
  }

  return { total: results.length, success, failed, results }
}
