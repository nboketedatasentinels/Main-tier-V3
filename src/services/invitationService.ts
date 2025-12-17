import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  BulkInvitationResult,
  InvitationMethod,
  InvitationPayload,
  InvitationResultEntry,
  OrganizationRecord,
} from '@/types/admin'

const invitationsCollection = collection(db, 'invitations')
const usersCollection = collection(db, 'users')

const codeChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

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
  const snapshot = await getDocs(query(usersCollection, where('email', '==', email)))
  if (snapshot.empty) return null
  const docSnap = snapshot.docs[0]
  return { id: docSnap.id, ...(docSnap.data() as Partial<OrganizationRecord>) }
}

const createOrUpdateUser = async (
  payload: Omit<InvitationPayload, 'method' | 'organizationId'> & { organizationId: string },
) => {
  const existing = payload.email ? await findExistingUserByEmail(payload.email) : null

  if (existing?.id) {
    const userRef = doc(db, 'users', existing.id)
    const assignedOrganizations = Array.isArray((existing as { assignedOrganizations?: string[] }).assignedOrganizations)
      ? ([...(existing as { assignedOrganizations?: string[] }).assignedOrganizations!, payload.organizationId] as string[])
      : [payload.organizationId]
    await updateDoc(userRef, { role: payload.role, assignedOrganizations, updatedAt: serverTimestamp() })
    return existing.id
  }

  const docRef = await addDoc(usersCollection, {
    name: payload.name,
    email: payload.email,
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
  for (const invitation of invitations) {
    try {
      if (invitation.method === 'email') {
        if (!invitation.email) throw new Error('Email is required for email invitations')
        const userId = await createOrUpdateUser(invitation)
        await createInvitation({
          name: invitation.name,
          email: invitation.email,
          role: invitation.role,
          method: 'email',
          organizationId: context.organizationId,
        })
        results.push({
          id: userId,
          name: invitation.name,
          email: invitation.email,
          role: invitation.role,
          method: 'email',
          status: 'success',
          message: 'Invitation email queued',
        })
      } else {
        const code = generateOneTimeCode()
        await createInvitation({
          name: invitation.name,
          email: invitation.email,
          role: invitation.role,
          method: 'one_time_code',
          organizationId: context.organizationId,
          code,
        })
        results.push({
          id: `${invitation.name}-${code}`,
          name: invitation.name,
          email: invitation.email,
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

  return { total: results.length, success, failed, results }
}
