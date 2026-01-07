import type {
  NudgeCampaignRecord,
  NudgeEffectivenessRecord,
  NudgeSentRecord,
  NudgeTemplateRecord,
} from '@/types/nudges'

const BOLT_URL = import.meta.env.VITE_SUPABASE_URL
const BOLT_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!BOLT_URL || !BOLT_KEY) {
  console.warn('Bolt database credentials are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

const buildBoltHeaders = () => ({
  apikey: BOLT_KEY,
  Authorization: `Bearer ${BOLT_KEY}`,
  'Content-Type': 'application/json',
})

const boltFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${BOLT_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...buildBoltHeaders(),
      ...(options?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Bolt request failed: ${response.status} ${errorText}`)
  }

  return response.json() as Promise<T>
}

export const fetchNudgeTemplates = async (onlyActive = false) => {
  const filter = onlyActive ? 'is_active=eq.true&' : ''
  return boltFetch<NudgeTemplateRecord[]>(`nudge_templates?${filter}order=created_at.desc`)
}

export const createNudgeTemplate = async (template: Omit<NudgeTemplateRecord, 'id' | 'created_at' | 'updated_at'>) => {
  const payload = [{ ...template }]
  const response = await boltFetch<NudgeTemplateRecord[]>(`nudge_templates`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { Prefer: 'return=representation' },
  })
  return response[0]
}

export const updateNudgeTemplate = async (id: string, updates: Partial<NudgeTemplateRecord>) => {
  const response = await boltFetch<NudgeTemplateRecord[]>(`nudge_templates?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
    headers: { Prefer: 'return=representation' },
  })
  return response[0]
}

export const logNudgeSent = async (payload: Omit<NudgeSentRecord, 'id' | 'sent_at'>) => {
  const response = await boltFetch<NudgeSentRecord[]>(`nudges_sent`, {
    method: 'POST',
    body: JSON.stringify([payload]),
    headers: { Prefer: 'return=representation' },
  })
  return response[0]
}

export const logNudgeEffectiveness = async (
  payload: Omit<NudgeEffectivenessRecord, 'id' | 'measured_at'>,
) => {
  const response = await boltFetch<NudgeEffectivenessRecord[]>(`nudge_effectiveness`, {
    method: 'POST',
    body: JSON.stringify([payload]),
    headers: { Prefer: 'return=representation' },
  })
  return response[0]
}

export const createNudgeCampaign = async (payload: Omit<NudgeCampaignRecord, 'id'>) => {
  const response = await boltFetch<NudgeCampaignRecord[]>(`nudge_campaigns`, {
    method: 'POST',
    body: JSON.stringify([payload]),
    headers: { Prefer: 'return=representation' },
  })
  return response[0]
}

export const fetchNudgeCampaigns = async () => {
  return boltFetch<NudgeCampaignRecord[]>(`nudge_campaigns?order=start_date.desc`)
}
