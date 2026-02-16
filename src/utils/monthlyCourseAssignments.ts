export type MonthlyCourseAssignments = Record<string, string>

export type MonthlyAssignmentMode = 'monthly' | 'array'
export type ProgramSegmentCadence = 'monthly' | 'biweekly'

const cleanCourseId = (value?: string | null): string => {
  if (!value) return ''
  const trimmed = value.trim()
  return trimmed
}

const BIWEEKLY_PROGRAM_DURATION = 1.5
const MAX_SUPPORTED_PROGRAM_MONTHS = 9

const normalizeProgramDuration = (programDuration?: number | string | null): number | null => {
  if (programDuration === undefined || programDuration === null) return null
  const parsed = typeof programDuration === 'string' ? Number(programDuration) : programDuration
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  if (Math.abs(parsed - BIWEEKLY_PROGRAM_DURATION) < 0.0001) return BIWEEKLY_PROGRAM_DURATION
  return Math.min(parsed, MAX_SUPPORTED_PROGRAM_MONTHS)
}

const isBiweeklyProgramDuration = (programDuration?: number | string | null): boolean => {
  const parsed = normalizeProgramDuration(programDuration)
  if (parsed === null) return false
  return Math.abs(parsed - BIWEEKLY_PROGRAM_DURATION) < 0.0001
}

export const resolveProgramCadence = (programDuration?: number | string | null): ProgramSegmentCadence => (
  isBiweeklyProgramDuration(programDuration) ? 'biweekly' : 'monthly'
)

export const getProgramDurationLabel = (programDuration?: number | string | null): string | null => {
  const parsed = normalizeProgramDuration(programDuration)
  if (parsed === null) return null
  if (isBiweeklyProgramDuration(parsed)) return '6 weeks (3 x 2-week windows)'
  const display = Number.isInteger(parsed) ? parsed.toString() : parsed.toFixed(1)
  return `${display} months`
}

export const resolveProgramMonthCount = (programDuration?: number | string | null): number => {
  const parsed = normalizeProgramDuration(programDuration)
  if (parsed === null) return 0
  if (isBiweeklyProgramDuration(parsed)) return 3
  return Math.ceil(parsed)
}

export const buildMonthlyAssignmentsFromArray = (
  courseAssignments: string[] = [],
  totalMonths: number,
): MonthlyCourseAssignments => {
  const assignments: MonthlyCourseAssignments = {}
  const cleaned = courseAssignments.map(cleanCourseId)
  for (let index = 0; index < totalMonths; index += 1) {
    assignments[String(index + 1)] = cleaned[index] || ''
  }
  return assignments
}

const normalizeMonthlyAssignmentsMap = (
  monthlyCourseAssignments: MonthlyCourseAssignments,
  totalMonths: number,
): MonthlyCourseAssignments => {
  const normalized: MonthlyCourseAssignments = {}
  for (let index = 0; index < totalMonths; index += 1) {
    const key = String(index + 1)
    normalized[key] = cleanCourseId(monthlyCourseAssignments[key])
  }
  return normalized
}

export const normalizeMonthlyAssignments = (params: {
  monthlyCourseAssignments?: MonthlyCourseAssignments | null
  courseAssignments?: string[] | null
  programDuration?: number | string | null
}): {
  monthlyAssignments: MonthlyCourseAssignments
  totalMonths: number
  assignmentMode: MonthlyAssignmentMode
} => {
  const { monthlyCourseAssignments, courseAssignments, programDuration } = params
  const monthlyCount = monthlyCourseAssignments ? Object.keys(monthlyCourseAssignments).length : 0
  const arrayCount = courseAssignments?.length ?? 0
  const durationCount = resolveProgramMonthCount(programDuration)
  const totalMonths = Math.max(monthlyCount, arrayCount, durationCount)

  if (!totalMonths) {
    return {
      monthlyAssignments: {},
      totalMonths: 0,
      assignmentMode: monthlyCourseAssignments && monthlyCount ? 'monthly' : 'array',
    }
  }

  const baseAssignments =
    monthlyCourseAssignments && monthlyCount
      ? monthlyCourseAssignments
      : buildMonthlyAssignmentsFromArray(courseAssignments || [], totalMonths)

  return {
    monthlyAssignments: normalizeMonthlyAssignmentsMap(baseAssignments, totalMonths),
    totalMonths,
    assignmentMode: monthlyCourseAssignments && monthlyCount ? 'monthly' : 'array',
  }
}

export const getMonthlyAssignmentsArray = (
  monthlyAssignments: MonthlyCourseAssignments,
  totalMonths: number,
): string[] => {
  return Array.from({ length: totalMonths }, (_, index) => {
    const key = String(index + 1)
    return monthlyAssignments[key] || ''
  })
}

export const getAssignedCourseIdsFromMonthlyAssignments = (
  monthlyAssignments: MonthlyCourseAssignments,
  totalMonths: number,
): string[] => getMonthlyAssignmentsArray(monthlyAssignments, totalMonths).filter(Boolean)

export const getAssignedCourseCountFromMonthlyAssignments = (
  monthlyAssignments: MonthlyCourseAssignments,
  totalMonths: number,
): number => getAssignedCourseIdsFromMonthlyAssignments(monthlyAssignments, totalMonths).length

export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export const getProgramSegmentDateRange = (params: {
  cohortStartDate: Date
  segmentIndex: number
  cadence: ProgramSegmentCadence
}) => {
  const { cohortStartDate, segmentIndex, cadence } = params
  if (cadence === 'biweekly') {
    const startDate = addDays(cohortStartDate, segmentIndex * 14)
    const endDate = addDays(cohortStartDate, (segmentIndex + 1) * 14)
    return { startDate, endDate }
  }
  const startDate = addMonths(cohortStartDate, segmentIndex)
  const endDate = addMonths(cohortStartDate, segmentIndex + 1)
  return { startDate, endDate }
}

export const getMonthDateRange = (cohortStartDate: Date, monthIndex: number) => {
  return getProgramSegmentDateRange({
    cohortStartDate,
    segmentIndex: monthIndex,
    cadence: 'monthly',
  })
}

export type MonthlyCourseAvailability = 'locked' | 'current' | 'completed'

export const getProgramSegmentAvailabilityStatus = (params: {
  cohortStartDate: Date | null
  currentDate: Date
  segmentIndex: number
  cadence: ProgramSegmentCadence
}): MonthlyCourseAvailability => {
  const { cohortStartDate, currentDate, segmentIndex, cadence } = params
  if (!cohortStartDate) {
    return segmentIndex === 0 ? 'current' : 'locked'
  }

  const { startDate, endDate } = getProgramSegmentDateRange({
    cohortStartDate,
    segmentIndex,
    cadence,
  })
  if (currentDate < startDate) return 'locked'
  if (currentDate >= endDate) return 'completed'
  return 'current'
}

export const getMonthAvailabilityStatus = (params: {
  cohortStartDate: Date | null
  currentDate: Date
  monthIndex: number
}): MonthlyCourseAvailability => {
  const { cohortStartDate, currentDate, monthIndex } = params
  return getProgramSegmentAvailabilityStatus({
    cohortStartDate,
    currentDate,
    segmentIndex: monthIndex,
    cadence: 'monthly',
  })
}

export const formatMonthRange = (startDate: Date, endDate: Date) => {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const endDisplay = new Date(endDate)
  endDisplay.setDate(endDisplay.getDate() - 1)
  return `${formatter.format(startDate)} – ${formatter.format(endDisplay)}`
}

export const buildMonthlyAssignmentsSummary = (params: {
  monthlyAssignments: MonthlyCourseAssignments
  totalMonths: number
  courseTitleLookup?: (courseId: string) => string
}): { month: number; courseId: string; title: string }[] => {
  const { monthlyAssignments, totalMonths, courseTitleLookup } = params
  return Array.from({ length: totalMonths }, (_, index) => {
    const courseId = monthlyAssignments[String(index + 1)] || ''
    return {
      month: index + 1,
      courseId,
      title: courseId ? courseTitleLookup?.(courseId) ?? courseId : 'Unassigned',
    }
  })
}

export const getProgramSegmentLabel = (segmentNumber: number, cadence: ProgramSegmentCadence): string => {
  if (cadence === 'biweekly') return `Window ${segmentNumber}`
  return `Month ${segmentNumber}`
}

export const migrateAssignmentsToMonthlyStructure = (params: {
  courseAssignments: string[]
  programDuration?: number | string | null
}): {
  monthlyCourseAssignments: MonthlyCourseAssignments
  courseAssignmentStructure: MonthlyAssignmentMode
} => {
  const { courseAssignments, programDuration } = params
  const totalMonths = Math.max(courseAssignments.length, resolveProgramMonthCount(programDuration))
  return {
    monthlyCourseAssignments: buildMonthlyAssignmentsFromArray(courseAssignments, totalMonths),
    courseAssignmentStructure: 'monthly',
  }
}
