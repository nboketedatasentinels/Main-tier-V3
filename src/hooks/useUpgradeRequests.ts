import { useCallback, useEffect, useState } from 'react'
import {
  checkPendingRequest,
  createUpgradeRequest,
  getUserUpgradeRequests,
} from '@/services/upgradeRequestService'
import { UpgradeRequest, UpgradeRequestForm } from '@/types/upgrade'

export const useUserUpgradeRequests = (userId: string | null | undefined) => {
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchRequests = async () => {
      if (!userId) return
      setLoading(true)
      setError(null)
      try {
        const data = await getUserUpgradeRequests(userId)
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

export const useCreateUpgradeRequest = (userId: string | null | undefined) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastRequest, setLastRequest] = useState<UpgradeRequest | null>(null)

  const submit = useCallback(
    async (form: UpgradeRequestForm) => {
      if (!userId) {
        setError(new Error('User is required'))
        return null
      }
      setLoading(true)
      setError(null)
      try {
        const request = await createUpgradeRequest(userId, form)
        setLastRequest(request)
        return request
      } catch (err) {
        setError(err as Error)
        return null
      } finally {
        setLoading(false)
      }
    },
    [userId]
  )

  return { submit, loading, error, lastRequest }
}

export const usePendingUpgradeRequest = (userId: string | null | undefined) => {
  const [pendingRequest, setPendingRequest] = useState<UpgradeRequest | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadPending = async () => {
      if (!userId) return
      setLoading(true)
      try {
        const request = await checkPendingRequest(userId)
        setPendingRequest(request)
      } finally {
        setLoading(false)
      }
    }

    loadPending()
  }, [userId])

  return { pendingRequest, loading }
}
