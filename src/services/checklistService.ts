import { supabase } from '@/services/supabase'
import { recordUserActivity } from './userProfileService'

/**
 * Weekly checklist state, backed by the Supabase `checklists` table (migration
 * 0035). This previously used the Firestore `checklists/{uid}_{week}` document,
 * but the Supabase auth cutover left no Firebase Auth session, so every write
 * was denied by the Firestore rules - surfacing to learners as
 * "Sync Error: Could not save your checklist progress".
 *
 * Storage shape: the table holds `activities` as a jsonb OBJECT keyed by
 * activity id so one activity can be patched atomically. The UI works in arrays
 * of `{ id, ... }`, so this module converts in both directions.
 *
 * The table's primary key is a text `id` of `${uid}_${week_number}`, carried over
 * from the Firestore doc-id convention - hence rowId() below.
 */

/** Primary key for one learner's week. Mirrors the old Firestore doc id. */
const rowId = (userId: string, weekNumber: number) => `${userId}_${weekNumber}`

export type ChecklistActivityEntry = {
  id: string
  status?: string
  hasInteracted?: boolean
  issuedByPartner?: boolean
  issuedBy?: string | null
  issuedAt?: string | null
  proofUrl?: string | null
  notes?: string | null
  rejectionReason?: string | null
}

type ChecklistActivityPatch = Omit<ChecklistActivityEntry, 'id'>

export interface ChecklistSnapshot {
  activities: ChecklistActivityEntry[]
  updatedAt?: string
}

/** jsonb object map -> the array of `{ id, ... }` entries the UI expects. */
const toEntries = (activities: unknown): ChecklistActivityEntry[] => {
  if (!activities || typeof activities !== 'object' || Array.isArray(activities)) {
    // Tolerate the legacy array shape in case a row was written that way.
    return Array.isArray(activities) ? (activities as ChecklistActivityEntry[]) : []
  }
  return Object.entries(activities as Record<string, Omit<ChecklistActivityEntry, 'id'>>).map(
    ([id, entry]) => ({ ...(entry ?? {}), id }),
  )
}

/** The UI's array -> the jsonb object map the table stores. */
const toMap = (activities: ChecklistActivityEntry[]): Record<string, ChecklistActivityPatch> => {
  const map: Record<string, ChecklistActivityPatch> = {}
  activities.forEach(({ id, ...rest }) => {
    if (id) map[id] = rest
  })
  return map
}

/** Patch a single activity. Atomic server-side, so concurrent writes (learner
 *  submitting proof while a partner approves another activity) cannot clobber. */
export async function upsertChecklistActivity(params: {
  userId: string
  weekNumber: number
  activityId: string
  patch: ChecklistActivityPatch
}) {
  const { error } = await supabase.rpc('upsert_checklist_activity', {
    p_uid: params.userId,
    p_week: params.weekNumber,
    p_activity_id: params.activityId,
    p_patch: params.patch,
  })
  if (error) throw new Error(error.message)

  // Record user activity for accurate "last active" tracking
  recordUserActivity(params.userId).catch((err) =>
    console.warn('[ChecklistService] Failed to record activity:', err),
  )
}

/** Replace the whole week's activity set (the checklist autosave path). */
export async function saveChecklistActivities(params: {
  userId: string
  weekNumber: number
  activities: ChecklistActivityEntry[]
}) {
  const { error } = await supabase.from('checklists').upsert(
    {
      id: rowId(params.userId, params.weekNumber),
      uid: params.userId,
      week_number: params.weekNumber,
      activities: toMap(params.activities),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (error) throw new Error(error.message)
}

export async function fetchChecklist(params: {
  userId: string
  weekNumber: number
}): Promise<ChecklistSnapshot | null> {
  const { data, error } = await supabase
    .from('checklists')
    .select('activities, updated_at')
    .eq('id', rowId(params.userId, params.weekNumber))
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    activities: toEntries((data as { activities?: unknown }).activities),
    updatedAt: (data as { updated_at?: string }).updated_at,
  }
}

/**
 * Initial fetch plus a realtime subscription on this learner's week - the
 * Supabase equivalent of the Firestore `onSnapshot` this replaced. Returns an
 * unsubscribe function; callers MUST call it on cleanup.
 */
export function subscribeToChecklist(
  params: { userId: string; weekNumber: number },
  onChange: (snapshot: ChecklistSnapshot) => void,
  onError?: (error: unknown) => void,
): () => void {
  let cancelled = false

  const load = async () => {
    try {
      const snapshot = await fetchChecklist(params)
      if (cancelled) return
      onChange(snapshot ?? { activities: [] })
    } catch (error) {
      if (cancelled) return
      onError?.(error)
    }
  }

  void load()

  const channel = supabase
    .channel(`checklists_${params.userId}_${params.weekNumber}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'checklists',
        filter: `uid=eq.${params.userId}`,
      },
      () => {
        void load()
      },
    )
    .subscribe()

  return () => {
    cancelled = true
    void supabase.removeChannel(channel)
  }
}
