/**
 * Organisation course library (custom course template).
 *
 * An organisation can bring its own courses. Every course follows the same
 * template - title, description, link or uploaded file, length, level and
 * free/paid + price - so any of them can be slotted into the organisation's
 * journey next to (or instead of) the T4L catalogue.
 *
 * Tenant isolation is enforced in the database (migration 0101): rows and
 * files are only visible to that organisation's members, its assigned partner
 * and super admins. Files sit in a private bucket and are opened through
 * short-lived signed URLs. Nothing here is sent to an AI model.
 *
 * In journey assignments a library course is stored as `org-course:<uuid>` so
 * it can never collide with a catalogue slug.
 */
import { supabase } from '@/services/supabase'
import type { CourseDifficulty } from '@/utils/courseMappings'
import type { CourseOption } from '@/types/admin'
import { formatCoursePrice, type CourseAccessInfo, type CourseAccessType } from '@/utils/courseAccess'

export type { CourseAccessType }

export const ORGANIZATION_COURSE_ID_PREFIX = 'org-course:'
export const ORGANIZATION_COURSE_BUCKET = 'organization-course-files'
export const ORGANIZATION_COURSE_MAX_FILE_BYTES = 50 * 1024 * 1024
export const ORGANIZATION_COURSE_FILE_ACCEPT = '.pdf,.mp4,.pptx,.docx'

/** Signed links stay valid for a learner session; reloading the page refreshes them. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 4

export interface OrganizationCourse {
  id: string
  organizationId: string
  title: string
  description: string
  link: string | null
  filePath: string | null
  fileName: string | null
  accessType: CourseAccessType
  price: number | null
  currency: string
  estimatedMinutes: number | null
  difficulty: CourseDifficulty
  archived: boolean
  createdAt: string
}

export interface OrganizationCourseInput {
  title: string
  description: string
  link?: string | null
  accessType: CourseAccessType
  price?: number | null
  estimatedMinutes?: number | null
  difficulty: CourseDifficulty
}

type Raw = Record<string, unknown>

const mapCourse = (row: Raw): OrganizationCourse => ({
  id: row.id as string,
  organizationId: row.organization_id as string,
  title: (row.title as string) ?? '',
  description: (row.description as string) ?? '',
  link: (row.link as string) ?? null,
  filePath: (row.file_path as string) ?? null,
  fileName: (row.file_name as string) ?? null,
  accessType: row.access_type === 'paid' ? 'paid' : 'free',
  price: row.price === null || row.price === undefined ? null : Number(row.price),
  currency: (row.currency as string) || 'USD',
  estimatedMinutes: (row.estimated_minutes as number) ?? null,
  difficulty: (row.difficulty as CourseDifficulty) ?? 'Beginner',
  archived: Boolean(row.archived),
  createdAt: (row.created_at as string) ?? '',
})

export const toOrganizationCourseAssignmentId = (courseId: string): string =>
  `${ORGANIZATION_COURSE_ID_PREFIX}${courseId}`

export const isOrganizationCourseAssignmentId = (value?: string | null): boolean =>
  Boolean(value && value.startsWith(ORGANIZATION_COURSE_ID_PREFIX))

export const parseOrganizationCourseAssignmentId = (value?: string | null): string | null =>
  isOrganizationCourseAssignmentId(value) ? value!.slice(ORGANIZATION_COURSE_ID_PREFIX.length) : null

export const toOrganizationCourseOption = (course: OrganizationCourse): CourseOption => ({
  id: toOrganizationCourseAssignmentId(course.id),
  title: course.title,
  description: course.description,
})

export const getOrganizationCourseAccess = (course: OrganizationCourse): CourseAccessInfo => ({
  type: course.accessType,
  priceLabel: course.accessType === 'paid' ? formatCoursePrice(course.price, course.currency) : null,
})

const normalizeLink = (value?: string | null): string | null => {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

const validateInput = (input: OrganizationCourseInput, hasFile: boolean) => {
  if (input.title.trim().length < 3) throw new Error('Course title must be at least 3 characters')
  if (!normalizeLink(input.link) && !hasFile) {
    throw new Error('Add a course link or upload a course file')
  }
  if (input.accessType === 'paid' && !(typeof input.price === 'number' && input.price > 0)) {
    throw new Error('Paid courses need a price greater than 0')
  }
}

const validateFile = (file: File) => {
  if (file.size > ORGANIZATION_COURSE_MAX_FILE_BYTES) {
    throw new Error('Course files must be 50 MB or smaller')
  }
}

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120)

const uploadCourseFile = async (organizationId: string, courseId: string, file: File) => {
  validateFile(file)
  // First path segment must be the org id - storage RLS checks it.
  const path = `${organizationId}/${courseId}/${Date.now()}-${safeFileName(file.name)}`
  const { error } = await supabase.storage
    .from(ORGANIZATION_COURSE_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (error) throw new Error(`File upload failed: ${error.message}`)
  return path
}

const removeCourseFile = async (path: string | null) => {
  if (!path) return
  const { error } = await supabase.storage.from(ORGANIZATION_COURSE_BUCKET).remove([path])
  if (error) console.warn('[organizationCourseService] old file cleanup failed', error)
}

export const listOrganizationCourses = async (
  organizationId: string,
  options: { includeArchived?: boolean } = {},
): Promise<OrganizationCourse[]> => {
  if (!organizationId) return []
  let query = supabase
    .from('organization_courses')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  if (!options.includeArchived) query = query.eq('archived', false)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapCourse(row as Raw))
}

/** Fetch library courses by their assignment ids (`org-course:<uuid>`). */
export const getOrganizationCoursesByAssignmentIds = async (
  assignmentIds: string[],
): Promise<Map<string, OrganizationCourse>> => {
  const ids = Array.from(
    new Set(assignmentIds.map(parseOrganizationCourseAssignmentId).filter((id): id is string => Boolean(id))),
  )
  const result = new Map<string, OrganizationCourse>()
  if (!ids.length) return result
  const { data, error } = await supabase.from('organization_courses').select('*').in('id', ids)
  if (error) throw new Error(error.message)
  ;(data ?? []).forEach((row) => {
    const course = mapCourse(row as Raw)
    result.set(toOrganizationCourseAssignmentId(course.id), course)
  })
  return result
}

/** Link a learner opens: the external link, or a signed URL for an uploaded file. */
export const resolveOrganizationCourseLink = async (course: OrganizationCourse): Promise<string | null> => {
  if (course.link) return course.link
  if (!course.filePath) return null
  const { data, error } = await supabase.storage
    .from(ORGANIZATION_COURSE_BUCKET)
    .createSignedUrl(course.filePath, SIGNED_URL_TTL_SECONDS)
  if (error) {
    console.warn('[organizationCourseService] signed URL failed', error)
    return null
  }
  return data?.signedUrl ?? null
}

export const createOrganizationCourse = async (
  organizationId: string,
  input: OrganizationCourseInput,
  file?: File | null,
): Promise<OrganizationCourse> => {
  validateInput(input, Boolean(file))
  if (file) validateFile(file)
  const id = crypto.randomUUID()
  const filePath = file ? await uploadCourseFile(organizationId, id, file) : null
  const { data: userData } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('organization_courses')
    .insert({
      id,
      organization_id: organizationId,
      title: input.title.trim(),
      description: input.description.trim(),
      link: normalizeLink(input.link),
      file_path: filePath,
      file_name: file?.name ?? null,
      access_type: input.accessType,
      price: input.accessType === 'paid' ? input.price : null,
      estimated_minutes: input.estimatedMinutes || null,
      difficulty: input.difficulty,
      created_by: userData.user?.id ?? null,
    })
    .select('*')
    .single()
  if (error) {
    await removeCourseFile(filePath)
    throw new Error(error.message)
  }
  return mapCourse(data as Raw)
}

export const updateOrganizationCourse = async (
  course: OrganizationCourse,
  input: OrganizationCourseInput,
  file?: File | null,
): Promise<OrganizationCourse> => {
  validateInput(input, Boolean(file || course.filePath))
  const filePath = file ? await uploadCourseFile(course.organizationId, course.id, file) : course.filePath

  const { data, error } = await supabase
    .from('organization_courses')
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      link: normalizeLink(input.link),
      file_path: filePath,
      file_name: file ? file.name : course.fileName,
      access_type: input.accessType,
      price: input.accessType === 'paid' ? input.price : null,
      estimated_minutes: input.estimatedMinutes || null,
      difficulty: input.difficulty,
    })
    .eq('id', course.id)
    .select('*')
    .single()
  if (error) {
    if (file) await removeCourseFile(filePath)
    throw new Error(error.message)
  }
  if (file) await removeCourseFile(course.filePath)
  return mapCourse(data as Raw)
}

/** Archived courses disappear for learners but keep past assignments resolvable for admins. */
export const setOrganizationCourseArchived = async (courseId: string, archived: boolean): Promise<void> => {
  const { error } = await supabase.from('organization_courses').update({ archived }).eq('id', courseId)
  if (error) throw new Error(error.message)
}
