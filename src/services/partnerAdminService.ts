import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import type {
  PartnerAdminRootDoc,
  PartnerAdminSnapshot,
} from '@/types/partnerAdmin'
import type { OrganizationRecord, UserProfile } from '@/types'

const PARTNER_COLLECTION = 'transformation_partners'
const PROFILES_COLLECTION = 'profiles'

const partnersCollection = collection(db, PARTNER_COLLECTION)
const organizationsCollection = collection(db, ORG_COLLECTION)
const profilesCollection = collection(db, PROFILES_COLLECTION)

const normalizeAssignments = (assignedOrganizations?: string[]): string[] => {
  const normalized: string[] = []
  const seen = new Set<string>()

  ;(assignedOrganizations || []).forEach((entry) => {
    if (typeof entry !== 'string') return
    const trimmed = entry.trim()
    if (!trimmed || seen.has(trimmed)) return
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

const mapPartnerDoc = (partnerId: string, data: Record<string, unknown>): PartnerAdminRootDoc => ({
  id: partnerId,
  ...(data as Omit<PartnerAdminRootDoc, 'id'>),
})

const mapOrganizationDoc = (docSnap: { id: string; data: () => unknown }): OrganizationRecord => ({
  id: docSnap.id,
  ...(docSnap.data() as Omit<OrganizationRecord, 'id'>),
})

const mapUserDoc = (docSnap: { id: string; data: () => unknown }): UserProfile => ({
  id: docSnap.id,
  ...(docSnap.data() as Omit<UserProfile, 'id'>),
})

const isActiveOrganization = (organization: OrganizationRecord) => organization.status === 'active'

const fetchOrganizations = async (organizationIds: string[]) => {
  if (!organizationIds.length) return []

  const idChunks = chunkList(organizationIds, 10)
  const snapshots = await Promise.all(
    idChunks.map((chunk) => getDocs(query(organizationsCollection, where(documentId(), 'in', chunk)))),
  )

  return snapshots.flatMap((snapshot) => snapshot.docs.map(mapOrganizationDoc))
}

const fetchUsersForOrganizations = async (organizationIds: string[]) => {
  if (!organizationIds.length) return []

  const idChunks = chunkList(organizationIds, 10)
  const snapshots = await Promise.all(
    idChunks.map((chunk) =>
      getDocs(query(profilesCollection, where('companyId', 'in', chunk))),
    ),
  )

  const usersMap = new Map<string, UserProfile>()
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((docSnap) => {
      usersMap.set(docSnap.id, mapUserDoc(docSnap))
    })
  })

  return Array.from(usersMap.values())
}

export const fetchPartnerAdminSnapshot = async (
  partnerId: string,
  partnerDocData?: Record<string, unknown>,
): Promise<PartnerAdminSnapshot> => {
  if (!partnerId) {
    return {
      partner: null,
      organizations: [],
      users: [],
    }
  }

  let partner: PartnerAdminRootDoc | null = null

  if (partnerDocData) {
    partner = mapPartnerDoc(partnerId, partnerDocData)
  } else {
    const partnerSnap = await getDoc(doc(partnersCollection, partnerId))
    if (partnerSnap.exists()) {
      partner = mapPartnerDoc(partnerSnap.id, partnerSnap.data() as Record<string, unknown>)
    }
  }

  const assignedOrganizations = normalizeAssignments(partner?.assignedOrganizations)
  const organizations = await fetchOrganizations(assignedOrganizations)
  const activeOrganizations = organizations.filter(isActiveOrganization)
  const activeOrganizationIds = activeOrganizations
    .map((org) => org.id)
    .filter((id): id is string => Boolean(id))

  const users = await fetchUsersForOrganizations(activeOrganizationIds)

  return {
    partner,
    organizations: activeOrganizations,
    users,
  }
}
