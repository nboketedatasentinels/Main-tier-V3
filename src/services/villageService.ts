import { addDoc, collection, getCountFromServer, getDoc, query, serverTimestamp, where, doc } from 'firebase/firestore'
import { db } from '@/services/firebase'

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
    query(collection(db, 'villages'), where('name', '==', trimmed)),
  )

  return snapshot.data().count > 0
}

export const fetchVillageById = async (villageId?: string | null): Promise<VillageSummary | null> => {
  if (!villageId?.trim()) return null

  try {
    const villageSnap = await getDoc(doc(db, 'villages', villageId))
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

  const villageRef = await addDoc(collection(db, 'villages'), {
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
