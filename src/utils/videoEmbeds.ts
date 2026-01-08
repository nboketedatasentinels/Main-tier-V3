export type VideoProvider = 'youtube' | 'vimeo' | 'wistia'

export type VideoEmbedResult = {
  provider: VideoProvider
  embedUrl: string
}

const sanitizeUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null
    }
    return parsed
  } catch (error) {
    return null
  }
}

const getYouTubeEmbed = (parsedUrl: URL): VideoEmbedResult | null => {
  if (parsedUrl.hostname.includes('youtu.be')) {
    const id = parsedUrl.pathname.replace('/', '')
    if (!id) return null
    return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` }
  }

  if (parsedUrl.hostname.includes('youtube.com')) {
    const idFromParams = parsedUrl.searchParams.get('v')
    if (idFromParams) {
      return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${idFromParams}` }
    }

    const segments = parsedUrl.pathname.split('/').filter(Boolean)
    const embedIndex = segments.indexOf('embed')
    if (embedIndex >= 0 && segments[embedIndex + 1]) {
      return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${segments[embedIndex + 1]}` }
    }
  }

  return null
}

const getVimeoEmbed = (parsedUrl: URL): VideoEmbedResult | null => {
  if (!parsedUrl.hostname.includes('vimeo.com')) return null

  const segments = parsedUrl.pathname.split('/').filter(Boolean)
  const id = segments.pop()
  if (!id) return null

  return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}` }
}

const getWistiaEmbed = (parsedUrl: URL): VideoEmbedResult | null => {
  if (!parsedUrl.hostname.includes('wistia.com') && !parsedUrl.hostname.includes('fast.wistia.net')) {
    return null
  }

  const segments = parsedUrl.pathname.split('/').filter(Boolean)
  const mediaIndex = segments.findIndex(segment => segment === 'medias' || segment === 'iframe')
  const id = mediaIndex >= 0 ? segments[mediaIndex + 1] : segments[segments.length - 1]

  if (!id) return null

  return { provider: 'wistia', embedUrl: `https://fast.wistia.net/embed/iframe/${id}` }
}

export const getVideoEmbedUrl = (url?: string | null): VideoEmbedResult | null => {
  if (!url) return null
  const parsed = sanitizeUrl(url)
  if (!parsed) return null

  return getYouTubeEmbed(parsed) || getVimeoEmbed(parsed) || getWistiaEmbed(parsed)
}

export const isSupportedVideoUrl = (url?: string | null) => Boolean(getVideoEmbedUrl(url))
