import { useEffect, useState, useMemo } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { getWindowNumber, PARALLEL_WINDOW_SIZE_WEEKS, getWindowTargetByJourney } from '@/utils/windowCalculations'
import { getCurrentWeekNumber } from '@/utils/weekCalculations'
import { JOURNEY_META } from '@/config/pointsConfig'
import type { WindowProgress } from '@/types'

export const useWindowProgress = () => {
  const { profile } = useAuth()
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

  useEffect(() => {
    if (!profile?.id || !profile?.journeyType) {
      if (profile && !profile.id) {
         setLoading(false)
      }
      return
    }

    const docId = `${profile.id}__${profile.journeyType}__${windowNumber}`
    const docRef = doc(db, 'windowProgress', docId)

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData(snapshot.data() as WindowProgress)
        } else {
          // Fallback if doc doesn't exist yet
          const journeyMeta = JOURNEY_META[profile.journeyType as keyof typeof JOURNEY_META]
          const weeklyTarget = journeyMeta?.weeklyTarget || 0
          const windowTarget = getWindowTargetByJourney(profile.journeyType, weeklyTarget)

          setData({
            uid: profile.id,
            journeyType: profile.journeyType,
            windowNumber,
            pointsEarned: 0,
            windowTarget,
            status: 'alert',
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
  }, [profile?.id, profile?.journeyType, windowNumber])

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
    windowNumber,
    totalWindows
  }
}
