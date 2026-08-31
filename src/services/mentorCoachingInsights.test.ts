import { describe, expect, it } from 'vitest'
import {
 buildAiInference,
 buildMentoringSessionPlan,
 buildStrengthsWeaknessesWriteUp,
} from '@/services/mentorCoachingInsights'

describe('mentorCoachingInsights', () => {
 it('builds strengths/growth write-up from personality + values', () => {
 const writeUp = buildStrengthsWeaknessesWriteUp({
 name: 'Ada',
 personalityType: 'INTJ',
 coreValues: ['Growth', 'Excellence'],
 journeyType: '3M',
 })
 expect(writeUp.strengths.length).toBeGreaterThan(0)
 expect(writeUp.growthEdges.length).toBeGreaterThan(0)
 expect(writeUp.summary).toContain('Ada')
 })

 it('labels AI inference and keeps 2-3 lines', () => {
 const ai = buildAiInference({
 name: 'Ada',
 personalityType: 'ENFJ',
 coreValues: ['Compassion', 'Growth'],
 ageRange: '35-44',
 journeyType: '3M',
 })
 expect(ai.label).toBe('AI-generated')
 expect(ai.lines.length).toBeGreaterThanOrEqual(2)
 expect(ai.lines.length).toBeLessThanOrEqual(3)
 expect(ai.disclaimer.toLowerCase()).toContain('ai-generated')
 })

 it('plans 3 sessions for a 3-month journey', () => {
 const plan = buildMentoringSessionPlan({
 name: 'Ada',
 journeyType: '3M',
 })
 expect(plan.recommendedSessionCount).toBe(3)
 expect(plan.sessions).toHaveLength(3)
 expect(plan.sessions[0].suggestedTopics.length).toBeGreaterThan(0)
 })
})
