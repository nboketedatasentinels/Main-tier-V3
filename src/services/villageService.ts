import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  doc,
} from 'firebase/firestore'
import { db } from '@/services/firebase'

const VILLAGES_COLLECTION = 'villages'
const VILLAGE_MEMBER_LIMIT = 10

export interface VillageSummary {
  id: string
  name: string
  description?: string
  creatorId: string
  memberCount: number
  isActive: boolean
  createdAt?: string
}

export const checkVillageNameExists = async (name: string): Promise<boolean> => {
  const trimmed = name.trim()
  if (!trimmed) {
    return false
  }

  const snapshot = await getCountFromServer(
    query(collection(db, VILLAGES_COLLECTION), where('name', '==', trimmed)),
  )

  return snapshot.data().count > 0
}

export const fetchVillageById = async (villageId?: string | null): Promise<VillageSummary | null> => {
  if (!villageId?.trim()) return null

  try {
    const villageSnap = await getDoc(doc(db, VILLAGES_COLLECTION, villageId))
    if (!villageSnap.exists()) return null
    const data = villageSnap.data() as {
      name?: string
      description?: string
      creatorId?: string
      memberCount?: number
      isActive?: boolean
      createdAt?: { toDate?: () => Date } | string
    }
    const createdAt =
      typeof data.createdAt === 'string'
        ? data.createdAt
        : data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : undefined

    return {
      id: villageSnap.id,
      name: data.name || 'Unnamed village',
      description: data.description,
      creatorId: data.creatorId || '',
      memberCount: data.memberCount ?? 0,
      isActive: data.isActive ?? true,
      createdAt,
    }
  } catch (error) {
    console.error('Failed to fetch village details', error)
    return null
  }
}

export const createVillage = async (params: {
  name: string
  description: string
  creatorId: string
}): Promise<string> => {
  const name = params.name.trim()
  const description = params.description.trim()
  const creatorId = params.creatorId.trim()

  if (!name) {
    throw new Error('Village name is required.')
  }
  if (!creatorId) {
    throw new Error('Creator id is required.')
  }

  const villageRef = await addDoc(collection(db, VILLAGES_COLLECTION), {
    name,
    description,
    creatorId,
    memberIds: [creatorId],
    memberCount: 1,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return villageRef.id
}

export const addMemberToVillage = async (params: { villageId: string; userId: string }) => {
  const { villageId, userId } = params
  if (!villageId.trim() || !userId.trim()) {
    throw new Error('Village id and user id are required.')
  }

  const villageRef = doc(db, VILLAGES_COLLECTION, villageId)
  await runTransaction(db, async (transaction) => {
    const villageSnap = await transaction.get(villageRef)
    if (!villageSnap.exists()) {
      throw new Error('Village not found.')
    }
    const data = villageSnap.data() as { memberCount?: number; memberIds?: string[] }
    const memberCount = data.memberCount ?? 0
    if (memberCount >= VILLAGE_MEMBER_LIMIT) {
      throw new Error('Village has reached capacity.')
    }
    const memberIds = data.memberIds ?? []
    if (memberIds.includes(userId)) {
      return
    }
    transaction.update(villageRef, {
      memberIds: arrayUnion(userId),
      memberCount: increment(1),
      updatedAt: serverTimestamp(),
    })
  })
}

export const removeMemberFromVillage = async (params: { villageId: string; userId: string }) => {
  const { villageId, userId } = params
  if (!villageId.trim() || !userId.trim()) {
    throw new Error('Village id and user id are required.')
  }

  await updateDoc(doc(db, VILLAGES_COLLECTION, villageId), {
    memberIds: arrayRemove(userId),
    memberCount: increment(-1),
    updatedAt: serverTimestamp(),
  })
}

export const getVillageMembers = async (villageId: string) => {
  if (!villageId.trim()) return []
  const snapshot = await getDocs(query(collection(db, 'profiles'), where('villageId', '==', villageId)))
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Record<string, unknown>),
  }))
}

export const updateVillageMetadata = async (params: {
  villageId: string
  name?: string
  description?: string
}) => {
  const { villageId, name, description } = params
  if (!villageId.trim()) {
    throw new Error('Village id is required.')
  }
  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  }
  if (name !== undefined) updates.name = name.trim()
  if (description !== undefined) updates.description = description.trim()
  await updateDoc(doc(db, VILLAGES_COLLECTION, villageId), updates)
}

export const checkUserVillageMembership = async (userId: string) => {
  if (!userId.trim()) return null
  const profileSnap = await getDoc(doc(db, 'profiles', userId))
  if (!profileSnap.exists()) return null
  const data = profileSnap.data() as { villageId?: string | null }
  return data.villageId ?? null
}

export const transferVillageOwnership = async (params: { villageId: string; newCreatorId: string }) => {
  const { villageId, newCreatorId } = params
  if (!villageId.trim() || !newCreatorId.trim()) {
    throw new Error('Village id and new creator id are required.')
  }

  await updateDoc(doc(db, VILLAGES_COLLECTION, villageId), {
    creatorId: newCreatorId,
    updatedAt: serverTimestamp(),
  })
}

export const canRemoveMember = (params: {
  creatorId?: string
  actorId?: string
  targetId?: string
}) => {
  const { creatorId, actorId, targetId } = params
  if (!creatorId || !actorId || !targetId) return false
  if (creatorId !== actorId) return false
  return creatorId !== targetId
}
