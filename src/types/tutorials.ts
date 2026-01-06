export interface TutorialCompletion {
  id: string
  user_id: string
  tutorial_id: string
  completed_at: string
  created_at: string
}

export interface TutorialDefinition {
  id: string
  title: string
  url: string
}

export const CALENDAR_SYNC_TUTORIAL: TutorialDefinition = {
  id: 'calendar-sync-tutorial',
  title: 'How to sync your Google calendar to the T4L calendar',
  url: 'https://www.iorad.com/player/123456/How-to-sync-your-Google-calendar-to-the-T4L-calendar',
}
