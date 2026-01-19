import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'
import type { PartnerAdminSnapshot, PartnerAssignment } from '@/types/admin'

const PARTNERS_COLLECTION = 'partners'

const normalizeAssignment = (assignment: PartnerAssignment): PartnerAssignment | null => {
  const organizationId = assignment.organizationId?.trim()
  if (!organizationId) return null

  return {
    organizationId,
    companyCode: assignment.companyCode?.trim() || undefined,
    status: assignment.status ?? 'active',
  }
}

const normalizeAssignments = (assignments: PartnerAssignment[] = []): PartnerAssignment[] => {
  const normalized: PartnerAssignment[] = []
  const seen = new Set<string>()

  assignments.forEach((assignment) => {
    const normalizedAssignment = normalizeAssignment(assignment)
    if (!normalizedAssignment) return
    if (seen.has(normalizedAssignment.organizationId)) return
    seen.add(normalizedAssignment.organizationId)
    normalized.push(normalizedAssignment)
  })

  return normalized
}

const buildSnapshot = (partnerId: string, data: Partial<PartnerAdminSnapshot>): PartnerAdminSnapshot => ({
  partnerId,
  role: 'partner',
  assignedOrganizations: normalizeAssignments(data.assignedOrganizations || []),
  createdAt: data.createdAt,
  updatedAt: data.updatedAt,
})

export const listenToPartnerAdminSnapshot = (
  partnerId: string,
  onChange: (snapshot: PartnerAdminSnapshot | null) => void,
  onError?: (error: unknown) => void,
) => {
  if (!partnerId) {
    onChange(null)
    return () => undefined
  }

  const partnerRef = doc(db, PARTNERS_COLLECTION, partnerId)
  return onSnapshot(
    partnerRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null)
        return
      }
      onChange(buildSnapshot(snapshot.id, snapshot.data() as PartnerAdminSnapshot))
    },
    (error) => {
      onError?.(error)
    },
  )
}

export const upsertPartnerAssignments = async (
  partnerId: string,
  assignments: PartnerAssignment[],
) => {
  if (!partnerId) return
  const partnerRef = doc(db, PARTNERS_COLLECTION, partnerId)
  const existingSnap = await getDoc(partnerRef)
  const payload: Partial<PartnerAdminSnapshot> = {
    partnerId,
    role: 'partner',
    assignedOrganizations: normalizeAssignments(assignments),
    updatedAt: serverTimestamp(),
  }

  if (!existingSnap.exists()) {
    payload.createdAt = serverTimestamp()
  }

  await setDoc(partnerRef, payload, { merge: true })
}
