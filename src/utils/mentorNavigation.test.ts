import { describe, expect, it } from 'vitest'
import { resolveMentorNavDestination } from '@/utils/mentorNavigation'

describe('resolveMentorNavDestination', () => {
  it('routes guidelines to the handbook page', () => {
    expect(resolveMentorNavDestination('guidelines')).toEqual({
      kind: 'route',
      path: '/mentor/guidelines',
    })
  })

  it('routes session points to the award page', () => {
    expect(resolveMentorNavDestination('session-points')).toEqual({
      kind: 'route',
      path: '/mentor/session-points',
    })
  })

  it('keeps dashboard section keys on the dashboard', () => {
    expect(resolveMentorNavDestination('mentees')).toEqual({
      kind: 'section',
      section: 'mentees',
    })
  })
})
