import { supabase } from '@/services/supabase'

export type VillageInvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked'

export interface VillageInvitation {
  id: string
  invitationCode: string
  villageId: string
  villageName: string
  invitedBy: string
  invitedByName?: string | null
  email?: string | null
  status: VillageInvitationStatus
  createdAt?: string
  acceptedAt?: string
  updatedAt?: string
}

const VILLAGE_MEMBER_LIMIT = 10
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

type InvitationRow = {
  id: string
  invitation_code: string | null
  village_id: string
  village_name: string | null
  invited_by: string
  invited_by_name: string | null
  email: string | null
  status: string | null
  created_at: string | null
  accepted_at: string | null
  updated_at: string | null
}

const mapInvitation = (row: InvitationRow): VillageInvitation => ({
  id: row.id,
  invitationCode: row.invitation_code || '',
  villageId: row.village_id || '',
  villageName: row.village_name || '',
  invitedBy: row.invited_by || '',
  invitedByName: row.invited_by_name,
  email: row.email,
  status: (row.status as VillageInvitationStatus) || 'pending',
  createdAt: row.created_at ?? undefined,
  acceptedAt: row.accepted_at ?? undefined,
  updatedAt: row.updated_at ?? undefined,
})

export const generateVillageInviteCode = (length = 8): string => {
  const safeLength = Math.max(6, Math.min(length, 12))
  const bytes = new Uint8Array(safeLength)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < safeLength; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  return Array.from(bytes)
    .map((value) => alphabet[value % alphabet.length])
    .join('')
}

export const validateVillageCapacity = async (villageId: string) => {
  const { data, error } = await supabase
    .from('villages')
    .select('member_count')
    .eq('id', villageId)
    .maybeSingle()

  if (error || !data) {
    throw new Error('Village not found.')
  }

  const memberCount = data.member_count ?? 0
  return {
    memberCount,
    limit: VILLAGE_MEMBER_LIMIT,
    isFull: memberCount >= VILLAGE_MEMBER_LIMIT,
  }
}

export const createVillageInvitation = async (params: {
  villageId: string
  villageName: string
  invitedBy: string
  invitedByName?: string | null
  email?: string | null
  invitationCode?: string
}) => {
  const invitationCode = params.invitationCode?.trim() || generateVillageInviteCode()

  const { data, error } = await supabase.rpc('create_village_invitation', {
    p: {
      villageId: params.villageId,
      villageName: params.villageName,
      invitedByName: params.invitedByName ?? null,
      email: params.email?.trim().toLowerCase() || null,
      invitationCode,
    },
  })

  if (error) {
    throw new Error(error.message || 'Unable to create village invitation.')
  }

  const payload = data as { id?: string; invitationCode?: string } | null
  return {
    id: payload?.id || '',
    invitationCode: payload?.invitationCode || invitationCode,
  }
}

export const listVillageInvitations = async (params: {
  villageId: string
  status?: VillageInvitationStatus
}) => {
  let query = supabase
    .from('village_invitations')
    .select('*')
    .eq('village_id', params.villageId)
    .order('created_at', { ascending: false })

  if (params.status) {
    query = query.eq('status', params.status)
  }

  const { data, error } = await query
  if (error) {
    console.error('Failed to list village invitations', error)
    return []
  }

  return ((data as InvitationRow[] | null) ?? []).map(mapInvitation)
}

export const fetchVillageInvitationByCode = async (invitationCode: string) => {
  const trimmed = invitationCode.trim().toUpperCase()
  if (!trimmed) return null

  const { data, error } = await supabase
    .from('village_invitations')
    .select('*')
    .eq('invitation_code', trimmed)
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return mapInvitation(data as InvitationRow)
}

export const revokeVillageInvitation = async (invitationId: string) => {
  if (!invitationId.trim()) {
    throw new Error('Invitation id is required.')
  }
  // Direct updates revoked; soft-fail for now until a dedicated RPC is added.
  console.warn('[villageInvitationService] revoke requires RPC; invitation left pending', invitationId)
}

export const resendVillageInvitation = async (invitationId: string) => {
  if (!invitationId.trim()) {
    throw new Error('Invitation id is required.')
  }
  // No-op for timestamp bump under RLS-locked table.
}

export const rejectVillageInvitation = async (invitationId: string) => {
  if (!invitationId.trim()) {
    throw new Error('Invitation id is required.')
  }
  console.warn('[villageInvitationService] reject requires RPC; invitation left pending', invitationId)
}

export const updateVillageMemberCount = async (_villageId: string, _delta: number) => {
  // Member count is maintained by set_my_village_id / create_my_village.
}

export const removeMemberFromVillage = async (villageId: string, userId: string) => {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id || user.id !== userId) {
    throw new Error('Only the member can leave the village from their account.')
  }
  void villageId
  const { error } = await supabase.rpc('set_my_village_id', { p_village_id: null })
  if (error) throw new Error(error.message || 'Unable to leave village.')
}

export const acceptVillageInvitation = async (params: {
  invitationId: string
  villageId: string
  userId: string
}) => {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id || user.id !== params.userId) {
    throw new Error('Please sign in with the invited account.')
  }

  const capacity = await validateVillageCapacity(params.villageId)
  if (capacity.isFull) {
    throw new Error('Village has reached capacity.')
  }

  const { error } = await supabase.rpc('set_my_village_id', {
    p_village_id: params.villageId,
  })
  if (error) {
    throw new Error(error.message || 'Unable to join village.')
  }

  // Best-effort mark invitation accepted (may be blocked by RLS revoke).
  await supabase
    .from('village_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.invitationId)
}
