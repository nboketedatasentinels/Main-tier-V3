import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@chakra-ui/react'
import {
  approvePointsVerificationRequest,
  listenToPointsVerificationRequestsByOrganizations,
  rejectPointsVerificationRequest,
  type PointsVerificationRequest,
} from '@/services/pointsVerificationService'
import { PartnerUser } from '@/hooks/usePartnerDashboardData'
import { useAuth } from '@/hooks/useAuth'

interface UsePointsApprovalQueueOptions {
  /** Organization IDs to filter by (for partners) */
  organizationIds?: string[]
  /** Whether to enable the subscription (defaults to true) */
  enabled?: boolean
}

export const usePointsApprovalQueue = (
  users: PartnerUser[],
  _isVisible: boolean, // Keep for backward compatibility but don't use as gate
  options: UsePointsApprovalQueueOptions = {},
) => {
  const { organizationIds = [], enabled = true } = options
  const [verificationRequests, setVerificationRequests] = useState<PointsVerificationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const { profile, isSuperAdmin } = useAuth()
  const toast = useToast()

  // Subscribe to verification requests - REMOVED visibility gate for immediate updates
  useEffect(() => {
    if (!enabled) {
      setVerificationRequests([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // For super_admin: get all requests (no org filter)
    // For partners: filter by their assigned organizations
    const filterOrgIds = isSuperAdmin ? undefined : organizationIds

    const unsubscribe = listenToPointsVerificationRequestsByOrganizations(
      (items) => {
        setVerificationRequests(items)
        setLoading(false)
      },
      filterOrgIds,
      (err) => {
        console.error('[usePointsApprovalQueue] Listener error:', err)
        setError('Failed to load approval requests')
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [enabled, organizationIds, isSuperAdmin])

  // User lookup for enrichment
  const approvalUserLookup = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  )

  // Build approval queue with user enrichment
  // Server-side filtering handles org scope, client-side just enriches with user data
  const approvalQueue = useMemo(() => {
    if (!verificationRequests.length) return []

    return verificationRequests.map((request) => {
      const user = approvalUserLookup.get(request.user_id)
      // If user not in lookup, include request anyway with minimal info
      // This handles edge cases where user data hasn't loaded yet
      return {
        request,
        user: user || {
          id: request.user_id,
          name: 'Loading...',
          email: '',
          companyCode: request.organizationId || 'Unknown',
          progressPercent: 0,
          currentWeek: request.week,
          status: 'Active' as const,
          lastActive: '',
          riskStatus: 'engaged' as const,
          weeklyEarned: 0,
          weeklyRequired: 0,
        },
      }
    })
  }, [approvalUserLookup, verificationRequests])

  // Backward compatibility: filter by user lookup if using legacy call pattern (no org IDs)
  const legacyFilteredQueue = useMemo(() => {
    // If using new server-side filtering (has org IDs) or is super admin, return all
    if (organizationIds.length > 0 || isSuperAdmin) {
      return approvalQueue
    }
    // Legacy behavior: filter by users in lookup
    return approvalQueue.filter(({ request }) => approvalUserLookup.has(request.user_id))
  }, [approvalQueue, approvalUserLookup, organizationIds, isSuperAdmin])

  const handleApprove = async (request: PointsVerificationRequest) => {
    setActionId(request.id)
    try {
      await approvePointsVerificationRequest({
        request,
        approver: {
          id: profile?.id ?? null,
          name: profile?.fullName ?? null,
        },
      })
      toast({
        title: 'Points approved',
        description: 'Points have been awarded and the request is now approved.',
        status: 'success',
        duration: 4000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Failed to approve points verification request', error)
      toast({
        title: 'Approval failed',
        description: 'We could not approve this request. Please retry.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      })
    } finally {
      setActionId(null)
    }
  }

  const handleReject = async (request: PointsVerificationRequest, reason?: string) => {
    setActionId(request.id)
    try {
      await rejectPointsVerificationRequest({
        request,
        approver: {
          id: profile?.id ?? null,
          name: profile?.fullName ?? null,
        },
        reason: reason || undefined,
      })
      toast({
        title: 'Request rejected',
        description: 'The submission has been rejected and points were not awarded.',
        status: 'info',
        duration: 4000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Failed to reject points verification request', error)
      toast({
        title: 'Rejection failed',
        description: 'We could not reject this request. Please retry.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      })
    } finally {
      setActionId(null)
    }
  }

  return {
    approvalQueue: legacyFilteredQueue,
    loading,
    error,
    actionId,
    handleApprove,
    handleReject,
  }
}
