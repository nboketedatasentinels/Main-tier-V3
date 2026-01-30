import { addDoc, collection, getCountFromServer, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '@/services/firebase'

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
