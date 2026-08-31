import type { CourseAssessmentDefinition } from '@/config/nativeCourseAssessments'
import { supabase } from '@/services/supabase'
import {
  parseSurveyMonkeyDetailsToQuestions,
  type SurveyMonkeySurveyDetails,
} from '@/utils/parseSurveyMonkeyDetails'
import type { CourseAssessmentQuestion } from '@/config/nativeCourseAssessments'

export type SurveyMonkeyKind = 'pre' | 'post' | 'other'

export interface SurveyMonkeyListedSurvey {
  id: string
  title: string
  kind: SurveyMonkeyKind
  collectorUrl: string | null
  collectorId: string | null
}

interface ListSurveysResponse {
  ok?: boolean
  count?: number
  surveys?: SurveyMonkeyListedSurvey[]
  error?: string
  message?: string
}

interface SurveyDetailsResponse {
  ok?: boolean
  surveyId?: string
  title?: string | null
  questionCount?: number
  questions?: CourseAssessmentQuestion[]
  pages?: SurveyMonkeySurveyDetails['pages']
  error?: string
  message?: string
}

const LIST_FUNCTION = 'surveymonkey-list-surveys'
const DETAILS_FUNCTION = 'surveymonkey-survey-details'

/** Short-lived in-memory cache so opening the same survey twice is cheap. */
const detailsCache = new Map<string, { at: number; questions: CourseAssessmentQuestion[]; title: string | null }>()
const DETAILS_CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Lists Pre/Post (or all) SurveyMonkey surveys + collector URLs via Edge Function.
 * Requires SURVEYMONKEY_ACCESS_TOKEN configured as a Supabase secret.
 */
export const listSurveyMonkeySurveys = async (
  kind: 'pre' | 'post' | 'course' | 'all' = 'course',
): Promise<SurveyMonkeyListedSurvey[]> => {
  const { data, error } = await supabase.functions.invoke<ListSurveysResponse>(LIST_FUNCTION, {
    body: { kind },
  })
  if (error) {
    throw new Error(error.message || 'Failed to list SurveyMonkey surveys')
  }
  if (data?.error) {
    throw new Error(data.message || data.error)
  }
  return data?.surveys ?? []
}

/**
 * Live-pull SurveyMonkey questions for one survey id (exact wording from SM).
 */
export const fetchSurveyMonkeyQuestions = async (
  surveyId: string,
): Promise<{ surveyId: string; title: string | null; questions: CourseAssessmentQuestion[] }> => {
  const id = surveyId.trim()
  if (!id) throw new Error('Missing SurveyMonkey survey id')

  const cached = detailsCache.get(id)
  if (cached && Date.now() - cached.at < DETAILS_CACHE_TTL_MS) {
    return { surveyId: id, title: cached.title, questions: cached.questions }
  }

  const { data, error } = await supabase.functions.invoke<SurveyDetailsResponse>(DETAILS_FUNCTION, {
    body: { surveyId: id },
  })
  if (error) {
    throw new Error(error.message || 'Failed to load SurveyMonkey survey details')
  }
  if (data?.error) {
    throw new Error(data.message || data.error)
  }

  let questions = data?.questions ?? []
  // Prefer server parse; if empty, re-parse raw pages on the client.
  if ((!questions.length || !Array.isArray(questions)) && data?.pages) {
    questions = parseSurveyMonkeyDetailsToQuestions({ pages: data.pages })
  }
  if (!questions.length) {
    throw new Error('SurveyMonkey returned no questions for this survey')
  }

  const title = data?.title ?? null
  detailsCache.set(id, { at: Date.now(), title, questions })
  return { surveyId: data?.surveyId || id, title, questions }
}

/**
 * Replace catalog snapshot questions with a live SurveyMonkey pull.
 * @deprecated SurveyMonkey runtime hydrate is retired - always returns catalog.
 * Kept so call sites compile until fully removed.
 */
export const hydrateCourseAssessmentFromSurveyMonkey = async (
  definition: CourseAssessmentDefinition,
): Promise<{ definition: CourseAssessmentDefinition; source: 'surveymonkey' | 'catalog' }> => {
  return { definition, source: 'catalog' }
}
