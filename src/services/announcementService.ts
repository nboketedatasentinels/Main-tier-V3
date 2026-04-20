import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  Announcement,
  AnnouncementTargeting,
  AnnouncementTier,
} from '@/hooks/useAnnouncements'

export interface AnnouncementDraftInput {
  title: string
  message: string
  tier?: AnnouncementTier | null
  author?: string | null
  source?: string | null
  isMandatory?: boolean
  actionLabel?: string | null
  actionUrl?: string | null
  targeting?: AnnouncementTargeting | null
  status?: 'draft' | 'published' | 'archived'
}

const ANNOUNCEMENTS_COLLECTION = 'announcements'

const cleanTargeting = (targeting?: AnnouncementTargeting | null) => {
  if (!targeting) return null
  const cleaned: AnnouncementTargeting = {}
  if (targeting.companyCode) cleaned.companyCode = targeting.companyCode
  if (targeting.companyCodes?.length) cleaned.companyCodes = targeting.companyCodes
  if (targeting.targetUsers?.length) cleaned.targetUsers = targeting.targetUsers
  if (targeting.targetRoles?.length) cleaned.targetRoles = targeting.targetRoles
  if (targeting.targetTiers?.length) cleaned.targetTiers = targeting.targetTiers
  if (targeting.targetStatuses?.length) cleaned.targetStatuses = targeting.targetStatuses
  return Object.keys(cleaned).length ? cleaned : null
}

export const createAnnouncement = async (input: AnnouncementDraftInput): Promise<string> => {
  const payload = {
    title: input.title.trim(),
    message: input.message.trim(),
    status: input.status ?? 'published',
    author: input.author ?? null,
    source: input.source ?? 'admin',
    tier: input.tier ?? 'global',
    isMandatory: Boolean(input.isMandatory),
    actionLabel: input.actionLabel?.trim() || null,
    actionUrl: input.actionUrl?.trim() || null,
    targeting: cleanTargeting(input.targeting),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, ANNOUNCEMENTS_COLLECTION), payload)
  return ref.id
}

export const updateAnnouncement = async (
  id: string,
  input: Partial<AnnouncementDraftInput>,
): Promise<void> => {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() }
  if (input.title !== undefined) payload.title = input.title.trim()
  if (input.message !== undefined) payload.message = input.message.trim()
  if (input.status !== undefined) payload.status = input.status
  if (input.tier !== undefined) payload.tier = input.tier
  if (input.author !== undefined) payload.author = input.author
  if (input.source !== undefined) payload.source = input.source
  if (input.isMandatory !== undefined) payload.isMandatory = Boolean(input.isMandatory)
  if (input.actionLabel !== undefined) payload.actionLabel = input.actionLabel?.trim() || null
  if (input.actionUrl !== undefined) payload.actionUrl = input.actionUrl?.trim() || null
  if (input.targeting !== undefined) payload.targeting = cleanTargeting(input.targeting)

  await updateDoc(doc(db, ANNOUNCEMENTS_COLLECTION, id), payload)
}

export const archiveAnnouncementAdmin = (id: string) =>
  updateAnnouncement(id, { status: 'archived' })

export const publishAnnouncement = (id: string) =>
  updateAnnouncement(id, { status: 'published' })

export const deleteAnnouncementAdmin = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, ANNOUNCEMENTS_COLLECTION, id))
}

export type AdminAnnouncement = Announcement & {
  status: 'draft' | 'published' | 'archived'
}

export const subscribeToAllAnnouncements = (
  onChange: (items: AdminAnnouncement[]) => void,
  onError?: (err: Error) => void,
): (() => void) => {
  const q = query(collection(db, ANNOUNCEMENTS_COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snapshot) => {
      const items: AdminAnnouncement[] = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data() as Record<string, unknown>
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null
        const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null
        const rawStatus = (data.status as string) || 'published'
        const status: AdminAnnouncement['status'] =
          rawStatus === 'draft' || rawStatus === 'archived' ? rawStatus : 'published'
        return {
          id: docSnapshot.id,
          title: (data.title as string) ?? '',
          message: (data.message as string) ?? '',
          status,
          createdAt,
          updatedAt,
          author: (data.author as string) ?? null,
          source: (data.source as string) ?? null,
          tier: (data.tier as AnnouncementTier) ?? null,
          isMandatory: Boolean(data.isMandatory),
          actionLabel: (data.actionLabel as string) ?? null,
          actionUrl: (data.actionUrl as string) ?? null,
          isRead: false,
          readAt: null,
          isArchived: false,
          archivedAt: null,
          actionCompleted: false,
          actionCompletedAt: null,
          targeting: (data.targeting as AnnouncementTargeting) ?? null,
        }
      })
      onChange(items)
    },
    (err) => {
      if (onError) onError(err)
      else console.error('Error subscribing to announcements:', err)
    },
  )
}
