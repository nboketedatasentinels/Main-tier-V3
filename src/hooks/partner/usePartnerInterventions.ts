import { useEffect, useState } from 'react'
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

  const [interventions, setInterventions] = useState<PartnerInterventionSummary[]>([])
  // Supabase `.in(...)` has no Firestore-style 30-item ceiling, so the queue is
  // never silently truncated. Kept in the return shape for consumer compat.
  const [hasQueryLimitWarning] = useState(false)

  useEffect(() => {
    if (profileStatus !== 'ready' || !enabled) {
      return
    }

    if (!user?.uid) return

    const assignedIds = Array.from(assignedOrgKeys).filter(Boolean)

    if (!isSuperAdmin && assignedIds.length === 0) {
      setInterventions([])
      return
    }

    const unsubscribe = listenToPartnerInterventions(
      { orgCodes: assignedIds, all: isSuperAdmin },
      (rows) => {
        const scoped = rows.filter((item) => {
          const orgCode = item.organizationCode?.toLowerCase()

          // Filter by partner assignment
          if (!isSuperAdmin && item.partnerId && item.partnerId !== user.uid) {
            return false
          }

          // Filter by organization access
          if (
            !isSuperAdmin &&
            (!assignedOrgKeys.size || (orgCode && !assignedOrgKeys.has(orgCode)))
          ) {
            return false
          }

          // Filter by selected organization
          if (selectedOrg !== 'all' && selectedOrg && orgCode && !selectedOrgKeys.has(orgCode)) {
            return false
          }

          return true
        })

        setInterventions(scoped)
      },
      (err) => {
        logger.error('[PartnerInterventions] Failed to load interventions', err)
        setInterventions([])
      },
    )

    return () => unsubscribe()
  }, [
    assignedOrgKeys,
    enabled,
    isSuperAdmin,
    profileStatus,
    selectedOrg,
    selectedOrgKeys,
    user?.uid,
  ])

  return {
    interventions,
    hasQueryLimitWarning,
  }
}
