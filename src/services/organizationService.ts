import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { Organization } from '@/types'
import { BulkInvitationResult, CourseOption, InvitationPayload, OrganizationLead, OrganizationRecord } from '@/types/admin'
import { inviteUsersBulk } from './invitationService'

const safeCodeChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

const orgCollection = collection(db, 'organizations')
const coursesCollection = collection(db, 'courses')
const usersCollection = collection(db, 'users')
const adminActivityCollection = collection(db, 'admin_activity_log')

export const generateOrganizationCode = (name: string) => {
  const validChars = name.toUpperCase().match(/[A-Z0-9]/g) ?? []
  let prefix = validChars.slice(0, 2).join('')
  if (prefix.length < 2) {
    prefix = 'OR'
  }
  const random = Array.from({ length: 4 })
    .map(() => safeCodeChars[Math.floor(Math.random() * safeCodeChars.length)])
    .join('')
  return `${prefix}${random}`
}

export const findOrganizationsWithInvalidCodes = async (): Promise<OrganizationRecord[]> => {
  const snapshot = await getDocs(orgCollection)
  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as OrganizationRecord) }))
    .filter((organization) => (organization.code || '').trim().length !== 6)
}

export const regenerateOrganizationCode = async (organizationId: string, organizationName: string) => {
  const code = generateOrganizationCode(organizationName)
  await updateDoc(doc(orgCollection, organizationId), { code, updatedAt: serverTimestamp() })
  return code
}

export const validateOrganizationCodeUnique = async (code: string) => {
  if (!code) return false
  const snapshot = await getDocs(query(orgCollection, where('code', '==', code)))
  return snapshot.empty
}

export const determineClusterFromTeamSize = (teamSize?: number) => {
  if (!teamSize || teamSize < 1) return ''
  if (teamSize >= 41) return 'Serengeti Cluster'
  if (teamSize >= 21) return 'Sahel Cluster'
  if (teamSize >= 11) return 'Sahara Cluster'
  if (teamSize >= 4) return 'Kalahari Cluster'
  return ''
}

export const fetchAvailableCourses = async (): Promise<CourseOption[]> => {
  const snapshot = await getDocs(query(coursesCollection, orderBy('title')))
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as { title?: string; description?: string }
    return { id: docSnap.id, title: data.title || 'Untitled course', description: data.description }
  })
}

const normalizeTimestamp = (value?: Timestamp | string | Date): string => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if ('toDate' in value) return value.toDate().toISOString()
  return ''
}

const normalizeOrganizationStatus = (status?: string): Organization['status'] => {
  if (status === 'active' || status === 'inactive' || status === 'suspended') return status
  return 'inactive'
}

const coerceCreatedAt = (
  value?: Timestamp | string | Date,
): Timestamp | ReturnType<typeof serverTimestamp> => {
  if (value instanceof Timestamp) return value
  if (value instanceof Date) return Timestamp.fromDate(value)
  if (typeof value === 'string') {
    const parsedDate = new Date(value)
    if (!Number.isNaN(parsedDate.getTime())) return Timestamp.fromDate(parsedDate)
  }
  return serverTimestamp()
}

export const validateCompanyCode = async (
  code: string,
): Promise<{ valid: boolean; error?: string; organization?: Organization }> => {
  const trimmed = code.trim().toUpperCase()
  if (!trimmed) {
    return { valid: false, error: 'Company code is required.' }
  }

  const snapshot = await getDocs(query(orgCollection, where('code', '==', trimmed)))
  if (snapshot.empty) {
    return { valid: false, error: 'Company code not found.' }
  }

  const docSnap = snapshot.docs[0]
  const data = docSnap.data() as Partial<OrganizationRecord> & {
    memberCount?: number
    settings?: Record<string, unknown>
  }
  const status = normalizeOrganizationStatus(data.status)
  if (status !== 'active') {
    return { valid: false, error: 'Company is not active.' }
  }

  return {
    valid: true,
    organization: {
      id: docSnap.id,
      code: data.code || trimmed,
      name: data.name || 'Unknown organization',
      status,
      createdAt: normalizeTimestamp(data.createdAt),
      updatedAt: normalizeTimestamp(data.updatedAt),
      memberCount: data.memberCount ?? 0,
      settings: data.settings,
    },
  }
}

const buildLead = (docSnap: { id: string; data: () => unknown }): OrganizationLead => {
  const data = docSnap.data() as Partial<OrganizationLead> & { firstName?: string; lastName?: string }
  const name =
    data.name ||
    [data.firstName, data.lastName].filter((value) => !!value).join(' ').trim() ||
    data.email ||
    'Unknown user'

  return { id: docSnap.id, name, email: data.email }
}

export const fetchMentors = async (): Promise<OrganizationLead[]> => {
  const snapshot = await getDocs(query(usersCollection, where('role', '==', 'mentor')))
  return snapshot.docs.map(buildLead)
}

export const fetchAmbassadors = async (): Promise<OrganizationLead[]> => {
  const snapshot = await getDocs(query(usersCollection, where('role', '==', 'ambassador')))
  return snapshot.docs.map(buildLead)
}

export const fetchPartners = async (): Promise<OrganizationLead[]> => {
  const snapshot = await getDocs(query(usersCollection, where('role', '==', 'partner')))
  return snapshot.docs.map(buildLead)
}

export const fetchOrganizationDetails = async (organizationId: string): Promise<OrganizationRecord | null> => {
  if (!organizationId) return null
  const docSnap = await getDoc(doc(db, 'organizations', organizationId))
  if (!docSnap.exists()) return null
  return { id: docSnap.id, ...(docSnap.data() as Omit<OrganizationRecord, 'id'>) }
}

export const fetchOrganizationAssignments = async (organizationId: string): Promise<string[]> => {
  if (!organizationId) return []
  const docSnap = await getDoc(doc(db, 'organizations', organizationId))
  if (!docSnap.exists()) return []
  const data = docSnap.data() as OrganizationRecord
  return data.courseAssignments || []
}

export const incrementOrganizationMemberCount = async (organizationId: string, delta = 1) => {
  if (!organizationId) return
  await updateDoc(doc(db, 'organizations', organizationId), {
    memberCount: increment(delta),
    updatedAt: serverTimestamp(),
  })
}

export const createOrganizationWithInvitations = async (
  organization: OrganizationRecord,
  invitations: InvitationPayload[],
  adminContext?: { adminId?: string; adminName?: string },
): Promise<{ organizationId: string; invitationResult: BulkInvitationResult | null }> => {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...organizationData } = organization
  const payload: Omit<OrganizationRecord, 'createdAt' | 'updatedAt'> & {
    createdAt: Timestamp | ReturnType<typeof serverTimestamp>
    updatedAt?: Timestamp | ReturnType<typeof serverTimestamp>
  } = {
    ...organizationData,
    createdAt: coerceCreatedAt(organization.createdAt),
  }

  const orgRef = await addDoc(orgCollection, { ...payload, updatedAt: serverTimestamp() })

  await addDoc(adminActivityCollection, {
    action: 'Organization created',
    organizationName: organization.name,
    organizationCode: organization.code,
    adminId: adminContext?.adminId,
    adminName: adminContext?.adminName,
    createdAt: serverTimestamp(),
    metadata: { via: 'CreateOrganizationModal' },
  })

  if (!invitations.length) {
    return { organizationId: orgRef.id, invitationResult: null }
  }

  const invitationResult = await inviteUsersBulk(
    invitations.map((invite) => ({ ...invite, organizationId: orgRef.id })),
    { organizationId: orgRef.id, organizationName: organization.name },
  )

  return { organizationId: orgRef.id, invitationResult }
}
