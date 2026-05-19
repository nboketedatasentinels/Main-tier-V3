/*
 * Shared submission runtime for /capstones/*.html.
 *
 * What this does:
 *  1. Reads <meta name="programme-component-*"> tags from the page.
 *  2. Loads Firebase using the config the React app published to localStorage.
 *  3. Picks up the learner's existing auth session (same origin).
 *  4. On Submit (window.submitCapstone / submitCaseStudy / submitPractical),
 *     collects every named input/textarea, builds a submission doc, and
 *     writes it to Firestore at
 *       programmeComponentSubmissions/{uid}__{componentId}.
 *  5. Shows a small status banner with success / error.
 *
 * The React app's Firestore rules enforce that a learner can only write
 * their own submission. Partners + admins of the learner's org can read.
 */

import {
  initializeApp,
  getApps,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js'
import {
  getAuth,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js'

const APP_BASE = '/app/courses#programme-components'
const CONFIG_KEY = 't4l_fb_config'

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
let firebaseApp = null
let firestore = null
let firebaseAuth = null
let authUser = null
let authResolved = false

if (config?.apiKey && config?.projectId) {
  firebaseApp = getApps().length ? getApps()[0] : initializeApp(config)
  firebaseAuth = getAuth(firebaseApp)
  firestore = getFirestore(firebaseApp)

  onAuthStateChanged(firebaseAuth, (user) => {
    authUser = user
    authResolved = true
    if (!user) {
      console.warn('[capstone-runtime] no signed-in user detected')
    }
  })
} else {
  console.error('[capstone-runtime] Firebase config not found in localStorage. Was the main app loaded on this origin?')
}

function waitForAuth(timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (authResolved) return resolve(authUser)
    const startedAt = Date.now()
    const id = setInterval(() => {
      if (authResolved || Date.now() - startedAt > timeoutMs) {
        clearInterval(id)
        resolve(authUser)
      }
    }, 100)
  })
}

async function submit() {
  if (!META.componentId) {
    showBanner('error', 'This page is missing its component id. Refresh; if it persists, contact your partner.')
    return
  }
  if (!firestore || !firebaseAuth) {
    showBanner('error', "We couldn't connect to your account. Open this page from the main app and try again.")
    return
  }
  showBanner('info', 'Submitting your work...')
  const user = await waitForAuth()
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

  const submissionId = `${user.uid}__${META.componentId}`
  const ref = doc(firestore, 'programmeComponentSubmissions', submissionId)

  // Look up learner profile so the submission records its organizationId.
  // Without it the partner dashboard can't scope submissions to their orgs.
  let organizationId = null
  try {
    const profileSnap = await getDoc(doc(firestore, 'profiles', user.uid))
    if (profileSnap.exists()) {
      const data = profileSnap.data() || {}
      organizationId = data.organizationId ?? data.orgId ?? data.companyId ?? null
    }
  } catch (err) {
    console.warn('[capstone-runtime] could not read learner profile for orgId', err)
  }

  try {
    // Read existing doc to preserve original submittedAt + capture resubmissions.
    const existing = await getDoc(ref)
    const isResubmission = existing.exists()

    await setDoc(
      ref,
      {
        uid: user.uid,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        organizationId,
        componentId: META.componentId,
        componentType: META.componentType ?? null,
        componentTitle: META.componentTitle ?? null,
        pillar: META.pillar ?? null,
        partId: META.partId ?? null,
        partTitle: META.partTitle ?? null,
        answers,
        answerCount: answeredCount,
        status: 'submitted',
        submittedAt: isResubmission ? existing.data().submittedAt : serverTimestamp(),
        lastUpdatedAt: serverTimestamp(),
        resubmittedAt: isResubmission ? serverTimestamp() : null,
        sourcePage: typeof window !== 'undefined' ? window.location.pathname : null,
      },
      { merge: true },
    )
    showBanner(
      'success',
      isResubmission ? 'Resubmitted. Your partner will see the updated answers.' : 'Submitted. Your partner can now review.',
    )
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
