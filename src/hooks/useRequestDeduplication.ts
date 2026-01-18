import { useCallback, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Hook for request deduplication with caching
 * Prevents duplicate requests for the same data and caches results with TTL
 *
 * @param fetchFn - The async function to execute
 * @param cacheKey - Unique identifier for this request
 * @param ttl - Time-to-live in milliseconds (default: 60000 = 1 minute)
 * @returns Memoized fetch function that handles deduplication
 */
export function useRequestDeduplication<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
  ttl: number = 60000
) {
  const cache = useRef<Map<string, CacheEntry<T>>>(new Map());
  const pendingRequests = useRef<Map<string, Promise<T>>>(new Map());

  const fetch = useCallback(async (): Promise<T> => {
    // Check cache first
    const cached = cache.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      console.debug(`[useRequestDeduplication] Cache hit for key: ${cacheKey}`);
      return cached.data;
    }

    // Check if request is already pending
    const pending = pendingRequests.current.get(cacheKey);
    if (pending) {
      console.debug(`[useRequestDeduplication] Request already pending for key: ${cacheKey}`);
      return pending;
    }

    // Execute new request
    console.debug(`[useRequestDeduplication] Executing new request for key: ${cacheKey}`);
    const promise = fetchFn();
    pendingRequests.current.set(cacheKey, promise);

    try {
      const data = await promise;

      // Store in cache
      cache.current.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      return data;
    } catch (error) {
      // Don't cache errors
      console.error(`[useRequestDeduplication] Request failed for key: ${cacheKey}`, error);
      throw error;
    } finally {
      // Remove from pending
      pendingRequests.current.delete(cacheKey);
    }
  }, [fetchFn, cacheKey, ttl]);

  const invalidateCache = useCallback(() => {
    cache.current.delete(cacheKey);
    console.debug(`[useRequestDeduplication] Cache invalidated for key: ${cacheKey}`);
  }, [cacheKey]);

  const clearAllCache = useCallback(() => {
    cache.current.clear();
    console.debug('[useRequestDeduplication] All cache cleared');
  }, []);

  return {
    fetch,
    invalidateCache,
    clearAllCache,
  };
}

/**
 * Hook for AbortController-based request cancellation
 * Useful for cancelling in-flight requests when component unmounts
 *
 * @returns Object with signal for fetch and abort function
 */
export function useAbortController() {
  const controllerRef = useRef<AbortController | null>(null);

  const getSignal = useCallback(() => {
    // Abort any existing request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    // Create new controller
    controllerRef.current = new AbortController();
    return controllerRef.current.signal;
  }, []);

  const abort = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  return { getSignal, abort };
}
