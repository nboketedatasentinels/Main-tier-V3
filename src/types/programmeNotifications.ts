import type { Timestamp } from 'firebase/firestore'

export type ProgrammeSlug = 'transformational-leadership-4w'

export type ProgrammeContentKind =
  | 'affirmation'
  | 'poll'
  | 'digital_edge'
  | 'deep_dive'
  | 'progress_check'
  | 'feedback_form'

export type ProgrammeChannel = 'in_app' | 'push'

export type ProgressCheckVariant =
  | 'day_2'
  | 'day_5_on_track'
  | 'day_5_behind'
  | 'day_5_pass'
  | 'day_5_no_pass'

export interface ProgrammePollReference {
  question: string
  options: string[]
}

export interface ProgrammeGammaSlide {
  title: string
  body: string
}

export interface ProgrammeReferenceContent {
  poll?: ProgrammePollReference
  gammaSlides?: ProgrammeGammaSlide[]
  pushCopy?: string
}

export interface ProgrammeNotificationTemplate {
  key: string
  programme: ProgrammeSlug
  week: 1 | 2 | 3 | 4
  day: 1 | 2 | 3 | 5
  contentKind: ProgrammeContentKind
  channel: ProgrammeChannel
  progressVariant?: ProgressCheckVariant
  title: string
  messageBody: string
  externalUrl?: string
  referenceContent?: ProgrammeReferenceContent
  targetAudience: string
  isActive: boolean
}

export interface ProgrammeNotificationTemplateRecord extends ProgrammeNotificationTemplate {
  id: string
  created_at?: Timestamp | null
  updated_at?: Timestamp | null
}

export interface ProgrammeNotificationTokens {
  firstName: string
  currentPoints?: string
}
