const DEFAULT_APP_BASE_URL = 'https://tier.t4leader.com'

const rawBaseUrl = (import.meta.env.VITE_APP_BASE_URL as string | undefined)?.trim()

export const APP_BASE_URL = rawBaseUrl && rawBaseUrl.length > 0 ? rawBaseUrl : DEFAULT_APP_BASE_URL
