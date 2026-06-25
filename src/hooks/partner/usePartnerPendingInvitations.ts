import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/services/supabase'

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

type InvitationRow = {
  id: string
  email: string | null
  role: string | null
  organization_id: string | null
  status: string | null
  created_at: string | null
}

const toDate = (value: string | null): Date | null => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

let invitationsChannelSeq = 0

/**
 * Pending invitations across the partner's assigned organizations, read from the
 * Supabase `invitations` table (migrated off Firestore; RLS grants partner/admin
 * SELECT - see 0024). Initial load + realtime channel, newest first.
 */
export const usePartnerPendingInvitations = ({ organizationIds, enabled = true }: Options) => {
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

    let cancelled = false
    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('invitations')
          .select('id, email, role, organization_id, status, created_at')
          .eq('status', 'pending')
          .in('organization_id', orgIds)
          .order('created_at', { ascending: false })

        if (cancelled) return
        if (queryError) throw queryError

        const list: PartnerPendingInvitation[] = ((data ?? []) as InvitationRow[]).map((row) => ({
          id: row.id,
          email: row.email ?? '',
          role: row.role ?? undefined,
          organizationId: row.organization_id ?? '',
          createdAt: toDate(row.created_at),
          expiresAt: null,
        }))

        setInvitations(list)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('[usePartnerPendingInvitations] Query failed', err)
        setError('Unable to load pending invitations.')
        setLoading(false)
      }
    }

    void load()

    const channel = supabase
      .channel(`partner_pending_invitations_${++invitationsChannelSeq}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, () => {
        void load()
      })
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [enabled, orgIdsKey])

  return { invitations, loading, error }
}
