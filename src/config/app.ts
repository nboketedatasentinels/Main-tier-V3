const DEFAULT_APP_BASE_URL = 'https://tier.t4leader.com'

const rawBaseUrl = (import.meta.env.VITE_APP_BASE_URL as string | undefined)?.trim()

const resolvedBaseUrl = rawBaseUrl && rawBaseUrl.length > 0 ? rawBaseUrl : DEFAULT_APP_BASE_URL
export const APP_BASE_URL = resolvedBaseUrl
const normalizedAppBaseUrl = resolvedBaseUrl.replace(/\/+$/, '')

export const formatVillageInviteLink = (invitationCode: string) =>
  `${normalizedAppBaseUrl}/app/villages/join/${encodeURIComponent(invitationCode.trim())}`
