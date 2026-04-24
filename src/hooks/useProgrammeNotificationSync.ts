import { useEffect, useRef } from 'react'
import {
  syncProgrammeNotificationsForUser,
  type ProgrammeSyncResult,
} from '@/services/programmeNotificationScheduler'
import { useAuth } from './useAuth'

declare global {
  interface Window {
    __t4lProgrammeSync?: () => Promise<ProgrammeSyncResult | null>
    __t4lLastProgrammeSync?: ProgrammeSyncResult
  }
}

export const useProgrammeNotificationSync = (): void => {
  const { profile } = useAuth()
  const lastSyncedUidRef = useRef<string | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    const uid = profile?.id
    if (!uid) {
      lastSyncedUidRef.current = null
      return
    }

    const runSync = async (): Promise<ProgrammeSyncResult | null> => {
      if (inFlightRef.current) return null
      inFlightRef.current = true
      try {
        const result = await syncProgrammeNotificationsForUser(uid)
        window.__t4lLastProgrammeSync = result
        if (result.fired > 0) {
          console.info(
            `%c[programmeScheduler] fired ${result.fired} of ${result.attempted}`,
            'color:#f4540c;font-weight:bold',
            result,
          )
        } else {
          console.info(
            `%c[programmeScheduler] nothing fired — ${result.reason ?? 'unknown'}`,
            'color:#888',
            result,
          )
        }
        return result
      } catch (err) {
        console.error('[programmeScheduler] sync failed', err)
        return null
      } finally {
        inFlightRef.current = false
      }
    }

    window.__t4lProgrammeSync = runSync

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
