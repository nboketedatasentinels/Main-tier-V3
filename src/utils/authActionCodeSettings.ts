import type { ActionCodeSettings } from 'firebase/auth'

const resolveBaseUrl = () => {
  const configuredUrl =
    import.meta.env.VITE_PUBLIC_APP_URL ||
    import.meta.env.VITE_APP_URL ||
    ''

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return ''
}

export const buildActionCodeSettings = (path: string): ActionCodeSettings | undefined => {
  const baseUrl = resolveBaseUrl()
  if (!baseUrl) return undefined

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return {
    url: `${baseUrl}${normalizedPath}`,
    handleCodeInApp: true,
  }
}
