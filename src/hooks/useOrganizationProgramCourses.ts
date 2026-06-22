import { useEffect, useState } from 'react'
import { getOrganizationProgram } from '@/services/supabaseOrgService'
import {
  MonthlyCourseAssignments,
  getMonthlyAssignmentsArray,
  normalizeMonthlyAssignments,
} from '@/utils/monthlyCourseAssignments'
import { resolveCourseIdFromMapping } from '@/utils/courseMappings'
import { normalizeDurationWeeks, resolveDurationWeeksFromProgramDuration, resolveJourneyType } from '@/utils/journeyType'
import { JOURNEY_META, type JourneyType } from '@/config/pointsConfig'
import { isPillar, type Pillar } from '@/types/pillar'

interface OrganizationProgram {
  monthlyAssignments: MonthlyCourseAssignments
  totalMonths: number
  cohortStartDate: Date | null
  orderedCourseIds: string[]
  courseAssignments: string[]
  journeyType: JourneyType | null
  programDurationWeeks: number | null
  pillar: Pillar | null
}

const normalizeDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return isNaN(parsed.getTime()) ? null : parsed
  }
  if (typeof value === 'object' && (value as { toDate?: () => Date }).toDate) {
    return (value as { toDate: () => Date }).toDate()
  }
  return null
}

const normalizeCourseAssignmentArray = (input?: unknown): string[] => {
  if (!Array.isArray(input)) return []
  return input.map(value => (typeof value === 'string' ? resolveCourseIdFromMapping(value) : ''))
}

const normalizeMonthlyAssignmentsFromMapping = (
  monthlyAssignments: MonthlyCourseAssignments,
  totalMonths: number,
): MonthlyCourseAssignments => {
  const mapped: MonthlyCourseAssignments = {}
  for (let index = 0; index < totalMonths; index += 1) {
    const key = String(index + 1)
    mapped[key] = resolveCourseIdFromMapping(monthlyAssignments[key])
  }
  return mapped
}

const isMonthlyCourseAssignments = (value: unknown): value is MonthlyCourseAssignments => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value as Record<string, unknown>).every(
    entry => entry === undefined || entry === null || typeof entry === 'string'
  )
}

export const useOrganizationProgramCourses = (organizationId: string | null) => {
  const [program, setProgram] = useState<OrganizationProgram | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) {
      setProgram(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    let cancelled = false

    // Org program now lives in Supabase (the Firebase org doc was deleted in the
    // migration). Journey fields are columns; course assignments + pillar live in
    // the settings jsonb. Field names match the old Firestore shape so the
    // normalization below is unchanged.
    void getOrganizationProgram(organizationId)
      .then(data => {
        if (cancelled) return
        if (!data) {
          setProgram(null)
          setLoading(false)
          return
        }

        const programDuration: number | null = data.programDuration ?? null
        const rawMonthlyAssignments = data.monthlyCourseAssignments
        const monthlyCourseAssignments = isMonthlyCourseAssignments(rawMonthlyAssignments)
          ? rawMonthlyAssignments
          : null
        const courseAssignments = normalizeCourseAssignmentArray(data.courseAssignments)
        const programDurationWeeks =
          normalizeDurationWeeks(data.programDurationWeeks) ?? resolveDurationWeeksFromProgramDuration(programDuration)
        const journeyType = resolveJourneyType({
          journeyType: data.journeyType,
          programDurationWeeks,
          programDuration,
        })
        const { monthlyAssignments, totalMonths } = normalizeMonthlyAssignments({
          monthlyCourseAssignments,
          courseAssignments,
          programDuration,
        })
        const mappedMonthlyAssignments = normalizeMonthlyAssignmentsFromMapping(monthlyAssignments, totalMonths)
        const monthlyAssignmentArray = getMonthlyAssignmentsArray(mappedMonthlyAssignments, totalMonths)
        const orderedCourseIds = Array.from(new Set(monthlyAssignmentArray.filter(Boolean)))

        setProgram({
          monthlyAssignments: mappedMonthlyAssignments,
          totalMonths,
          cohortStartDate: normalizeDate(data.cohortStartDate),
          orderedCourseIds,
          courseAssignments,
          journeyType,
          programDurationWeeks: programDurationWeeks ?? (journeyType ? JOURNEY_META[journeyType].weeks : null),
          pillar: isPillar(data.pillar) ? data.pillar : null,
        })
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        console.error('Organization program load error', err)
        setProgram(null)
        setError('Unable to load organization program.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [organizationId])

  return { program, loading, error }
}
