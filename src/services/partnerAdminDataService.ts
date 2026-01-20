import { collection, getDocs, query, where, type Timestamp } from 'firebase/firestore'
import { fetchOrganizationsByIds } from '@/services/organizationService'
import type {
  PartnerAdminDataSnapshot,
  PartnerAdminUser,
  PartnerAdminPointsOverview,
  PartnerAdminSnapshot,
  PartnerAssignment,
} from '@/types/admin'
import { db } from './firebase'

const FIRESTORE_IN_QUERY_LIMIT = 30

const normalizeAssignments = (assignments: PartnerAssignment[] = []): PartnerAssignment[] =>
  assignments.reduce<PartnerAssignment[]>((normalized, assignment) => {
    const organizationId = assignment.organizationId?.trim()
    const companyCode = assignment.companyCode?.trim()
    if (!organizationId && !companyCode) return normalized
    normalized.push({
      organizationId: organizationId || undefined,
      companyCode: companyCode || undefined,
      status: assignment.status ?? 'active',
    })
    return normalized
  }, [])

const buildEmptyPointsOverview = (): PartnerAdminPointsOverview => ({
  totalPoints: 0,
  weeklyPoints: 0,
  pendingPoints: 0,
  approvedPoints: 0,
  rejectedPoints: 0,
})

const normalizeDateString = (value?: Timestamp | string | Date | number | null): string | null => {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }
  if (value instanceof Object && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  return null
}

export const fetchPartnerAdminSnapshot = async (
  partnerId: string,
  data: Partial<PartnerAdminSnapshot>,
): Promise<PartnerAdminDataSnapshot> => {
  const assignedOrganizations = normalizeAssignments(data.assignedOrganizations || [])
  const assignedOrganizationIds = Array.from(
    new Set(
      assignedOrganizations
        .map((assignment) => assignment.organizationId?.trim())
        .filter((orgId): orgId is string => !!orgId),
    ),
  )
  const organizations = assignedOrganizationIds.length
    ? await fetchOrganizationsByIds(assignedOrganizationIds)
    : []

  const orgIdChunks: string[][] = []
  for (let i = 0; i < assignedOrganizationIds.length; i += FIRESTORE_IN_QUERY_LIMIT) {
    orgIdChunks.push(assignedOrganizationIds.slice(i, i + FIRESTORE_IN_QUERY_LIMIT))
  }

  const users: PartnerAdminUser[] = []

  for (const chunk of orgIdChunks) {
    const q = query(collection(db, 'profiles'), where('organizationId', 'in', chunk))
    const snap = await getDocs(q)
    snap.forEach((docSnap) => {
      const data = docSnap.data() as {
        name?: string
        firstName?: string
        lastName?: string
        email?: string
        organizationId?: string
        companyCode?: string
        role?: string
        status?: string
        progressPercent?: number
        currentWeek?: number
        weeklyEarned?: number
        weeklyRequired?: number
        lastActive?: Timestamp | string | Date | number | null
        updatedAt?: Timestamp | string | Date | number | null
        riskStatus?: PartnerAdminUser['riskStatus']
        riskReasons?: string[]
        nudgeEnabled?: boolean
        adminNotes?: string
      }

      const name =
        data.name ?? `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim()

      users.push({
        id: docSnap.id,
        name: name || '',
        email: data.email ?? '',
        organizationId: data.organizationId,
        companyCode: data.companyCode ?? '',
        role: (data.role ?? 'learner').toLowerCase() as PartnerAdminUser['role'],
        status: (data.status ?? 'Active') as PartnerAdminUser['status'],
        progressPercent: data.progressPercent ?? 0,
        currentWeek: data.currentWeek ?? 0,
        weeklyEarned: data.weeklyEarned ?? 0,
        weeklyRequired: data.weeklyRequired ?? 0,
        lastActive:
          normalizeDateString(data.lastActive ?? data.updatedAt ?? null) ??
          new Date(0).toISOString(),
        riskStatus: data.riskStatus ?? 'engaged',
        riskReasons: data.riskReasons ?? [],
        nudgeEnabled: data.nudgeEnabled ?? true,
        adminNotes: data.adminNotes ?? '',
      })
    })
  }

  return {
    partnerId,
    assignedOrganizations,
    organizations,
    users,
    usersFetchedAt: new Date(),
    pointsOverview: buildEmptyPointsOverview(),
    createdAt: normalizeDateString(data.createdAt ?? null) ?? undefined,
    updatedAt: normalizeDateString(data.updatedAt ?? null) ?? undefined,
  }
}
