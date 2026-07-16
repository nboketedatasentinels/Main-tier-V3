import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { logger } from '@/utils/partnerDashboardUtils'
import {
  listenToPartnerInterventions,
  type PartnerInterventionSummary,
} from '@/services/partnerInterventionsService'

export type { PartnerInterventionSummary } from '@/services/partnerInterventionsService'

interface UsePartnerInterventionsOptions {
  selectedOrg: string
  assignedOrgKeys: Set<string>
  selectedOrgKeys: Set<string>
  enabled?: boolean
}

export const usePartnerInterventions = (options: UsePartnerInterventionsOptions) => {
  const { selectedOrg, assignedOrgKeys, selectedOrgKeys, enabled = true } = options
  const { isSuperAdmin, user, profileStatus } = useAuth()

  const [rawInterventions, setRawInterventions] = useState<PartnerInterventionSummary[]>([])
  // Supabase `.in(...)` has no Firestore-style 30-item ceiling, so the queue is
  // never silently truncated. Kept in the return shape for consumer compat.
  const [hasQueryLimitWarning] = useState(false)

  // Stable string key of the assigned org codes. assignedOrgKeys is a Set whose
  // identity changes every render; deriving a sorted-joined STRING lets the
  // subscription effect below depend on the CONTENT (stable) instead of the Set
  // reference — otherwise it re-subscribed every render and looped forever
  // (ERR_INSUFFICIENT_RESOURCES).
  const assignedIdsKey = useMemo(
    () => Array.from(assignedOrgKeys).filter(Boolean).sort().join('|'),
    [assignedOrgKeys],
  )

  useEffect(() => {
    if (profileStatus !== 'ready' || !enabled) return
    if (!user?.uid) return

    const assignedIds = assignedIdsKey ? assignedIdsKey.split('|') : []

    if (!isSuperAdmin && assignedIds.length === 0) {
      setRawInterventions([])
      return
    }

    const unsubscribe = listenToPartnerInterventions(
      { orgCodes: assignedIds, all: isSuperAdmin },
      (rows) => setRawInterventions(rows),
      (err) => {
        logger.error('[PartnerInterventions] Failed to load interventions', err)
        setRawInterventions([])
      },
    )

    return () => unsubscribe()
    // Subscription depends only on the QUERY inputs (which orgs to fetch), NOT on
    // the client-side filter Sets — those are applied in the memo below.
  }, [assignedIdsKey, enabled, isSuperAdmin, profileStatus, user?.uid])

  // Client-side scoping. Re-runs cheaply when the filter changes, without ever
  // touching the subscription.
  const interventions = useMemo(() => {
    return rawInterventions.filter((item) => {
      const orgCode = item.organizationCode?.toLowerCase()

      // Filter by partner assignment
      if (!isSuperAdmin && item.partnerId && item.partnerId !== user?.uid) {
        return false
      }

      // Filter by organization access
      if (!isSuperAdmin && (!assignedOrgKeys.size || (orgCode && !assignedOrgKeys.has(orgCode)))) {
        return false
      }

      // Filter by selected organization
      if (selectedOrg !== 'all' && selectedOrg && orgCode && !selectedOrgKeys.has(orgCode)) {
        return false
      }

      return true
    })
  }, [rawInterventions, isSuperAdmin, user?.uid, assignedOrgKeys, selectedOrg, selectedOrgKeys])

  return {
    interventions,
    hasQueryLimitWarning,
  }
}
