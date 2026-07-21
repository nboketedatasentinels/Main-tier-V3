import { supabase } from '@/services/supabase'
import { normalizeRole } from '@/utils/role'

/**
 * Admin -> partners/learners broadcast messaging.
 *
 * Writes one row per recipient into the Supabase `notifications` table (same
 * shape as notificationService.notifySupabaseUser), so each message lands in the
 * recipient's in-app bell (listenToUserNotifications reads `.eq('uid', ...)`).
 */
export type MessageAudience = 'partners' | 'learners' | 'everyone'

export const AUDIENCE_LABELS: Record<MessageAudience, string> = {
  partners: 'All partners',
  learners: 'All learners',
  everyone: 'All partners & learners',
}

const matchesAudience = (role: string, audience: MessageAudience): boolean => {
  const normalized = normalizeRole(role)
  const isPartner = normalized === 'partner'
  const isLearner = normalized === 'free_user' || normalized === 'paid_member'
  if (audience === 'partners') return isPartner
  if (audience === 'learners') return isLearner
  return isPartner || isLearner
}

/** How many recipients a given audience currently resolves to. */
export const countAudience = async (audience: MessageAudience): Promise<number> => {
  const { data, error } = await supabase.from('profiles').select('id, role')
  if (error) throw new Error(error.message)
  return ((data ?? []) as { id: string; role: string | null }[]).filter((r) =>
    matchesAudience(r.role ?? '', audience),
  ).length
}

/**
 * Sends an in-app notification to every profile matching `audience`.
 * Returns how many recipients were notified.
 */
export const sendAdminBroadcast = async (params: {
  audience: MessageAudience
  title: string
  message: string
  senderName?: string | null
}): Promise<{ sent: number }> => {
  const title = params.title.trim()
  const message = params.message.trim()
  if (!title) throw new Error('A title is required.')
  if (!message) throw new Error('A message is required.')

  const { data, error } = await supabase.from('profiles').select('id, role')
  if (error) throw new Error(error.message)

  const recipients = ((data ?? []) as { id: string; role: string | null }[])
    .filter((r) => matchesAudience(r.role ?? '', params.audience))
    .map((r) => r.id)
    .filter(Boolean)

  if (!recipients.length) return { sent: 0 }

  const nowIso = new Date().toISOString()
  const rows = recipients.map((uid) => ({
    uid,
    type: 'admin_message',
    notification_type: 'admin_message',
    category: 'announcement',
    title,
    message,
    is_read: false,
    related_id: null,
    created_at: nowIso,
    data: { from: params.senderName ?? 'Administrator', broadcast: true, audience: params.audience },
  }))

  // Chunk the bulk insert so a very large audience doesn't hit request limits.
  const CHUNK = 500
  let sent = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error: insertError } = await supabase.from('notifications').insert(chunk)
    if (insertError) throw new Error(insertError.message)
    sent += chunk.length
  }
  return { sent }
}
