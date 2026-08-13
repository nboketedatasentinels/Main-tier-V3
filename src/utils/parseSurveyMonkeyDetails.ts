/**
 * Faithful SurveyMonkey → native question mapping.
 * Expands matrix rows, keeps choice text, and reads real scale bounds.
 */
import type { CourseAssessmentQuestion } from '@/config/nativeCourseAssessments'

export type SurveyMonkeyRawQuestion = {
  id?: string
  family?: string
  subtype?: string
  headings?: Array<{ heading?: string }>
  answers?: {
    rows?: Array<{ id?: string; text?: string }>
    choices?: Array<{ id?: string; text?: string; weight?: number }>
  }
}

export type SurveyMonkeySurveyDetails = {
  id?: string
  title?: string
  pages?: Array<{
    id?: string
    title?: string
    questions?: SurveyMonkeyRawQuestion[]
  }>
}

export const stripSurveyMonkeyHtml = (value: string): string =>
  (value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()

const headingText = (q: SurveyMonkeyRawQuestion): string =>
  stripSurveyMonkeyHtml((q.headings || []).map((h) => h.heading || '').join(' '))

const resolveScale = (
  choices: Array<{ text?: string; weight?: number }> | undefined,
): { min: number; max: number } => {
  const weights = (choices || [])
    .map((c) => c.weight)
    .filter((w): w is number => typeof w === 'number' && Number.isFinite(w))
  if (weights.length > 0) {
    return { min: Math.min(...weights), max: Math.max(...weights) }
  }

  const parsed = (choices || [])
    .map((c) => Number.parseInt(String(c.text || '').trim(), 10))
    .filter((n) => Number.isFinite(n))
  if (parsed.length > 0) {
    return { min: Math.min(...parsed), max: Math.max(...parsed) }
  }

  return { min: 1, max: 10 }
}

/**
 * Convert SurveyMonkey survey details pages into native assessment questions.
 * Keeps every answerable item SurveyMonkey exposes for supported families.
 */
export const parseSurveyMonkeyDetailsToQuestions = (
  details: SurveyMonkeySurveyDetails | null | undefined,
): CourseAssessmentQuestion[] => {
  const questions: CourseAssessmentQuestion[] = []

  for (const page of details?.pages || []) {
    for (const q of page.questions || []) {
      const heading = headingText(q)
      const family = (q.family || '').toLowerCase()
      const subtype = (q.subtype || '').toLowerCase()

      if (family === 'presentation') {
        if (heading) questions.push({ type: 'info', text: heading })
        continue
      }

      if (family === 'matrix' && (subtype === 'rating' || subtype === 'single' || !subtype)) {
        const rows = (q.answers?.rows || [])
          .map((row) => stripSurveyMonkeyHtml(row.text || ''))
          .filter(Boolean)
        const scale = resolveScale(q.answers?.choices)

        if (rows.length > 0) {
          if (heading) questions.push({ type: 'info', text: heading })
          for (const row of rows) {
            questions.push({ type: 'rating', text: row, min: scale.min, max: scale.max })
          }
          continue
        }

        if (heading) {
          questions.push({ type: 'rating', text: heading, min: scale.min, max: scale.max })
        }
        continue
      }

      if (family === 'single_choice' || family === 'multiple_choice') {
        const choices = (q.answers?.choices || [])
          .map((c) => stripSurveyMonkeyHtml(c.text || ''))
          .filter(Boolean)
        if (!heading) continue
        // Native UI is single-select; preserve full choice list from SurveyMonkey.
        questions.push({ type: 'single_choice', text: heading, choices })
        continue
      }

      if (family === 'open_ended') {
        if (!heading) continue
        questions.push({
          type: subtype === 'essay' || subtype === 'multi' ? 'long_text' : 'short_text',
          text: heading,
        })
        continue
      }

      if (family === 'datetime' || family === 'demographic') {
        if (!heading) continue
        questions.push({ type: 'short_text', text: heading })
        continue
      }

      // Unknown families: keep the prompt so nothing from SM is silently dropped.
      if (heading) {
        questions.push({ type: 'long_text', text: heading })
      }
    }
  }

  return questions
}
