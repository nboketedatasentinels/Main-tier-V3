import { useMemo } from 'react'
import { useAuth } from './useAuth'
import { JOURNEY_META } from '@/config/pointsConfig'
import {
  getWindowNumber,
  getWindowRange,
  getWindowTargetByJourney,
  PARALLEL_WINDOW_SIZE_WEEKS,
} from '@/utils/windowCalculations'

export interface WindowContext {
  windowNumber: number
  startWeek: number
  endWeek: number
  windowTarget: number
  journeyType: string
  currentWeek: number
}

export const useCurrentWindow = (): WindowContext | null => {
  const { profile } = useAuth()

  return useMemo(() => {
    if (!profile?.journeyType || !profile?.currentWeek) {
      return null
    }

    const journeyMeta = JOURNEY_META[profile.journeyType]
    const windowNumber = getWindowNumber(profile.currentWeek, PARALLEL_WINDOW_SIZE_WEEKS)
    const { startWeek, endWeek } = getWindowRange(
      profile.currentWeek,
      journeyMeta.weeks,
      PARALLEL_WINDOW_SIZE_WEEKS
    )
    const windowTarget = getWindowTargetByJourney(profile.journeyType, journeyMeta.weeklyTarget)

    return {
      windowNumber,
      startWeek,
      endWeek,
      windowTarget,
      journeyType: profile.journeyType,
      currentWeek: profile.currentWeek,
    }
  }, [profile?.journeyType, profile?.currentWeek])
}
