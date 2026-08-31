/*
 * Shared submission runtime for /capstones/*.html (Capstone / Case Study /
 * Practical deliverables).
 *
 * What this does:
 *  1. Reads <meta name="programme-component-*"> tags from the page.
 *  2. Reads the Supabase project config (URL + anon key) the React app
 *     published to localStorage as `t4l_sb_config` (see src/services/supabase.ts).
 *  3. Picks up the learner's existing Supabase session from localStorage
 *     (`sb-<ref>-auth-token`, written by supabase-js on the same origin),
 *     refreshing the access token if it has expired.
 *  4. On Submit (window.submitCapstone / submitCaseStudy / submitPractical),
 *     collects every named input/textarea and UPSERTs the submission into the
 *     Supabase `programme_component_submissions` table via the REST API
 *     (unique on user_id + component_id, so resubmits update in place).
 *  5. On success: clears the form, reloads the page, then shows a success
 *     banner (flash message via sessionStorage so it survives the refresh).
 *
 * Row-Level Security enforces that a learner can only write their own row
 * (pcs_insert: user_id = auth.uid()); partners/admins of the org can read.
 *
 * This replaces the old Firebase/Firestore runtime, which broke after the
 * Firebase -> Supabase auth cutover ("You need to be signed in") because the
 * app no longer holds a Firebase session.
 */

const APP_BASE = '/app/courses#programme-components'
const CONFIG_KEY = 't4l_sb_config'

function readMeta(name) {
  const el = document.querySelector(`meta[name="${name}"]`)
  return el ? el.getAttribute('content') : null
}

function readConfig() {
  try {
    const raw = window.localStorage?.getItem(CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.url || !parsed?.anonKey) return null
    return parsed
  } catch {
    return null
  }
}

/** Read the supabase-js persisted session for this project (same origin). */
function readSession(url) {
  try {
    const ref = new URL(url).hostname.split('.')[0]
    if (!ref) return null
    const raw = window.localStorage?.getItem(`sb-${ref}-auth-token`)
    if (!raw) return null
    // supabase-js may store the session as raw JSON or base64-prefixed JSON.
    const json = raw.startsWith('base64-')
      ? atob(raw.slice('base64-'.length))
      : raw
    const parsed = JSON.parse(json)
    // Some versions wrap it as { currentSession: {...} }.
    return parsed?.access_token ? parsed : parsed?.currentSession ?? null
  } catch {
    return null
  }
}

const SUBMIT_FLASH_KEY = 't4l_capstone_submit_flash'

function showBanner(kind, message) {
  let banner = document.getElementById('__t4l_submission_banner')
  if (!banner) {
    banner = document.createElement('div')
    banner.id = '__t4l_submission_banner'
    banner.style.cssText = [
      'position:fixed',
      'top:16px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:9999',
      'padding:12px 18px',
      'border-radius:10px',
      "font-family:'DM Sans',system-ui,sans-serif",
      'font-size:14px',
      'font-weight:600',
      'box-shadow:0 8px 24px rgba(0,0,0,0.18)',
      'max-width:min(640px, calc(100vw - 32px))',
    ].join(';')
    document.body.appendChild(banner)
  }
  const palette = {
    info: { bg: '#1f1730', color: '#ffffff' },
    success: { bg: '#0f6c2e', color: '#ffffff' },
    error: { bg: '#9b1c1c', color: '#ffffff' },
  }
  const tone = palette[kind] || palette.info
  banner.style.background = tone.bg
  banner.style.color = tone.color
  banner.textContent = message
}

/** Clear every named field so a reload / next edit starts blank. */
function clearFormFields() {
  const inputs = document.querySelectorAll('input[name], textarea[name], select[name]')
  inputs.forEach((el) => {
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = false
    } else {
      el.value = ''
    }
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  if (typeof window.recountWords === 'function') {
    try {
      window.recountWords()
    } catch {
      // non-fatal
    }
  }
}

/** Persist success copy across reload, then show it once on the next load. */
function flashSuccessAndReload(message) {
  try {
    sessionStorage.setItem(
      SUBMIT_FLASH_KEY,
      JSON.stringify({ message, at: Date.now() }),
    )
  } catch {
    // sessionStorage unavailable - still clear + reload; banner may be lost.
  }
  clearFormFields()
  window.location.reload()
}

function consumeSubmitFlash() {
  try {
    const raw = sessionStorage.getItem(SUBMIT_FLASH_KEY)
    if (!raw) return
    sessionStorage.removeItem(SUBMIT_FLASH_KEY)
    const parsed = JSON.parse(raw)
    const message = typeof parsed?.message === 'string' ? parsed.message : null
    if (!message) return
    // Drop stale flashes (e.g. tab restored hours later).
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > 5 * 60 * 1000) return
    showBanner('success', message)
  } catch {
    // non-fatal
  }
}

consumeSubmitFlash()

function collectAnswers() {
  const answers = {}
  const inputs = document.querySelectorAll('input[name], textarea[name], select[name]')
  inputs.forEach((el) => {
    const name = el.getAttribute('name')
    if (!name) return
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (!el.checked) return
      answers[name] = el.value
    } else {
      answers[name] = el.value
    }
  })
  return answers
}

/**
 * Derive a stable component id from the URL path when meta tags aren't set.
 * /capstones/starter-kit-capstone-part-a.html -> 'starter-kit-capstone-part-a'
 */
function deriveComponentIdFromPath() {
  try {
    const path = window.location.pathname || ''
    const file = path.split('/').pop() || ''
    return file.replace(/\.html?$/i, '') || null
  } catch {
    return null
  }
}

function inferComponentType(componentId) {
  if (!componentId) return null
  if (componentId.includes('case-study')) return 'case_study'
  if (componentId.includes('practical')) return 'practical'
  if (componentId.includes('capstone')) return 'capstone'
  return null
}

function inferPillar(componentId) {
  if (!componentId) return null
  if (componentId.startsWith('starter-kit-')) return 'starter_kit'
  if (componentId.startsWith('innovation-')) return 'innovation_technology'
  if (componentId.startsWith('leading-self-')) return 'leading_self'
  if (componentId.startsWith('fostering-')) return 'fostering'
  if (componentId.startsWith('transforming-business-')) return 'transforming_business'
  return null
}

function deriveComponentTitle() {
  return document.title
    ? document.title.replace(/\s+[|·-]\s*T4L.*$/i, '').trim()
    : null
}

const derivedId = deriveComponentIdFromPath()
const META = {
  componentId: readMeta('programme-component-id') || derivedId,
  componentType: readMeta('programme-component-type') || inferComponentType(derivedId),
  pillar: readMeta('programme-pillar') || inferPillar(derivedId),
  partId: readMeta('programme-part-id') || derivedId,
  partTitle: readMeta('programme-part-title'),
  componentTitle: readMeta('programme-component-title') || deriveComponentTitle(),
}

if (!META.componentId) {
  console.error('[capstone-runtime] Could not determine component id from URL or meta tags. Submit will be disabled.')
}

const config = readConfig()
if (!config) {
  console.error('[capstone-runtime] Supabase config not found in localStorage. Was the main app loaded on this origin?')
}

/** REST helper against the Supabase project, with the learner's bearer token. */
async function sbFetch(path, token, init = {}) {
  const headers = {
    apikey: config.anonKey,
    Authorization: `Bearer ${token}`,
    ...(init.headers || {}),
  }
  return fetch(`${config.url}${path}`, { ...init, headers })
}

/** Ensure a non-expired access token, refreshing via the token endpoint if needed. */
async function getAccessToken() {
  const session = readSession(config.url)
  if (!session?.access_token) return null

  const expiresAt = typeof session.expires_at === 'number' ? session.expires_at : 0
  const nowSec = Math.floor(Date.now() / 1000)
  // Valid for at least another minute -> use as-is.
  if (expiresAt - nowSec > 60) {
    return { token: session.access_token, user: session.user ?? null }
  }

  // Expired/expiring: refresh with the stored refresh token.
  if (!session.refresh_token) {
    return { token: session.access_token, user: session.user ?? null }
  }
  try {
    const res = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    })
    if (!res.ok) {
      // Refresh failed -> fall back to the (possibly stale) token; submit may 401.
      return { token: session.access_token, user: session.user ?? null }
    }
    const refreshed = await res.json()
    return { token: refreshed.access_token, user: refreshed.user ?? session.user ?? null }
  } catch {
    return { token: session.access_token, user: session.user ?? null }
  }
}

async function fetchOrganizationId(uid, token) {
  try {
    const res = await sbFetch(
      `/rest/v1/profiles?id=eq.${uid}&select=organization_id,company_id`,
      token,
    )
    if (!res.ok) return null
    const rows = await res.json()
    const row = rows?.[0]
    if (!row) return null
    return row.organization_id || row.company_id || null
  } catch {
    return null
  }
}

async function submit() {
  if (!META.componentId) {
    showBanner('error', 'This page is missing its component id. Refresh; if it persists, contact support.')
    return
  }
  if (!config) {
    showBanner('error', "We couldn't connect to your account. Open this page from the main app and try again.")
    return
  }

  const confirmMessage = readMeta('programme-submit-confirm')
  if (confirmMessage && !window.confirm(confirmMessage.replace(/&#10;/g, '\n'))) {
    return
  }

  showBanner('info', 'Submitting your work...')

  const auth = await getAccessToken()
  const uid = auth?.user?.id
  if (!auth?.token || !uid) {
    showBanner(
      'error',
      'You need to be signed in. Open the main app, sign in, then click "Begin part" again from your courses page.',
    )
    return
  }

  const answers = collectAnswers()
  const answeredCount = Object.values(answers).filter(
    (v) => typeof v === 'string' && v.trim().length > 0,
  ).length
  if (answeredCount === 0) {
    showBanner('error', 'Nothing to submit yet. Fill in the fields and try again.')
    return
  }

  const organizationId = await fetchOrganizationId(uid, auth.token)

  // Detect resubmission for the success message (best-effort).
  let isResubmission = false
  try {
    const existingRes = await sbFetch(
      `/rest/v1/programme_component_submissions?user_id=eq.${uid}&component_id=eq.${encodeURIComponent(META.componentId)}&select=id`,
      auth.token,
    )
    if (existingRes.ok) {
      const rows = await existingRes.json()
      isResubmission = Array.isArray(rows) && rows.length > 0
    }
  } catch {
    // non-fatal
  }

  const payload = {
    user_id: uid,
    organization_id: organizationId,
    component_id: META.componentId,
    component_type: META.componentType ?? null,
    component_title: META.componentTitle ?? null,
    pillar: META.pillar ?? null,
    part_id: META.partId ?? null,
    part_title: META.partTitle ?? null,
    answers,
    answer_count: answeredCount,
    status: 'submitted',
    last_updated_at: new Date().toISOString(),
    ...(isResubmission ? { resubmitted_at: new Date().toISOString() } : {}),
    source_page: typeof window !== 'undefined' ? window.location.pathname : null,
  }

  try {
    // Upsert on (user_id, component_id): first submit inserts, resubmit updates
    // in place (submitted_at is preserved because we don't send it).
    const res = await sbFetch(
      `/rest/v1/programme_component_submissions?on_conflict=user_id,component_id`,
      auth.token,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(payload),
      },
    )

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[capstone-runtime] save failed', res.status, detail)
      if (res.status === 401 || res.status === 403) {
        showBanner(
          'error',
          'Your session expired. Open the main app, sign in again, then reopen this page.',
        )
      } else {
        showBanner('error', "We couldn't save your submission. Check your connection and try again.")
      }
      return
    }

    const reviewerLabel = organizationId
      ? 'Your partner can now review.'
      : 'A T4L assessor can now review your Practitioner Capstone.'
    const successMessage = isResubmission
      ? `Resubmitted. ${reviewerLabel}`
      : `Submitted. ${reviewerLabel}`
    // Clear fields + reload so the form is empty; flash keeps the success banner.
    flashSuccessAndReload(successMessage)
  } catch (err) {
    console.error('[capstone-runtime] save failed', err)
    showBanner('error', "We couldn't save your submission. Check your connection and try again.")
  }
}

// Bind the three legacy handler names the existing HTML pages use.
window.submitCapstone = submit
window.submitCaseStudy = submit
window.submitPractical = submit
window.t4lSubmitProgrammeComponent = submit

// Surface a small hint that work isn't auto-saved (one-time per session).
try {
  const HINT_KEY = 't4l_capstone_hint_shown'
  if (!sessionStorage.getItem(HINT_KEY)) {
    setTimeout(() => {
      showBanner('info', 'Your work is saved when you click Submit. Keep this tab open until then.')
      sessionStorage.setItem(HINT_KEY, '1')
      setTimeout(() => {
        const banner = document.getElementById('__t4l_submission_banner')
        if (banner && banner.textContent && banner.textContent.startsWith('Your work is saved')) {
          banner.remove()
        }
      }, 6000)
    }, 800)
  }
} catch {
  // sessionStorage unavailable; non-fatal.
}

void APP_BASE
