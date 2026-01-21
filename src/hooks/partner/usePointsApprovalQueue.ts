import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@chakra-ui/react'
import {
  approvePointsVerificationRequest,
  listenToPointsVerificationRequests,
  rejectPointsVerificationRequest,
  type PointsVerificationRequest,
} from '@/services/pointsVerificationService'
import { PartnerUser } from '@/hooks/usePartnerDashboardData'
import { useAuth } from '@/hooks/useAuth'

export const usePointsApprovalQueue = (users: PartnerUser[], isVisible: boolean) => {
  const [verificationRequests, setVerificationRequests] = useState<PointsVerificationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const { profile } = useAuth()
  const toast = useToast()

  useEffect(() => {
    if (!isVisible) return

    const unsubscribe = listenToPointsVerificationRequests((items) => {
      setVerificationRequests(items)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [isVisible])

  const approvalUserLookup = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  )

  const approvalQueue = useMemo(() => {
    if (!verificationRequests.length) return []
    return verificationRequests
      .filter((request) => approvalUserLookup.has(request.user_id))
      .map((request) => ({
        request,
        user: approvalUserLookup.get(request.user_id)!
      }))
  }, [approvalUserLookup, verificationRequests])

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
    approvalQueue,
    loading,
    actionId,
    handleApprove,
    handleReject,
  }
}
