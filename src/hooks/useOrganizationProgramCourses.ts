import { useEffect, useState } from 'react'
import { doc, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { ORG_COLLECTION } from '@/constants/organizations'
import {
  MonthlyCourseAssignments,
  getMonthlyAssignmentsArray,
  normalizeMonthlyAssignments,
} from '@/utils/monthlyCourseAssignments'

interface OrganizationProgram {
  monthlyAssignments: MonthlyCourseAssignments
  totalMonths: number
  cohortStartDate: Date | null
  orderedCourseIds: string[]
}

const normalizeDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return isNaN(parsed.getTime()) ? null : parsed
  }
  if (value instanceof Timestamp) {
    return value.toDate()
  }
  if (typeof value === 'object' && (value as { toDate?: () => Date }).toDate) {
    return (value as { toDate: () => Date }).toDate()
  }
  return null
}

const normalizeCourseIds = (input?: unknown): string[] => {
  if (!Array.isArray(input)) return []
  const uniqueIds = new Set<string>()
  input.forEach(value => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) {
        uniqueIds.add(trimmed)
      }
    }
  })
  return Array.from(uniqueIds)
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

    const organizationRef = doc(db, ORG_COLLECTION, organizationId)
    const unsubscribe = onSnapshot(
      organizationRef,
      snapshot => {
        if (!snapshot.exists()) {
          setProgram(null)
          setLoading(false)
          return
        }

        const data = snapshot.data()
        const rawDuration =
          data.programDuration || data.program_duration || data.duration || data.programLength
        const programDuration: number | string | null =
          typeof rawDuration === 'number' || typeof rawDuration === 'string' ? rawDuration : null
        const rawMonthlyAssignments = data.monthlyCourseAssignments
        const monthlyCourseAssignments = isMonthlyCourseAssignments(rawMonthlyAssignments)
          ? rawMonthlyAssignments
          : null
        const courseAssignments = normalizeCourseIds(
          data.courseAssignments || data.assignedCourses || data.defaultCourses
        )
        const { monthlyAssignments, totalMonths } = normalizeMonthlyAssignments({
          monthlyCourseAssignments,
          courseAssignments,
          programDuration,
        })
        const monthlyAssignmentArray = getMonthlyAssignmentsArray(monthlyAssignments, totalMonths).filter(Boolean)
        const orderedCourseIds = Array.from(new Set(monthlyAssignmentArray))

        setProgram({
          monthlyAssignments,
          totalMonths,
          cohortStartDate: normalizeDate(data.cohortStartDate),
          orderedCourseIds,
        })
        setLoading(false)
      },
      snapshotError => {
        console.error('Organization listener error', snapshotError)
        setProgram(null)
        setError('Unable to load organization program.')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [organizationId])

  return { program, loading, error }
}
