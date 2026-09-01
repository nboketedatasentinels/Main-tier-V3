/**
 * Stripe Impact Log Pro (~$5/mo) — client helpers.
 * Requires edge functions `create-checkout-session` + `stripe-webhook` and secrets:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_IMPACT_LOG_PRICE_ID
 */
import { supabase } from '@/services/supabase'

export type CheckoutKind = 'impact_log_pro'

export async function startImpactLogProCheckout(params?: {
  successPath?: string
  cancelPath?: string
}): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke<{
    url?: string
    error?: string
  }>('create-checkout-session', {
    body: {
      kind: 'impact_log_pro' satisfies CheckoutKind,
      successPath: params?.successPath ?? '/upgrade?impact_pro=success',
      cancelPath: params?.cancelPath ?? '/upgrade?impact_pro=cancel',
    },
  })
  if (error) throw new Error(error.message)
  if (!data?.url) throw new Error(data?.error || 'Checkout session was not created')
  return { url: data.url }
}

export async function openImpactLogProCheckout(): Promise<void> {
  const { url } = await startImpactLogProCheckout()
  window.location.assign(url)
}
