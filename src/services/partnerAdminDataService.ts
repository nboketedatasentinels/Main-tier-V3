import { fetchOrganizationsByIds } from '@/services/organizationService'
import { fetchOrganizationUsers } from '@/services/organizationUserService'
import type {
  PartnerAdminDataSnapshot,
  PartnerAdminPointsOverview,
  PartnerAdminSnapshot,
  PartnerAssignment,
} from '@/types/admin'

const normalizeAssignments = (assignments: PartnerAssignment[] = []): PartnerAssignment[] =>
  assignments
    .map((assignment) => {
      const organizationId = assignment.organizationId?.trim()
      const companyCode = assignment.companyCode?.trim()
      if (!organizationId && !companyCode) return null
      return {
        organizationId: organizationId || undefined,
        companyCode: companyCode || undefined,
        status: assignment.status ?? 'active',
      }
    })
    .filter((assignment): assignment is PartnerAssignment => !!assignment)

const buildEmptyPointsOverview = (): PartnerAdminPointsOverview => ({
  totalPoints: 0,
  weeklyPoints: 0,
  pendingPoints: 0,
  approvedPoints: 0,
  rejectedPoints: 0,
})

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
  const assignedOrganizationKeys = Array.from(
    new Set(
      assignedOrganizations
        .flatMap((assignment) => [assignment.organizationId, assignment.companyCode])
        .map((key) => key?.trim())
        .filter((key): key is string => !!key),
    ),
  )

  const organizations = assignedOrganizationIds.length
    ? await fetchOrganizationsByIds(assignedOrganizationIds)
    : []

  const userSnapshots = await Promise.all(
    assignedOrganizationKeys.map((organizationKey) => fetchOrganizationUsers(organizationKey)),
  )
  const usersMap = new Map<string, PartnerAdminDataSnapshot['users'][number]>()
  userSnapshots.forEach((users) => {
    users.forEach((user) => {
      usersMap.set(user.id, user)
    })
  })

  return {
    partnerId,
    assignedOrganizations,
    organizations,
    users: Array.from(usersMap.values()),
    usersFetchedAt: new Date(),
    pointsOverview: buildEmptyPointsOverview(),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}
