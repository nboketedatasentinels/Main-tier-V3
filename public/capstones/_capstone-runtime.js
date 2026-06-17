/*
 * Shared submission runtime for /capstones/*.html.
 *
 * What this does:
 *  1. Reads <meta name="programme-component-*"> tags from the page (with
 *     filename-based fallbacks).
 *  2. Loads Supabase using the config the React app published to localStorage
 *     (t4l_sb_config = { url, anonKey }, written by src/services/supabase.ts).
 *  3. Picks up the learner's existing Supabase auth session (same origin --
 *     supabase-js reads the persisted session from localStorage).
 *  4. On Submit (window.submitCapstone / submitCaseStudy / submitPractical),
 *     collects every named input/textarea and upserts a row into
 *       public.programme_component_submissions  (one per learner per artefact).
 *  5. Shows a small status banner with success / error.
 *
 * RLS (migration 0014) lets a learner write only their own submission, and
 * partners/admins of the learner's org read + review it. A Database Webhook on
 * INSERT/UPDATE of the table invokes the `grade-submission` Edge Function,
 * which writes the advisory `ai_grade` server-side -- so by the time a partner
 * opens it, the submission is already graded. No client AI call needed.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CONFIG_KEY = 't4l_sb_config'

function readMeta(name) {
  const el = document.querySelector(`meta[name="${name}"]`)
  return el ? el.getAttribute('content') : null
}

function readConfig() {
  try {
    const raw = window.localStorage?.getItem(CONFIG_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

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
      'font-family:\'DM Sans\',system-ui,sans-serif',
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
let supabase = null

if (config?.url && config?.anonKey) {
  // Same url+anonKey as the React app => same persisted-session storage key,
  // so this client transparently picks up the learner's existing login.
  supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
} else {
  console.error('[capstone-runtime] Supabase config not found in localStorage (t4l_sb_config). Was the main app loaded on this origin?')
}

async function getUser() {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      console.warn('[capstone-runtime] auth.getUser error', error)
      return null
    }
    return data?.user ?? null
  } catch (err) {
    console.warn('[capstone-runtime] auth.getUser threw', err)
    return null
  }
}

async function submit() {
  if (!META.componentId) {
    showBanner('error', 'This page is missing its component id. Refresh; if it persists, contact your partner.')
    return
  }
  if (!supabase) {
    showBanner('error', "We couldn't connect to your account. Open this page from the main app and try again.")
    return
  }
  showBanner('info', 'Submitting your work...')

  const user = await getUser()
  if (!user) {
    showBanner(
      'error',
      'You need to be signed in. Open the main app, sign in, then click "Begin part" again from your courses page.',
    )
    return
  }

  const answers = collectAnswers()
  const answeredCount = Object.values(answers).filter((v) => typeof v === 'string' && v.trim().length > 0).length
  if (answeredCount === 0) {
    showBanner('error', 'Nothing to submit yet. Fill in the fields and try again.')
    return
  }

  // Learner's org so the partner dashboard can scope the submission.
  let organizationId = null
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()
    organizationId = profile?.organization_id ?? null
  } catch (err) {
    console.warn('[capstone-runtime] could not read learner profile for organization_id', err)
  }

  // Detect resubmission so we preserve the original submitted_at.
  let isResubmission = false
  try {
    const { data: existing } = await supabase
      .from('programme_component_submissions')
      .select('id')
      .eq('user_id', user.id)
      .eq('component_id', META.componentId)
      .maybeSingle()
    isResubmission = !!existing
  } catch (err) {
    console.warn('[capstone-runtime] resubmission check failed', err)
  }

  const nowIso = new Date().toISOString()
  const row = {
    user_id: user.id,
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
    last_updated_at: nowIso,
    source_page: typeof window !== 'undefined' ? window.location.pathname : null,
  }
  if (isResubmission) {
    row.resubmitted_at = nowIso
  } else {
    row.submitted_at = nowIso
  }

  try {
    const { error } = await supabase
      .from('programme_component_submissions')
      .upsert(row, { onConflict: 'user_id,component_id' })
    if (error) throw error

    showBanner(
      'success',
      isResubmission
        ? 'Resubmitted. Your partner will see the updated answers (re-graded automatically).'
        : 'Submitted. It is being graded, then your partner can review it.',
    )
  } catch (err) {
    console.error('[capstone-runtime] save failed', err)
    const msg = err?.message || ''
    if (/row-level security|permission|denied/i.test(msg)) {
      showBanner('error', "We couldn't save your submission (permission). Make sure you're signed in to the main app on this device.")
    } else {
      showBanner('error', "We couldn't save your submission. Check your connection and try again.")
    }
  }
}

// Bind the handler names the existing HTML pages use.
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
