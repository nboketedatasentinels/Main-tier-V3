import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import type {
  NudgeCampaignRecord,
  NudgeEffectivenessRecord,
  NudgeSentRecord,
  NudgeTemplateRecord,
} from '@/types/nudges'

const mapDoc = <T extends { id: string }>(docSnap: { id: string; data: () => unknown }) =>
  ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<T, 'id'>),
  }) as T

const isMissingIndexError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  const message = (error as { message?: string }).message
  return code === 'failed-precondition' && typeof message === 'string' && message.includes('requires an index')
}

const sortTemplatesByCreatedAt = (templates: NudgeTemplateRecord[]) => {
  return [...templates].sort((a, b) => {
    const aValue = a.created_at?.toMillis?.() ?? 0
    const bValue = b.created_at?.toMillis?.() ?? 0
    return bValue - aValue
  })
}

export const fetchNudgeTemplates = async (onlyActive = false) => {
  const templatesRef = collection(db, 'nudge_templates')
  const baseQuery = onlyActive
    ? query(templatesRef, where('is_active', '==', true), orderBy('created_at', 'desc'))
    : query(templatesRef, orderBy('created_at', 'desc'))
  try {
    const snapshot = await getDocs(baseQuery)
    return snapshot.docs.map((docSnap) => mapDoc<NudgeTemplateRecord>(docSnap))
  } catch (error) {
    if (onlyActive && isMissingIndexError(error)) {
      const fallbackSnapshot = await getDocs(query(templatesRef, where('is_active', '==', true)))
      const fallbackTemplates = fallbackSnapshot.docs.map((docSnap) => mapDoc<NudgeTemplateRecord>(docSnap))
      return sortTemplatesByCreatedAt(fallbackTemplates)
    }
    throw error
  }
}

export const createNudgeTemplate = async (template: Omit<NudgeTemplateRecord, 'id' | 'created_at' | 'updated_at'>) => {
  const templatesRef = collection(db, 'nudge_templates')
  const payload = {
    ...template,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  }
  const docRef = await addDoc(templatesRef, payload)
  const docSnap = await getDoc(docRef)
  return docSnap.exists()
    ? mapDoc<NudgeTemplateRecord>(docSnap)
    : ({
        id: docRef.id,
        ...template,
        created_at: null,
        updated_at: null,
      } as NudgeTemplateRecord)
}

export const updateNudgeTemplate = async (id: string, updates: Partial<NudgeTemplateRecord>) => {
  const docRef = doc(db, 'nudge_templates', id)
  await updateDoc(docRef, {
    ...updates,
    updated_at: serverTimestamp(),
  })
  const docSnap = await getDoc(docRef)
  return docSnap.exists()
    ? mapDoc<NudgeTemplateRecord>(docSnap)
    : ({
        id,
        ...updates,
      } as NudgeTemplateRecord)
}

export const logNudgeSent = async (payload: Omit<NudgeSentRecord, 'id' | 'sent_at'>) => {
  const sentRef = collection(db, 'nudges_sent')
  const docRef = await addDoc(sentRef, { ...payload, sent_at: serverTimestamp() })
  const docSnap = await getDoc(docRef)
  return docSnap.exists()
    ? mapDoc<NudgeSentRecord>(docSnap)
    : ({
        id: docRef.id,
        ...payload,
        sent_at: null,
      } as NudgeSentRecord)
}

export const logNudgeEffectiveness = async (
  payload: Omit<NudgeEffectivenessRecord, 'id' | 'measured_at'>,
) => {
  const effectivenessRef = collection(db, 'nudge_effectiveness')
  const docRef = await addDoc(effectivenessRef, { ...payload, measured_at: serverTimestamp() })
  const docSnap = await getDoc(docRef)
  return docSnap.exists()
    ? mapDoc<NudgeEffectivenessRecord>(docSnap)
    : ({
        id: docRef.id,
        ...payload,
        measured_at: null,
      } as NudgeEffectivenessRecord)
}

export const createNudgeCampaign = async (payload: Omit<NudgeCampaignRecord, 'id'>) => {
  const campaignsRef = collection(db, 'nudge_campaigns')
  const docRef = await addDoc(campaignsRef, payload)
  const docSnap = await getDoc(docRef)
  return docSnap.exists()
    ? mapDoc<NudgeCampaignRecord>(docSnap)
    : ({
        id: docRef.id,
        ...payload,
      } as NudgeCampaignRecord)
}

export const fetchNudgeCampaigns = async () => {
  const campaignsRef = collection(db, 'nudge_campaigns')
  const snapshot = await getDocs(query(campaignsRef, orderBy('start_date', 'desc')))
  return snapshot.docs.map((docSnap) => mapDoc<NudgeCampaignRecord>(docSnap))
}
