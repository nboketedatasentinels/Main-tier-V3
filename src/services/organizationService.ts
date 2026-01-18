import {
  DocumentSnapshot,
  Timestamp,
  addDoc,
  collection,
  doc,
  documentId,
  FirestoreError,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  QuerySnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import { Organization } from '@/types'
import {
  BulkInvitationResult,
  CourseOption,
  InvitationPayload,
  OrganizationLead,
  OrganizationRecord,
} from '@/types/admin'
import {
  normalizeDurationWeeks,
  resolveDurationWeeksFromProgramDuration,
  resolveJourneyType,
} from '@/utils/journeyType'
import { inviteUsersBulk } from './invitationService'
export { checkOrganizationAccess, fetchOrganizationEngagementStats, fetchOrganizationUsers } from './organizationUserService'

const safeCodeChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

const orgCollection = collection(db, ORG_COLLECTION)
const coursesCollection = collection(db, 'courses')
const usersCollection = collection(db, 'users')
const adminActivityCollection = collection(db, 'admin_activity_log')

export type LeadershipRole = 'mentor' | 'ambassador' | 'partner'

const leadershipRoleConfig: Record<
  LeadershipRole,
  {
    field: keyof OrganizationRecord
    assignedAtField: keyof OrganizationRecord
    assignedByField: keyof OrganizationRecord
    requiredRole: string
  }
> = {
  mentor: {
    field: 'assignedMentorId',
    assignedAtField: 'assignedMentorAt',
    assignedByField: 'assignedMentorBy',
    requiredRole: 'mentor',
  },
  ambassador: {
    field: 'assignedAmbassadorId',
    assignedAtField: 'assignedAmbassadorAt',
    assignedByField: 'assignedAmbassadorBy',
    requiredRole: 'ambassador',
  },
  partner: {
    field: 'transformationPartnerId',
    assignedAtField: 'assignedPartnerAt',
    assignedByField: 'assignedPartnerBy',
    requiredRole: 'partner',
  },
}

const assertLeadershipRole = (role: string): role is LeadershipRole =>
  role === 'mentor' || role === 'ambassador' || role === 'partner'

/**
 * Gets the current actor ID. This should only be used as a fallback.
 * Prefer passing actorId explicitly to avoid race conditions during auth state changes.
 * @deprecated Pass actorId explicitly to service functions instead
 */
const getActorId = () => auth.currentUser?.uid || 'system'

type OrganizationAccessAttemptPayload = {
  userId: string
  organizationId?: string
  organizationCode?: string
  reason?: string
  metadata?: Record<string, unknown>
}

export type OrganizationPartnerValidationResult = {
  isValid: boolean
  partnerId?: string
  partnerName?: string
  message?: string
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

const normalizeProgramDurationWeeks = (
  programDurationWeeks?: number | string | null,
  programDuration?: number | string | null,
): number | null => {
  return normalizeDurationWeeks(programDurationWeeks) ?? resolveDurationWeeksFromProgramDuration(programDuration)
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
  const rawProgramDuration =
    data.programDuration ?? (data as { program_duration?: number | string | null }).program_duration ?? null
  const programDurationWeeks = normalizeProgramDurationWeeks(data.programDurationWeeks, rawProgramDuration)
  const journeyType = resolveJourneyType({
    journeyType: data.journeyType,
    programDurationWeeks,
    programDuration: rawProgramDuration,
  })
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
      journeyType: journeyType ?? undefined,
      programDurationWeeks: programDurationWeeks ?? undefined,
      cohortStartDate: normalizeTimestamp(data.cohortStartDate),
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

const validateLeadershipIds = (organizationId: string, userId: string, role: LeadershipRole) => {
  if (!organizationId?.trim()) throw new Error('Organization is required.')
  if (!userId?.trim()) throw new Error('User ID is required.')
  if (!assertLeadershipRole(role)) throw new Error('Invalid leadership role.')
}

const buildLeadershipAuditEntry = (params: {
  action: string
  organizationId: string
  userId?: string | null
  role: LeadershipRole
  actorId: string
  previousUserId?: string | null
}) => ({
  action: params.action,
  organizationId: params.organizationId,
  userId: params.userId ?? null,
  adminId: params.actorId,
  createdAt: serverTimestamp(),
  metadata: {
    role: params.role,
    assignedUserId: params.userId ?? null,
    previousUserId: params.previousUserId ?? null,
  },
})

const assignLeadershipRole = async (
  organizationId: string,
  userId: string,
  role: LeadershipRole,
  actorId?: string,
) => {
  validateLeadershipIds(organizationId, userId, role)
  const resolvedActorId = actorId || getActorId()
  const roleConfig = leadershipRoleConfig[role]
  const organizationRef = doc(db, ORG_COLLECTION, organizationId)
  const userRef = doc(usersCollection, userId)
  const auditRef = doc(adminActivityCollection)

  await runTransaction(db, async (transaction) => {
    const [organizationSnap, userSnap] = await Promise.all([
      transaction.get(organizationRef),
      transaction.get(userRef),
    ])
    if (!organizationSnap.exists()) {
      throw new Error('Organization record not found.')
    }
    if (!userSnap.exists()) {
      throw new Error('User record not found.')
    }

    const userData = userSnap.data() as { role?: string }
    if (userData.role !== roleConfig.requiredRole) {
      throw new Error(`User role must be ${roleConfig.requiredRole}.`)
    }

    transaction.update(organizationRef, {
      [roleConfig.field]: userId,
      [roleConfig.assignedAtField]: serverTimestamp(),
      [roleConfig.assignedByField]: resolvedActorId,
      leadershipUpdatedAt: serverTimestamp(),
      leadershipUpdatedBy: resolvedActorId,
    })
    transaction.set(
      auditRef,
      buildLeadershipAuditEntry({
        action: 'leadership_assigned',
        organizationId,
        userId,
        role,
        actorId: resolvedActorId,
        previousUserId: (organizationSnap.data() as OrganizationRecord)[roleConfig.field] as string | null,
      }),
    )
  })
}

export const assignMentorToOrganization = async (organizationId: string, mentorId: string, actorId?: string) =>
  assignLeadershipRole(organizationId, mentorId, 'mentor', actorId)

export const assignAmbassadorToOrganization = async (organizationId: string, ambassadorId: string, actorId?: string) =>
  assignLeadershipRole(organizationId, ambassadorId, 'ambassador', actorId)

export const assignPartnerToOrganization = async (organizationId: string, partnerId: string, actorId?: string) =>
  assignLeadershipRole(organizationId, partnerId, 'partner', actorId)

export const unassignLeadershipRole = async (organizationId: string, role: string, actorId?: string) => {
  if (!organizationId?.trim()) throw new Error('Organization is required.')
  if (!assertLeadershipRole(role)) throw new Error('Invalid leadership role.')
  const resolvedActorId = actorId || getActorId()
  const roleConfig = leadershipRoleConfig[role]
  const organizationRef = doc(db, ORG_COLLECTION, organizationId)
  const auditRef = doc(adminActivityCollection)

  await runTransaction(db, async (transaction) => {
    const organizationSnap = await transaction.get(organizationRef)
    if (!organizationSnap.exists()) {
      throw new Error('Organization record not found.')
    }
    const previousUserId = (organizationSnap.data() as OrganizationRecord)[roleConfig.field] as string | null

    transaction.update(organizationRef, {
      [roleConfig.field]: null,
      [roleConfig.assignedAtField]: null,
      [roleConfig.assignedByField]: resolvedActorId,
      leadershipUpdatedAt: serverTimestamp(),
      leadershipUpdatedBy: resolvedActorId,
    })
    transaction.set(
      auditRef,
      buildLeadershipAuditEntry({
        action: 'leadership_unassigned',
        organizationId,
        userId: null,
        role,
        actorId: resolvedActorId,
        previousUserId,
      }),
    )
  })
}

export const fetchOrganizationDetails = async (organizationId: string): Promise<OrganizationRecord | null> => {
  if (!organizationId) return null
  const docSnap = await getDoc(doc(db, ORG_COLLECTION, organizationId))
  if (!docSnap.exists()) return null
  return { id: docSnap.id, ...(docSnap.data() as Omit<OrganizationRecord, 'id'>) }
}

export const validateOrganizationPartner = async (organizationId: string): Promise<OrganizationPartnerValidationResult> => {
  if (!organizationId) {
    return { isValid: false, message: 'Organization is missing.' }
  }

  const orgSnap = await getDoc(doc(db, ORG_COLLECTION, organizationId))
  if (!orgSnap.exists()) {
    return { isValid: false, message: 'Organization record could not be found.' }
  }

  const orgData = orgSnap.data() as { transformation_partner_id?: string | null }
  const partnerId = orgData.transformation_partner_id
  if (!partnerId) {
    return { isValid: false, message: 'Tier 2 verification requires enrollment in the partner program.' }
  }

  const partnerSnap = await getDoc(doc(db, 'transformation_partners', partnerId))
  if (!partnerSnap.exists()) {
    return { isValid: false, message: 'Partner program record could not be verified.' }
  }

  const partnerData = partnerSnap.data() as { name?: string; displayName?: string; status?: string; isActive?: boolean }
  const status = partnerData.status?.toLowerCase()
  const isActive = status ? status === 'active' : partnerData.isActive !== false

  if (!isActive) {
    return { isValid: false, message: 'Partner program enrollment is inactive.' }
  }

  return {
    isValid: true,
    partnerId,
    partnerName: partnerData.name || partnerData.displayName,
  }
}


export const logOrganizationAccessAttempt = async ({
  userId,
  organizationId,
  organizationCode,
  reason,
  metadata,
}: OrganizationAccessAttemptPayload) => {
  if (!userId) return
  await addDoc(adminActivityCollection, {
    action: 'organization_access_attempt',
    adminId: userId,
    userId,
    organizationCode,
    severity: 'watch',
    metadata: {
      organizationId,
      reason,
      ...metadata,
    },
    createdAt: serverTimestamp(),
  })
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
  const docSnap = await getDoc(doc(db, ORG_COLLECTION, organizationId))
  if (!docSnap.exists()) return []
  const data = docSnap.data() as OrganizationRecord
  return data.courseAssignments || []
}

export const incrementOrganizationMemberCount = async (organizationId: string, delta = 1) => {
  if (!organizationId) return
  await updateDoc(doc(db, ORG_COLLECTION, organizationId), {
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

const normalizeAssignments = (assignedOrganizations?: string[]): string[] => {
  const normalized: string[] = []
  const seen = new Set<string>()

  ;(assignedOrganizations || []).forEach((entry) => {
    if (typeof entry !== 'string') return
    const trimmed = entry.trim()
    if (!trimmed) return
    if (seen.has(trimmed)) return
    seen.add(trimmed)
    normalized.push(trimmed)
  })

  return normalized
}

const chunkList = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const buildOrganizationRecord = (docSnap: { id: string; data: () => unknown }): OrganizationRecord => ({
  id: docSnap.id,
  ...(docSnap.data() as Omit<OrganizationRecord, 'id'>),
})

const fetchOrganizationsByAssignments = async (assignments: string[]): Promise<OrganizationRecord[]> => {
  const normalized = normalizeAssignments(assignments)
  if (!normalized.length) return []

  const idChunks = chunkList(normalized, 10)

  const snapshots = await Promise.all(
    idChunks.map((chunk) => getDocs(query(orgCollection, where(documentId(), 'in', chunk)))),
  )

  const orgMap = new Map<string, OrganizationRecord>()
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((docSnap) => {
      orgMap.set(docSnap.id, buildOrganizationRecord(docSnap))
    })
  })

  return Array.from(orgMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

export const fetchAssignedOrganizations = async (userId: string): Promise<OrganizationRecord[]> => {
  if (!userId) return []
  const userSnap = await getDoc(doc(usersCollection, userId))
  if (!userSnap.exists()) return []
  const data = userSnap.data() as { assignedOrganizations?: string[] }
  return fetchOrganizationsByAssignments(data.assignedOrganizations || [])
}

const listenToOrganizationsByAssignments = (
  assignments: string[],
  onChange: (organizations: OrganizationRecord[]) => void,
  onError?: (error: FirestoreError) => void,
) => {
  const normalized = normalizeAssignments(assignments)
  if (!normalized.length) {
    onChange([])
    return () => undefined
  }

  const idChunks = chunkList(normalized, 10)
  const listenerMaps = new Map<string, Map<string, OrganizationRecord>>()
  const unsubscribers: Array<() => void> = []

  const emitCombined = () => {
    const combined = new Map<string, OrganizationRecord>()
    listenerMaps.forEach((map) => {
      map.forEach((org, id) => {
        combined.set(id, org)
      })
    })
    onChange(Array.from(combined.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '')))
  }

  idChunks.forEach((chunk, index) => {
    const key = `id-${index}`
    const unsubscribe = onSnapshot(
      query(orgCollection, where(documentId(), 'in', chunk)),
      (snapshot: QuerySnapshot) => {
        listenerMaps.set(
          key,
          new Map(
            snapshot.docs.map((docSnap: DocumentSnapshot) => [docSnap.id, buildOrganizationRecord(docSnap)]),
          ),
        )
        emitCombined()
      },
      onError,
    )
    unsubscribers.push(unsubscribe)
  })

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
  }
}

export interface ListenToAssignedOrganizationsOptions {
  status?: OrganizationRecord['status'] | OrganizationRecord['status'][]
  onError?: (error: FirestoreError) => void
}

export const listenToAssignedOrganizations = (
  userId: string,
  onChange: (organizations: OrganizationRecord[]) => void,
  options?: ListenToAssignedOrganizationsOptions,
) => {
  if (!userId) {
    onChange([])
    return () => undefined
  }

  const statusFilter = options?.status
  const statusList = Array.isArray(statusFilter) ? statusFilter : statusFilter ? [statusFilter] : null
  let currentAssignments: string[] = []
  const handleChange = (organizations: OrganizationRecord[]) => {
    const filtered = statusList
      ? organizations.filter((org) => org.status && statusList.includes(org.status))
      : organizations
    if (currentAssignments.length && !filtered.length) {
      console.warn('[OrganizationService] No organizations found for assignments', {
        userId,
        assignments: currentAssignments,
      })
    }
    onChange(filtered)
  }

  let unsubscribeOrganizations: (() => void) | null = null
  let lastAssignmentKey = ''

  const updateAssignments = (assignments: string[]) => {
    const normalized = normalizeAssignments(assignments)
    const assignmentKey = normalized.slice().sort().join('|')
    if (assignmentKey === lastAssignmentKey) return
    lastAssignmentKey = assignmentKey
    currentAssignments = normalized

    console.debug('[OrganizationService] Assigned organizations updated', {
      userId,
      assignments: normalized,
    })

    if (unsubscribeOrganizations) {
      unsubscribeOrganizations()
      unsubscribeOrganizations = null
    }

    unsubscribeOrganizations = listenToOrganizationsByAssignments(normalized, handleChange, options?.onError)
  }

  const unsubscribeUser = onSnapshot(
    doc(usersCollection, userId),
    (snapshot: DocumentSnapshot) => {
      if (!snapshot.exists()) {
        updateAssignments([])
        return
      }
      const data = snapshot.data() as { assignedOrganizations?: string[] }
      updateAssignments(data.assignedOrganizations || [])
    },
    options?.onError,
  )

  return () => {
    unsubscribeUser()
    if (unsubscribeOrganizations) {
      unsubscribeOrganizations()
    }
  }
}
