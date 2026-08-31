/**
 * Maps monthly-journey catalogue course slugs → native course podcast packs.
 *
 * Pack files live at `/course-podcasts/{packId}/` (see public/course-podcasts).
 * Same pack is used whether the org journey is 6-week-adjacent monthly or
 * 3/6/9-month - if the course is assigned that month, this pack applies.
 *
 * C13 (Data Sentinels) is on hold in the source pack - no assets yet.
 */

import type { CoursePodcastSlot } from '@/types/coursePodcast'

/** Stable pack id, e.g. T4L-C01. Matches folder under public/course-podcasts. */
export type CoursePodcastPackId = `T4L-C${string}`

export type CoursePodcastPackStatus = 'ready' | 'hold' | 'partial'

export interface CoursePodcastPackRef {
 packId: CoursePodcastPackId
 /** Catalogue course slug from `MONTHLY_JOURNEY_COURSE_CATALOGUE`. */
 catalogueCourseId: string
 status: CoursePodcastPackStatus
 /** Human note when status is hold/partial. */
 note?: string
}

/**
 * Ordered C01 - C20 ↔ catalogue. Titles in the pack match catalogue titles
 * (minor wording differences like Leader/Leaders are intentional upstream).
 */
export const COURSE_PODCAST_PACKS: readonly CoursePodcastPackRef[] = [
 { packId: 'T4L-C01', catalogueCourseId: 'think-like-an-owner', status: 'ready' },
 { packId: 'T4L-C02', catalogueCourseId: 'mindset-reset', status: 'ready' },
 { packId: 'T4L-C03', catalogueCourseId: 'confidence-code', status: 'ready' },
 { packId: 'T4L-C04', catalogueCourseId: 'science-of-you', status: 'ready' },
 { packId: 'T4L-C05', catalogueCourseId: 'courage-to-heal', status: 'ready' },
 { packId: 'T4L-C06', catalogueCourseId: 'heart-of-leadership', status: 'ready' },
 { packId: 'T4L-C07', catalogueCourseId: 'art-of-connection', status: 'ready' },
 { packId: 'T4L-C08', catalogueCourseId: 'cultural-intelligence', status: 'ready' },
 { packId: 'T4L-C09', catalogueCourseId: 'foundations-of-leadership', status: 'ready' },
 { packId: 'T4L-C10', catalogueCourseId: 'ai-stacking-101', status: 'ready' },
 { packId: 'T4L-C11', catalogueCourseId: 'data-fluency-reporting', status: 'ready' },
 { packId: 'T4L-C12', catalogueCourseId: 'understanding-digital-bias', status: 'ready' },
 {
 packId: 'T4L-C13',
 catalogueCourseId: 'digital-transformation-data',
 status: 'hold',
 note: 'Data Sentinels pack on hold upstream - no podcast assets yet.',
 },
 { packId: 'T4L-C14', catalogueCourseId: 'goal-setting-mastery', status: 'ready' },
 { packId: 'T4L-C15', catalogueCourseId: 'leading-through-change', status: 'ready' },
 { packId: 'T4L-C16', catalogueCourseId: 'project-management-for-leaders', status: 'ready' },
 { packId: 'T4L-C17', catalogueCourseId: 'thrive-toxic-workplace', status: 'ready' },
 { packId: 'T4L-C18', catalogueCourseId: 'transformational-leadership', status: 'ready' },
 { packId: 'T4L-C19', catalogueCourseId: 'linkedin-warrior', status: 'ready' },
 {
 packId: 'T4L-C20',
 catalogueCourseId: 'path-to-promotion',
 status: 'partial',
 note: 'Anchor episode UNFILLED - widener + challenger ship.',
 },
] as const

const BY_CATALOGUE = new Map(
 COURSE_PODCAST_PACKS.map((pack) => [pack.catalogueCourseId, pack] as const),
)
const BY_PACK = new Map(COURSE_PODCAST_PACKS.map((pack) => [pack.packId, pack] as const))

export function getCoursePodcastPackByCatalogueId(
 catalogueCourseId: string | null | undefined,
): CoursePodcastPackRef | null {
 if (!catalogueCourseId) return null
 return BY_CATALOGUE.get(catalogueCourseId) ?? null
}

export function getCoursePodcastPackByPackId(
 packId: string | null | undefined,
): CoursePodcastPackRef | null {
 if (!packId) return null
 return BY_PACK.get(packId as CoursePodcastPackId) ?? null
}

/** Public URL path for a pack folder (Vite `public/`). */
export function getCoursePodcastPackBasePath(packId: CoursePodcastPackId): string {
 const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
 return `${base}course-podcasts/${packId}`
}

export function getCoursePodcastMetaUrl(packId: CoursePodcastPackId): string {
 return `${getCoursePodcastPackBasePath(packId)}/meta.json`
}

export function getCoursePodcastTranscriptUrl(
 packId: CoursePodcastPackId,
 slot: CoursePodcastSlot,
): string {
 return `${getCoursePodcastPackBasePath(packId)}/${slot}.txt`
}

/** Packs that currently have on-disk assets learners can open. */
export function listReadyCoursePodcastPacks(): CoursePodcastPackRef[] {
 return COURSE_PODCAST_PACKS.filter((p) => p.status === 'ready' || p.status === 'partial')
}
