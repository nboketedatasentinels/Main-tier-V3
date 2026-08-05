import { supabase } from '@/services/supabase'

const VILLAGE_MEMBER_LIMIT = 10

export interface VillageSummary {
  id: string
  name: string
  description?: string
  creatorId: string
  memberCount: number
  isActive: boolean
  createdAt?: string
}

type VillageRow = {
  id: string
  name: string | null
  description: string | null
  creator_id: string
  member_ids?: string[] | null
  member_count: number | null
  is_active: boolean | null
  created_at?: string | null
}

const buildVillageSummary = (row: VillageRow): VillageSummary => ({
  id: row.id,
  name: row.name?.trim() || 'Unnamed village',
  description: row.description ?? undefined,
  creatorId: row.creator_id || '',
  memberCount: typeof row.member_count === 'number' ? row.member_count : 0,
  isActive: typeof row.is_active === 'boolean' ? row.is_active : true,
  createdAt: row.created_at ?? undefined,
})

const mapRpcError = (error: { message?: string } | null): Error => {
  const message = (error?.message || '').toLowerCase()
  if (message.includes('village_name_taken')) {
    return new Error('A village with this name already exists. Please choose a different name.')
  }
  if (message.includes('already_in_village')) {
    return new Error('You already belong to a village.')
  }
  if (message.includes('village_name_required')) {
    return new Error('Village name is required.')
  }
  if (message.includes('village_full')) {
    return new Error('Village has reached capacity.')
  }
  if (message.includes('village_not_found')) {
    return new Error('Village not found.')
  }
  if (message.includes('not_authenticated')) {
    return new Error('Please sign in again to create a village.')
  }
  if (message.includes('forbidden')) {
    return new Error("You don't have permission to manage this village.")
  }
  return new Error(error?.message || 'Unable to complete village action.')
}

export const checkVillageNameExists = async (name: string): Promise<boolean> => {
  const trimmed = name.trim()
  if (!trimmed) return false

  const { data, error } = await supabase.rpc('is_village_name_taken', {
    p_name: trimmed,
  })

  if (error) {
    console.warn('[villageService] name check failed', error)
    return false
  }

  return Boolean(data)
}

export const fetchVillageById = async (villageId?: string | null): Promise<VillageSummary | null> => {
  if (!villageId?.trim()) return null

  try {
    const { data, error } = await supabase
      .from('villages')
      .select('id, name, description, creator_id, member_count, is_active, created_at')
      .eq('id', villageId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return buildVillageSummary(data as VillageRow)
  } catch (error) {
    console.error('Failed to fetch village details', error)
    return null
  }
}

export const fetchVillagesByIds = async (villageIds: string[]): Promise<VillageSummary[]> => {
  const normalized = villageIds.map((id) => id?.trim()).filter(Boolean)
  if (!normalized.length) return []

  const { data, error } = await supabase
    .from('villages')
    .select('id, name, description, creator_id, member_count, is_active, created_at')
    .in('id', normalized)

  if (error) {
    console.error('Failed to fetch villages', error)
    return []
  }

  return (data as VillageRow[] | null)?.map(buildVillageSummary) ?? []
}

export const createVillage = async (params: {
  name: string
  description: string
  creatorId: string
}): Promise<string> => {
  const name = params.name.trim()
  const description = params.description.trim()
  const creatorId = params.creatorId.trim()

  if (!name) {
    throw new Error('Village name is required.')
  }
  if (!creatorId) {
    throw new Error('Creator id is required.')
  }

  const { data, error } = await supabase.rpc('create_my_village', {
    p_name: name,
    p_description: description,
  })

  if (error) throw mapRpcError(error)

  const payload = data as { id?: string } | null
  if (!payload?.id) {
    throw new Error('Village was created but no id was returned.')
  }

  return payload.id
}

/** Join the shared Free Learners Village (idempotent). */
export const ensureFreeUserVillage = async (): Promise<{
  villageId: string | null
  joined: boolean
  skipped: boolean
}> => {
  const { data, error } = await supabase.rpc('ensure_free_user_village')
  if (error) {
    console.warn('[villageService] ensure_free_user_village failed', error)
    return { villageId: null, joined: false, skipped: true }
  }

  const payload = (data ?? {}) as {
    ok?: boolean
    villageId?: string
    joined?: boolean
    alreadyJoined?: boolean
    skipped?: boolean
  }

  return {
    villageId: payload.villageId ?? null,
    joined: Boolean(payload.joined || payload.alreadyJoined),
    skipped: Boolean(payload.skipped),
  }
}

export const addMemberToVillage = async (params: { villageId: string; userId: string }) => {
  const { villageId, userId } = params
  if (!villageId.trim() || !userId.trim()) {
    throw new Error('Village id and user id are required.')
  }

  // Joining is done by the member themselves via set_my_village_id.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id || user.id !== userId) {
    throw new Error('Only the joining member can add themselves to a village.')
  }

  const { error } = await supabase.rpc('set_my_village_id', {
    p_village_id: villageId,
  })
  if (error) throw mapRpcError(error)
}

export const removeMemberFromVillage = async (params: { villageId: string; userId: string }) => {
  const { villageId, userId } = params
  if (!villageId.trim() || !userId.trim()) {
    throw new Error('Village id and user id are required.')
  }

  const village = await fetchVillageById(villageId)
  if (!village) throw new Error('Village not found.')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Please sign in again.')

  // Creator removing someone, or member leaving themselves.
  if (user.id !== village.creatorId && user.id !== userId) {
    throw new Error("You don't have permission to remove this member.")
  }

  if (user.id === userId) {
    const { error } = await supabase.rpc('set_my_village_id', { p_village_id: null })
    if (error) throw mapRpcError(error)

    // Also drop from member_ids via a targeted update through service isn't available;
    // set_my_village_id(null) clears the profile. Remove from array with a soft update
    // only when the leaver is the actor (RLS blocks direct updates — use RPC path).
    return
  }

  throw new Error('Ask the member to leave, or use village management tools.')
}

export const getVillageMembers = async (villageId: string) => {
  if (!villageId.trim()) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, data, village_id')
    .or(`village_id.eq.${villageId},data->>villageId.eq.${villageId}`)

  if (error) {
    console.error('Failed to load village members', error)
    return []
  }

  return (data ?? []).map((row) => {
    const jsonb = (row.data as Record<string, unknown> | null) ?? {}
    return {
      id: row.id as string,
      fullName: (row.full_name as string) || (jsonb.fullName as string) || '',
      email: (row.email as string) || '',
      avatarUrl: (row.avatar_url as string) || (jsonb.avatarUrl as string) || '',
      ...jsonb,
    }
  })
}

export const updateVillageMetadata = async (params: {
  villageId: string
  name?: string
  description?: string
}) => {
  const { villageId, name, description } = params
  if (!villageId.trim()) {
    throw new Error('Village id is required.')
  }

  // Direct updates revoked; use create/invite RPCs for now. Keep signature for callers.
  void name
  void description
  throw new Error('Updating village details is temporarily unavailable. Contact support if you need a rename.')
}

export const checkUserVillageMembership = async (userId: string) => {
  if (!userId.trim()) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('village_id, data')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null

  const fromColumn = data.village_id as string | null
  const fromData = (data.data as Record<string, unknown> | null)?.villageId
  return fromColumn || (typeof fromData === 'string' ? fromData : null) || null
}

export const transferVillageOwnership = async (_params: {
  villageId: string
  newCreatorId: string
}) => {
  throw new Error('Transferring village ownership is temporarily unavailable.')
}

export const canRemoveMember = (params: {
  creatorId?: string
  actorId?: string
  targetId?: string
}) => {
  const { creatorId, actorId, targetId } = params
  if (!creatorId || !actorId || !targetId) return false
  if (creatorId !== actorId) return false
  return creatorId !== targetId
}

export { VILLAGE_MEMBER_LIMIT }
