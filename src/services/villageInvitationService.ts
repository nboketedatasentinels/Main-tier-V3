import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  increment,
} from 'firebase/firestore'
import { db } from '@/services/firebase'

export type VillageInvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked'

export interface VillageInvitation {
  id: string
  invitationCode: string
  villageId: string
  villageName: string
  invitedBy: string
  invitedByName?: string | null
  email?: string | null
  status: VillageInvitationStatus
  createdAt?: string
  acceptedAt?: string
  updatedAt?: string
}

const INVITATIONS_COLLECTION = 'village_invitations'
const VILLAGES_COLLECTION = 'villages'
const VILLAGE_MEMBER_LIMIT = 10

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const toIsoString = (value?: { toDate?: () => Date } | string | null) => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  if (value.toDate) return value.toDate().toISOString()
  return undefined
}

const mapInvitation = (snapshot: { id: string; data: () => Record<string, unknown> }): VillageInvitation => {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    invitationCode: (data.invitationCode as string) || '',
    villageId: (data.villageId as string) || '',
    villageName: (data.villageName as string) || '',
    invitedBy: (data.invitedBy as string) || '',
    invitedByName: (data.invitedByName as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    status: (data.status as VillageInvitationStatus) || 'pending',
    createdAt: toIsoString(data.createdAt as { toDate?: () => Date } | string | null),
    acceptedAt: toIsoString(data.acceptedAt as { toDate?: () => Date } | string | null),
    updatedAt: toIsoString(data.updatedAt as { toDate?: () => Date } | string | null),
  }
}

export const generateVillageInviteCode = (length = 8): string => {
  const safeLength = Math.max(6, Math.min(length, 12))
  const bytes = new Uint8Array(safeLength)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  return Array.from(bytes)
    .map((value) => alphabet[value % alphabet.length])
    .join('')
}

export const validateVillageCapacity = async (villageId: string) => {
  const villageSnap = await getDoc(doc(db, VILLAGES_COLLECTION, villageId))
  if (!villageSnap.exists()) {
    throw new Error('Village not found.')
  }
  const data = villageSnap.data() as { memberCount?: number }
  const memberCount = data.memberCount ?? 0

  return {
    memberCount,
    limit: VILLAGE_MEMBER_LIMIT,
    isFull: memberCount >= VILLAGE_MEMBER_LIMIT,
  }
}

export const createVillageInvitation = async (params: {
  villageId: string
  villageName: string
  invitedBy: string
  invitedByName?: string | null
  email?: string | null
  invitationCode?: string
}) => {
  const invitationCode = params.invitationCode?.trim() || generateVillageInviteCode()

  const invitationRef = await addDoc(collection(db, INVITATIONS_COLLECTION), {
    invitationCode,
    villageId: params.villageId,
    villageName: params.villageName,
    invitedBy: params.invitedBy,
    invitedByName: params.invitedByName ?? null,
    email: params.email?.trim().toLowerCase() || null,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return { id: invitationRef.id, invitationCode }
}

export const listVillageInvitations = async (params: {
  villageId: string
  status?: VillageInvitationStatus
}) => {
  const filters = [where('villageId', '==', params.villageId)]
  if (params.status) {
    filters.push(where('status', '==', params.status))
  }
  const snapshot = await getDocs(query(collection(db, INVITATIONS_COLLECTION), ...filters))
  return snapshot.docs.map((docSnap) => mapInvitation(docSnap))
}

export const fetchVillageInvitationByCode = async (invitationCode: string) => {
  const trimmed = invitationCode.trim().toUpperCase()
  if (!trimmed) return null
  const snapshot = await getDocs(
    query(collection(db, INVITATIONS_COLLECTION), where('invitationCode', '==', trimmed), limit(1)),
  )
  const docSnap = snapshot.docs[0]
  if (!docSnap) return null
  return mapInvitation(docSnap)
}

export const revokeVillageInvitation = async (invitationId: string) => {
  if (!invitationId.trim()) {
    throw new Error('Invitation id is required.')
  }
  await updateDoc(doc(db, INVITATIONS_COLLECTION, invitationId), {
    status: 'revoked',
    updatedAt: serverTimestamp(),
  })
}

export const resendVillageInvitation = async (invitationId: string) => {
  if (!invitationId.trim()) {
    throw new Error('Invitation id is required.')
  }
  await updateDoc(doc(db, INVITATIONS_COLLECTION, invitationId), {
    updatedAt: serverTimestamp(),
  })
}

export const rejectVillageInvitation = async (invitationId: string) => {
  if (!invitationId.trim()) {
    throw new Error('Invitation id is required.')
  }
  await updateDoc(doc(db, INVITATIONS_COLLECTION, invitationId), {
    status: 'declined',
    updatedAt: serverTimestamp(),
  })
}

export const updateVillageMemberCount = async (villageId: string, delta: number) => {
  if (!villageId.trim()) {
    throw new Error('Village id is required.')
  }
  await updateDoc(doc(db, VILLAGES_COLLECTION, villageId), {
    memberCount: increment(delta),
    updatedAt: serverTimestamp(),
  })
}

export const removeMemberFromVillage = async (villageId: string, userId: string) => {
  if (!villageId.trim() || !userId.trim()) {
    throw new Error('Village id and user id are required.')
  }
  await updateDoc(doc(db, VILLAGES_COLLECTION, villageId), {
    memberIds: arrayRemove(userId),
    memberCount: increment(-1),
    updatedAt: serverTimestamp(),
  })
}

export const acceptVillageInvitation = async (params: {
  invitationId: string
  villageId: string
  userId: string
}) => {
  const invitationRef = doc(db, INVITATIONS_COLLECTION, params.invitationId)
  const villageRef = doc(db, VILLAGES_COLLECTION, params.villageId)

  await runTransaction(db, async (transaction) => {
    const [invitationSnap, villageSnap] = await Promise.all([
      transaction.get(invitationRef),
      transaction.get(villageRef),
    ])

    if (!invitationSnap.exists()) {
      throw new Error('Invitation not found.')
    }
    if (!villageSnap.exists()) {
      throw new Error('Village not found.')
    }

    const invitationData = invitationSnap.data() as { status?: VillageInvitationStatus }
    if (invitationData.status && invitationData.status !== 'pending') {
      throw new Error('Invitation is no longer available.')
    }

    const villageData = villageSnap.data() as { memberCount?: number; memberIds?: string[] }
    const memberCount = villageData.memberCount ?? 0
    if (memberCount >= VILLAGE_MEMBER_LIMIT) {
      throw new Error('Village has reached capacity.')
    }

    const memberIds = villageData.memberIds ?? []
    if (!memberIds.includes(params.userId)) {
      transaction.update(villageRef, {
        memberIds: arrayUnion(params.userId),
        memberCount: increment(1),
        updatedAt: serverTimestamp(),
      })
    }

    transaction.update(invitationRef, {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}
