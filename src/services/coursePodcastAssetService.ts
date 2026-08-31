/**
 * Loads native course podcast packs (meta + transcripts) from static assets.
 *
 * Play → episode.url (publisher). Read → transcript text. Grade → questions +
 * what_will_be_assessed from meta (AI fill/compliance wiring comes next).
 */

import {
 getCoursePodcastMetaUrl,
 getCoursePodcastPackByCatalogueId,
 getCoursePodcastTranscriptUrl,
 type CoursePodcastPackId,
 type CoursePodcastPackRef,
} from '@/config/coursePodcastCatalogue'
import {
 isCoursePodcastEpisodeFilled,
 type CoursePodcastEpisode,
 type CoursePodcastEpisodeFilled,
 type CoursePodcastPackMeta,
 type CoursePodcastSlot,
} from '@/types/coursePodcast'

const metaCache = new Map<string, CoursePodcastPackMeta>()
const transcriptCache = new Map<string, string>()

async function fetchJson<T>(url: string): Promise<T> {
 const res = await fetch(url)
 if (!res.ok) {
 throw new Error(`Failed to load course podcast meta (${res.status}): ${url}`)
 }
 return (await res.json()) as T
}

async function fetchText(url: string): Promise<string> {
 const res = await fetch(url)
 if (!res.ok) {
 throw new Error(`Failed to load course podcast transcript (${res.status}): ${url}`)
 }
 return res.text()
}

export async function loadCoursePodcastPackMeta(
 packId: CoursePodcastPackId,
): Promise<CoursePodcastPackMeta> {
 const cached = metaCache.get(packId)
 if (cached) return cached
 const meta = await fetchJson<CoursePodcastPackMeta>(getCoursePodcastMetaUrl(packId))
 metaCache.set(packId, meta)
 return meta
}

export async function loadCoursePodcastPackForCatalogueCourse(
 catalogueCourseId: string,
): Promise<{ ref: CoursePodcastPackRef; meta: CoursePodcastPackMeta } | null> {
 const ref = getCoursePodcastPackByCatalogueId(catalogueCourseId)
 if (!ref || ref.status === 'hold') return null
 const meta = await loadCoursePodcastPackMeta(ref.packId)
 return { ref, meta }
}

export async function loadCoursePodcastTranscript(params: {
 packId: CoursePodcastPackId
 slot: CoursePodcastSlot
}): Promise<string> {
 const key = `${params.packId}:${params.slot}`
 const cached = transcriptCache.get(key)
 if (cached) return cached
 const text = await fetchText(getCoursePodcastTranscriptUrl(params.packId, params.slot))
 transcriptCache.set(key, text)
 return text
}

/** Episodes a learner can listen to (filled slots only). */
export function listPlayableEpisodes(meta: CoursePodcastPackMeta): CoursePodcastEpisodeFilled[] {
 return meta.episodes.filter(isCoursePodcastEpisodeFilled)
}

/** Grading payload for one episode - criteria + open questions. */
export function getEpisodeGradingPayload(episode: CoursePodcastEpisode): {
 slot: CoursePodcastSlot
 ready: boolean
 whatWillBeAssessed: string | null
 questions: CoursePodcastEpisodeFilled['questions']
} {
 if (!isCoursePodcastEpisodeFilled(episode)) {
 return {
 slot: episode.slot,
 ready: false,
 whatWillBeAssessed: null,
 questions: [],
 }
 }
 return {
 slot: episode.slot,
 ready: true,
 whatWillBeAssessed: episode.what_will_be_assessed,
 questions: episode.questions,
 }
}

/** Clear caches (tests / hot reload). */
export function clearCoursePodcastAssetCache(): void {
 metaCache.clear()
 transcriptCache.clear()
}
