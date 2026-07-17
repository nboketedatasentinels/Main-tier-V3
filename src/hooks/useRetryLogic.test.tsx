import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useRetryLogic } from '@/hooks/useRetryLogic'

/**
 * Regression guard for the partner-dashboard request storm.
 *
 * usePartnerOrganizations / usePartnerAdminData pass a FRESH inline
 * `onMaxRetriesExceeded` (`() => setX([])`) on every render, and they put the
 * returned object in a useEffect dependency array. If that object changes
 * identity every render, the subscription effect re-runs every render and
 * re-fetches in an infinite loop (net::ERR_INSUFFICIENT_RESOURCES). The hook
 * must therefore return a STABLE object regardless of the callback's identity.
 */
describe('useRetryLogic', () => {
  it('returns a stable object across re-renders even with a fresh callback each render', () => {
    const { result, rerender } = renderHook(() =>
      // A new function literal every render - the exact pattern the partner hooks use.
      useRetryLogic({ maxRetries: 3, onMaxRetriesExceeded: () => undefined }),
    )

    const first = result.current
    rerender()
    rerender()
    rerender()

    // Same identity => effects depending on `retry` do not re-run => no loop.
    expect(result.current).toBe(first)
    expect(result.current.scheduleRetry).toBe(first.scheduleRetry)
  })

  it('still invokes the LATEST onMaxRetriesExceeded once retries are exhausted', () => {
    vi.useFakeTimers()
    try {
      const firstCb = vi.fn()
      const latestCb = vi.fn()
      let cb = firstCb

      const { result, rerender } = renderHook(() =>
        useRetryLogic({ maxRetries: 0, onMaxRetriesExceeded: cb }),
      )

      // Re-render with a different callback; the ref should track the latest.
      cb = latestCb
      rerender()

      act(() => {
        // maxRetries = 0 => the first failure immediately exceeds retries.
        result.current.scheduleRetry(
          new Error('denied'),
          () => undefined,
          () => undefined,
          () => undefined,
        )
      })

      expect(firstCb).not.toHaveBeenCalled()
      expect(latestCb).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
