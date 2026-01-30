import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import type { UserProfile } from '@/types'

export interface BadgeRecord {
  id: string
  title: string
  description?: string
  criteria?: string
  type?: string
  earned: boolean
  earnedAt?: string
  progressPercentage?: number
}

export interface ImpactLogSummary {
  totalEntries: number
  lastActivityAt?: string
}

export interface OrganizationSummary {
  id: string
  name: string
  code?: string
  status?: string
}

export interface UserProfileExtended extends UserProfile {
  coreValues?: string[]
  socialLinks?: {
    linkedin?: string
    twitter?: string
    github?: string
    website?: string
  }
  notes?: string
  goalsCompleted?: number
  goalsTotal?: number
  milestonesProgress?: number
  weeklyActivity?: number
  lastModifiedBy?: string
  lastModifiedByName?: string
  lastModifiedAt?: string
}

export interface ProfileAccessLog {
  viewerId: string
  targetUserId: string
  viewerRole?: string
  allowed: boolean
  reason?: string
  route?: string
}

const normalizeDateString = (value?: unknown): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  const maybeTimestamp = value as { toDate?: () => Date }
  if (maybeTimestamp?.toDate) {
    return maybeTimestamp.toDate().toISOString()
  }
  return undefined
}

export const fetchUserProfileById = async (userId: string): Promise<UserProfileExtended | null> => {
  const userRef = doc(db, 'users', userId)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) return null

  const data = snapshot.data() as UserProfileExtended

  return {
    ...data,
    id: snapshot.id,
    createdAt: normalizeDateString(data.createdAt) || new Date().toISOString(),
    updatedAt: normalizeDateString(data.updatedAt) || new Date().toISOString(),
    lastActive: normalizeDateString(data.lastActive),
    lastActiveAt: normalizeDateString(data.lastActiveAt),
    registrationDate: normalizeDateString(data.registrationDate),
    lastModifiedAt: normalizeDateString(data.lastModifiedAt),
    socialLinks: data.socialLinks || {
      linkedin: data.linkedinUrl,
    },
  }
}

export const fetchOrganizationDetails = async (companyId?: string | null): Promise<OrganizationSummary | null> => {
  if (!companyId) return null
  const snapshot = await getDoc(doc(db, ORG_COLLECTION, companyId))
  if (!snapshot.exists()) return null
  const data = snapshot.data() as { name?: string; code?: string; status?: string }
  return {
    id: snapshot.id,
    name: data.name || 'Unknown organization',
    code: data.code,
    status: data.status,
  }
}

export const fetchUserBadges = async (userId: string): Promise<BadgeRecord[]> => {
  const badgeDefsSnap = await getDocs(collection(db, 'badges'))
  const badgeDefs = badgeDefsSnap.docs.map((docItem) => {
    const data = docItem.data() as {
      title?: string
      description?: string
      criteria?: string
      type?: string
    }
    return {
      id: docItem.id,
      title: data.title || 'Untitled badge',
      description: data.description,
      criteria: data.criteria,
      type: data.type,
    }
  })

  const userBadgesSnap = await getDocs(query(collection(db, 'user_badges'), where('userId', '==', userId)))
  const userBadges = new Map(
    userBadgesSnap.docs.map((docItem) => {
      const payload = docItem.data() as { badgeId?: string; earnedAt?: string; progressPercentage?: number }
      return [payload.badgeId, { ...payload, id: docItem.id }]
    })
  )

  return badgeDefs.map((def) => {
    const userBadge = userBadges.get(def.id)
    return {
      ...def,
      earned: Boolean(userBadge?.earnedAt),
      earnedAt: userBadge?.earnedAt,
      progressPercentage: userBadge?.progressPercentage,
    }
  })
}

export const fetchImpactLogSummary = async (userId: string): Promise<ImpactLogSummary> => {
  const logsQuery = query(
    collection(db, 'impact_logs'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(1),
  )
  const [countSnapshot, lastLogSnapshot] = await Promise.all([
    getCountFromServer(query(collection(db, 'impact_logs'), where('userId', '==', userId))),
    getDocs(logsQuery),
  ])
  const lastLog = lastLogSnapshot.docs[0]?.data() as { createdAt?: unknown }
  return {
    totalEntries: countSnapshot.data().count,
    lastActivityAt: normalizeDateString(lastLog?.createdAt),
  }
}

export const updateUserProfile = async (
  userId: string,
  updates: Record<string, unknown>,
  allowedFields: string[],
  actor: { id: string; name?: string } | null,
) => {
  const sanitized = Object.fromEntries(
    Object.entries(updates).filter(([key, value]) => allowedFields.includes(key) && typeof value !== 'undefined')
  )

  if (!Object.keys(sanitized).length) {
    return { updates: {} as Record<string, unknown>, error: null }
  }

  const payload: Record<string, unknown> = {
    ...sanitized,
    updatedAt: serverTimestamp(),
  }

  if (actor) {
    payload.lastModifiedBy = actor.id
    payload.lastModifiedByName = actor.name || null
    payload.lastModifiedAt = serverTimestamp()
  }

  // Add role change audit trail if role is being updated
  const hasRoleUpdate = Object.prototype.hasOwnProperty.call(sanitized, 'role')
  if (hasRoleUpdate && actor) {
    payload.roleChangedBy = actor.id
    payload.roleChangedAt = serverTimestamp()
  }

  await updateDoc(doc(db, 'users', userId), payload)

  const hasMentorUpdate = Object.prototype.hasOwnProperty.call(sanitized, 'mentorId')
  const hasAmbassadorUpdate = Object.prototype.hasOwnProperty.call(sanitized, 'ambassadorId')

  if (hasMentorUpdate || hasAmbassadorUpdate) {
    const normalizeAssignmentId = (value: unknown) => {
      if (typeof value !== 'string') return value ?? null
      const trimmed = value.trim()
      return trimmed.length ? trimmed : null
    }

    const supportPayload: Record<string, unknown> = {
      user_id: userId,
      assigned_date: serverTimestamp(),
      updated_at: serverTimestamp(),
    }

    if (hasMentorUpdate) {
      supportPayload.mentor_id = normalizeAssignmentId(sanitized.mentorId)
    }
    if (hasAmbassadorUpdate) {
      supportPayload.ambassador_id = normalizeAssignmentId(sanitized.ambassadorId)
    }

    await setDoc(doc(db, 'support_assignments', userId), supportPayload, { merge: true })
  }

  return { updates: sanitized, error: null }
}

export const updateUserVillageId = async (userId: string, villageId: string): Promise<void> => {
  if (!userId.trim()) {
    throw new Error('User id is required.')
  }
  if (!villageId.trim()) {
    throw new Error('Village id is required.')
  }

  const userRef = doc(db, 'users', userId)

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef)

    if (!snapshot.exists()) {
      throw new Error('User profile not found.')
    }

    transaction.update(userRef, {
      villageId,
      updatedAt: serverTimestamp(),
    })
  })
}

export const logUserProfileAccess = async (log: ProfileAccessLog) => {
  await addDoc(collection(db, 'profile_access_logs'), {
    ...log,
    createdAt: serverTimestamp(),
  })
}
