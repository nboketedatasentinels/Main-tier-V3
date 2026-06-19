import { supabase } from '@/services/supabase'

export type FeedbackCategory = 'bug' | 'feature_request' | 'general' | 'appreciation'

export type FeedbackStatus = 'new' | 'reviewed' | 'resolved'

export interface FeedbackInput {
  userId: string | null
  userEmail: string | null
  userName: string | null
  category: FeedbackCategory
  message: string
  pageContext?: string | null
}

export interface FeedbackRecord {
  id: string
  userId: string | null
  userEmail: string | null
  userName: string | null
  category: FeedbackCategory
  message: string
  pageContext: string | null
  status: FeedbackStatus
  createdAt: Date | null
  reviewedAt: Date | null
  reviewedBy: string | null
}

const FEEDBACK_TABLE = 'feedback'

interface FeedbackRow {
  id: string
  uid: string | null
  user_email: string | null
  user_name: string | null
  category: string | null
  message: string | null
  page_context: string | null
  status: string | null
  reviewed_by: string | null
  created_at: string | null
  reviewed_at: string | null
  updated_at?: string | null
  data?: Record<string, unknown> | null
}

const toDate = (value: string | null | undefined): Date | null => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const mapRow = (row: FeedbackRow): FeedbackRecord => ({
  id: row.id,
  userId: row.uid ?? null,
  userEmail: row.user_email ?? null,
  userName: row.user_name ?? null,
  category: (row.category as FeedbackCategory) ?? 'general',
  message: row.message ?? '',
  pageContext: row.page_context ?? null,
  status: (row.status as FeedbackStatus) ?? 'new',
  createdAt: toDate(row.created_at),
  reviewedAt: toDate(row.reviewed_at),
  reviewedBy: row.reviewed_by ?? null,
})

export const submitFeedback = async (input: FeedbackInput): Promise<string> => {
  const id = crypto.randomUUID()
  const nowIso = new Date().toISOString()

  const { error } = await supabase.from(FEEDBACK_TABLE).insert({
    id,
    uid: input.userId,
    user_email: input.userEmail,
    user_name: input.userName,
    category: input.category,
    message: input.message.trim(),
    page_context: input.pageContext ?? null,
    status: 'new',
    created_at: nowIso,
    updated_at: nowIso,
  })

  if (error) {
    console.error('[feedbackService] submitFeedback failed', error)
    throw new Error(error.message)
  }

  return id
}

// Monotonic suffix so every realtime subscription gets a distinct channel topic
// (see the comment at the channel() call for why this is required).
let feedbackChannelSeq = 0

export const subscribeToFeedback = (
  onUpdate: (records: FeedbackRecord[]) => void,
  onError?: (err: Error) => void
) => {
  let active = true

  const fetchAll = async () => {
    const { data, error } = await supabase
      .from(FEEDBACK_TABLE)
      .select('*')
      .order('created_at', { ascending: false })

    if (!active) return

    if (error) {
      console.error('[feedbackService] subscribe fetch failed', error)
      onError?.(new Error(error.message))
      return
    }

    const records = ((data as FeedbackRow[]) ?? []).map(mapRow)
    onUpdate(records)
  }

  // Initial load.
  void fetchAll()

  // Realtime: re-fetch on any change to the feedback table. Unique topic per
  // subscription - supabase.channel(topic) reuses a same-topic channel, so a
  // remount before async teardown (or two mounts at once) would hit an
  // already-subscribed channel and `.on()` would throw "cannot add
  // postgres_changes callbacks after subscribe()".
  const channel = supabase
    .channel(`feedback-changes_${++feedbackChannelSeq}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: FEEDBACK_TABLE },
      () => {
        void fetchAll()
      }
    )
    .subscribe()

  return () => {
    active = false
    void supabase.removeChannel(channel)
  }
}

export const updateFeedbackStatus = async (
  feedbackId: string,
  status: FeedbackStatus,
  reviewerId: string | null
): Promise<void> => {
  const nowIso = new Date().toISOString()

  const { error } = await supabase
    .from(FEEDBACK_TABLE)
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', feedbackId)

  if (error) {
    console.error('[feedbackService] updateFeedbackStatus failed', error)
    throw new Error(error.message)
  }
}
