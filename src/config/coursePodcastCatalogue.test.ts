import { describe, expect, it } from 'vitest'
import {
  COURSE_PODCAST_PACKS,
  getCoursePodcastPackByCatalogueId,
  listReadyCoursePodcastPacks,
} from '@/config/coursePodcastCatalogue'
import { MONTHLY_JOURNEY_COURSE_CATALOGUE } from '@/config/courseCatalogue'

describe('coursePodcastCatalogue', () => {
  it('covers every monthly catalogue course exactly once', () => {
    const catalogueIds = MONTHLY_JOURNEY_COURSE_CATALOGUE.map((c) => c.id).sort()
    const mappedIds = COURSE_PODCAST_PACKS.map((p) => p.catalogueCourseId).sort()
    expect(mappedIds).toEqual(catalogueIds)
  })

  it('keeps C13 on hold and C20 partial', () => {
    expect(getCoursePodcastPackByCatalogueId('digital-transformation-data')?.status).toBe('hold')
    expect(getCoursePodcastPackByCatalogueId('path-to-promotion')?.status).toBe('partial')
  })

  it('lists ready/partial packs only (excludes hold)', () => {
    const ready = listReadyCoursePodcastPacks()
    expect(ready.every((p) => p.status !== 'hold')).toBe(true)
    expect(ready).toHaveLength(19)
  })
})
