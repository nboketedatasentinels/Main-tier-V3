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
  /** Org join code, shown to members so they can enter it on the sign-up page. */
  organizationCode?: string | null
}

interface SendWelcomeEmailPayload {
  to: string
  recipientName: string
  role: WelcomeRole
  organizationName?: string
  organizationCode?: string
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
  const orgCode = params.organizationCode?.trim()
  if (orgCode) payload.organizationCode = orgCode

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

/**
 * Notify a user that their role changed. Loads contact + org labels from their
 * profile when not supplied. Best-effort: never throws.
 */
export const notifyUserOfRoleChange = async (params: {
  userId: string
  role: string | null | undefined
  email?: string | null
  name?: string | null
  organizationName?: string | null
  organizationCode?: string | null
}): Promise<void> => {
  try {
    let email = params.email?.trim() || null
    let name = params.name?.trim() || null
    let organizationName = params.organizationName?.trim() || null
    let organizationCode = params.organizationCode?.trim() || null

    if (!email || !name || !organizationName || !organizationCode) {
      const { data } = await supabase
        .from('profiles')
        .select('email, full_name, company_name, company_code')
        .eq('id', params.userId)
        .maybeSingle()
      email = email || (typeof data?.email === 'string' ? data.email.trim() : null)
      name = name || (typeof data?.full_name === 'string' ? data.full_name.trim() : null) || email
      organizationName =
        organizationName ||
        (typeof data?.company_name === 'string' ? data.company_name.trim() : null)
      organizationCode =
        organizationCode ||
        (typeof data?.company_code === 'string' ? data.company_code.trim() : null)
    }

    if (!email) return

    await sendRoleWelcomeEmail({
      to: email,
      recipientName: name || email,
      role: toWelcomeRole(params.role),
      organizationName,
      organizationCode,
    })
  } catch (error) {
    console.warn('[welcomeEmailService] notifyUserOfRoleChange failed', error)
  }
}
