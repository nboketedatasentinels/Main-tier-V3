const CANONICAL_APP_BASE_URL = 'https://app.t4leader.com'
/** Legacy host that no longer resolves in DNS — rewrite to canonical. */
const LEGACY_APP_HOSTS = new Set(['tier.t4leader.com', 'www.tier.t4leader.com'])

const rawBaseUrl = (import.meta.env.VITE_APP_BASE_URL as string | undefined)?.trim()

const rewriteLegacyHost = (value: string): string => {
  try {
    const url = new URL(value)
    if (LEGACY_APP_HOSTS.has(url.hostname.toLowerCase())) {
      url.protocol = 'https:'
      url.hostname = 'app.t4leader.com'
      return url.toString().replace(/\/+$/, '')
    }
  } catch {
    // fall through
  }
  return value.replace(/\/+$/, '')
}

const resolvedBaseUrl = rewriteLegacyHost(
  rawBaseUrl && rawBaseUrl.length > 0 ? rawBaseUrl : CANONICAL_APP_BASE_URL,
)

export const APP_BASE_URL = resolvedBaseUrl
const normalizedAppBaseUrl = resolvedBaseUrl.replace(/\/+$/, '')

/** Canonical public privacy statement (marketing site). */
export const PRIVACY_STATEMENT_URL = 'https://www.t4leader.com/privacy-statement'

export const formatVillageInviteLink = (invitationCode: string) =>
  `${normalizedAppBaseUrl}/app/villages/join/${encodeURIComponent(invitationCode.trim())}`
