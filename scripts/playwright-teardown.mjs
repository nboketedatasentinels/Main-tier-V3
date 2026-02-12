import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const reportDir = path.resolve('playwright-report')
const rawResultsPath = path.join(reportDir, 'results.raw.json')
const resultsPath = path.join(reportDir, 'results.json')
const indexPath = path.join(reportDir, 'index.html')

const cwd = path.resolve(process.cwd())
const home = os.homedir()
const cwdLower = cwd.toLowerCase()
const homeLower = home.toLowerCase()

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const sanitizePath = (value) => {
  const normalized = path.normalize(value)
  const lower = normalized.toLowerCase()

  if (lower.startsWith(cwdLower)) {
    const relativePath = path.relative(cwd, normalized)
    return relativePath || '.'
  }

  if (lower.startsWith(homeLower)) {
    const relativePath = path.relative(home, normalized)
    return path.join('<home>', relativePath)
  }

  return value
}

const sanitizeFileUri = (value) => {
  if (!value.startsWith('file:///')) return value
  const url = new URL(value)
  let pathname = decodeURIComponent(url.pathname)
  if (/^\/[A-Za-z]:\//.test(pathname)) {
    pathname = pathname.slice(1)
  }
  const sanitized = sanitizePath(pathname)
  return `file:///${sanitized.replace(/\\/g, '/')}`
}

const sanitizeString = (value) => {
  if (!value || typeof value !== 'string') return value

  if (value.startsWith('file:///')) {
    return sanitizeFileUri(value)
  }

  const lower = value.toLowerCase()
  if (lower.startsWith(cwdLower) || lower.startsWith(homeLower)) {
    return sanitizePath(value)
  }

  if (lower.includes(cwdLower)) {
    return value.replace(new RegExp(escapeRegExp(cwd), 'gi'), '<repo>')
  }

  if (lower.includes(homeLower)) {
    return value.replace(new RegExp(escapeRegExp(home), 'gi'), '<home>')
  }

  return value
}

const sanitizeNode = (node) => {
  if (Array.isArray(node)) {
    return node.map(sanitizeNode)
  }

  if (node && typeof node === 'object') {
    const next = {}
    for (const [key, value] of Object.entries(node)) {
      next[key] = sanitizeNode(value)
    }
    return next
  }

  return sanitizeString(node)
}

const sanitizeResultsJson = async () => {
  try {
    const raw = await fs.readFile(rawResultsPath, 'utf8')
    const json = JSON.parse(raw)
    const sanitized = sanitizeNode(json)
    await fs.writeFile(resultsPath, JSON.stringify(sanitized, null, 2))
    await fs.rm(rawResultsPath, { force: true })
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn('[playwright-teardown] Failed to sanitize results.json', error)
    }
  }
}

const fixReportHtml = async () => {
  try {
    const html = await fs.readFile(indexPath, 'utf8')
    const scriptMatch = html.match(/<script id="playwrightReportBase64"[\s\S]*?<\/script>/)
    if (!scriptMatch) return

    const script = scriptMatch[0]
    let updated = html.replace(script, '')
    if (updated.includes('</body>')) {
      updated = updated.replace('</body>', `${script}\n</body>`)
      await fs.writeFile(indexPath, updated)
    }
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn('[playwright-teardown] Failed to patch index.html', error)
    }
  }
}

export default async function globalTeardown() {
  await sanitizeResultsJson()
  await fixReportHtml()
}
