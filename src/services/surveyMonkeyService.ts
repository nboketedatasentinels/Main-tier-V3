import { supabase } from '@/services/supabase'

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

const FUNCTION_NAME = 'surveymonkey-list-surveys'

/**
 * Lists Pre/Post (or all) SurveyMonkey surveys + collector URLs via Edge Function.
 * Requires SURVEYMONKEY_ACCESS_TOKEN configured as a Supabase secret.
 */
export const listSurveyMonkeySurveys = async (
  kind: 'pre' | 'post' | 'course' | 'all' = 'course',
): Promise<SurveyMonkeyListedSurvey[]> => {
  const { data, error } = await supabase.functions.invoke<ListSurveysResponse>(FUNCTION_NAME, {
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
