/**
 * Coach (ambassador) session slots + bookings - Supabase-backed.
 * Replaces Firestore ambassador_slots / ambassador_slot_bookings which fail
 * under Supabase-only auth ("Missing or insufficient permissions").
 */
import { supabase } from '@/services/supabase'
import { awardChecklistPoints } from '@/services/pointsService'
import { upsertChecklistActivity } from '@/services/checklistService'
import { notifyAsLeadership, notifyCoachSlotPublished } from '@/services/notificationService'
import { getActivityDefinitionById } from '@/config/pointsConfig'
import { assertMandatoryLiftComplete } from '@/services/liftAssessmentService'
import { resolveLearnerJourneyContextDetailed } from '@/services/learnerJourneyContext'
import { assertCoachMeetingAllowedThisMonth } from '@/services/sessionMonthLimit'

export type CoachSlotStatus = 'open' | 'full' | 'cancelled' | 'completed'
export type CoachBookingStatus = 'booked' | 'attended' | 'no_show' | 'cancelled'

export interface CoachSlot {
 id: string
 ambassadorId: string
 ambassadorName: string | null
 companyId: string
 companyCode: string | null
 title: string
 description: string | null
 scheduledAt: Date
 durationMinutes: number
 capacity: number
 meetingLink: string | null
 location: string | null
 status: CoachSlotStatus
 bookingCount: number
 cancellationReason: string | null
 createdAt: Date
 updatedAt: Date | null
}

export interface CoachBooking {
 id: string
 slotId: string
 learnerId: string
 learnerName: string | null
 ambassadorId: string
 companyId: string | null
 status: CoachBookingStatus
 bookedAt: Date
 attendedAt: Date | null
 cancelledAt: Date | null
 cancelledBy: string | null
 cancelReason: string | null
 pointsAwarded: boolean
 pointsAwardedAt: Date | null
 slotTitle: string | null
 slotScheduledAt: Date | null
 slotStatus: CoachSlotStatus | null
}

type Unsubscribe = () => void

const parseTs = (value: unknown): Date | null => {
 if (!value) return null
 if (value instanceof Date) return value
 if (typeof value === 'string' || typeof value === 'number') {
 const d = new Date(value)
 return Number.isNaN(d.getTime()) ? null : d
 }
 return null
}

const pickString = (value: unknown): string | null =>
 typeof value === 'string' && value.trim().length > 0 ? value : null

const mapSlot = (row: Record<string, unknown>): CoachSlot => ({
 id: String(row.id ?? ''),
 ambassadorId: pickString(row.ambassador_id) ?? '',
 ambassadorName: pickString(row.ambassador_name),
 companyId: pickString(row.company_id) ?? '',
 companyCode: pickString(row.company_code),
 title: pickString(row.title) ?? 'Coach coaching session',
 description: pickString(row.description),
 scheduledAt: parseTs(row.scheduled_at) ?? new Date(),
 durationMinutes: Number(row.duration_minutes ?? 60) || 60,
 capacity: Math.max(1, Number(row.capacity ?? 1)),
 meetingLink: pickString(row.meeting_link),
 location: pickString(row.location),
 status: (row.status as CoachSlotStatus) || 'open',
 bookingCount: Math.max(0, Number(row.booking_count ?? 0)),
 cancellationReason: pickString(row.cancellation_reason),
 createdAt: parseTs(row.created_at) ?? new Date(),
 updatedAt: parseTs(row.updated_at),
})

const mapBooking = (row: Record<string, unknown>): CoachBooking => ({
 id: String(row.id ?? ''),
 slotId: pickString(row.slot_id) ?? '',
 learnerId: pickString(row.learner_id) ?? '',
 learnerName: pickString(row.learner_name),
 ambassadorId: pickString(row.ambassador_id) ?? '',
 companyId: pickString(row.company_id),
 status: (row.status as CoachBookingStatus) || 'booked',
 bookedAt: parseTs(row.booked_at) ?? new Date(),
 attendedAt: parseTs(row.attended_at),
 cancelledAt: parseTs(row.cancelled_at),
 cancelledBy: pickString(row.cancelled_by),
 cancelReason: pickString(row.cancel_reason),
 pointsAwarded: Boolean(row.points_awarded),
 pointsAwardedAt: parseTs(row.points_awarded_at),
 slotTitle: pickString(row.slot_title),
 slotScheduledAt: parseTs(row.slot_scheduled_at),
 slotStatus: (pickString(row.slot_status) as CoachSlotStatus | null) ?? null,
})

const bookingIdFor = (slotId: string, learnerId: string) => `${slotId}__${learnerId}`

async function getJourneyContext(uid: string) {
 return resolveLearnerJourneyContextDetailed(uid)
}

let coachRealtimeChannelSeq = 0

const subscribeQuery = <T>(
 load: () => Promise<T>,
 onUpdate: (value: T) => void,
 onError?: (error: Error) => void,
 channelName?: string,
 table?: string,
 filter?: string,
): Unsubscribe => {
 let cancelled = false

 const run = async () => {
 try {
 const value = await load()
 if (!cancelled) onUpdate(value)
 } catch (err) {
 if (cancelled) return
 onError?.(err instanceof Error ? err : new Error(String(err)))
 }
 }

 void run()

 // Always unique topic - fixed names like coach-learner-bookings-<id> collide when
 // AmbassadorDashboard + Session Prep subscribe together and crash with
 // "cannot add postgres_changes callbacks after subscribe()".
 let channel: ReturnType<typeof supabase.channel> | null = null
 if (channelName && table) {
 try {
 channel = supabase
 .channel(`${channelName}_${++coachRealtimeChannelSeq}`)
 .on(
 'postgres_changes',
 {
 event: '*',
 schema: 'public',
 table,
 ...(filter ? { filter } : {}),
 },
 () => {
 void run()
 },
 )
 .subscribe()
 } catch (err) {
 console.warn('[ambassadorSessionService] realtime subscribe skipped', err)
 channel = null
 }
 }

 const poll = window.setInterval(() => {
 void run()
 }, 20_000)

 return () => {
 cancelled = true
 window.clearInterval(poll)
 if (channel) void supabase.removeChannel(channel)
 }
}

export async function createCoachSlot(params: {
 ambassadorId: string
 ambassadorName?: string
 companyId: string
 companyCode?: string
 title: string
 description?: string
 scheduledAt: Date
 durationMinutes?: number
 capacity: number
 meetingLink?: string
 location?: string
}): Promise<string> {
 const {
 ambassadorId,
 ambassadorName,
 companyId,
 companyCode,
 title,
 description,
 scheduledAt,
 durationMinutes = 60,
 capacity,
 meetingLink,
 location,
 } = params

 if (!ambassadorId) throw new Error('Coach id is required.')
 if (!companyId) throw new Error('Organization is required.')
 if (!title.trim()) throw new Error('A session title is required.')
 if (capacity < 1) throw new Error('Capacity must be at least 1 learner.')
 if (scheduledAt.getTime() < Date.now() - 60_000) {
 throw new Error('Scheduled time must be in the future.')
 }

 const { data, error } = await supabase
 .from('ambassador_slots')
 .insert({
 ambassador_id: ambassadorId,
 ambassador_name: ambassadorName ?? null,
 company_id: companyId,
 company_code: companyCode ?? null,
 title: title.trim(),
 description: description?.trim() || null,
 scheduled_at: scheduledAt.toISOString(),
 duration_minutes: Math.max(15, Math.round(durationMinutes)),
 capacity: Math.round(capacity),
 meeting_link: meetingLink?.trim() || null,
 location: location?.trim() || null,
 status: 'open',
 booking_count: 0,
 created_by: ambassadorId,
 })
 .select('id')
 .single()

 if (error) throw new Error(error.message)
 const slotId = String(data.id)

 try {
 await notifyCoachSlotPublished(slotId)
 } catch (err) {
 console.warn('[CoachSessionService] notify coachees of new slot failed:', err)
 }

 return slotId
}

export async function updateCoachSlot(params: {
 slotId: string
 updates: Partial<{
 title: string
 description: string | null
 scheduledAt: Date
 durationMinutes: number
 capacity: number
 meetingLink: string | null
 location: string | null
 }>
}): Promise<void> {
 const { slotId, updates } = params
 const { data: existing, error: readError } = await supabase
 .from('ambassador_slots')
 .select('booking_count, status')
 .eq('id', slotId)
 .maybeSingle()

 if (readError) throw new Error(readError.message)
 if (!existing) throw new Error('Slot not found.')
 if (existing.status === 'cancelled' || existing.status === 'completed') {
 throw new Error('Slot is closed and cannot be edited.')
 }

 const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
 if (updates.title !== undefined) payload.title = updates.title.trim()
 if (updates.description !== undefined) payload.description = updates.description
 if (updates.scheduledAt) payload.scheduled_at = updates.scheduledAt.toISOString()
 if (updates.durationMinutes !== undefined) {
 payload.duration_minutes = Math.max(15, Math.round(updates.durationMinutes))
 }
 if (updates.capacity !== undefined) {
 const currentBookings = Number(existing.booking_count ?? 0)
 if (updates.capacity < currentBookings) {
 throw new Error(`Capacity cannot be below current booking count (${currentBookings}).`)
 }
 payload.capacity = Math.round(updates.capacity)
 if (existing.status === 'full' && updates.capacity > currentBookings) {
 payload.status = 'open'
 }
 }
 if (updates.meetingLink !== undefined) payload.meeting_link = updates.meetingLink
 if (updates.location !== undefined) payload.location = updates.location

 const { error } = await supabase.from('ambassador_slots').update(payload).eq('id', slotId)
 if (error) throw new Error(error.message)
}

export async function cancelCoachSlot(params: {
 slotId: string
 actorId: string
 reason?: string
}): Promise<void> {
 const { slotId, actorId, reason } = params
 const { data: slot, error: readError } = await supabase
 .from('ambassador_slots')
 .select('status, title')
 .eq('id', slotId)
 .maybeSingle()

 if (readError) throw new Error(readError.message)
 if (!slot) throw new Error('Slot not found.')
 if (slot.status === 'cancelled' || slot.status === 'completed') {
 throw new Error('Slot is already closed.')
 }

 const { error: slotError } = await supabase
 .from('ambassador_slots')
 .update({
 status: 'cancelled',
 cancellation_reason: reason?.trim() || null,
 cancelled_by: actorId,
 updated_at: new Date().toISOString(),
 })
 .eq('id', slotId)
 if (slotError) throw new Error(slotError.message)

 const { data: bookings, error: bookingsError } = await supabase
 .from('ambassador_slot_bookings')
 .select('id, learner_id')
 .eq('slot_id', slotId)
 .eq('status', 'booked')
 if (bookingsError) throw new Error(bookingsError.message)

 const notifyPromises: Promise<unknown>[] = []
 for (const booking of bookings ?? []) {
 const { error } = await supabase
 .from('ambassador_slot_bookings')
 .update({
 status: 'cancelled',
 cancelled_at: new Date().toISOString(),
 cancelled_by: actorId,
 cancel_reason: reason?.trim() || 'Coach cancelled the session',
 slot_status: 'cancelled',
 updated_at: new Date().toISOString(),
 })
 .eq('id', booking.id)
 if (error) throw new Error(error.message)

 if (booking.learner_id) {
 notifyPromises.push(
 notifyAsLeadership({
 userId: booking.learner_id,
 type: 'important_update',
 title: 'Coach session cancelled',
 message: reason?.trim()
 ? `${slot.title ?? 'A coaching session'} was cancelled. Reason: ${reason.trim()}`
 : `${slot.title ?? 'A coaching session'} was cancelled by the coach.`,
 relatedId: slotId,
 category: 'important_updates',
 data: { priority: 'push', slotId, kind: 'ambassador_slot_cancelled' },
 }).catch((err) =>
 console.warn('[CoachSessionService] notify cancel fan-out failed:', err),
 ),
 )
 }
 }
 await Promise.all(notifyPromises)
}

export async function bookCoachSlot(params: {
 slotId: string
 learnerId: string
 learnerName?: string
 companyId?: string
}): Promise<string> {
 const { slotId, learnerId, learnerName, companyId } = params
 if (!slotId || !learnerId) throw new Error('Slot and learner ids are required.')

 await assertMandatoryLiftComplete(learnerId)

 const { data: slotRow, error: slotReadError } = await supabase
 .from('ambassador_slots')
 .select('ambassador_id, title, scheduled_at')
 .eq('id', slotId)
 .maybeSingle()
 if (slotReadError) throw new Error(slotReadError.message)
 if (!slotRow) throw new Error('Session slot not found.')

 const sessionAt = slotRow.scheduled_at ? new Date(String(slotRow.scheduled_at)) : new Date()
 const { data: auth } = await supabase.auth.getUser()
 const forSelf = auth?.user?.id === learnerId
 await assertCoachMeetingAllowedThisMonth({
 learnerId,
 sessionAt,
 forSelf,
 })

 const { data, error } = await supabase.rpc('book_ambassador_slot', {
 p_slot_id: slotId,
 p_learner_id: learnerId,
 p_learner_name: learnerName ?? null,
 p_company_id: companyId ?? null,
 })

 if (error) throw new Error(error.message)
 const bookingId = String(data)

 if (slotRow.ambassador_id) {
 await notifyAsLeadership({
 userId: slotRow.ambassador_id,
 type: 'session_request',
 title: 'New booking on your coaching session',
 message: `${learnerName ?? 'A learner'} booked "${slotRow.title ?? 'your session'}".`,
 relatedId: slotId,
 category: 'action_required',
 data: { priority: 'push', slotId, bookingId, learnerId, kind: 'ambassador_slot_booked' },
 }).catch((err) => console.warn('[CoachSessionService] notify booking failed:', err))
 }

 return bookingId
}

export async function cancelBooking(params: {
 bookingId: string
 actorId: string
 reason?: string
}): Promise<void> {
 const { bookingId, actorId, reason } = params
 const { data: booking, error: readError } = await supabase
 .from('ambassador_slot_bookings')
 .select('status, slot_id')
 .eq('id', bookingId)
 .maybeSingle()

 if (readError) throw new Error(readError.message)
 if (!booking) throw new Error('Booking not found.')
 if (booking.status !== 'booked') {
 throw new Error('Booking cannot be cancelled in its current state.')
 }

 const slotId = booking.slot_id as string
 const { data: slot } = await supabase
 .from('ambassador_slots')
 .select('status, booking_count')
 .eq('id', slotId)
 .maybeSingle()

 const { error: bookingError } = await supabase
 .from('ambassador_slot_bookings')
 .update({
 status: 'cancelled',
 cancelled_at: new Date().toISOString(),
 cancelled_by: actorId,
 cancel_reason: reason?.trim() || null,
 updated_at: new Date().toISOString(),
 })
 .eq('id', bookingId)
 if (bookingError) throw new Error(bookingError.message)

 if (slot) {
 const nextCount = Math.max(0, Number(slot.booking_count ?? 0) - 1)
 const { error: slotError } = await supabase
 .from('ambassador_slots')
 .update({
 booking_count: nextCount,
 status: slot.status === 'full' ? 'open' : slot.status,
 updated_at: new Date().toISOString(),
 })
 .eq('id', slotId)
 if (slotError) throw new Error(slotError.message)
 }
}

export async function markAttendance(params: {
 bookingId: string
 status: 'attended' | 'no_show'
 markedBy: string
 /** When true, update attendance status only (no checklist points attempt). */
 skipPoints?: boolean
}): Promise<{ pointsAwarded: boolean; pointsAmount?: number; message?: string }> {
 const { bookingId, status, markedBy, skipPoints = false } = params

 const { data: booking, error: readError } = await supabase
 .from('ambassador_slot_bookings')
 .select('*')
 .eq('id', bookingId)
 .maybeSingle()

 if (readError) throw new Error(readError.message)
 if (!booking) throw new Error('Booking not found.')

 const currentStatus = booking.status as CoachBookingStatus | undefined
 const learnerId = pickString(booking.learner_id)
 const slotTitle = pickString(booking.slot_title)
 const alreadyAwarded = Boolean(booking.points_awarded)
 const slotId = pickString(booking.slot_id)
 let coachName: string | null = null
 if (slotId) {
 const { data: slotRow } = await supabase
 .from('ambassador_slots')
 .select('ambassador_name, title')
 .eq('id', slotId)
 .maybeSingle()
 coachName = pickString(slotRow?.ambassador_name)
 if (!slotTitle && slotRow) {
 // keep slotTitle from booking when present
 }
 }
 const coachLabel = coachName?.trim() ? `Coach ${coachName.trim()}` : 'Your coach'
 const sessionLabel = slotTitle ?? 'the session'

 // Same status again: allow a points-only retry when attended but not awarded.
 if (currentStatus === status) {
 if (skipPoints || !(status === 'attended' && !alreadyAwarded && learnerId)) {
 return {
 pointsAwarded: alreadyAwarded,
 pointsAmount: alreadyAwarded ? 2000 : 0,
 message: alreadyAwarded ? undefined : 'Already marked attended',
 }
 }
 } else {
 if (currentStatus !== 'booked' && currentStatus !== 'attended' && currentStatus !== 'no_show') {
 throw new Error('Attendance can only be marked on active bookings.')
 }

 const { error: updateError } = await supabase
 .from('ambassador_slot_bookings')
 .update({
 status,
 attended_at: status === 'attended' ? new Date().toISOString() : null,
 marked_by: markedBy,
 points_awarded: status === 'no_show' ? false : alreadyAwarded,
 points_awarded_at: status === 'no_show' ? null : booking.points_awarded_at,
 updated_at: new Date().toISOString(),
 })
 .eq('id', bookingId)
 if (updateError) throw new Error(updateError.message)

 if (skipPoints) {
 // Attendance-only update (e.g. purchased-session cap reached).
 if (learnerId) {
 await notifyAsLeadership({
 userId: learnerId,
 type: 'approval',
 title:
 status === 'attended'
 ? `${coachLabel} confirmed your attendance`
 : `${coachLabel} recorded a no-show`,
 message:
 status === 'attended'
 ? `${coachLabel} confirmed your attendance at "${sessionLabel}".`
 : `${coachLabel} recorded a no-show for "${sessionLabel}".`,
 relatedId: bookingId,
 category: 'important_updates',
 data: {
 priority: 'push',
 bookingId,
 kind: 'ambassador_attendance',
 pointsAwarded: false,
 pointsAmount: 0,
 actorRole: 'coach',
 actorName: coachName,
 },
 }).catch((err) =>
 console.warn('[CoachSessionService] notify attendance failed:', err),
 )
 }
 return {
 pointsAwarded: false,
 pointsAmount: 0,
 message: status === 'attended' ? 'Attendance saved without points.' : undefined,
 }
 }
 }

 const shouldAttemptAward = !skipPoints && status === 'attended' && !alreadyAwarded
 let pointsAwarded = false
 let pointsAmount = 0
 let awardMessage: string | undefined

 if (shouldAttemptAward && learnerId) {
 try {
 const context = await getJourneyContext(learnerId)
 if (!context.ok) {
 if (context.reason === 'forbidden') {
 awardMessage =
 'Attendance saved, but coach points could not be issued (coach link not recognised). Try Issue +2,000 again.'
 } else if (context.reason === 'missing_journey') {
 awardMessage =
 'Attendance saved, but this learner has no journey type set - points need an active journey (e.g. 3M / 6M / 9M).'
 } else {
 awardMessage =
 'Attendance saved, but journey details could not be loaded for points. Try Issue +2,000 again.'
 }
 } else {
 const activity = getActivityDefinitionById({
 activityId: 'ambassador_session',
 journeyType: context.journeyType,
 })
 if (!activity) {
 awardMessage = 'Coach session points are not part of this journey.'
 } else {
 const result = await awardChecklistPoints({
 uid: learnerId,
 journeyType: context.journeyType,
 weekNumber: context.weekNumber,
 activity,
 source: 'ambassador_attendance',
 claimRef: `ambassador_session:${bookingId}`,
 })
 if (result.awarded || result.reason === 'already_awarded') {
 pointsAwarded = true
 pointsAmount = activity.points
 await supabase
 .from('ambassador_slot_bookings')
 .update({
 points_awarded: true,
 points_awarded_at: new Date().toISOString(),
 })
 .eq('id', bookingId)
 // Mark Done on the learner checklist for this week (ledger drives the count).
 await upsertChecklistActivity({
 userId: learnerId,
 weekNumber: context.weekNumber,
 activityId: 'ambassador_session',
 patch: {
 status: 'completed',
 hasInteracted: true,
 issuedByPartner: false,
 },
 }).catch((err) =>
 console.warn('[CoachSessionService] checklist upsert after points failed:', err),
 )
 } else {
 awardMessage = result.message ?? 'Could not issue coach session points.'
 }
 }
 }
 } catch (err) {
 console.error('[CoachSessionService] Failed to award attendance points:', err)
 awardMessage =
 err instanceof Error ? err.message : 'Could not issue coach session points.'
 }
 }

 const statusChanged = currentStatus !== status
 const newlyAwardedPoints = pointsAwarded && !alreadyAwarded
 if (learnerId && (statusChanged || newlyAwardedPoints)) {
 await notifyAsLeadership({
 userId: learnerId,
 type: 'approval',
 title: newlyAwardedPoints
 ? `+${(pointsAmount || 2000).toLocaleString()} Coach Session points`
 : status === 'attended'
 ? `${coachLabel} confirmed your attendance`
 : `${coachLabel} recorded a no-show`,
 message: newlyAwardedPoints
 ? statusChanged
 ? `${coachLabel} confirmed your attendance at "${sessionLabel}" and added +${(pointsAmount || 2000).toLocaleString()} Coach Session points to your journey.`
 : `${coachLabel} issued +${(pointsAmount || 2000).toLocaleString()} Coach Session points for "${sessionLabel}". They are on your journey dashboard.`
 : status === 'attended'
 ? `${coachLabel} confirmed your attendance at "${sessionLabel}".${
 awardMessage ? ` ${awardMessage}` : ''
 }`
 : `${coachLabel} recorded a no-show for "${sessionLabel}".`,
 relatedId: bookingId,
 category: 'important_updates',
 data: {
 priority: 'push',
 bookingId,
 kind: newlyAwardedPoints ? 'coach_points_awarded' : 'ambassador_attendance',
 pointsAwarded: newlyAwardedPoints,
 pointsAmount: newlyAwardedPoints ? pointsAmount || 2000 : 0,
 actorRole: 'coach',
 actorName: coachName,
 source: 'Coach Session',
 },
 }).catch((err) =>
 console.warn('[CoachSessionService] notify attendance failed:', err),
 )
 }

 return { pointsAwarded, pointsAmount, message: awardMessage }
}

export async function markSlotCompleted(slotId: string): Promise<void> {
 const { error } = await supabase
 .from('ambassador_slots')
 .update({ status: 'completed', updated_at: new Date().toISOString() })
 .eq('id', slotId)
 if (error) throw new Error(error.message)
}

export const subscribeToCoachSlots = (
 ambassadorId: string,
 onUpdate: (slots: CoachSlot[]) => void,
 onError?: (error: Error) => void,
): Unsubscribe =>
 subscribeQuery(
 async () => {
 const { data, error } = await supabase
 .from('ambassador_slots')
 .select('*')
 .eq('ambassador_id', ambassadorId)
 .order('scheduled_at', { ascending: true })
 if (error) throw new Error(error.message)
 return (data ?? []).map((row) => mapSlot(row as Record<string, unknown>))
 },
 onUpdate,
 onError,
 `coach-slots-${ambassadorId}`,
 'ambassador_slots',
 `ambassador_id=eq.${ambassadorId}`,
 )

export const subscribeToOpenSlotsForOrg = (
 companyId: string,
 onUpdate: (slots: CoachSlot[]) => void,
 onError?: (error: Error) => void,
): Unsubscribe =>
 subscribeQuery(
 async () => {
 const { data, error } = await supabase
 .from('ambassador_slots')
 .select('*')
 .eq('company_id', companyId)
 .in('status', ['open', 'full'])
 .order('scheduled_at', { ascending: true })
 if (error) throw new Error(error.message)
 return (data ?? []).map((row) => mapSlot(row as Record<string, unknown>))
 },
 onUpdate,
 onError,
 `coach-org-slots-${companyId}`,
 'ambassador_slots',
 `company_id=eq.${companyId}`,
 )

export const subscribeToSlotBookings = (
 slotId: string,
 onUpdate: (bookings: CoachBooking[]) => void,
 onError?: (error: Error) => void,
): Unsubscribe =>
 subscribeQuery(
 async () => {
 const { data, error } = await supabase
 .from('ambassador_slot_bookings')
 .select('*')
 .eq('slot_id', slotId)
 if (error) throw new Error(error.message)
 const bookings = (data ?? []).map((row) => mapBooking(row as Record<string, unknown>))
 bookings.sort((a, b) => (a.bookedAt?.getTime() ?? 0) - (b.bookedAt?.getTime() ?? 0))
 return bookings
 },
 onUpdate,
 onError,
 `coach-slot-bookings-${slotId}`,
 'ambassador_slot_bookings',
 `slot_id=eq.${slotId}`,
 )

export const subscribeToLearnerBookings = (
 learnerId: string,
 onUpdate: (bookings: CoachBooking[]) => void,
 onError?: (error: Error) => void,
): Unsubscribe =>
 subscribeQuery(
 async () => {
 const { data, error } = await supabase
 .from('ambassador_slot_bookings')
 .select('*')
 .eq('learner_id', learnerId)
 if (error) throw new Error(error.message)
 const bookings = (data ?? []).map((row) => mapBooking(row as Record<string, unknown>))
 bookings.sort(
 (a, b) =>
 (b.slotScheduledAt?.getTime() ?? b.bookedAt?.getTime() ?? 0) -
 (a.slotScheduledAt?.getTime() ?? a.bookedAt?.getTime() ?? 0),
 )
 return bookings
 },
 onUpdate,
 onError,
 `coach-learner-bookings-${learnerId}`,
 'ambassador_slot_bookings',
 `learner_id=eq.${learnerId}`,
 )

export const subscribeToAmbassadorBookings = (
 ambassadorId: string,
 onUpdate: (bookings: CoachBooking[]) => void,
 onError?: (error: Error) => void,
): Unsubscribe =>
 subscribeQuery(
 async () => {
 const { data, error } = await supabase
 .from('ambassador_slot_bookings')
 .select('*')
 .eq('ambassador_id', ambassadorId)
 if (error) throw new Error(error.message)
 const bookings = (data ?? []).map((row) => mapBooking(row as Record<string, unknown>))
 bookings.sort(
 (a, b) =>
 (b.slotScheduledAt?.getTime() ?? b.bookedAt?.getTime() ?? 0) -
 (a.slotScheduledAt?.getTime() ?? a.bookedAt?.getTime() ?? 0),
 )
 return bookings
 },
 onUpdate,
 onError,
 `coach-ambassador-bookings-${ambassadorId}`,
 'ambassador_slot_bookings',
 `ambassador_id=eq.${ambassadorId}`,
 )

export const groupBookingsByStatus = (
 bookings: CoachBooking[],
): Record<CoachBookingStatus, CoachBooking[]> => ({
 booked: bookings.filter((b) => b.status === 'booked'),
 attended: bookings.filter((b) => b.status === 'attended'),
 no_show: bookings.filter((b) => b.status === 'no_show'),
 cancelled: bookings.filter((b) => b.status === 'cancelled'),
})

// Keep export for callers that still import the helper name.
export const bookingIdForSlot = bookingIdFor
