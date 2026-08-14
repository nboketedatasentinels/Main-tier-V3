/**
 * Course podcast pack types (native in-app assets).
 *
 * Each catalogue course maps to a T4L-C## pack with up to three slots:
 * anchor / widener / challenger. Metadata + grading criteria live in
 * `public/course-podcasts/{packId}/meta.json`; transcripts in `{slot}.txt`.
 * Episode audio is the external publisher URL until we host audio in storage.
 */

export type CoursePodcastSlot = 'anchor' | 'widener' | 'challenger'

export type CoursePodcastQuestionType = 'recall' | 'application' | 'challenge'

export interface CoursePodcastQuestion {
  type: CoursePodcastQuestionType | string
  question: string
}

export interface CoursePodcastEpisodeFilled {
  slot: CoursePodcastSlot
  status?: 'ready' | string
  episode_title: string
  show_name: string
  guest?: string
  region?: string
  duration_minutes?: number
  url: string
  transcript_file: string
  transcript_source?: string
  listening_range?: string
  the_idea?: string
  /** Grading focus / compliance note shown before the learner answers. */
  what_will_be_assessed: string
  questions: CoursePodcastQuestion[]
}

export interface CoursePodcastEpisodeUnfilled {
  slot: CoursePodcastSlot
  status: 'UNFILLED'
  transcript_file?: string | null
  unfilled_reason?: string
}

export type CoursePodcastEpisode = CoursePodcastEpisodeFilled | CoursePodcastEpisodeUnfilled

export interface CoursePodcastPackMeta {
  course_id: string
  course_name: string
  episodes: CoursePodcastEpisode[]
  ledger_append?: Array<{
    episode_title: string
    show_name: string
    region?: string
  }>
}

export function isCoursePodcastEpisodeFilled(
  episode: CoursePodcastEpisode,
): episode is CoursePodcastEpisodeFilled {
  return (
    episode.status !== 'UNFILLED' &&
    typeof (episode as CoursePodcastEpisodeFilled).url === 'string' &&
    Array.isArray((episode as CoursePodcastEpisodeFilled).questions)
  )
}
