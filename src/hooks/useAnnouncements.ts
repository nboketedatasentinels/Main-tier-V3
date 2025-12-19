import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Timestamp,
  collection,
  doc,
  FieldValue,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from './useAuth'

export interface AnnouncementTargeting {
  companyCode?: string | null
  companyCodes?: string[]
  targetUsers?: string[]
  targetRoles?: string[]
  targetTiers?: string[]
  targetStatuses?: string[]
}

export interface Announcement {
  id: string
  title: string
  message: string
  status: string
  createdAt: Date | null
  updatedAt: Date | null
  author?: string | null
  source?: string | null
  isRead: boolean
  readAt: Date | null
  isArchived: boolean
  archivedAt: Date | null
  targeting?: AnnouncementTargeting | null
}

interface FirestoreAnnouncement {
  title: string
  message: string
  status?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
  author?: string | null
  source?: string | null
  targeting?: AnnouncementTargeting | null
}

interface AnnouncementState {
  isRead?: boolean
  readAt?: Timestamp | FieldValue | null
  isArchived?: boolean
  archivedAt?: Timestamp | FieldValue | null
}

interface UseAnnouncementsResult {
  announcements: Announcement[]
  loading: boolean
  error: string | null
  markAnnouncementAsRead: (id: string) => Promise<void>
  markAnnouncementAsUnread: (id: string) => Promise<void>
  archiveAnnouncement: (id: string) => Promise<void>
  restoreAnnouncement: (id: string) => Promise<void>
}

export const useAnnouncements = (): UseAnnouncementsResult => {
  const { user, profile } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [rawAnnouncements, setRawAnnouncements] = useState<Announcement[]>([])
  const [userStates, setUserStates] = useState<Record<string, AnnouncementState>>({})

  const canSeeAnnouncement = useCallback(
    (announcement: Announcement): boolean => {
      if (!announcement.targeting || !profile) return true

      const { targeting } = announcement

      if (targeting.targetRoles?.length && profile.role) {
        if (!targeting.targetRoles.includes(profile.role)) return false
      }

      if (targeting.targetUsers?.length) {
        if (!targeting.targetUsers.includes(profile.id)) return false
      }

      if (targeting.companyCode && profile.companyId) {
        if (targeting.companyCode !== profile.companyId) return false
      }

      if (targeting.companyCodes?.length && profile.companyId) {
        if (!targeting.companyCodes.includes(profile.companyId)) return false
      }

      return true
    },
    [profile],
  )

  useEffect(() => {
    if (!user) {
      setAnnouncements([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const announcementsQuery = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))
    const userStatesCollection = collection(db, 'announcementStates', user.uid, 'states')

    const unsubscribeAnnouncements = onSnapshot(
      announcementsQuery,
      (snapshot) => {
        const loaded: Announcement[] = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() as FirestoreAnnouncement
          return {
            id: docSnapshot.id,
            title: data.title,
            message: data.message,
            status: data.status || 'published',
            createdAt: data.createdAt?.toDate?.() || null,
            updatedAt: data.updatedAt?.toDate?.() || null,
            author: data.author ?? null,
            source: data.source ?? null,
            isRead: false,
            readAt: null,
            isArchived: false,
            archivedAt: null,
            targeting: data.targeting ?? null,
          }
        })

        setRawAnnouncements(loaded)
        setLoading(false)
      },
      (err) => {
        console.error('Error loading announcements:', err)
        setError('Unable to load announcements right now.')
        setLoading(false)
      },
    )

    const unsubscribeStates = onSnapshot(
      userStatesCollection,
      (snapshot) => {
        const stateMap: Record<string, AnnouncementState> = {}
        snapshot.forEach((docSnapshot) => {
          stateMap[docSnapshot.id] = docSnapshot.data() as AnnouncementState
        })
        setUserStates(stateMap)
      },
      (err) => {
        console.error('Error loading announcement states:', err)
        setError('Unable to load your announcement preferences.')
      },
    )

    return () => {
      unsubscribeAnnouncements()
      unsubscribeStates()
    }
  }, [user])

  useEffect(() => {
    const merged = rawAnnouncements
      .map((announcement) => {
        const state = userStates[announcement.id]
        const readAt = state?.readAt instanceof Timestamp
          ? state.readAt.toDate()
          : state?.readAt instanceof Date
            ? state.readAt
            : null

        const archivedAt = state?.archivedAt instanceof Timestamp
          ? state.archivedAt.toDate()
          : state?.archivedAt instanceof Date
            ? state.archivedAt
            : null

        return {
          ...announcement,
          isRead: state?.isRead ?? false,
          readAt,
          isArchived: state?.isArchived ?? false,
          archivedAt,
        }
      })
      .filter((announcement) => !announcement.isArchived)
      .filter((announcement) => canSeeAnnouncement(announcement))
    setAnnouncements(merged)
  }, [rawAnnouncements, userStates, canSeeAnnouncement])

  const updateState = useCallback(
    async (id: string, updates: AnnouncementState) => {
      if (!user) return
      const stateRef = doc(db, 'announcementStates', user.uid, 'states', id)
      await setDoc(
        stateRef,
        {
          ...updates,
          readAt: updates.readAt === undefined ? serverTimestamp() : updates.readAt,
          archivedAt: updates.archivedAt === undefined ? null : updates.archivedAt,
        },
        { merge: true },
      )
    },
    [user],
  )

  const markAnnouncementAsRead = useCallback(
    async (id: string) => {
      await updateState(id, { isRead: true, readAt: serverTimestamp() })
    },
    [updateState],
  )

  const markAnnouncementAsUnread = useCallback(
    async (id: string) => {
      await updateState(id, { isRead: false, readAt: null })
    },
    [updateState],
  )

  const archiveAnnouncement = useCallback(
    async (id: string) => {
      await updateState(id, { isArchived: true, archivedAt: serverTimestamp() })
    },
    [updateState],
  )

  const restoreAnnouncement = useCallback(
    async (id: string) => {
      await updateState(id, { isArchived: false, archivedAt: null })
    },
    [updateState],
  )

  const sortedAnnouncements = useMemo(() => {
    return [...announcements].sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0
      const dateB = b.createdAt?.getTime() || 0
      return dateB - dateA
    })
  }, [announcements])

  return {
    announcements: sortedAnnouncements,
    loading,
    error,
    markAnnouncementAsRead,
    markAnnouncementAsUnread,
    archiveAnnouncement,
    restoreAnnouncement,
  }
}
