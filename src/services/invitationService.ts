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
import { TransformationTier } from '@/types'

const invitationsCollection = collection(db, 'invitations')
const usersCollection = collection(db, 'users')
const profilesCollection = collection(db, 'profiles')
const organizationsCollection = collection(db, ORG_COLLECTION)

const codeChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

// License/seat usage should include all learner + leadership roles that occupy a paid slot.
// Partner/super admin roles are intentionally excluded (0 weight).
const LICENSE_CONSUMING_ROLES = new Set(['user', 'free_user', 'paid_member', 'mentor', 'ambassador', 'team_leader'])

const isLicenseConsumingRole = (role?: string | null) => {
  if (!role) return false
  const normalized = role.toString().trim().toLowerCase().replace(/[-\s]+/g, '_')
  return LICENSE_CONSUMING_ROLES.has(normalized)
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
    name: data.name || null,
    code: data.code || null,
  }
}

const getActiveLicenseMemberCount = async (organizationId: string) => {
  const [assignedSnapshot, companySnapshot] = await Promise.all([
    getDocs(query(usersCollection, where('assignedOrganizations', 'array-contains', organizationId))),
    getDocs(query(usersCollection, where('companyId', '==', organizationId))),
  ])

  const uniqueDocs = new Map<string, { role?: string; accountStatus?: string | null }>()
  assignedSnapshot.docs.forEach((docSnap) => uniqueDocs.set(docSnap.id, docSnap.data() as { role?: string; accountStatus?: string | null }))
  companySnapshot.docs.forEach((docSnap) => uniqueDocs.set(docSnap.id, docSnap.data() as { role?: string; accountStatus?: string | null }))

  let count = 0
  for (const data of uniqueDocs.values()) {
    if (!isActiveAccountStatus(data.accountStatus)) continue
    if (!isLicenseConsumingRole(data.role)) continue
    count += 1
  }

  return count
}

const getExistingSeatMemberEmails = async (organizationId: string) => {
  const [assignedSnapshot, companySnapshot] = await Promise.all([
    getDocs(query(usersCollection, where('assignedOrganizations', 'array-contains', organizationId))),
    getDocs(query(usersCollection, where('companyId', '==', organizationId))),
  ])

  const emails = new Set<string>()
  const process = (docSnap: { data: () => unknown }) => {
    const data = docSnap.data() as { role?: string; accountStatus?: string | null; email?: string | null }
    if (!isLicenseConsumingRole(data.role) || !isActiveAccountStatus(data.accountStatus)) return
    const normalized = normalizeEmail(data.email || '')
    if (normalized) emails.add(normalized)
  }

  assignedSnapshot.docs.forEach(process)
  companySnapshot.docs.forEach(process)

  return emails
}

const getPendingInvitationSeatCount = async (organizationId: string, existingSeatEmails: Set<string>) => {
  const snapshot = await getDocs(
    query(invitationsCollection, where('organizationId', '==', organizationId), where('status', '==', 'pending')),
  )

  return snapshot.docs.filter((docSnap) => {
    const data = docSnap.data() as { role?: string; email?: string | null }
    if (!isLicenseConsumingRole(data.role)) return false
    const normalized = normalizeEmail(data.email || '')
    if (normalized && existingSeatEmails.has(normalized)) return false
    return true
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

  const scoreDoc = (docSnap: { id: string; data: () => unknown }) => {
    const data = docSnap.data() as {
      id?: string
      membershipStatus?: string
      companyId?: string | null
      companyCode?: string | null
      assignedOrganizations?: unknown
      role?: string | null
      mergedInto?: string | null
    }

    if (data.mergedInto) return -1000

    let score = 0
    if (data.id && data.id === docSnap.id) score += 100
    if (data.membershipStatus === 'paid') score += 25
    if (data.companyId) score += 15
    if (data.companyCode) score += 5
    if (Array.isArray(data.assignedOrganizations) && data.assignedOrganizations.length > 0) score += 5
    if (data.role && data.role !== 'free_user') score += 2
    return score
  }

  // Prefer `users` as canonical (Cloud Function syncs users -> profiles).
  const userSnapshot = await getDocs(query(usersCollection, where('email', '==', normalizedEmail)))
  const userCandidates = userSnapshot.docs
    .map((docSnap) => ({ id: docSnap.id, score: scoreDoc(docSnap) }))
    .sort((a, b) => b.score - a.score)
  if (userCandidates.length) {
    return { id: userCandidates[0].id, source: 'users' as const }
  }

  // Fallback for legacy records stored only in `profiles`.
  const profileSnapshot = await getDocs(query(profilesCollection, where('email', '==', normalizedEmail)))
  const profileCandidates = profileSnapshot.docs
    .map((docSnap) => ({ id: docSnap.id, score: scoreDoc(docSnap) }))
    .sort((a, b) => b.score - a.score)
  if (!profileCandidates.length) return null
  return { id: profileCandidates[0].id, source: 'profiles' as const }
}

const createOrUpdateUser = async (
  payload: Omit<InvitationPayload, 'method' | 'organizationId'> & {
    organizationId: string
    organizationName?: string | null
    organizationCode?: string | null
  },
) => {
  const normalizedEmail = payload.email ? normalizeEmail(payload.email) : undefined
  const existing = normalizedEmail ? await findExistingUserByEmail(normalizedEmail) : null

  if (existing?.id) {
    const userId = existing.id
    const userRef = doc(db, 'users', userId)
    const profileRef = doc(db, 'profiles', userId)
    const [userSnap, profileSnap] = await Promise.all([getDoc(userRef), getDoc(profileRef)])

    // Keep the profile role in sync so Super Admin user management reflects assigned roles.
    if (existing.source === 'profiles') {
      await updateDoc(profileRef, {
        role: payload.role,
        membershipStatus: 'paid',
        companyId: payload.organizationId,
        companyCode: payload.organizationCode ?? null,
        companyName: payload.organizationName ?? null,
        transformationTier: TransformationTier.CORPORATE_MEMBER,
        updatedAt: serverTimestamp(),
        'dashboardPreferences.lockedToFreeExperience': false,
      })
    } else {
      if (profileSnap.exists()) {
        await updateDoc(profileRef, {
          role: payload.role,
          membershipStatus: 'paid',
          companyId: payload.organizationId,
          companyCode: payload.organizationCode ?? null,
          companyName: payload.organizationName ?? null,
          transformationTier: TransformationTier.CORPORATE_MEMBER,
          updatedAt: serverTimestamp(),
          'dashboardPreferences.lockedToFreeExperience': false,
        })
      }
    }

    // Ensure `users/{userId}` holds org assignments for access checks + license accounting.
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
      await updateDoc(userRef, {
        role: payload.role,
        membershipStatus: 'paid',
        companyId: payload.organizationId,
        companyCode: payload.organizationCode ?? null,
        companyName: payload.organizationName ?? null,
        transformationTier: TransformationTier.CORPORATE_MEMBER,
        assignedOrganizations,
        updatedAt: serverTimestamp(),
        'dashboardPreferences.lockedToFreeExperience': false,
      })
    } else {
      await setDoc(
        userRef,
        {
          name: payload.name,
          email: normalizedEmail,
          role: payload.role,
          membershipStatus: 'paid',
          companyId: payload.organizationId,
          companyCode: payload.organizationCode ?? null,
          companyName: payload.organizationName ?? null,
          transformationTier: TransformationTier.CORPORATE_MEMBER,
          dashboardPreferences: {
            lockedToFreeExperience: false,
          },
          assignedOrganizations,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    }

    return userId
  }

  return null
}

export const inviteUsersBulk = async (
  invitations: InvitationPayload[],
  context: { organizationId: string; organizationName: string },
): Promise<BulkInvitationResult> => {
  const results: InvitationResultEntry[] = []
  const { teamSize, code: organizationCode, name: organizationName } = await getOrganizationLicenseSnapshot(context.organizationId)
  if (!teamSize || teamSize <= 0) {
    throw new Error('Cohort size must be set before inviting users.')
  }

  const existingSeatEmails = await getExistingSeatMemberEmails(context.organizationId)
  const currentMembers = await getActiveLicenseMemberCount(context.organizationId)
  const pendingInviteSeats = await getPendingInvitationSeatCount(context.organizationId, existingSeatEmails)

  const requestedSeats = invitations.filter((invite) => {
    if (!isLicenseConsumingRole(invite.role)) return false
    const normalized = normalizeEmail(invite.email || '')
    if (normalized && existingSeatEmails.has(normalized)) return false
    return true
  }).length

  const availableSeats = Math.max(teamSize - currentMembers - pendingInviteSeats, 0)
  if (requestedSeats > availableSeats) {
    throw new Error(
      `Cannot add ${requestedSeats} members. ${currentMembers} of ${teamSize} licenses already in use, with ${pendingInviteSeats} pending invite(s). Only ${availableSeats} licenses available.`,
    )
  }
  for (const invitation of invitations) {
    try {
      if (invitation.method === 'email') {
        if (!invitation.email) throw new Error('Email is required for email invitations')
        const normalizedEmail = normalizeEmail(invitation.email)
        const userId = await createOrUpdateUser({
          ...invitation,
          email: normalizedEmail,
          organizationName: organizationName ?? context.organizationName,
          organizationCode,
        })
        const invitationRef = await createInvitation({
          name: invitation.name,
          email: normalizedEmail,
          role: invitation.role,
          method: 'email',
          organizationId: context.organizationId,
        })
        results.push({
          id: userId || invitationRef.id,
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
        const invitationRef = await createInvitation({
          name: invitation.name,
          email: normalizedEmail,
          role: invitation.role,
          method: 'one_time_code',
          organizationId: context.organizationId,
          code,
        })
        results.push({
          id: invitationRef.id,
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
