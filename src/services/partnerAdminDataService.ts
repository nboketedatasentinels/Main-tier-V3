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
      if (!organizationId) return null
      return {
        organizationId,
        companyCode: assignment.companyCode?.trim() || undefined,
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

  return {
    partnerId,
    assignedOrganizations,
    organizations: [],
    users: [],
    pointsOverview: buildEmptyPointsOverview(),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}
