import { supabase } from '@/services/supabase'

/**
 * Supabase writers for partner-managed user metadata. Replaces the direct
 * Firestore writes that lived in PartnerUserManagement (which failed with
 * "Missing or insufficient permissions" after the Firebase -> Supabase auth
 * cutover, since the partner no longer holds a Firebase session).
 *
 * Long-tail profile fields (nudgeEnabled, adminNotes, ...) are NOT columns on
 * `public.profiles` - they live in the `data` jsonb (see PROFILE_COLUMNS in
 * partnerSupabaseReads and splitProfileUpdates in AuthContext). supabase-js
 * cannot partial-merge jsonb in a single update, so we read the current `data`,
 * merge the patch, and write it back.
 */
export const mergeUserProfileData = async (
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> => {
  if (!userId) throw new Error('User id is required')

  const { data: row, error: readError } = await supabase
    .from('profiles')
    .select('data')
    .eq('id', userId)
    .maybeSingle()
  if (readError) throw new Error(readError.message)

  const current = (row?.data as Record<string, unknown> | null) ?? {}
  const merged = { ...current, ...patch }

  const { error } = await supabase
    .from('profiles')
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

/**
 * Records a partner-initiated engagement action against a learner in the
 * canonical `admin_activity_log` table (replaces the old
 * `users/{id}/engagement_actions` Firestore subcollection, which had no reader
 * and no Supabase home). Best-effort audit; the caller decides how to surface
 * failures.
 */
export const recordPartnerEngagementAction = async (params: {
  learnerId: string
  actionType: string
  actionLabel: string
  actorId?: string | null
  actorName?: string | null
}): Promise<void> => {
  const { error } = await supabase.from('admin_activity_log').insert({
    action: `engagement_action:${params.actionType}`,
    user_id: params.learnerId,
    admin_id: params.actorId ?? null,
    admin_name: params.actorName ?? null,
    created_at: new Date().toISOString(),
    metadata: {
      action_type: params.actionType,
      action_label: params.actionLabel,
    },
  })
  if (error) throw new Error(error.message)
}
