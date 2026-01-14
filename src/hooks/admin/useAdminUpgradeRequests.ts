import { useCallback, useEffect, useState } from 'react'
import {
  fetchAdminPendingUpgradeRequests,
  fetchAdminUpgradeRequests,
  fetchAdminUserRequests,
  updateAdminUpgradeRequestStatus,
} from '@/services/admin/adminUpgradeService'
import { UpgradeRequest, UpgradeRequestStatus } from '@/types/upgrade'
import { useAuth } from '@/hooks/useAuth'

export const useAllUpgradeRequests = () => {
  const { isAdmin } = useAuth()
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminUpgradeRequests(isAdmin)
      setRequests(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  return { requests, loading, error, refetch: fetchRequests }
}

export const useUpdateRequestStatus = () => {
  const { isAdmin } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const mutate = useCallback(
    async (requestId: string, status: UpgradeRequestStatus, notes?: string, reviewedBy?: string) => {
      setLoading(true)
      setError(null)
      try {
        return await updateAdminUpgradeRequestStatus(isAdmin, requestId, status, notes, reviewedBy)
      } catch (err) {
        setError(err as Error)
        return null
      } finally {
        setLoading(false)
      }
    },
    [isAdmin]
  )

  return { mutate, loading, error }
}

export const usePendingRequestCount = () => {
  const { isAdmin } = useAuth()
  const [count, setCount] = useState(0)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const pending = await fetchAdminPendingUpgradeRequests(isAdmin)
        setCount(pending.length)
        setError(null)
      } catch (err) {
        setError(err as Error)
      }
    }

    fetchCount()
  }, [isAdmin])

  return { count, error }
}

export const useUserRequestsForAdmin = (userId: string | null | undefined) => {
  const { isAdmin } = useAuth()
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchRequests = async () => {
      if (!userId) return
      setLoading(true)
      setError(null)
      try {
        const data = await fetchAdminUserRequests(isAdmin, userId)
        setRequests(data)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchRequests()
  }, [isAdmin, userId])

  return { requests, loading, error }
}
