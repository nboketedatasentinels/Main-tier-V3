export type MonthlyCourseAssignments = Record<string, string>

export type MonthlyAssignmentMode = 'monthly' | 'array'

const cleanCourseId = (value?: string | null): string => {
  if (!value) return ''
  const trimmed = value.trim()
  return trimmed
}

export const resolveProgramMonthCount = (programDuration?: number | string | null): number => {
  if (programDuration === undefined || programDuration === null) return 0
  const parsed = typeof programDuration === 'string' ? Number(programDuration) : programDuration
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  if (parsed === 1.5) return 3
  return Math.ceil(parsed)
}

export const buildMonthlyAssignmentsFromArray = (
  courseAssignments: string[] = [],
  totalMonths: number,
): MonthlyCourseAssignments => {
  const assignments: MonthlyCourseAssignments = {}
  const cleaned = courseAssignments.map(cleanCourseId).filter(Boolean)
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

export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

export const getMonthDateRange = (cohortStartDate: Date, monthIndex: number) => {
  const startDate = addMonths(cohortStartDate, monthIndex)
  const endDate = addMonths(cohortStartDate, monthIndex + 1)
  return { startDate, endDate }
}

export type MonthlyCourseAvailability = 'locked' | 'current' | 'completed'

export const getMonthAvailabilityStatus = (params: {
  cohortStartDate: Date | null
  currentDate: Date
  monthIndex: number
}): MonthlyCourseAvailability => {
  const { cohortStartDate, currentDate, monthIndex } = params
  if (!cohortStartDate) {
    return monthIndex === 0 ? 'current' : 'locked'
  }

  const { startDate, endDate } = getMonthDateRange(cohortStartDate, monthIndex)
  if (currentDate < startDate) return 'locked'
  if (currentDate >= endDate) return 'completed'
  return 'current'
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
