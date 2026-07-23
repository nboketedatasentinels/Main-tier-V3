import { supabase } from '@/services/supabase'
import { normalizeRole } from '@/utils/role'

/**
 * Admin -> partners/learners broadcast messaging.
 *
 * Writes one row per recipient into the Supabase `notifications` table (same
 * shape as notificationService.notifySupabaseUser), so each message lands in the
 * recipient's in-app bell (listenToUserNotifications reads `.eq('uid', ...)`).
 *
 * Audiences cover the whole partner or learner population, or a single named
 * person via the `individual` mode (see resolveRecipientIds / searchRecipients).
 */
export type MessageAudience = 'partners' | 'learners' | 'everyone' | 'individual'

export const AUDIENCE_LABELS: Record<MessageAudience, string> = {
  partners: 'All partners',
  learners: 'All learners',
  everyone: 'All partners & learners',
  individual: 'A specific person',
}

/** A partner or learner an admin can message directly. */
export type RecipientOption = {
  id: string
  name: string
  email: string | null
  role: string
}

type ProfileRow = {
  id: string
  role: string | null
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}

const isPartnerRole = (role: string) => normalizeRole(role) === 'partner'
const isLearnerRole = (role: string) => {
  const normalized = normalizeRole(role)
  return normalized === 'free_user' || normalized === 'paid_member'
}

const matchesAudience = (role: string, audience: MessageAudience): boolean => {
  const partner = isPartnerRole(role)
  const learner = isLearnerRole(role)
  if (audience === 'partners') return partner
  if (audience === 'learners') return learner
  // `everyone` (and, for counting purposes, `individual`) span partners + learners.
  return partner || learner
}

const displayName = (row: ProfileRow): string =>
  (row.full_name && row.full_name.trim()) ||
  [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
  (row.email && row.email.trim()) ||
  'Unnamed user'

/** How many recipients a given audience currently resolves to. */
export const countAudience = async (audience: MessageAudience): Promise<number> => {
  const { data, error } = await supabase.from('profiles').select('id, role')
  if (error) throw new Error(error.message)
  return ((data ?? []) as { id: string; role: string | null }[]).filter((r) =>
    matchesAudience(r.role ?? '', audience),
  ).length
}

/**
 * Searches partners + learners by name or email for the "specific person" mode.
 * Returns at most `limit` matches, ordered by name. An empty term returns the
 * first `limit` messageable profiles so the picker is useful before typing.
 */
export const searchRecipients = async (
  term: string,
  limit = 20,
): Promise<RecipientOption[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, first_name, last_name, email')
    .order('full_name', { ascending: true })
  if (error) throw new Error(error.message)

  const needle = term.trim().toLowerCase()
  return ((data ?? []) as ProfileRow[])
    .filter((row) => row.id && matchesAudience(row.role ?? '', 'everyone'))
    .filter((row) => {
      if (!needle) return true
      const haystack = `${displayName(row)} ${row.email ?? ''}`.toLowerCase()
      return haystack.includes(needle)
    })
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      name: displayName(row),
      email: row.email ?? null,
      role: normalizeRole(row.role ?? ''),
    }))
}

/** Resolves the concrete recipient uids for a send. */
const resolveRecipientIds = async (
  audience: MessageAudience,
  recipientId?: string | null,
): Promise<string[]> => {
  if (audience === 'individual') {
    return recipientId ? [recipientId] : []
  }
  const { data, error } = await supabase.from('profiles').select('id, role')
  if (error) throw new Error(error.message)
  return ((data ?? []) as { id: string; role: string | null }[])
    .filter((r) => matchesAudience(r.role ?? '', audience))
    .map((r) => r.id)
    .filter(Boolean)
}

/**
 * Sends an in-app notification to every profile matching `audience` (or to the
 * single `recipientId` when audience is `individual`).
 * Returns how many recipients were notified.
 */
export const sendAdminBroadcast = async (params: {
  audience: MessageAudience
  title: string
  message: string
  senderName?: string | null
  recipientId?: string | null
}): Promise<{ sent: number }> => {
  const title = params.title.trim()
  const message = params.message.trim()
  if (!title) throw new Error('A title is required.')
  if (!message) throw new Error('A message is required.')
  if (params.audience === 'individual' && !params.recipientId) {
    throw new Error('Select a recipient to message.')
  }

  const recipients = await resolveRecipientIds(params.audience, params.recipientId)
  if (!recipients.length) return { sent: 0 }

  const nowIso = new Date().toISOString()
  const rows = recipients.map((uid) => ({
    uid,
    type: 'admin_message',
    notification_type: 'admin_message',
    // Valid NotificationCategory so the notification is grouped/filtered
    // consistently in the in-app bell.
    category: 'important_updates',
    title,
    message,
    is_read: false,
    related_id: null,
    created_at: nowIso,
    data: {
      from: params.senderName ?? 'Administrator',
      broadcast: params.audience !== 'individual',
      audience: params.audience,
    },
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
