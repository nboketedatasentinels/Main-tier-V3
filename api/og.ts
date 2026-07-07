/**
 * GET /api/og?a=<archetype>&i=<index>
 *
 * Renders the social-share card image (1200x630 PNG) that LinkedIn shows for a
 * result. It carries the person's ACTUAL result: archetype + LIFT Index, on the
 * T4L brand. Referenced as og:image by api/share.ts.
 *
 * Edge runtime + @vercel/og (Satori). The element tree is built with a small
 * hyperscript helper instead of JSX, so it doesn't depend on the function
 * bundler's JSX transform. Fonts are fetched from Google at request time; if
 * font loading or rendering fails for any reason we fall back to the existing
 * static card so a share NEVER breaks (no regression on failure).
 */
import { ImageResponse } from '@vercel/og'
import { resolveArchetype, clampIndex, PLUM, GOLD, SOFT_GOLD } from './_archetypes'

export const config = { runtime: 'edge' }

// Minimal hyperscript for Satori element objects (no JSX transform needed).
type Style = Record<string, string | number>
interface El {
  type: string
  props: { style?: Style; children?: unknown }
}
const el = (style: Style, children: unknown): El => ({ type: 'div', props: { style, children } })

// Fetch a Satori-compatible font payload from Google Fonts. Presenting an older
// user agent makes Google return ttf/woff (Satori supports ttf/otf/woff; only
// woff2 is unsupported). Returns the font's ArrayBuffer.
async function loadFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36' } },
  ).then((r) => r.text())
  const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(truetype|opentype|woff)'\)/)?.[1]
  if (!url) throw new Error(`font url not found for ${family} ${weight}`)
  return fetch(url).then((r) => r.arrayBuffer())
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams, origin } = new URL(req.url)
  const { meta } = resolveArchetype(searchParams.get('a'))
  const index = clampIndex(searchParams.get('i'))

  try {
    const [inter700, inter400, poppins700] = await Promise.all([
      loadFont('Inter', 700),
      loadFont('Inter', 400),
      loadFont('Poppins', 700),
    ])

    const children: El[] = [
      // Brand mark
      el(
        { display: 'flex', fontSize: 26, fontWeight: 700, letterSpacing: 2 },
        [
          { type: 'div', props: { style: { display: 'flex' }, children: 'TRANSFORMATION ' } },
          { type: 'div', props: { style: { display: 'flex', color: GOLD }, children: 'LEADER' } },
        ],
      ),
      // Eyebrow
      el(
        {
          display: 'flex',
          alignSelf: 'flex-start',
          marginTop: 48,
          padding: '10px 22px',
          borderRadius: 999,
          background: '#fbf2d8',
          color: '#9c6f15',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 2,
        },
        'MY LIFT INDEX RESULT',
      ),
      // Archetype
      el(
        { display: 'flex', marginTop: 28, fontFamily: 'Poppins', fontWeight: 700, fontSize: 92, lineHeight: 1 },
        meta.title,
      ),
    ]

    if (index !== null) {
      children.push(
        el({ display: 'flex', marginTop: 18, fontSize: 44, fontWeight: 700, color: GOLD }, `LIFT Index ${index}`),
      )
    }

    children.push(
      // Tagline
      el(
        { display: 'flex', marginTop: 24, fontSize: 30, fontWeight: 400, color: '#4b5563' },
        `Leads with ${meta.tagline}`,
      ),
      // Footer CTA
      el(
        { display: 'flex', marginTop: 'auto', fontSize: 26, fontWeight: 400, color: '#6b7280' },
        "Curious how you'd rate? Take the free 4-minute LIFT Index.",
      ),
    )

    const tree = el(
      {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        fontFamily: 'Inter',
        color: PLUM,
        background: `linear-gradient(135deg, #ffffff 0%, #fffaf0 55%, ${SOFT_GOLD} 140%)`,
      },
      children,
    )

    return new ImageResponse(tree as unknown as never, {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: inter400, weight: 400, style: 'normal' },
        { name: 'Inter', data: inter700, weight: 700, style: 'normal' },
        { name: 'Poppins', data: poppins700, weight: 700, style: 'normal' },
      ],
    })
  } catch (err) {
    // Never break a share: fall back to the static brand card.
    return Response.redirect(`${origin}/og-lift-assessment.png`, 302)
  }
}
