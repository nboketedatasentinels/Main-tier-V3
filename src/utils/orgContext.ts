export type OrgContext =
  | { type: 'organization'; organizationId: string }
  | { type: 'village'; villageId: string }
  | { type: 'corporate_village'; corporateVillageId: string }
  | { type: 'individual' }

type OrgProfileSource = {
  companyId?: string | null
  corporateVillageId?: string | null
  villageId?: string | null
}

export const resolveOrgContext = (profile?: OrgProfileSource | null): OrgContext => {
  if (profile?.companyId) {
    return { type: 'organization', organizationId: profile.companyId }
  }

  if (profile?.corporateVillageId) {
    return { type: 'corporate_village', corporateVillageId: profile.corporateVillageId }
  }

  if (profile?.villageId) {
    return { type: 'village', villageId: profile.villageId }
  }

  return { type: 'individual' }
}
