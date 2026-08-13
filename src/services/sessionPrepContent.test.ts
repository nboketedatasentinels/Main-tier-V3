import { describe, expect, it } from 'vitest'
import { buildSessionPrepModel, mentorMeetupCountForJourney } from '@/services/sessionPrepContent'

describe('sessionPrepContent', () => {
  it('maps journey length to mentor meetup count', () => {
    expect(mentorMeetupCountForJourney('3M')).toBe(3)
    expect(mentorMeetupCountForJourney('6M')).toBe(6)
    expect(mentorMeetupCountForJourney('6W')).toBe(0)
  })

  it('builds different mentor vs coach readings', () => {
    const base = {
      leaderName: 'Thandiwe Moyo',
      goals: 'Get exec approval for phase two without defending it line by line',
      pillars: { L: 64, I: 79, F: 48, T: 73 },
      personalityType: 'INTJ',
      coreValues: ['Autonomy', 'Mastery', 'Integrity'],
      journeyType: '6M',
      currentWeek: 5,
      windowStatus: 'warning' as const,
      sessionNumber: 1,
    }
    const mentor = buildSessionPrepModel({ ...base, audience: 'mentor' })
    const coach = buildSessionPrepModel({ ...base, audience: 'coach' })
    expect(mentor.tendencies.length).toBeGreaterThan(0)
    expect(coach.tendencies.length).toBe(0)
    expect(coach.goalVerbatim).toContain('exec approval')
    expect(mentor.opener).not.toBeNull()
    expect(coach.stanceReminders.length).toBeGreaterThan(0)
    expect(mentor.topics[0].sayLabel).toBe('Say this out loud')
    expect(coach.topics[0].sayLabel).toBe('Ask this')
  })

  it('builds leader prep with can-see panel and scores', () => {
    const leader = buildSessionPrepModel({
      audience: 'leader',
      leaderName: 'Thandiwe Moyo',
      mentorName: 'Grace Adjei',
      goals: 'Get exec approval',
      pillars: { L: 64, I: 79, F: 48, T: 73 },
      journeyType: '6M',
      sessionNumber: 1,
    })
    expect(leader.showScores).toBe(true)
    expect(leader.mentorCanSee.length).toBeGreaterThan(0)
    expect(leader.mentorCannotSee).toEqual(
      expect.arrayContaining([expect.stringMatching(/points/i)]),
    )
    expect(leader.bringItems.length).toBe(3)
  })
})
