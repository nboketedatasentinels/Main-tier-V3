import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'

export type OrganizationAccessErrorCode = 'ORG_NOT_FOUND' | 'ORG_INACTIVE' | 'NO_COURSES_ASSIGNED'

export interface OrganizationValidationResult {
  valid: boolean
  organizationId?: string
  organizationCode?: string
  organizationName?: string
  organizationStatus?: string | null
  errorCode?: OrganizationAccessErrorCode
  message?: string
  organization?: Record<string, unknown>
}

const organizationsCollection = collection(db, 'organizations')

const isInactiveStatus = (status?: string | null) => {
  if (!status) return false
  const normalized = status.toLowerCase()
  return ['inactive', 'paused', 'archived', 'disabled'].some((value) => normalized.includes(value))
}

const hasAssignedCourses = (data: Record<string, unknown>) => {
  const monthlyAssignments = data.monthlyCourseAssignments
  const courseAssignments = data.courseAssignments
  const programDuration = data.programDuration || data.program_duration || data.duration || data.programLength

  const hasMonthly =
    monthlyAssignments &&
    typeof monthlyAssignments === 'object' &&
    Object.values(monthlyAssignments as Record<string, unknown>).some(Boolean)
  const hasCourses = Array.isArray(courseAssignments) && courseAssignments.some(Boolean)
  const hasDuration = typeof programDuration === 'number' || typeof programDuration === 'string'

  return hasMonthly || hasCourses || hasDuration
}

export const validateUserOrganizationAccess = async (params: {
  organizationId?: string | null
  organizationCode?: string | null
}): Promise<OrganizationValidationResult> => {
  const { organizationId, organizationCode } = params

  if (!organizationId && !organizationCode) {
    return {
      valid: false,
      errorCode: 'ORG_NOT_FOUND',
      message: 'No organization assignment was found for this profile.',
    }
  }

  let docSnapshot = organizationId ? await getDoc(doc(organizationsCollection, organizationId)) : null

  if (!docSnapshot || !docSnapshot.exists()) {
    if (organizationCode) {
      const trimmedCode = organizationCode.trim().toUpperCase()
      const snapshot = await getDocs(query(organizationsCollection, where('code', '==', trimmedCode)))
      docSnapshot = snapshot.docs[0] || null
    }
  }

  if (!docSnapshot || !docSnapshot.exists()) {
    return {
      valid: false,
      errorCode: 'ORG_NOT_FOUND',
      message: 'Organization details could not be found.',
    }
  }

  const data = docSnapshot.data() as Record<string, unknown>
  const status = typeof data.status === 'string' ? data.status : null

  if (isInactiveStatus(status)) {
    return {
      valid: false,
      organizationId: docSnapshot.id,
      organizationCode: typeof data.code === 'string' ? data.code : undefined,
      organizationName: typeof data.name === 'string' ? data.name : undefined,
      organizationStatus: status,
      errorCode: 'ORG_INACTIVE',
      message: 'Your organization is currently inactive.',
      organization: data,
    }
  }

  if (!hasAssignedCourses(data)) {
    return {
      valid: false,
      organizationId: docSnapshot.id,
      organizationCode: typeof data.code === 'string' ? data.code : undefined,
      organizationName: typeof data.name === 'string' ? data.name : undefined,
      organizationStatus: status,
      errorCode: 'NO_COURSES_ASSIGNED',
      message: 'No courses are assigned to your organization yet.',
      organization: data,
    }
  }

  return {
    valid: true,
    organizationId: docSnapshot.id,
    organizationCode: typeof data.code === 'string' ? data.code : undefined,
    organizationName: typeof data.name === 'string' ? data.name : undefined,
    organizationStatus: status,
    organization: data,
  }
}
