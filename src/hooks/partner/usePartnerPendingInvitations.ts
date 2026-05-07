import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  onSnapshot,
  query,
  where,
  type Query,
  type DocumentData,
} from 'firebase/firestore'
import { db } from '@/services/firebase'

const FIRESTORE_IN_QUERY_LIMIT = 30

export interface PartnerPendingInvitation {
  id: string
  email: string
  name?: string
  role?: string
  organizationId: string
  createdAt?: Date | null
  expiresAt?: Date | null
}

interface Options {
  organizationIds: string[]
  enabled?: boolean
}

const toDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const obj = value as { toDate?: () => Date; seconds?: number }
  if (typeof obj.toDate === 'function') {
    try {
      const d = obj.toDate()
      return Number.isNaN(d.getTime()) ? null : d
    } catch {
      return null
    }
  }
  if (typeof obj.seconds === 'number') {
    return new Date(obj.seconds * 1000)
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * Real-time listener for pending invitations across the partner's assigned
 * organizations. Chunked into batches of 30 to satisfy Firestore's `in`
 * operator limit. Returns deduplicated, sorted invitations (newest first).
 */
export const usePartnerPendingInvitations = ({
  organizationIds,
  enabled = true,
}: Options) => {
  const [invitations, setInvitations] = useState<PartnerPendingInvitation[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Stable key so we don't resubscribe when an array reference flips but the
  // contents are equivalent.
  const orgIdsKey = useMemo(
    () => Array.from(new Set(organizationIds.filter(Boolean))).sort().join('|'),
    [organizationIds],
  )

  useEffect(() => {
    if (!enabled) {
      setInvitations([])
      setLoading(false)
      setError(null)
      return
    }

    const orgIds = orgIdsKey ? orgIdsKey.split('|') : []
    if (!orgIds.length) {
      setInvitations([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const queries: Query<DocumentData>[] = []
    for (let i = 0; i < orgIds.length; i += FIRESTORE_IN_QUERY_LIMIT) {
      const chunk = orgIds.slice(i, i + FIRESTORE_IN_QUERY_LIMIT)
      queries.push(
        query(
          collection(db, 'invitations'),
          where('status', '==', 'pending'),
          where('organizationId', 'in', chunk),
        ),
      )
    }

    const accumulator = new Map<number, Map<string, PartnerPendingInvitation>>()
    let pendingInitial = queries.length

    const recompute = () => {
      const merged = new Map<string, PartnerPendingInvitation>()
      accumulator.forEach((batch) => {
        batch.forEach((invite, id) => {
          merged.set(id, invite)
        })
      })
      const list = Array.from(merged.values()).sort((a, b) => {
        const aTime = a.createdAt ? a.createdAt.getTime() : 0
        const bTime = b.createdAt ? b.createdAt.getTime() : 0
        return bTime - aTime
      })
      setInvitations(list)
    }

    const unsubscribers = queries.map((q, index) => {
      accumulator.set(index, new Map())
      return onSnapshot(
        q,
        (snapshot) => {
          const batch = new Map<string, PartnerPendingInvitation>()
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>
            batch.set(docSnap.id, {
              id: docSnap.id,
              email: typeof data.email === 'string' ? data.email : '',
              name: typeof data.name === 'string' ? data.name : undefined,
              role: typeof data.role === 'string' ? data.role : undefined,
              organizationId:
                typeof data.organizationId === 'string' ? data.organizationId : '',
              createdAt: toDate(data.createdAt),
              expiresAt: toDate(data.expiresAt),
            })
          })
          accumulator.set(index, batch)
          if (pendingInitial > 0) {
            pendingInitial -= 1
            if (pendingInitial === 0) setLoading(false)
          }
          recompute()
        },
        (err) => {
          console.error('[usePartnerPendingInvitations] Query failed', err)
          setError('Unable to load pending invitations.')
          if (pendingInitial > 0) {
            pendingInitial -= 1
            if (pendingInitial === 0) setLoading(false)
          }
        },
      )
    })

    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [enabled, orgIdsKey])

  return { invitations, loading, error }
}
