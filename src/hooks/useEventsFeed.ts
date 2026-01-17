import { useEffect, useMemo, useState } from 'react'
import { Timestamp, collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from './useAuth'
import { UserRole } from '@/types'

export interface EventItem {
  id: string
  title: string
  description: string
  date: Date | null
  time: string
  location: string
  link: string
  category: string
  imageUrl?: string
  postedAt: Date | null
  status: 'draft' | 'published' | 'archived'
  createdBy: string
  createdByName?: string
  updatedAt?: Date | null
}

interface FirestoreEvent {
  title: string
  description: string
  date?: Timestamp
  time: string
  location: string
  link: string
  category: string
  imageUrl?: string
  postedAt?: Timestamp
  status: 'draft' | 'published' | 'archived'
  createdBy: string
  createdByName?: string
  updatedAt?: Timestamp
}

interface UseEventsFeedResult {
  events: EventItem[]
  loading: boolean
  error: string | null
}

export const useEventsFeed = (): UseEventsFeedResult => {
  const { profile } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const eventsQuery = query(collection(db, 'events'), orderBy('date', 'asc'))

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const loaded: EventItem[] = snapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data() as FirestoreEvent
            return {
              id: docSnapshot.id,
              title: data.title,
              description: data.description,
              date: data.date?.toDate?.() || null,
              time: data.time,
              location: data.location,
              link: data.link,
              category: data.category,
              imageUrl: data.imageUrl,
              postedAt: data.postedAt?.toDate?.() || null,
              status: data.status,
              createdBy: data.createdBy,
              createdByName: data.createdByName,
              updatedAt: data.updatedAt?.toDate?.() || null,
            }
          })
          .filter((event) => {
            const isAdmin =
              profile?.role === UserRole.SUPER_ADMIN ||
              profile?.role === UserRole.AMBASSADOR ||
              profile?.role === UserRole.PARTNER

            if (isAdmin) return true
            return event.status === 'published'
          })

        setEvents(loaded)
        setLoading(false)
      },
      (err) => {
        console.error('Error loading events:', err)
        setError('Unable to load events right now.')
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [profile?.role])

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const dateA = a.date?.getTime() || 0
      const dateB = b.date?.getTime() || 0
      return dateA - dateB
    })
  }, [events])

  return { events: sortedEvents, loading, error }
}
