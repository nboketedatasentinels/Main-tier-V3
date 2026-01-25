import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { logger } from '@/utils/partnerDashboardUtils'

export interface PartnerInterventionSummary {
  id: string
  name: string
  target: string
  reason: string
  status: 'active' | 'watch' | 'critical' | 'escalated'
  deadline: string
  organizationCode?: string
  userId?: string
  partnerId?: string
  openedAt?: string
  statusChangedAt?: string
  riskVerdicts?: string[]
  assignedAdminName?: string
  escalationReason?: string
}

interface UsePartnerInterventionsOptions {
  selectedOrg: string
  assignedOrgKeys: Set<string>
  selectedOrgKeys: Set<string>
  enabled?: boolean
}

// ============================================================================
// FIX #3: Proper handling of Firestore 'in' query limits with warning
// ============================================================================
const FIRESTORE_IN_QUERY_LIMIT = 30

export const usePartnerInterventions = (options: UsePartnerInterventionsOptions) => {
  const { selectedOrg, assignedOrgKeys, selectedOrgKeys, enabled = true } = options
  const { isSuperAdmin, user, profileStatus } = useAuth()

  const [interventions, setInterventions] = useState<PartnerInterventionSummary[]>([])
  const [hasQueryLimitWarning, setHasQueryLimitWarning] = useState(false)

  useEffect(() => {
    if (profileStatus !== 'ready' || !enabled) {
      return
    }

    if (!user?.uid) return

    let q = query(collection(db, 'interventions'), orderBy('opened_at', 'desc'))

    if (!isSuperAdmin) {
      // FIX #6: Use lowercase keys consistently for Firestore queries
      // Note: This assumes Firestore data is also stored lowercase
      const assignedIds = Array.from(assignedOrgKeys).filter(Boolean)

      if (assignedIds.length === 0) {
        setInterventions([])
        setHasQueryLimitWarning(false)
        return
      }

      // FIX #3: Warn when query is truncated
      if (assignedIds.length > FIRESTORE_IN_QUERY_LIMIT) {
        logger.warn(
          `[PartnerInterventions] Query truncated: ${assignedIds.length} org keys exceeds ` +
            `Firestore limit of ${FIRESTORE_IN_QUERY_LIMIT}. Some interventions may be missing.`
        )
        setHasQueryLimitWarning(true)
      } else {
        setHasQueryLimitWarning(false)
      }

      q = query(
        q,
        where('organization_code', 'in', assignedIds.slice(0, FIRESTORE_IN_QUERY_LIMIT))
      )
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scoped = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() as Partial<PartnerInterventionSummary> & {
            partner_id?: string
            organization_code?: string
            opened_at?: string
          }

          return {
            id: docSnap.id,
            name: data.name || 'Intervention',
            target: data.target || 'Assigned learner',
            reason: data.reason || 'Intervention in progress',
            status: (data.status as PartnerInterventionSummary['status']) || 'active',
            deadline: data.deadline || data.opened_at || new Date().toISOString(),
            organizationCode: data.organizationCode || data.organization_code,
            userId: data.userId,
            partnerId: data.partner_id,
            openedAt: data.openedAt || data.opened_at,
            statusChangedAt: (data as any).status_changed_at || data.opened_at,
            riskVerdicts: (data as any).risk_verdicts || ['Behind on engagement targets'],
            assignedAdminName: (data as any).assigned_admin_name || 'Governance Team',
            escalationReason: (data as any).escalation_reason || 'SLA Breach',
          }
        })
        .filter((item) => {
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
          if (
            selectedOrg !== 'all' &&
            selectedOrg &&
            orgCode &&
            !selectedOrgKeys.has(orgCode)
          ) {
            return false
          }

          return true
        })

      setInterventions(scoped)
    })

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
