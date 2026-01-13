import { InviteDraft } from '@/types/admin'
import { normalizeEmail } from '@/utils/email'

const headers = ['name', 'email', 'role', 'invitation method']

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const generateCSVTemplate = () => {
  const exampleRows = [
    'Name,Email,Role,Invitation Method',
    'Jane Doe,jane@example.com,user,email',
    'John Learner,,user,one_time_code',
  ]
  return exampleRows.join('\n')
}

export const downloadCSVTemplate = () => {
  const csv = generateCSVTemplate()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'organization_invitations_template.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const normalizeHeader = (value: string) => value.trim().toLowerCase()

const parseRow = (row: string[]) => {
  const [name, email, role, method] = row
  return {
    name: name?.trim() || '',
    email: normalizeEmail(email || ''),
    role: (role?.trim() || 'user') as InviteDraft['role'],
    method: (method?.trim() || (email ? 'email' : 'one_time_code')) as InviteDraft['method'],
  }
}

export const parseInvitationCSV = async (file: File): Promise<InviteDraft[]> => {
  const text = await file.text()
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length <= 1) {
    throw new Error('CSV must include at least one data row')
  }

  const fileHeaders = lines[0].split(',').map(normalizeHeader)
  const missing = headers.filter((header) => !fileHeaders.includes(header))
  if (missing.length) {
    throw new Error(`Invalid CSV format. Missing columns: ${missing.join(', ')}`)
  }

  const dataLines = lines.slice(1)
  const emailRows = new Map<string, number[]>()
  const drafts: InviteDraft[] = dataLines.map((line, index) => {
    const columns = line.split(',')
    const parsed = parseRow(columns)
    const rowNumber = index + 2

    if (!parsed.name) throw new Error(`Row ${index + 2}: Name is required`)
    if (parsed.method === 'email' && parsed.email && !emailRegex.test(parsed.email)) {
      throw new Error(`Row ${index + 2}: Invalid email format`)
    }
    if (parsed.method === 'email' && parsed.email) {
      const rows = emailRows.get(parsed.email) || []
      rows.push(rowNumber)
      emailRows.set(parsed.email, rows)
    }

    return {
      id: `${Date.now()}-${index}`,
      name: parsed.name,
      email: parsed.email,
      role: parsed.role,
      method: parsed.method,
    }
  })

  const duplicateEmailDetails = Array.from(emailRows.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([email, rows]) => `${email} (rows ${rows.join(', ')})`)
  if (duplicateEmailDetails.length) {
    throw new Error(`Duplicate emails found: ${duplicateEmailDetails.join('; ')}`)
  }

  return drafts
}
