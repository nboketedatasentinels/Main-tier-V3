/**
 * GET /r?a=<archetype>&i=<index>
 *
 * The per-result share page. This is the URL that gets posted to LinkedIn (and
 * anywhere else) from the assessment thank-you page. It solves the problem that
 * a Vite SPA can't expose per-result Open Graph tags: social crawlers don't run
 * JS, so they only ever saw the one static card in index.html. This endpoint is
 * server-rendered, so LinkedIn/WhatsApp/Slack read OG tags that carry the
 * person's ACTUAL result, and the card image (api/og.tsx) shows it too.
 *
 * Humans who click the shared link get a small branded landing page with the
 * result and a clear call to take the assessment themselves.
 *
 * Wired to the clean /r path via a rewrite in vercel.json.
 */
import { resolveArchetype, clampIndex, PLUM, GOLD, SOFT_GOLD } from './_archetypes'

const ASSESSMENT_PATH = '/assessment'

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })

export default function handler(req: any, res: any): void {
  const host = (req.headers['x-forwarded-host'] || req.headers.host || 'app.t4leader.com') as string
  const origin = `https://${host}`

  const query = req.query ?? {}
  const { key, meta } = resolveArchetype(query.a)
  const index = clampIndex(query.i)

  const shareUrl = `${origin}/r?a=${encodeURIComponent(key)}${index !== null ? `&i=${index}` : ''}`
  const imageUrl = `${origin}/api/og?a=${encodeURIComponent(key)}${index !== null ? `&i=${index}` : ''}`
  const assessmentUrl = `${origin}${ASSESSMENT_PATH}`

  const indexLabel = index !== null ? ` · LIFT Index ${index}` : ''
  const title = `${meta.title}${indexLabel}`
  const description = `${meta.blurb} The LIFT Index scores how you lead AI and digital transformation across four pillars. Take the free 4-minute assessment and see how you rate.`

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="T4L - Transformation Leader" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(shareUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />

    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Poppins:wght@700&display=swap" rel="stylesheet" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Inter', system-ui, sans-serif;
        color: ${PLUM};
        background: radial-gradient(1200px 600px at 80% -10%, ${SOFT_GOLD}33, transparent),
                    radial-gradient(1000px 600px at -10% 110%, ${GOLD}33, transparent), #ffffff;
        min-height: 100vh;
        display: flex; align-items: center; justify-content: center;
        padding: 24px;
      }
      .card {
        width: 100%; max-width: 560px; text-align: center;
        background: #ffffff; border: 1px solid #f3e2b3; border-radius: 24px;
        box-shadow: 0 20px 60px rgba(39, 6, 46, 0.08);
        padding: 40px 28px;
      }
      .eyebrow {
        display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: 0.08em;
        text-transform: uppercase; color: #9c6f15; background: #fbf2d8;
        padding: 6px 12px; border-radius: 999px; margin-bottom: 20px;
      }
      .archetype { font-family: 'Poppins', sans-serif; font-size: 34px; font-weight: 700; line-height: 1.1; }
      .index {
        font-size: 20px; font-weight: 700; margin-top: 6px;
        background: linear-gradient(90deg, ${PLUM}, ${GOLD});
        -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
      }
      .tagline { color: #6b7280; margin-top: 14px; font-size: 15px; }
      .blurb { color: #374151; margin-top: 8px; font-size: 15px; line-height: 1.6; }
      .cta {
        display: inline-block; margin-top: 28px; text-decoration: none;
        background: ${PLUM}; color: #ffffff; font-weight: 700; font-size: 15px;
        padding: 14px 28px; border-radius: 999px;
      }
      .sub { margin-top: 14px; font-size: 13px; color: #9ca3af; }
      .brand { margin-top: 32px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: ${PLUM}; }
      .brand span { color: ${GOLD}; }
    </style>
  </head>
  <body>
    <main class="card">
      <span class="eyebrow">LIFT Index result</span>
      <div class="archetype">${escapeHtml(meta.title)}</div>
      ${index !== null ? `<div class="index">LIFT Index ${index}</div>` : ''}
      <div class="tagline">Leads with: ${escapeHtml(meta.tagline)}</div>
      <p class="blurb">${escapeHtml(meta.blurb)}</p>
      <a class="cta" href="${escapeHtml(assessmentUrl)}">Curious how you'd rate? Take the free LIFT Index</a>
      <div class="sub">4 minutes. No cost. See your leadership profile across four pillars.</div>
      <div class="brand">TRANSFORMATION <span>LEADER</span></div>
    </main>
  </body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Cache the crawler-facing page briefly; result content is deterministic per URL.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600')
  res.status(200).send(html)
}
