import { describe, expect, it } from 'vitest'
import {
  FREE_USER_3M_MONTHLY_ASSIGNMENTS,
  resolveFreeUserCatalogueCourseId,
} from './freeUserJourneyCourses'
import { getCoursePodcastPackByCatalogueId } from './coursePodcastCatalogue'

describe('freeUserJourneyCourses', () => {
  it('maps free-user weeks onto 3-month journey catalogue courses', () => {
    expect(resolveFreeUserCatalogueCourseId(1)).toBe('think-like-an-owner')
    expect(resolveFreeUserCatalogueCourseId(4)).toBe('think-like-an-owner')
    expect(resolveFreeUserCatalogueCourseId(5)).toBe('project-management-for-leaders')
    expect(resolveFreeUserCatalogueCourseId(9)).toBe('transformational-leadership')
  })

  it('has ready podcast packs for every free-user 3M course', () => {
    for (const courseId of Object.values(FREE_USER_3M_MONTHLY_ASSIGNMENTS)) {
      const pack = getCoursePodcastPackByCatalogueId(courseId)
      expect(pack?.status).toBe('ready')
    }
  })
})
