/**
 * Stripe checkout helpers.
 * Requires edge functions `create-checkout-session` + `stripe-webhook` and secrets:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   STRIPE_IMPACT_LOG_PRICE_ID ($5/mo),
 *   STRIPE_FULL_PROGRAMME_PRICE_ID ($50/mo)
 */
import { supabase } from '@/services/supabase'

export type CheckoutKind = 'impact_log_pro' | 'full_programme'

async function startCheckout(
  kind: CheckoutKind,
  params?: { successPath?: string; cancelPath?: string },
): Promise<{ url: string }> {
  const defaults =
    kind === 'full_programme'
      ? {
          successPath: '/upgrade?full_programme=success',
          cancelPath: '/upgrade?full_programme=cancel',
        }
      : {
          successPath: '/upgrade?impact_pro=success',
          cancelPath: '/upgrade?impact_pro=cancel',
        }

  const { data, error } = await supabase.functions.invoke<{
    url?: string
    error?: string
  }>('create-checkout-session', {
    body: {
      kind,
      successPath: params?.successPath ?? defaults.successPath,
      cancelPath: params?.cancelPath ?? defaults.cancelPath,
    },
  })
  if (error) throw new Error(error.message)
  if (!data?.url) throw new Error(data?.error || 'Checkout session was not created')
  return { url: data.url }
}

export async function startImpactLogProCheckout(params?: {
  successPath?: string
  cancelPath?: string
}): Promise<{ url: string }> {
  return startCheckout('impact_log_pro', params)
}

export async function openImpactLogProCheckout(): Promise<void> {
  const { url } = await startImpactLogProCheckout()
  window.location.assign(url)
}

export async function startFullProgrammeCheckout(params?: {
  successPath?: string
  cancelPath?: string
}): Promise<{ url: string }> {
  return startCheckout('full_programme', params)
}

export async function openFullProgrammeCheckout(): Promise<void> {
  const { url } = await startFullProgrammeCheckout()
  window.location.assign(url)
}
