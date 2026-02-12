import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
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
 * Safely update a document, ignoring errors if the document doesn't exist.
 */
const safeUpdate = async (
  collectionName: string,
  docId: string,
  data: Record<string, unknown>,
): Promise<void> => {
  try {
    const docRef = doc(db, collectionName, docId)
    await updateDoc(docRef, data)
  } catch (error) {
    // Silently ignore if document doesn't exist - this is expected for some users
    // who may only have a profile or user document but not both
    console.debug(`[PartnerSync] Could not update ${collectionName}/${docId}:`, error)
  }
}

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

  const updates: Promise<void>[] = []

  // Remove org from previous partner's assignedOrganizations
  if (previousPartnerId) {
    const removeData = {
      assignedOrganizations: arrayRemove(organizationId),
      assignedOrganizationsUpdatedAt: serverTimestamp(),
    }
    updates.push(safeUpdate('profiles', previousPartnerId, removeData))
    updates.push(safeUpdate('users', previousPartnerId, removeData))
  }

  // Add org to new partner's assignedOrganizations
  if (newPartnerId) {
    const addData = {
      assignedOrganizations: arrayUnion(organizationId),
      assignedOrganizationsUpdatedAt: serverTimestamp(),
    }
    updates.push(safeUpdate('profiles', newPartnerId, addData))
    updates.push(safeUpdate('users', newPartnerId, addData))
  }

  await Promise.all(updates)
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

  const updates: Promise<void>[] = []

  // Set transformationPartnerId on newly added organizations
  for (const orgId of addedOrgs) {
    let previousPartnerId: string | null = null
    try {
      const orgRef = doc(db, ORG_COLLECTION, orgId)
      const orgSnap = await getDoc(orgRef)
      if (orgSnap.exists()) {
        const orgData = orgSnap.data() as { transformationPartnerId?: string | null }
        const existingPartnerId = typeof orgData.transformationPartnerId === 'string'
          ? orgData.transformationPartnerId
          : null
        if (existingPartnerId && existingPartnerId !== partnerId) {
          previousPartnerId = existingPartnerId
        }
      }
    } catch (error) {
      console.debug(`[PartnerSync] Could not inspect org ${orgId} before reassignment:`, error)
    }

    if (previousPartnerId) {
      const removeData = {
        assignedOrganizations: arrayRemove(orgId),
        assignedOrganizationsUpdatedAt: serverTimestamp(),
      }
      updates.push(safeUpdate('profiles', previousPartnerId, removeData))
      updates.push(safeUpdate('users', previousPartnerId, removeData))
    }

    updates.push(
      safeUpdate(ORG_COLLECTION, orgId, {
        transformationPartnerId: partnerId,
        assignedPartnerAt: serverTimestamp(),
        leadershipUpdatedAt: serverTimestamp(),
      }),
    )
  }

  // Clear transformationPartnerId from removed organizations (only if it matches this partner)
  for (const orgId of removedOrgs) {
    const orgRef = doc(db, ORG_COLLECTION, orgId)
    try {
      const orgSnap = await getDoc(orgRef)
      if (orgSnap.exists()) {
        const orgData = orgSnap.data()
        if (orgData.transformationPartnerId === partnerId) {
          updates.push(
            safeUpdate(ORG_COLLECTION, orgId, {
              transformationPartnerId: null,
              assignedPartnerAt: null,
              leadershipUpdatedAt: serverTimestamp(),
            }),
          )
        }
      }
    } catch (error) {
      console.debug(`[PartnerSync] Could not check org ${orgId}:`, error)
    }
  }

  await Promise.all(updates)
}

/**
 * Remove partner from organization (sync the partner side).
 * Called after unassignLeadershipRole() clears the organization's partner.
 */
export const syncRemovePartnerFromOrganization = async (
  partnerId: string,
  organizationId: string,
): Promise<void> => {
  const removeData = {
    assignedOrganizations: arrayRemove(organizationId),
    assignedOrganizationsUpdatedAt: serverTimestamp(),
  }

  await Promise.all([
    safeUpdate('profiles', partnerId, removeData),
    safeUpdate('users', partnerId, removeData),
  ])
}
