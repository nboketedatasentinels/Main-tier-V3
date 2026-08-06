/**
 * Helpers for matching admin Users Management rows to an organization filter.
 * Partners/mentors/coaches can belong to several orgs via assignedOrganizations;
 * learners usually have a single companyId / companyCode.
 */

export type OrgFilterOrg = {
  id: string
  name?: string | null
  code?: string | null
}

export type OrgFilterUser = {
  companyId?: string | null
  companyCode?: string | null
  companyName?: string | null
  assignedOrganizations?: string[] | null
}

const norm = (value: string | null | undefined): string => (value || '').trim().toLowerCase()

/** True when a stored org key (id or code) refers to the given organization. */
export const orgKeyMatches = (key: string | null | undefined, org: OrgFilterOrg): boolean => {
  const k = norm(key)
  if (!k) return false
  return k === norm(org.id) || (!!org.code && k === norm(org.code))
}

/**
 * Whether this user should appear when the admin filters to `selectedOrg`.
 * Matches primary company fields and any entry in assignedOrganizations.
 */
export const userMatchesOrganizationFilter = (
  user: OrgFilterUser,
  selectedOrg: OrgFilterOrg | null,
): boolean => {
  if (!selectedOrg) return true

  if (orgKeyMatches(user.companyId, selectedOrg)) return true
  if (orgKeyMatches(user.companyCode, selectedOrg)) return true

  const assigned = user.assignedOrganizations ?? []
  if (assigned.some((id) => orgKeyMatches(id, selectedOrg))) return true

  return false
}

/**
 * Resolve which organization label to show for a user.
 * When an org filter is active and the user matches that org, prefer that org
 * so multi-org partners aren't labeled with a different primary company.
 */
export const resolveUserOrganizationLabel = (
  user: OrgFilterUser,
  organizations: OrgFilterOrg[],
  filteredOrg: OrgFilterOrg | null = null,
): { name: string; code: string | null; allNames: string[] } | null => {
  const findOrg = (key: string | null | undefined) =>
    organizations.find((o) => orgKeyMatches(key, o)) ?? null

  if (filteredOrg && userMatchesOrganizationFilter(user, filteredOrg)) {
    return {
      name: filteredOrg.name || filteredOrg.code || filteredOrg.id,
      code: filteredOrg.code ?? null,
      allNames: [filteredOrg.name || filteredOrg.code || filteredOrg.id].filter(Boolean),
    }
  }

  const assignedIds = (user.assignedOrganizations ?? []).filter(Boolean)
  const assignedOrgs = assignedIds
    .map((id) => findOrg(id))
    .filter((o): o is OrgFilterOrg => Boolean(o))

  if (assignedOrgs.length > 1) {
    const primary =
      findOrg(user.companyId) ||
      findOrg(user.companyCode) ||
      assignedOrgs[0]
    const names = assignedOrgs.map((o) => o.name || o.code || o.id)
    return {
      name: primary?.name || names[0],
      code: primary?.code ?? null,
      allNames: names,
    }
  }

  if (user.companyName) {
    return {
      name: user.companyName,
      code: user.companyCode ?? null,
      allNames: [user.companyName],
    }
  }

  const candidateId = user.companyId || assignedIds[0] || null
  if (candidateId) {
    const org = findOrg(candidateId)
    if (org) {
      return {
        name: org.name || org.code || org.id,
        code: org.code ?? null,
        allNames: [org.name || org.code || org.id],
      }
    }
    return {
      name: user.companyCode || candidateId,
      code: user.companyCode ?? null,
      allNames: [user.companyCode || candidateId],
    }
  }

  if (user.companyCode) {
    const org = findOrg(user.companyCode)
    return org
      ? {
          name: org.name || org.code || org.id,
          code: org.code ?? null,
          allNames: [org.name || org.code || org.id],
        }
      : { name: user.companyCode, code: user.companyCode, allNames: [user.companyCode] }
  }

  return null
}
