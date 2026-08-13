import { useMemo } from 'react'
import { getCatalogueCourseById } from '@/config/courseCatalogue'
import type { MonthlyCourseAssignments } from '@/utils/monthlyCourseAssignments'

type ProgramLike = {
  orderedCourseIds?: string[] | null
  monthlyAssignments?: MonthlyCourseAssignments | null
} | null

/** Unique catalogue titles for an organisation programme (admin monthly course picks). */
export const resolveOrgProgrammeCourseTitles = (program: ProgramLike): string[] => {
  const ids = program?.orderedCourseIds ?? []
  const titles: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    const title = getCatalogueCourseById(id)?.title?.trim()
    if (!title) continue
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    titles.push(title)
  }
  return titles
}

export const useOrgProgrammeCourseTitles = (program: ProgramLike): string[] =>
  useMemo(() => resolveOrgProgrammeCourseTitles(program), [program])
