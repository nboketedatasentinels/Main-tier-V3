import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()
const srcRoot = path.join(repoRoot, 'src')

const patterns = [
  {
    id: 'chakra-gray-300-400-color-prop',
    description: 'Chakra `color` set to gray.300/gray.400 (often fails contrast on light surfaces)',
    regex: /\bcolor\s*=\s*["']gray\.(300|400)["']/,
  },
  {
    id: 'chakra-gray-300-400-color-style',
    description: "Style object `color: 'gray.300'|'gray.400'`",
    regex: /\bcolor\s*:\s*["']gray\.(300|400)["']/,
  },
  {
    id: 'chakra-gray-100-200-borderColor-prop',
    description:
      'Chakra `borderColor` set to gray.100/gray.200 (too light for visible boundaries on white surfaces)',
    regex: /\bborderColor\s*=\s*["']gray\.(100|200)["']/,
  },
  {
    id: 'chakra-gray-100-200-borderColor-style',
    description: "Style object `borderColor: 'gray.100'|'gray.200'`",
    regex: /\bborderColor\s*:\s*["']gray\.(100|200)["']/,
  },
  {
    id: 'chakra-gray-300-400-borderColor-prop',
    description: 'Chakra `borderColor` set to gray.300/gray.400 (often too low-contrast for control boundaries)',
    regex: /\bborderColor\s*=\s*["']gray\.(300|400)["']/,
  },
  {
    id: 'chakra-gray-300-400-borderColor-style',
    description: "Style object `borderColor: 'gray.300'|'gray.400'`",
    regex: /\bborderColor\s*:\s*["']gray\.(300|400)["']/,
  },
  {
    id: 'chakra-useColorModeValue-gray-200',
    description: "useColorModeValue('gray.200', ...) is usually too light for borders on light surfaces",
    regex: /\buseColorModeValue\(\s*["']gray\.200["']\s*,/,
  },
  {
    id: 'tailwind-low-contrast-border-gray',
    description: 'Tailwind borders using gray-100/200/300 (often too light on white)',
    regex: /\bborder-gray-(100|200|300)\b/,
  },
  {
    id: 'tailwind-low-contrast-divider-bg-gray',
    description: 'Tailwind divider backgrounds using gray-200 (often invisible on white)',
    regex: /\bbg-gray-200\b/,
  },
  {
    id: 'tailwind-low-contrast-text-gray',
    description: 'Tailwind text using gray-300/400 (often fails contrast on light surfaces)',
    regex: /\btext-gray-(300|400)\b/,
  },
  {
    id: 'tailwind-low-contrast-placeholder-gray',
    description: 'Tailwind placeholder text using gray-400 (often too light)',
    regex: /\bplaceholder:text-gray-400\b/,
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

for await (const filePath of walk(srcRoot)) {
  if (!isSourceFile(filePath)) continue

  const content = await readFile(filePath, 'utf8')
  const lines = content.split(/\r?\n/)

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    for (const pattern of patterns) {
      if (!pattern.regex.test(line)) continue

      violations.push({
        file: relative(filePath),
        line: lineIndex + 1,
        pattern: pattern.id,
        description: pattern.description,
        text: line.trim(),
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
