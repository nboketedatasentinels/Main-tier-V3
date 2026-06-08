/**
 * Admin access-code elevation. The code is validated server-side by the
 * `claim_admin_access` SECURITY DEFINER function (migration 0012); it is never
 * stored in the client bundle. Caller must be authenticated.
 */
import { supabase } from '@/services/supabase'

export type ClaimAdminResult = 'ok' | 'invalid_code' | 'unauthenticated' | string

export const claimAdminAccess = async (accessCode: string): Promise<ClaimAdminResult> => {
  const { data, error } = await supabase.rpc('claim_admin_access', { access_code: accessCode })
  if (error) throw new Error(error.message)
  return (data as string) ?? 'error'
}
