import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { ORG_COLLECTION } from '@/constants/organizations'

/**
 * Bidirectional sync service for partner-organization assignments.
 *
 * The application has two relationship models:
 * 1. Organization-centric: organization.transformationPartnerId (single partner per org)
 * 2. Partner-centric: partner.assignedOrganizations[] (many orgs per partner)
 *
 * This service ensures both stay in sync.
 */

/**
 * Sync partner's assignedOrganizations when an organization's partner changes.
 * Called after assignLeadershipRole() updates the organization.
 */
export const syncOrganizationPartnerChange = async (
  organizationId: string,
  newPartnerId: string | null,
  previousPartnerId: string | null,
): Promise<void> => {
  if (newPartnerId === previousPartnerId) return

  const batch = writeBatch(db)

  // Remove org from previous partner's assignedOrganizations
  if (previousPartnerId) {
    const prevPartnerRef = doc(db, 'profiles', previousPartnerId)
    const prevPartnerUserRef = doc(db, 'users', previousPartnerId)
    batch.update(prevPartnerRef, {
      assignedOrganizations: arrayRemove(organizationId),
      assignedOrganizationsUpdatedAt: serverTimestamp(),
    })
    batch.update(prevPartnerUserRef, {
      assignedOrganizations: arrayRemove(organizationId),
      assignedOrganizationsUpdatedAt: serverTimestamp(),
    })
  }

  // Add org to new partner's assignedOrganizations
  if (newPartnerId) {
    const newPartnerRef = doc(db, 'profiles', newPartnerId)
    const newPartnerUserRef = doc(db, 'users', newPartnerId)
    batch.update(newPartnerRef, {
      assignedOrganizations: arrayUnion(organizationId),
      assignedOrganizationsUpdatedAt: serverTimestamp(),
    })
    batch.update(newPartnerUserRef, {
      assignedOrganizations: arrayUnion(organizationId),
      assignedOrganizationsUpdatedAt: serverTimestamp(),
    })
  }

  await batch.commit()
}

/**
 * Sync organization documents when a partner's assigned organizations change.
 * Called after assignOrganizations() updates the partner.
 */
export const bulkSyncPartnerOrganizations = async (
  partnerId: string,
  newOrgIds: string[],
  previousOrgIds: string[],
): Promise<void> => {
  const newSet = new Set(newOrgIds)
  const prevSet = new Set(previousOrgIds)

  // Organizations to add this partner to
  const addedOrgs = newOrgIds.filter((id) => !prevSet.has(id))
  // Organizations to remove this partner from
  const removedOrgs = previousOrgIds.filter((id) => !newSet.has(id))

  if (addedOrgs.length === 0 && removedOrgs.length === 0) return

  const batch = writeBatch(db)

  // Set transformationPartnerId on newly added organizations
  for (const orgId of addedOrgs) {
    const orgRef = doc(db, ORG_COLLECTION, orgId)
    batch.update(orgRef, {
      transformationPartnerId: partnerId,
      assignedPartnerAt: serverTimestamp(),
      leadershipUpdatedAt: serverTimestamp(),
    })
  }

  // Clear transformationPartnerId from removed organizations (only if it matches this partner)
  for (const orgId of removedOrgs) {
    const orgRef = doc(db, ORG_COLLECTION, orgId)
    // Need to check if current partner matches before clearing
    const orgSnap = await getDoc(orgRef)
    if (orgSnap.exists()) {
      const orgData = orgSnap.data()
      if (orgData.transformationPartnerId === partnerId) {
        batch.update(orgRef, {
          transformationPartnerId: null,
          assignedPartnerAt: null,
          leadershipUpdatedAt: serverTimestamp(),
        })
      }
    }
  }

  await batch.commit()
}

/**
 * Remove partner from organization (sync the partner side).
 * Called after unassignLeadershipRole() clears the organization's partner.
 */
export const syncRemovePartnerFromOrganization = async (
  partnerId: string,
  organizationId: string,
): Promise<void> => {
  const batch = writeBatch(db)

  const partnerRef = doc(db, 'profiles', partnerId)
  const partnerUserRef = doc(db, 'users', partnerId)

  batch.update(partnerRef, {
    assignedOrganizations: arrayRemove(organizationId),
    assignedOrganizationsUpdatedAt: serverTimestamp(),
  })
  batch.update(partnerUserRef, {
    assignedOrganizations: arrayRemove(organizationId),
    assignedOrganizationsUpdatedAt: serverTimestamp(),
  })

  await batch.commit()
}
