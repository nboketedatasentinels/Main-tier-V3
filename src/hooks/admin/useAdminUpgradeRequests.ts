import { useCallback, useEffect, useState } from 'react'
import {
  fetchAdminPendingUpgradeRequests,
  fetchAdminUpgradeRequests,
  fetchAdminUserRequests,
  updateAdminUpgradeRequestStatus,
} from '@/services/admin/adminUpgradeService'
import { UpgradeRequest, UpgradeRequestStatus } from '@/types/upgrade'

export const useAllUpgradeRequests = () => {
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminUpgradeRequests()
      setRequests(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  return { requests, loading, error, refetch: fetchRequests }
}

export const useUpdateRequestStatus = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const mutate = useCallback(
    async (requestId: string, status: UpgradeRequestStatus, notes?: string, reviewedBy?: string) => {
      setLoading(true)
      setError(null)
      try {
        return await updateAdminUpgradeRequestStatus(requestId, status, notes, reviewedBy)
      } catch (err) {
        setError(err as Error)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { mutate, loading, error }
}

export const usePendingRequestCount = () => {
  const [count, setCount] = useState(0)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const pending = await fetchAdminPendingUpgradeRequests()
        setCount(pending.length)
        setError(null)
      } catch (err) {
        setError(err as Error)
      }
    }

    fetchCount()
  }, [])

  return { count, error }
}

export const useUserRequestsForAdmin = (userId: string | null | undefined) => {
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchRequests = async () => {
      if (!userId) return
      setLoading(true)
      setError(null)
      try {
        const data = await fetchAdminUserRequests(userId)
        setRequests(data)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchRequests()
  }, [userId])

  return { requests, loading, error }
}
