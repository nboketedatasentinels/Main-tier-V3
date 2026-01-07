import {
  Timestamp,
  addDoc,
  collection,
  documentId,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { Organization } from '@/types'
import {
  BulkInvitationResult,
  CourseOption,
  OrganizationStatus,
  InvitationPayload,
  OrganizationLead,
  OrganizationRecord,
  OrganizationStatistics,
  OrganizationUserProfile,
} from '@/types/admin'
import { inviteUsersBulk } from './invitationService'

const safeCodeChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

const orgCollection = collection(db, 'organizations')
const coursesCollection = collection(db, 'courses')
const usersCollection = collection(db, 'users')
const engagementCollection = collection(db, 'user_engagement_scores')
const adminActivityCollection = collection(db, 'admin_activity_log')

const chunkArray = <T>(items: T[], size = 10): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

const fetchAssignedOrganizationIds = async (userId: string): Promise<string[]> => {
  if (!userId) return []
  const userSnap = await getDoc(doc(usersCollection, userId))
  if (!userSnap.exists()) return []
  const data = userSnap.data() as { assignedOrganizations?: string[] }
  if (!Array.isArray(data.assignedOrganizations)) return []
  return data.assignedOrganizations.filter((orgId) => typeof orgId === 'string' && orgId.trim().length > 0)
}

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

const parseDateValue = (value?: Timestamp | string | Date | number): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const maybeDate = (value as { toDate?: () => Date })?.toDate?.()
  return maybeDate || null
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

export const fetchOrganizationByCode = async (organizationCode: string): Promise<OrganizationRecord | null> => {
  if (!organizationCode) return null
  const trimmed = organizationCode.trim().toUpperCase()
  const snapshot = await getDocs(query(orgCollection, where('code', '==', trimmed)))
  if (snapshot.empty) return null
  const docSnap = snapshot.docs[0]
  return { id: docSnap.id, ...(docSnap.data() as Omit<OrganizationRecord, 'id'>) }
}

export const fetchOrganizationAssignments = async (organizationId: string): Promise<string[]> => {
  if (!organizationId) return []
  const docSnap = await getDoc(doc(db, 'organizations', organizationId))
  if (!docSnap.exists()) return []
  const data = docSnap.data() as OrganizationRecord
  return data.courseAssignments || []
}

export const checkOrganizationAccess = async (
  userId: string,
  organizationId: string,
): Promise<{ authorized: boolean; error?: 'invalid' | 'not_found' | 'unauthorized' }> => {
  if (!userId || !organizationId) {
    return { authorized: false, error: 'invalid' }
  }

  const userSnap = await getDoc(doc(usersCollection, userId))
  if (!userSnap.exists()) {
    return { authorized: false, error: 'not_found' }
  }

  const data = userSnap.data() as { role?: string; assignedOrganizations?: string[] }
  if (data.role === 'super_admin') {
    return { authorized: true }
  }

  const assignedOrganizations = data.assignedOrganizations || []
  if (assignedOrganizations.includes(organizationId)) {
    return { authorized: true }
  }

  return { authorized: false, error: 'unauthorized' }
}

const mapOrganizationUser = (docSnap: { id: string; data: () => unknown }): OrganizationUserProfile => {
  const data = docSnap.data() as Partial<OrganizationUserProfile> & {
    firstName?: string
    lastName?: string
    fullName?: string
    membershipStatus?: 'free' | 'paid' | 'inactive'
    role?: OrganizationUserProfile['role']
    accountStatus?: 'active' | 'suspended'
    lastActive?: Timestamp | string | number | Date
    lastActiveAt?: Timestamp | string | number | Date
    createdAt?: Timestamp | string | number | Date
  }

  const name =
    data.name ||
    data.fullName ||
    [data.firstName, data.lastName].filter(Boolean).join(' ').trim() ||
    data.email ||
    'Unknown user'

  return {
    id: docSnap.id,
    name,
    email: data.email,
    role: data.role || 'user',
    membershipStatus: data.membershipStatus || 'free',
    accountStatus: data.accountStatus || 'active',
    lastActive: parseDateValue(data.lastActive || data.lastActiveAt),
    createdAt: parseDateValue(data.createdAt),
    avatarUrl: data.avatarUrl || null,
  }
}

export const fetchOrganizationUsers = async (organizationId: string): Promise<OrganizationUserProfile[]> => {
  if (!organizationId) return []

  const primarySnapshot = await getDocs(query(usersCollection, where('companyId', '==', organizationId)))
  if (!primarySnapshot.empty) {
    return primarySnapshot.docs.map(mapOrganizationUser)
  }

  const secondarySnapshot = await getDocs(query(usersCollection, where('companyCode', '==', organizationId)))
  if (!secondarySnapshot.empty) {
    return secondarySnapshot.docs.map(mapOrganizationUser)
  }

  const tertiarySnapshot = await getDocs(query(usersCollection, where('organizationId', '==', organizationId)))
  return tertiarySnapshot.docs.map(mapOrganizationUser)
}

export const fetchOrganizationEngagementStats = async (organizationId: string): Promise<OrganizationStatistics> => {
  const users = await fetchOrganizationUsers(organizationId)
  const now = Date.now()
  const thirtyDaysAgo = now - 1000 * 60 * 60 * 24 * 30
  const sevenDaysAgo = now - 1000 * 60 * 60 * 24 * 7

  const totalMembers = users.length
  const activeMembers = users.filter((user) => (user.lastActive?.getTime() ?? 0) >= thirtyDaysAgo).length
  const paidMembers = users.filter((user) => user.membershipStatus === 'paid').length
  const newMembersThisWeek = users.filter((user) => (user.createdAt?.getTime() ?? 0) >= sevenDaysAgo).length

  let engagementSnapshot = await getDocs(query(engagementCollection, where('companyId', '==', organizationId)))
  if (engagementSnapshot.empty) {
    engagementSnapshot = await getDocs(query(engagementCollection, where('organizationId', '==', organizationId)))
  }
  if (engagementSnapshot.empty) {
    engagementSnapshot = await getDocs(query(engagementCollection, where('organizationCode', '==', organizationId)))
  }

  const engagementScores = engagementSnapshot.docs
    .map((docSnap) => (docSnap.data() as { engagementScore?: number }).engagementScore ?? 0)
    .filter((score) => Number.isFinite(score))
  const averageEngagementRate = engagementScores.length
    ? Math.round(engagementScores.reduce((sum, score) => sum + score, 0) / engagementScores.length)
    : 0

  return {
    totalMembers,
    activeMembers,
    paidMembers,
    newMembersThisWeek,
    averageEngagementRate,
  }
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

export const fetchAssignedOrganizations = async (
  userId: string,
  options?: { status?: OrganizationStatus },
): Promise<OrganizationRecord[]> => {
  const assignedOrganizations = await fetchAssignedOrganizationIds(userId)
  if (!assignedOrganizations.length) return []

  const chunks = chunkArray(assignedOrganizations, 10)
  const queries = chunks.map((chunk) => {
    const constraints = [where(documentId(), 'in', chunk)]
    if (options?.status) {
      constraints.push(where('status', '==', options.status))
    }
    return query(orgCollection, ...constraints)
  })

  const snapshots = await Promise.all(queries.map((chunkQuery) => getDocs(chunkQuery)))
  const organizationMap = new Map<string, OrganizationRecord>()
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((docSnap) => {
      organizationMap.set(docSnap.id, {
        id: docSnap.id,
        ...(docSnap.data() as Omit<OrganizationRecord, 'id'>),
      })
    })
  })

  return Array.from(organizationMap.values())
}

export const listenToAssignedOrganizations = (
  userId: string,
  onChange: (organizations: OrganizationRecord[]) => void,
  options?: {
    status?: OrganizationStatus
    onError?: (error: Error) => void
  },
) => {
  let isActive = true
  const unsubscribeCallbacks: Array<() => void> = []
  const organizationsByChunk = new Map<number, OrganizationRecord[]>()

  const emitChanges = () => {
    if (!isActive) return
    const organizationMap = new Map<string, OrganizationRecord>()
    organizationsByChunk.forEach((organizations) => {
      organizations.forEach((organization) => {
        const orgId = organization.id || organization.code || organization.name
        if (orgId) {
          organizationMap.set(orgId, organization)
        }
      })
    })
    onChange(Array.from(organizationMap.values()))
  }

  fetchAssignedOrganizationIds(userId)
    .then((assignedOrganizations) => {
      if (!assignedOrganizations.length) {
        if (isActive) {
          onChange([])
        }
        return
      }

      const chunks = chunkArray(assignedOrganizations, 10)
      chunks.forEach((chunk, index) => {
        const constraints = [where(documentId(), 'in', chunk)]
        if (options?.status) {
          constraints.push(where('status', '==', options.status))
        }
        const chunkQuery = query(orgCollection, ...constraints)
        const unsubscribe = onSnapshot(
          chunkQuery,
          (snapshot) => {
            const organizations = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<OrganizationRecord, 'id'>),
            }))
            organizationsByChunk.set(index, organizations)
            emitChanges()
          },
          (error) => {
            options?.onError?.(error as Error)
          },
        )
        unsubscribeCallbacks.push(unsubscribe)
      })
    })
    .catch((error) => {
      if (isActive) {
        options?.onError?.(error as Error)
      }
    })

  return () => {
    isActive = false
    unsubscribeCallbacks.forEach((unsubscribe) => unsubscribe())
  }
}

export const logOrganizationAccessAttempt = async (params: {
  userId: string
  organizationCode?: string
  organizationId?: string
  reason?: string
}) => {
  const { userId, organizationCode, organizationId, reason } = params
  if (!userId) return
  try {
    await addDoc(adminActivityCollection, {
      action: 'Organization access denied',
      organizationCode: organizationCode || organizationId || 'unknown',
      userId,
      createdAt: serverTimestamp(),
      severity: 'watch',
      metadata: {
        reason: reason || 'access_denied',
        organizationId,
      },
    })
  } catch (error) {
    console.warn('Unable to log organization access attempt', error)
  }
}
