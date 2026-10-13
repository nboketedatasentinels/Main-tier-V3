import { getCourseDetailsFromMapping } from '@/utils/courseMappings'
import { isComplementaryCourse } from '@/utils/membership'

export type CourseAccessType = 'free' | 'paid'

/** What a learner sees on a course card: free, or paid with its price. */
export interface CourseAccessInfo {
  type: CourseAccessType
  priceLabel: string | null
}

export const formatCoursePrice = (price: number | null | undefined, currency = 'USD'): string | null => {
  if (price === null || price === undefined || !Number.isFinite(price)) return null
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(price)
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

/** T4L catalogue courses: complementary ones are free, the rest carry their catalogue price. */
export const getCatalogueCourseAccess = (
  courseTitle?: string | null,
  courseId?: string | null,
): CourseAccessInfo => {
  if (isComplementaryCourse(courseTitle, courseId)) return { type: 'free', priceLabel: null }
  const details = getCourseDetailsFromMapping(courseTitle) ?? getCourseDetailsFromMapping(courseId)
  return { type: 'paid', priceLabel: formatCoursePrice(details?.price) }
}
