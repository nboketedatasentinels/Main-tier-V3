import { supabase } from '@/services/supabase'
import { UpgradeRequest, UpgradeRequestForm, UpgradeRequestStatus, UpgradeRequestType } from '@/types/upgrade'
import { AdminDataError } from '@/services/admin/adminErrors'

const REQUEST_TABLE = 'upgrade_requests'

/**
 * Shape of a raw row returned by Supabase for public.upgrade_requests.
 * Columns are snake_case; timestamps arrive as ISO strings.
 */
interface UpgradeRequestRow {
  id: string
  uid: string | null
  request_type: UpgradeRequestType
  current_tier: string | null
  requested_tier: string | null
  status: UpgradeRequestStatus
  message: string | null
  admin_notes: string | null
  contact_preference: string | null
  contact_details: string | null
  village_id: string | null
  village_name: string | null
  user_details: UpgradeRequest['userDetails'] | null
  requested_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string | null
  updated_at: string | null
  data: Record<string, unknown> | null
}

/**
 * Map a snake_case Supabase row to the camelCase UpgradeRequest interface.
 * villageDescription has no dedicated column; it is persisted inside `data`.
 */
const toUpgradeRequest = (row: UpgradeRequestRow): UpgradeRequest => {
  const extra = (row.data ?? {}) as Record<string, unknown>
  const villageDescription =
    (extra.villageDescription as string | undefined) ?? null

  return {
    id: row.id,
    user_id: row.uid ?? '',
    request_type: row.request_type,
    current_tier: row.current_tier ?? null,
    requested_tier: row.requested_tier ?? null,
    status: row.status,
    message: row.message ?? null,
    admin_notes: row.admin_notes ?? null,
    villageId: row.village_id ?? null,
    villageName: row.village_name ?? null,
    villageDescription,
    userDetails: row.user_details ?? null,
    requested_at: row.requested_at ?? row.created_at ?? new Date().toISOString(),
    reviewed_at: row.reviewed_at ?? null,
    reviewed_by: row.reviewed_by ?? null,
    contact_preference: row.contact_preference ?? null,
    contact_details: row.contact_details ?? null,
  }
}

export const createUpgradeRequest = async (userId: string, requestData: UpgradeRequestForm) => {
  // Pull learner profile details so the admin view has context (best-effort).
  let profileData: Record<string, unknown> | null = null
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (profileRow) {
    profileData = profileRow as Record<string, unknown>
  }

  const villageId = (profileData?.village_id as string | undefined) || (profileData?.villageId as string | undefined) || null
  let villageName: string | null =
    (profileData?.village_name as string | undefined) || (profileData?.villageName as string | undefined) || null
  let villageDescription: string | null =
    (profileData?.village_description as string | undefined) ||
    (profileData?.villageDescription as string | undefined) ||
    (profileData?.village_purpose as string | undefined) ||
    (profileData?.villagePurpose as string | undefined) ||
    null

  if (villageId) {
    const { data: villageRow } = await supabase
      .from('villages')
      .select('name, description')
      .eq('id', villageId)
      .maybeSingle()
    if (villageRow) {
      const village = villageRow as { name?: string; description?: string }
      villageName = village.name || villageName
      villageDescription = village.description || villageDescription
    }
  }

  const userDetails = profileData
    ? {
        fullName: (profileData.full_name as string | undefined) || (profileData.fullName as string | undefined) || null,
        firstName: (profileData.first_name as string | undefined) || (profileData.firstName as string | undefined) || null,
        lastName: (profileData.last_name as string | undefined) || (profileData.lastName as string | undefined) || null,
        email: (profileData.email as string | undefined) || null,
        role: (profileData.role as string | undefined) || null,
        phoneNumber:
          (profileData.phone_number as string | undefined) || (profileData.phoneNumber as string | undefined) || null,
        companyId:
          (profileData.company_id as string | undefined) || (profileData.companyId as string | undefined) || null,
        organizationId:
          (profileData.organization_id as string | undefined) ||
          (profileData.organizationId as string | undefined) ||
          null,
      }
    : null

  const id = crypto.randomUUID()
  const nowIso = new Date().toISOString()

  const insertPayload = {
    id,
    uid: userId,
    request_type: requestData.requestType,
    current_tier: requestData.currentTier ?? null,
    requested_tier: requestData.requestedTier ?? null,
    status: 'pending' as UpgradeRequestStatus,
    message: requestData.message ?? null,
    admin_notes: null,
    contact_preference: requestData.contactPreference ?? null,
    contact_details: requestData.contactDetails ?? null,
    village_id: villageId,
    village_name: villageName,
    user_details: userDetails,
    requested_at: nowIso,
    // villageDescription has no column - stash it in the data jsonb so the
    // mapper can recover it on read.
    data: villageDescription ? { villageDescription } : null,
  }

  const { data: inserted, error } = await supabase
    .from(REQUEST_TABLE)
    .insert(insertPayload)
    .select('*')
    .single()

  if (error) {
    throw new AdminDataError('Failed to create upgrade request.', error.code, { message: error.message })
  }

  // Best-effort admin notification. A failure here must not block the request.
  try {
    await supabase.from('admin_notifications').insert({
      id: crypto.randomUUID(),
      type: 'upgrade_request',
      category: 'upgrade_request',
      message: `New upgrade request from ${userDetails?.fullName || userDetails?.email || 'a user'}`,
      is_read: false,
      read: false,
      target_roles: ['super_admin'],
      metadata: {
        userId,
        userName: userDetails?.fullName || userDetails?.firstName || userDetails?.email || userId,
        userEmail: userDetails?.email || null,
        currentTier: requestData.currentTier ?? null,
        requestedTier: requestData.requestedTier ?? requestData.requestType,
        villageName,
        requestId: id,
        route: `/super-admin?tab=approvals&requestId=${id}`,
      },
      created_at: nowIso,
    })
  } catch {
    // Swallow notification errors - the request itself succeeded.
  }

  return toUpgradeRequest(inserted as UpgradeRequestRow)
}

export const getUserUpgradeRequests = async (userId: string): Promise<UpgradeRequest[]> => {
  const { data, error } = await supabase
    .from(REQUEST_TABLE)
    .select('*')
    .eq('uid', userId)
    .order('requested_at', { ascending: false })

  if (error) {
    throw new AdminDataError('Failed to load upgrade requests.', error.code, { message: error.message })
  }

  return (data as UpgradeRequestRow[]).map(toUpgradeRequest)
}

export const checkPendingRequest = async (userId: string): Promise<UpgradeRequest | null> => {
  const { data, error } = await supabase
    .from(REQUEST_TABLE)
    .select('*')
    .eq('uid', userId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(1)

  if (error) {
    throw new AdminDataError('Failed to check pending upgrade request.', error.code, { message: error.message })
  }

  const rows = data as UpgradeRequestRow[]
  if (!rows || rows.length === 0) return null
  return toUpgradeRequest(rows[0])
}

export const getAllUpgradeRequests = async (): Promise<UpgradeRequest[]> => {
  const startedAt = performance.now()

  const { data, error } = await supabase
    .from(REQUEST_TABLE)
    .select('*')
    .order('requested_at', { ascending: false })

  if (error) {
    const code = error.code ?? 'unknown'
    console.error('🔴 [Admin] upgrade_requests failed', { code, message: error.message })

    // Supabase returns 42501 (insufficient_privilege) when RLS blocks the read.
    if (code === '42501') {
      throw new AdminDataError('You do not have permission to view upgrade requests.', 'permission-denied')
    }

    throw new AdminDataError('Failed to load upgrade requests.', code, { message: error.message })
  }

  const rows = data as UpgradeRequestRow[]
  console.log(
    '🟢 [Admin] upgrade_requests loaded:',
    rows.length,
    'rows in',
    Math.round(performance.now() - startedAt),
    'ms'
  )
  return rows.map(toUpgradeRequest)
}

export const getPendingUpgradeRequests = async (): Promise<UpgradeRequest[]> => {
  const { data, error } = await supabase
    .from(REQUEST_TABLE)
    .select('*')
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })

  if (error) {
    throw new AdminDataError('Failed to load pending upgrade requests.', error.code, { message: error.message })
  }

  return (data as UpgradeRequestRow[]).map(toUpgradeRequest)
}

export const updateUpgradeRequestStatus = async (
  requestId: string,
  status: UpgradeRequestStatus,
  notes?: string,
  reviewedBy?: string
) => {
  const { data, error } = await supabase
    .from(REQUEST_TABLE)
    .update({
      status,
      admin_notes: notes ?? null,
      reviewed_by: reviewedBy ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('*')
    .single()

  if (error) {
    throw new AdminDataError('Failed to update upgrade request.', error.code, { message: error.message })
  }

  return toUpgradeRequest(data as UpgradeRequestRow)
}

export const getUserRequestsForAdmin = async (userId: string): Promise<UpgradeRequest[]> => {
  const { data, error } = await supabase
    .from(REQUEST_TABLE)
    .select('*')
    .eq('uid', userId)
    .order('requested_at', { ascending: false })

  if (error) {
    throw new AdminDataError('Failed to load user upgrade requests.', error.code, { message: error.message })
  }

  return (data as UpgradeRequestRow[]).map(toUpgradeRequest)
}
