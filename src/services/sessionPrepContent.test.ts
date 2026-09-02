import { describe, expect, it } from 'vitest'
import { buildSessionPrepModel, mentorMeetupCountForJourney } from '@/services/sessionPrepContent'

describe('sessionPrepContent', () => {
  it('maps journey length to mentor meetup count', () => {
    expect(mentorMeetupCountForJourney('3M')).toBe(3)
    expect(mentorMeetupCountForJourney('6M')).toBe(6)
    expect(mentorMeetupCountForJourney('6W')).toBe(0)
  })

  it('builds mentor vs coach readings from live signals only', () => {
    const base = {
      leaderName: 'Thandiwe Moyo',
      goals: 'Get exec approval for phase two without defending it line by line',
      pillars: { L: 64, I: 79, F: 48, T: 73 },
      personalityType: 'INTJ',
      coreValues: ['Autonomy', 'Mastery', 'Integrity'],
      journeyType: '6M',
      currentWeek: 5,
      courseTitles: ['Data-Driven Decisions in Digital Transformation'],
      windowStatus: 'warning' as const,
      sessionNumber: 1,
    }
    const mentor = buildSessionPrepModel({ ...base, audience: 'mentor' })
    const coach = buildSessionPrepModel({ ...base, audience: 'coach' })
    expect(mentor.tendencies.length).toBeGreaterThan(0)
    expect(coach.tendencies.length).toBeGreaterThan(0)
    expect(coach.goalVerbatim).toContain('exec approval')
    expect(mentor.goalVerbatim).toContain('exec approval')
    expect(mentor.opener).not.toBeNull()
    expect(coach.stanceReminders.length).toBeGreaterThan(0)
    expect(mentor.topics[0].sayLabel).toBe('Say this out loud')
    expect(coach.topics[0].sayLabel).toBe('Ask this')
    expect(mentor.topics.some((t) => /Data-Driven Decisions/i.test(t.title))).toBe(true)
    expect(mentor.showScores).toBe(true)
    expect(mentor.liftPending).toBe(false)
  })

  it('does not invent personality or LIFT when missing', () => {
    const model = buildSessionPrepModel({
      audience: 'mentor',
      leaderName: 'Syntiche Musawu',
      journeyType: '3M',
      sessionNumber: 1,
      courseTitles: ['Leading Transformation Across Cultures and Borders'],
    })
    expect(model.tendencies).toEqual([])
    expect(model.costs).toEqual([])
    expect(model.pillars).toBeNull()
    expect(model.liftPending).toBe(true)
    expect(model.topics.some((t) => /Leading Transformation/i.test(t.title))).toBe(true)
    expect(model.headline).toMatch(/programme|Leading Transformation/i)
  })

  it('builds leader prep with LIFT scores and without static tip panels', () => {
    const leader = buildSessionPrepModel({
      audience: 'leader',
      leaderName: 'Thandiwe Moyo',
      mentorName: 'Grace Adjei',
      goals: 'Get exec approval',
      pillars: { L: 64, I: 79, F: 48, T: 73 },
      archetype: 'Architect',
      journeyType: '6M',
      sessionNumber: 1,
      totalPoints: 12500,
    })
    expect(leader.showScores).toBe(true)
    expect(leader.archetypeLabel).toBe('Architect')
    expect(leader.totalPointsLabel).toContain('12,500')
    expect(leader.bringItems).toEqual([])
    expect(leader.mentorCanSee).toEqual([])
    expect(leader.mentorCannotSee).toEqual([])
  })
})
