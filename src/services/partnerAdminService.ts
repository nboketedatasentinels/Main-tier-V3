import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'
import type { PartnerAdminSnapshot, PartnerAssignment } from '@/types/admin'

const PARTNERS_COLLECTION = 'partners'

const normalizeAssignment = (assignment: PartnerAssignment): PartnerAssignment | null => {
  const organizationId = assignment.organizationId?.trim()
  const companyCode = assignment.companyCode?.trim()
  if (!organizationId && !companyCode) return null

  return {
    organizationId: organizationId || undefined,
    companyCode: companyCode || undefined,
    status: assignment.status ?? 'active',
  }
}

const normalizeAssignments = (assignments: PartnerAssignment[] = []): PartnerAssignment[] => {
  const normalized: PartnerAssignment[] = []
  const seen = new Set<string>()

  assignments.forEach((assignment) => {
    const normalizedAssignment = normalizeAssignment(assignment)
    if (!normalizedAssignment) return
    const dedupeKey =
      normalizedAssignment.organizationId || normalizedAssignment.companyCode || ''
    if (!dedupeKey) return
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)
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
