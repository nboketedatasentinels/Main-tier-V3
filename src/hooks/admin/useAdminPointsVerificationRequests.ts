import { useEffect, useState } from 'react'
import {
  listenToAllPointsVerificationRequests,
  PointsVerificationRequest,
  PointsVerificationRequestStatus,
} from '@/services/pointsVerificationService'

export const useAdminPointsVerificationRequests = (
  status: PointsVerificationRequestStatus | 'all' = 'all',
  limitCount?: number,
) => {
  const [requests, setRequests] = useState<PointsVerificationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const unsubscribe = listenToAllPointsVerificationRequests(
      (items) => {
        setRequests(items)
        setLoading(false)
      },
      { status, limit: limitCount },
      (err) => {
        setError(err as Error)
        setLoading(false)
      },
    )
    return () => unsubscribe()
  }, [limitCount, status])

  return { requests, loading, error }
}
