import { useEffect, useState, useMemo } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import {
  getWindowNumber,
  getWindowWeekNumber,
  PARALLEL_WINDOW_SIZE_WEEKS,
  getWindowTargetByJourney
} from '@/utils/windowCalculations'
import { getCurrentWeekNumber } from '@/utils/weekCalculations'
import { JOURNEY_META } from '@/config/pointsConfig'
import type { WindowProgress } from '@/types'

export const useWindowProgress = () => {
  const { profile } = useAuth()
  const profileId = profile?.id
  const journeyType = profile?.journeyType
  const [data, setData] = useState<WindowProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const currentWeek = useMemo(() => {
    return (profile?.currentWeek && profile.currentWeek > 0)
      ? profile.currentWeek
      : getCurrentWeekNumber()
  }, [profile?.currentWeek])

  const windowNumber = useMemo(() => {
    return getWindowNumber(currentWeek, PARALLEL_WINDOW_SIZE_WEEKS)
  }, [currentWeek])

  const windowWeek = useMemo(() => {
    return getWindowWeekNumber(currentWeek, PARALLEL_WINDOW_SIZE_WEEKS)
  }, [currentWeek])

  useEffect(() => {
    if (!profileId || !journeyType) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const docId = `${profileId}__${journeyType}__${windowNumber}`
    const docRef = doc(db, 'windowProgress', docId)

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const windowData = snapshot.data() as WindowProgress

          // 6W journey fix: Don't show alert in weeks 1-4 (at-risk starts at week 5)
          if (journeyType === '6W' && currentWeek <= 4) {
            if (windowData.status === 'alert') {
              setData({ ...windowData, status: 'warning' })
            } else {
              setData(windowData)
            }
          } else {
            setData(windowData)
          }
        } else {
          // Fallback if doc doesn't exist yet
          const journeyMeta = JOURNEY_META[journeyType as keyof typeof JOURNEY_META]
          const weeklyTarget = journeyMeta?.weeklyTarget || 0
          const windowTarget = getWindowTargetByJourney(journeyType, weeklyTarget)

          // 6W journey: Use 'warning' not 'alert' for weeks 1-4 (at-risk starts at week 5)
          const defaultStatus = (journeyType === '6W' && currentWeek <= 4) ? 'warning' : 'alert'

          setData({
            uid: profileId,
            journeyType,
            windowNumber,
            pointsEarned: 0,
            windowTarget,
            status: defaultStatus,
          })
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching window progress:', err)
        setError(err as Error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [profileId, journeyType, windowNumber])

  const totalWindows = useMemo(() => {
    if (!profile?.journeyType) return 0
    const journeyMeta = JOURNEY_META[profile.journeyType as keyof typeof JOURNEY_META]
    if (!journeyMeta) return 0
    return Math.ceil(journeyMeta.weeks / PARALLEL_WINDOW_SIZE_WEEKS)
  }, [profile?.journeyType])

  return {
    data,
    loading,
    error,
    currentWeek,
    windowWeek,
    windowNumber,
    totalWindows
  }
}
