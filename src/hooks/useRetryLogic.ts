import { useCallback, useRef } from 'react'
import { formatAdminFirestoreError } from '@/services/admin/adminErrors'

// ============================================================================
// FIX #4 & #8: Proper retry logic that handles stale closures and prevents
// infinite loops by tracking retry state properly
// ============================================================================

interface UseRetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  onMaxRetriesExceeded?: (error: unknown) => void
}

interface RetryState {
  attempts: number
  timeoutId: ReturnType<typeof setTimeout> | null
  isMounted: boolean
}

export const useRetryLogic = (options: UseRetryOptions = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 8000,
    onMaxRetriesExceeded,
  } = options

  const stateRef = useRef<RetryState>({
    attempts: 0,
    timeoutId: null,
    isMounted: true,
  })

  const reset = useCallback(() => {
    stateRef.current.attempts = 0
    if (stateRef.current.timeoutId) {
      clearTimeout(stateRef.current.timeoutId)
      stateRef.current.timeoutId = null
    }
  }, [])

  const setMounted = useCallback((mounted: boolean) => {
    stateRef.current.isMounted = mounted
    if (!mounted) {
      reset()
    }
  }, [reset])

  const scheduleRetry = useCallback(
    (
      error: unknown,
      retryFn: () => void,
      setError: (error: string | null) => void,
      setLoading: (loading: boolean) => void,
    ): boolean => {
      if (!stateRef.current.isMounted) return false

      const nextAttempt = stateRef.current.attempts + 1

      if (nextAttempt > maxRetries) {
        const errorMessage = formatAdminFirestoreError(
          error,
          'Unable to load data. Please try again.',
          { indexMessage: 'Missing Firestore index required for this query.' }
        )
        setError(errorMessage)
        setLoading(false)
        onMaxRetriesExceeded?.(error)
        return false
      }

      stateRef.current.attempts = nextAttempt
      const delay = Math.min(baseDelay * 2 ** (nextAttempt - 1), maxDelay)

      const errorMessage = formatAdminFirestoreError(
        error,
        `Unable to load data. Retrying (${nextAttempt}/${maxRetries})...`,
        { indexMessage: 'Missing Firestore index required for this query.' }
      )
      setError(errorMessage)

      // Clear any existing timeout before scheduling new one
      if (stateRef.current.timeoutId) {
        clearTimeout(stateRef.current.timeoutId)
      }

      stateRef.current.timeoutId = setTimeout(() => {
        if (!stateRef.current.isMounted) return
        stateRef.current.timeoutId = null
        retryFn()
      }, delay)

      return true
    },
    [maxRetries, baseDelay, maxDelay, onMaxRetriesExceeded]
  )

  const cleanup = useCallback(() => {
    setMounted(false)
  }, [setMounted])

  return {
    reset,
    setMounted,
    scheduleRetry,
    cleanup,
    getAttempts: () => stateRef.current.attempts,
  }
}
