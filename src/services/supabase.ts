import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Browser Supabase client.
 *
 * Auth cutover (Firebase -> Supabase). Uses the **anon/public** key only -
 * never the service-role key client-side. The service-role key lives in the
 * Node-only `SUPABASE_SERVICE_ROLE_KEY` (no VITE_ prefix) and must not reach
 * the bundle.
 *
 * Required env (add to .env / Vercel project settings):
 *   VITE_SUPABASE_URL       e.g. https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY  Dashboard -> Settings -> API -> anon/public key
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const PLACEHOLDER_HINT = 'REPLACE_WITH'

const isPlaceholder = (value?: string) =>
  !value || value.includes(PLACEHOLDER_HINT) || value.trim().length === 0

const missingKeys: string[] = []
if (isPlaceholder(url)) missingKeys.push('VITE_SUPABASE_URL')
if (isPlaceholder(anonKey)) missingKeys.push('VITE_SUPABASE_ANON_KEY')

export const supabaseConfigStatus = {
  url: url ?? null,
  isValid: missingKeys.length === 0,
  missingKeys,
}

if (!supabaseConfigStatus.isValid) {
  console.warn(
    '[Supabase] Auth is not configured. Missing/placeholder env:',
    missingKeys.join(', '),
    '\nAdd VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Dashboard -> Settings -> API) to .env, then restart the dev server.'
  )
}

// createClient tolerates empty strings; calls fail clearly until env is set,
// and `supabaseConfigStatus` lets the auth layer surface a friendly message.
export const supabase: SupabaseClient = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
