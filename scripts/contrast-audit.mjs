import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()
const srcRoot = path.join(repoRoot, 'src')

const patterns = [
  {
    id: 'chakra-gray-300-400-color-prop',
    description: 'Chakra `color` set to gray.300/gray.400 (often fails contrast on light surfaces)',
    regex: /\bcolor\s*=\s*["']gray\.(300|400)["']/g,
  },
  {
    id: 'chakra-gray-300-400-color-style',
    description: "Style object `color: 'gray.300'|'gray.400'`",
    regex: /\bcolor\s*:\s*["']gray\.(300|400)["']/g,
  },
  {
    id: 'chakra-gray-100-200-borderColor-prop',
    description:
      'Chakra `borderColor` set to gray.100/gray.200 (too light for visible boundaries on white surfaces)',
    regex: /\bborderColor\s*=\s*["']gray\.(100|200)["']/g,
  },
  {
    id: 'chakra-gray-100-200-borderColor-style',
    description: "Style object `borderColor: 'gray.100'|'gray.200'`",
    regex: /\bborderColor\s*:\s*["']gray\.(100|200)["']/g,
  },
  {
    id: 'chakra-gray-300-400-borderColor-prop',
    description: 'Chakra `borderColor` set to gray.300/gray.400 (often too low-contrast for control boundaries)',
    regex: /\bborderColor\s*=\s*["']gray\.(300|400)["']/g,
  },
  {
    id: 'chakra-gray-300-400-borderColor-style',
    description: "Style object `borderColor: 'gray.300'|'gray.400'`",
    regex: /\bborderColor\s*:\s*["']gray\.(300|400)["']/g,
  },
  {
    id: 'chakra-useColorModeValue-gray-200',
    description: "useColorModeValue('gray.200', ...) is usually too light for borders on light surfaces",
    regex: /\buseColorModeValue\(\s*["']gray\.200["']\s*,/g,
  },
  {
    id: 'tailwind-low-contrast-border-gray',
    description: 'Tailwind borders using gray-100/200/300 (often too light on white)',
    regex: /\bborder-gray-(100|200|300)\b/g,
  },
  {
    id: 'tailwind-low-contrast-divider-bg-gray',
    description: 'Tailwind divider backgrounds using gray-200 (often invisible on white)',
    regex: /\bbg-gray-200\b/g,
  },
  {
    id: 'tailwind-low-contrast-text-gray',
    description: 'Tailwind text using gray-300/400 (often fails contrast on light surfaces)',
    regex: /\btext-gray-(300|400)\b/g,
  },
  {
    id: 'tailwind-low-contrast-placeholder-gray',
    description: 'Tailwind placeholder text using gray-400 (often too light)',
    regex: /\bplaceholder:text-gray-400\b/g,
  },
  {
    id: 'tailwind-low-contrast-hover-text-gray',
    description: 'Tailwind hover text using gray-300/400 (often fails contrast on light surfaces)',
    regex: /\bhover:text-gray-(300|400)\b/g,
  },
  {
    id: 'tailwind-low-contrast-active-text-gray',
    description: 'Tailwind active text using gray-300/400 (often fails contrast on light surfaces)',
    regex: /\bactive:text-gray-(300|400)\b/g,
  },
  {
    id: 'tailwind-low-contrast-hover-border-gray',
    description: 'Tailwind hover borders using gray-100/200/300 (often too light on white)',
    regex: /\bhover:border-gray-(100|200|300)\b/g,
  },
  {
    id: 'tailwind-low-contrast-focus-border-gray',
    description: 'Tailwind focus borders using gray-100/200/300 (often too light on white)',
    regex: /\bfocus:border-gray-(100|200|300)\b/g,
  },
]

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(fullPath)
      continue
    }
    yield fullPath
  }
}

function isSourceFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx'
}

function relative(filePath) {
  return path.relative(repoRoot, filePath)
}

const violations = []

function findLineNumber(content, index) {
  // 1-based line numbers
  let line = 1
  for (let i = 0; i < index; i++) {
    if (content.charCodeAt(i) === 10) line++
  }
  return line
}

function getLineText(content, lineNumber) {
  const lines = content.split(/\r?\n/)
  return (lines[lineNumber - 1] || '').trim()
}

for await (const filePath of walk(srcRoot)) {
  if (!isSourceFile(filePath)) continue

  const content = await readFile(filePath, 'utf8')

  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0
    let match
    // eslint-disable-next-line no-cond-assign
    while ((match = pattern.regex.exec(content)) !== null) {
      const lineNumber = findLineNumber(content, match.index)
      violations.push({
        file: relative(filePath),
        line: lineNumber,
        pattern: pattern.id,
        description: pattern.description,
        text: getLineText(content, lineNumber),
      })
    }
  }
}

if (violations.length === 0) {
  console.log('✅ Contrast audit: no known low-contrast patterns found in src/')
  process.exit(0)
}

console.error(`❌ Contrast audit: found ${violations.length} potential low-contrast patterns in src/`)

const byPattern = violations.reduce((acc, v) => {
  acc[v.pattern] = acc[v.pattern] || { description: v.description, count: 0 }
  acc[v.pattern].count++
  return acc
}, {})

for (const [id, info] of Object.entries(byPattern)) {
  console.error(`- ${id}: ${info.count} (${info.description})`)
}

console.error('\nFirst 50 occurrences:')
for (const v of violations.slice(0, 50)) {
  console.error(`- ${v.file}:${v.line} [${v.pattern}] ${v.text}`)
}

process.exit(1)
