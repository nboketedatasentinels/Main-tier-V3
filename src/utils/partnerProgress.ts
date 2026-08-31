import { differenceInCalendarDays } from 'date-fns'
import { JOURNEY_META, type JourneyType } from '@/config/pointsConfig'
import {
 calculatePartnerWindowRisk,
 type PartnerWindowRiskResult,
 type WindowStatus,
} from '@/utils/windowStatus'

export interface WeeklyPointsRecord {
 user_id?: string
 week_number?: number
 points_earned?: number
 target_points?: number
 required_points?: number
}

export interface ProgressMappingResult {
 current_week: number
 earned_points: Record<number, number>
 required_points: Record<number, number>
}

export const getProgramWeekNumber = (startDate?: string): number => {
 if (!startDate) return 1
 const start = new Date(startDate)
 const now = new Date()
 const diffMs = now.getTime() - start.getTime()
 const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
 return Math.max(1, diffWeeks + 1)
}

export const mapWeeklyPointsToProgress = (
 weeklyPointsData: WeeklyPointsRecord[],
 currentWeek: number,
): ProgressMappingResult => {
 const earned_points: Record<number, number> = {}
 const required_points: Record<number, number> = {}

 weeklyPointsData.forEach((entry) => {
 const week = entry.week_number ?? 0
 if (!week) return

 earned_points[week] = entry.points_earned ?? 0
 required_points[week] = entry.required_points ?? entry.target_points ?? 0
 })

 return {
 current_week: currentWeek,
 earned_points,
 required_points,
 }
}

/**
 * Journey context for risk calculation.
 * Risk is based on the current 2-week window vs journey window target
 * (On Track / Warning / Alert / Recovery) - not lifetime pace ratio.
 */
export interface JourneyContext {
 journeyType: string | null
 totalPoints: number
 programDurationWeeks?: number | null
 previousWindowStatus?: WindowStatus | null
}

export type RiskLevel = 'critical' | 'behind' | 'warning' | 'on_track'

export interface RiskResult {
 status: 'at_risk' | 'on_track'
 level: RiskLevel
 reason?: string
 points_deficit?: number
 /** @deprecated Prefer windowRatio - kept for older call sites. */
 paceRatio?: number
 windowRatio?: number
 windowStatus?: WindowStatus
}

/**
 * Calculates partner/admin risk from the current 2-week window.
 *
 * Thresholds (universal):
 * On Track ≥ 100% of window target
 * Warning 75% - 99%
 * Alert < 75% → at_risk only in week 2 of the window
 * Recovery ≥ 100% after Alert
 *
 * False-alarm guards live in calculatePartnerWindowRisk.
 */
export const calculateUserRiskStatus = (
 currentWeek: number,
 earnedPoints: Record<number, number>,
 _requiredPoints: Record<number, number>,
 _nudgeResponsivenessScore?: number,
 journeyContext?: JourneyContext,
): RiskResult => {
 const result: PartnerWindowRiskResult = calculatePartnerWindowRisk({
 journeyType: (journeyContext?.journeyType as JourneyType | null) ?? null,
 currentWeek,
 totalPoints: journeyContext?.totalPoints ?? 0,
 earnedPointsByWeek: earnedPoints,
 previousWindowStatus: journeyContext?.previousWindowStatus,
 programDurationWeeks: journeyContext?.programDurationWeeks,
 })

 return {
 status: result.status,
 level: result.level,
 reason: result.reason,
 points_deficit: result.points_deficit,
 paceRatio: result.windowRatio,
 windowRatio: result.windowRatio,
 windowStatus: result.windowStatus,
 }
}

export const build14DayRegistrationTrend = (
 registrationDates: (string | undefined)[],
): { label: string; value: number }[] => {
 const start = new Date()
 start.setDate(start.getDate() - 13)

 const buckets = Array.from({ length: 14 }, (_, idx) => ({
 date: new Date(start.getTime() + idx * 24 * 60 * 60 * 1000),
 value: 0,
 }))

 registrationDates.forEach((dateString) => {
 if (!dateString) return
 const date = new Date(dateString)
 if (Number.isNaN(date.getTime())) return
 const dayIndex = differenceInCalendarDays(date, start)
 if (!Number.isInteger(dayIndex)) return
 if (dayIndex < 0 || dayIndex >= 14) return
 buckets[dayIndex].value += 1
 })

 return buckets.map((bucket) => ({
 label: `${bucket.date.getMonth() + 1}/${bucket.date.getDate()}`,
 value: bucket.value,
 }))
}

/** Convenience: window target for a journey (product sheet). */
export const getWindowTargetForJourney = (journeyType: JourneyType): number =>
 JOURNEY_META[journeyType].windowTarget
