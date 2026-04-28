import type { Timestamp } from 'firebase/firestore'
import type {
  ProgrammeGammaSlide,
  ProgrammePollReference,
} from './programmeNotifications'

export const SIX_WEEK_PROGRAMME_SLUG = 'transforming-business-6w' as const
export type SixWeekProgrammeSlug = typeof SIX_WEEK_PROGRAMME_SLUG

export type SixWeekContentKind =
  | 'affirmation'
  | 'poll'
  | 'peer_nudge'
  | 'progress_check'
  | 'survey_reminder'
  | 'digital_edge_email'
  | 'shameless_podcast_email'

export type SixWeekChannel = 'in_app' | 'push' | 'email'

export type SixWeekWeek = 1 | 2 | 3 | 4 | 5 | 6
export type SixWeekDay = 1 | 2 | 3 | 4 | 5 | 6

export type SixWeekProgressVariant = 'day_2' | 'day_5'

export interface SixWeekEmailContent {
  subject: string
  preview: string
  bodyHtml: string
  bodyText: string
}

export interface SixWeekReferenceContent {
  poll?: ProgrammePollReference
  gammaSlides?: ProgrammeGammaSlide[]
}

export interface SixWeekNotificationTemplate {
  key: string
  programme: SixWeekProgrammeSlug
  week: SixWeekWeek
  day: SixWeekDay
  contentKind: SixWeekContentKind
  channel: SixWeekChannel
  progressVariant?: SixWeekProgressVariant
  title: string
  messageBody: string
  externalUrl?: string
  emailContent?: SixWeekEmailContent
  referenceContent?: SixWeekReferenceContent
  targetAudience: string
  isActive: boolean
}

export interface SixWeekNotificationTemplateRecord extends SixWeekNotificationTemplate {
  id: string
  created_at?: Timestamp | null
  updated_at?: Timestamp | null
}

export interface SixWeekNotificationTokens {
  firstName: string
  currentPoints?: string
}

export interface SixWeekDayInfo {
  week: SixWeekWeek
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7
  dayOfJourney: number
}
