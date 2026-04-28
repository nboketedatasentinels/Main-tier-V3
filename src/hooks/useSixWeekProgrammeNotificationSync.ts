import { useEffect, useRef } from 'react'
import {
  syncSixWeekNotificationsForUser,
  type SixWeekSyncResult,
} from '@/services/sixWeekProgrammeNotificationScheduler'
import { useAuth } from './useAuth'

declare global {
  interface Window {
    __t4lSixWeekSync?: () => Promise<SixWeekSyncResult | null>
    __t4lLastSixWeekSync?: SixWeekSyncResult
  }
}

export const useSixWeekProgrammeNotificationSync = (): void => {
  const { profile } = useAuth()
  const lastSyncedUidRef = useRef<string | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    const uid = profile?.id
    if (!uid) {
      lastSyncedUidRef.current = null
      return
    }

    const runSync = async (): Promise<SixWeekSyncResult | null> => {
      if (inFlightRef.current) return null
      inFlightRef.current = true
      try {
        const result = await syncSixWeekNotificationsForUser(uid)
        window.__t4lLastSixWeekSync = result
        if (result.fired > 0) {
          console.info(
            `%c[6w-scheduler] fired ${result.fired} of ${result.attempted} (emails=${result.emailsSent}, pushBuzz=${result.pushesBuzzed})`,
            'color:#f4540c;font-weight:bold',
            result,
          )
        } else {
          console.info(
            `%c[6w-scheduler] nothing fired — ${result.reason ?? 'unknown'}`,
            'color:#888',
            result,
          )
        }
        return result
      } catch (err) {
        console.error('[6w-scheduler] sync failed', err)
        return null
      } finally {
        inFlightRef.current = false
      }
    }

    window.__t4lSixWeekSync = runSync

    if (lastSyncedUidRef.current !== uid) {
      lastSyncedUidRef.current = uid
      void runSync()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void runSync()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [profile?.id])
}
