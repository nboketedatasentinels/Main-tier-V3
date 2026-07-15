import { supabase } from '@/services/supabase'
import { normalizeRole } from '@/utils/role'

export type WelcomeRole = 'partner' | 'mentor' | 'ambassador' | 'user'

/** Map any raw/normalized role string onto the four welcome-email variants. */
export const toWelcomeRole = (role: string | null | undefined): WelcomeRole => {
  switch (normalizeRole(role)) {
    case 'partner':
      return 'partner'
    case 'mentor':
      return 'mentor'
    case 'ambassador':
      return 'ambassador'
    default:
      return 'user'
  }
}

export interface RoleWelcomeEmailParams {
  to: string
  recipientName: string
  role: WelcomeRole
  organizationName?: string | null
}

interface SendWelcomeEmailPayload {
  to: string
  recipientName: string
  role: WelcomeRole
  organizationName?: string
}

const WELCOME_EMAIL_FUNCTION = 'send-welcome-email'

/**
 * Sends a role-specific welcome email via the `send-welcome-email` Supabase Edge
 * Function (invoked with the caller's Supabase session; the function verifies
 * the caller is a partner/admin and sends over SMTP).
 *
 * Best-effort by design: an email failure must never roll back the assignment
 * that triggered it, so this resolves to `{ success: false }` and logs instead of
 * throwing. Callers can fire-and-forget without a try/catch.
 */
export const sendRoleWelcomeEmail = async (
  params: RoleWelcomeEmailParams,
): Promise<{ success: boolean }> => {
  const to = params.to?.trim()
  const recipientName = params.recipientName?.trim()

  if (!to || !recipientName || !params.role) {
    return { success: false }
  }

  const payload: SendWelcomeEmailPayload = {
    to,
    recipientName,
    role: params.role,
  }
  const org = params.organizationName?.trim()
  if (org) payload.organizationName = org

  try {
    const { data, error } = await supabase.functions.invoke<{ success: boolean }>(
      WELCOME_EMAIL_FUNCTION,
      { body: payload },
    )
    if (error) throw error
    return { success: Boolean(data?.success) }
  } catch (error) {
    console.warn('[welcomeEmailService] Failed to send welcome email', {
      role: params.role,
      error: error instanceof Error ? error.message : error,
    })
    return { success: false }
  }
}
