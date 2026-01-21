import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { fetchPartnerAdminSnapshot } from '@/services/partnerAdminDataService'
import type { DashboardDebugInfo } from '@/utils/partnerDashboardUtils'
import type { PartnerAdminDataSnapshot, PartnerAdminSnapshot } from '@/types/admin'

export const usePartnerAdminData = (
  partnerId?: string | null,
): {
  snapshot: PartnerAdminDataSnapshot | null
  loading: boolean
  error: string | null
  refresh: () => void
  debugInfo: DashboardDebugInfo | null
} => {
  const [snapshot, setSnapshot] = useState<PartnerAdminDataSnapshot | null>(null)
  const [loading, setLoading] = useState<boolean>(() => !!partnerId)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const debugInfo: DashboardDebugInfo | null = null

  const refresh = useCallback(() => {
    setRefreshIndex((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!partnerId) {
      setSnapshot(null)
      setLoading(false)
      setError(null)
      return
    }

    let isActive = true

    setLoading(true)
    setError(null)

    const partnerRef = doc(db, 'partners', partnerId)
    const unsubscribe = onSnapshot(
      partnerRef,
      async (docSnap) => {
        if (!isActive) return
        if (!docSnap.exists()) {
          setSnapshot(null)
          setLoading(false)
          return
        }

        try {
          const data = docSnap.data() as PartnerAdminSnapshot
          const nextSnapshot = await fetchPartnerAdminSnapshot(partnerId, data)
          if (!isActive) return
          setSnapshot(nextSnapshot)
          setLoading(false)
        } catch (err) {
          console.error('[PartnerAdminData] Failed to load partner admin data', err)
          if (!isActive) return
          setSnapshot(null)
          setError('Unable to load partner admin data.')
          setLoading(false)
        }
      },
      (err) => {
        console.error('[PartnerAdminData] Failed to subscribe to partner admin data', err)
        if (!isActive) return
        setSnapshot(null)
        setError('Unable to load partner admin data.')
        setLoading(false)
      },
    )

    return () => {
      isActive = false
      unsubscribe()
    }
  }, [partnerId, refreshIndex])

  return { snapshot, loading, error, refresh, debugInfo }
}
