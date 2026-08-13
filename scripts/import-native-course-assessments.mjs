#!/usr/bin/env node
/**
 * Import Pre/Post course assessment questions from SurveyMonkey into
 * src/config/nativeCourseAssessments.catalog.json
 *
 * Faithful pull: expands matrix rows, keeps identity fields, and uses SM scales.
 *
 * Requires SURVEYMONKEY_ACCESS_TOKEN in local .env
 * Usage: node scripts/import-native-course-assessments.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_JSON = resolve(ROOT, 'src/config/nativeCourseAssessments.catalog.json')
const SM_API = 'https://api.surveymonkey.com/v3'

function loadToken() {
  for (const name of ['.env', '.env.local']) {
    const path = resolve(ROOT, name)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t.startsWith('SURVEYMONKEY_ACCESS_TOKEN=')) continue
      let value = t.slice('SURVEYMONKEY_ACCESS_TOKEN='.length).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (value && !value.includes('your_surveymonkey')) return value
    }
  }
  return null
}

async function smFetch(token, path) {
  const res = await fetch(`${SM_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}: ${text.slice(0, 400)}`)
  return JSON.parse(text)
}

function inferKind(title) {
  const t = (title || '').toLowerCase()
  if (t.includes('pre')) return 'pre'
  if (t.includes('post')) return 'post'
  return 'other'
}

function isExternal(title) {
  return /external\s*rater/i.test(title || '')
}

function stripHtml(s) {
  return (s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function courseKey(title) {
  return stripHtml(title)
    .replace(/pre[-\s]?course\s+assessment/gi, '')
    .replace(/post[-\s]?course\s+assessment/gi, '')
    .replace(/\(external rater\)/gi, '')
    .replace(/external rater/gi, '')
    .replace(/[-–—|:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function resolveScale(choices) {
  const weights = (choices || [])
    .map((c) => c.weight)
    .filter((w) => typeof w === 'number' && Number.isFinite(w))
  if (weights.length > 0) return { min: Math.min(...weights), max: Math.max(...weights) }

  const parsed = (choices || [])
    .map((c) => Number.parseInt(String(c.text || '').trim(), 10))
    .filter((n) => Number.isFinite(n))
  if (parsed.length > 0) return { min: Math.min(...parsed), max: Math.max(...parsed) }

  return { min: 1, max: 10 }
}

function parseQuestions(pages) {
  const questions = []
  for (const page of pages || []) {
    for (const q of page.questions || []) {
      const heading = stripHtml((q.headings || []).map((h) => h.heading || '').join(' '))
      const family = (q.family || '').toLowerCase()
      const subtype = (q.subtype || '').toLowerCase()

      if (family === 'presentation') {
        if (heading) questions.push({ type: 'info', text: heading })
        continue
      }

      if (family === 'matrix' && (subtype === 'rating' || subtype === 'single' || !subtype)) {
        const rows = (q.answers?.rows || [])
          .map((row) => stripHtml(row.text || ''))
          .filter(Boolean)
        const scale = resolveScale(q.answers?.choices)
        if (rows.length > 0) {
          if (heading) questions.push({ type: 'info', text: heading })
          for (const row of rows) {
            questions.push({ type: 'rating', text: row, min: scale.min, max: scale.max })
          }
          continue
        }
        if (heading) {
          questions.push({ type: 'rating', text: heading, min: scale.min, max: scale.max })
        }
        continue
      }

      if (family === 'single_choice' || family === 'multiple_choice') {
        const choices = (q.answers?.choices || [])
          .map((c) => stripHtml(c.text || ''))
          .filter(Boolean)
        if (!heading) continue
        questions.push({ type: 'single_choice', text: heading, choices })
        continue
      }

      if (family === 'open_ended') {
        if (!heading) continue
        questions.push({
          type: subtype === 'essay' || subtype === 'multi' ? 'long_text' : 'short_text',
          text: heading,
        })
        continue
      }

      if (family === 'datetime' || family === 'demographic') {
        if (heading) questions.push({ type: 'short_text', text: heading })
        continue
      }

      if (heading) questions.push({ type: 'long_text', text: heading })
    }
  }
  return questions
}

async function main() {
  const token = loadToken()
  if (!token) {
    console.error('Missing SURVEYMONKEY_ACCESS_TOKEN in .env')
    process.exit(1)
  }

  const surveys = []
  for (let page = 1; page <= 20; page += 1) {
    const data = await smFetch(token, `/surveys?per_page=100&page=${page}`)
    const batch = data.data || []
    surveys.push(...batch)
    if (batch.length < 100) break
  }

  const out = []
  let i = 0
  for (const s of surveys) {
    const kind = inferKind(s.title)
    if (kind === 'other') continue
    i += 1
    process.stderr.write(`\r[${i}] ${(s.title || '').slice(0, 60)}`)
    const detail = await smFetch(token, `/surveys/${s.id}/details`)
    out.push({
      surveyMonkeyId: String(s.id),
      title: s.title,
      kind,
      audience: isExternal(s.title) ? 'external_rater' : 'self',
      courseKey: courseKey(s.title),
      courseMatchers: [courseKey(s.title)].filter(Boolean),
      questions: parseQuestions(detail.pages),
    })
  }
  process.stderr.write('\n')

  mkdirSync(resolve(ROOT, 'scripts/data'), { recursive: true })
  writeFileSync(OUT_JSON, JSON.stringify(out, null, 2))
  writeFileSync(resolve(ROOT, 'scripts/data/sm-course-assessments.json'), JSON.stringify(out, null, 2))
  console.log(
    JSON.stringify(
      {
        wrote: OUT_JSON,
        count: out.length,
        selfPre: out.filter((x) => x.kind === 'pre' && x.audience === 'self').length,
        selfPost: out.filter((x) => x.kind === 'post' && x.audience === 'self').length,
        rater: out.filter((x) => x.audience === 'external_rater').length,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
