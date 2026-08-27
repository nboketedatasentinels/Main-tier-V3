import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { Download } from 'lucide-react'
import { format } from 'date-fns'
import {
  IMPACT_CATS,
  IMPACT_ESG_PILLARS,
  IMPACT_GROWTH,
  IMPACT_WASTES,
  claimInputsFromRecord,
  formatMoney,
  valuation,
  type ImpactRateCard,
} from '@/config/impactValueEngine'
import type { ImpactLogRecord } from '@/services/impactLogService'
import { downloadImprovementValueReportPdf } from '@/reports/t4lImprovementValueReportPdf'

type Props = {
  entries: ImpactLogRecord[]
  rates: ImpactRateCard[]
  user?: unknown
  profile?: { companyName?: string | null; companyId?: string | null } | null
}

type Tab = 'register' | 'board' | 'waste' | 'esg'

function csvEscape(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const ImpactExportPanel: React.FC<Props> = ({ entries, rates, profile }) => {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('register')
  const [pdfBusy, setPdfBusy] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  const claims = entries.filter((e) => e.entryKind === 'claim' || (!e.entryKind && e.categoryGroup === 'business'))
  const validated = claims.filter(
    (e) => e.claimStatus === 'Recognized' || e.verificationStatus === 'approved',
  )
  const esg = entries.filter((e) => e.entryKind === 'esg' || e.categoryGroup === 'esg')

  const downloadPdf = async () => {
    setPdfBusy(true)
    try {
      const name = await downloadImprovementValueReportPdf({
        entries,
        rates,
        orgName: profile?.companyName,
      })
      toast({
        status: 'success',
        title: 'PDF downloaded',
        description: name,
      })
    } catch (err) {
      toast({
        status: 'error',
        title: 'PDF download failed',
        description: err instanceof Error ? err.message : 'Try again',
      })
    } finally {
      setPdfBusy(false)
    }
  }

  const registerCsv = useMemo(() => {
    const head = [
      'id',
      'type',
      'title',
      'date',
      'status',
      'tier',
      'category',
      'waste_or_growth',
      'net_per_period_usd',
      'bucket',
      'hours',
      'people',
    ]
    const rows = entries.map((e) => {
      const inputs = claimInputsFromRecord(e)
      const v = inputs ? valuation(inputs, rates) : null
      const cat = IMPACT_CATS.find((c) => c.k === e.claim?.cat)?.n || e.businessCategory || e.esgCategory || ''
      const sub =
        e.claim?.cat === 'rev'
          ? IMPACT_GROWTH.find((g) => g.k === e.claim?.growth)?.n
          : IMPACT_WASTES.find((w) => w.k === e.claim?.waste)?.n
      return [
        e.id,
        e.entryKind || e.categoryGroup,
        e.title,
        e.date,
        e.claimStatus || e.verificationStatus,
        v?.tier ?? '',
        cat,
        sub || '',
        v && v.tier > 1 ? Math.round(v.net) : e.usdValue ?? 0,
        e.claim?.bucket || '',
        e.hours,
        e.peopleImpacted,
      ]
    })
    return [head, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n')
  }, [entries, rates])

  const download = (name: string, text: string, mime = 'text/csv;charset=utf-8') => {
    try {
      const blob = new Blob([text], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 500)
    } catch {
      toast({ status: 'warning', title: 'Download blocked. Copy from the box instead' })
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ status: 'success', title: 'Copied' })
    } catch {
      toast({ status: 'warning', title: 'Select the text and copy manually' })
    }
  }

  const cash = validated
    .filter((e) => e.claim?.bucket === 'cash')
    .reduce((s, e) => s + Number(e.usdValue || 0), 0)
  const avoid = validated
    .filter((e) => e.claim?.bucket === 'avoidance')
    .reduce((s, e) => s + Number(e.usdValue || 0), 0)
  const capHours = validated
    .filter((e) => e.claim?.bucket === 'capacity')
    .reduce((s, e) => s + Number(e.hours || 0), 0)

  const wasteRows = IMPACT_WASTES.map((w) => {
    const matched = validated.filter((c) => c.claim?.waste === w.k)
    const value = matched.reduce((s, e) => s + Number(e.usdValue || 0), 0)
    return { k: w.k, label: w.n, count: matched.length, value }
  }).filter((w) => w.count > 0)
  const growthRows = IMPACT_GROWTH.map((g) => {
    const matched = validated.filter((c) => c.claim?.growth === g.k)
    const value = matched.reduce((s, e) => s + Number(e.usdValue || 0), 0)
    return { k: g.k, label: g.n, count: matched.length, value }
  }).filter((g) => g.count > 0)

  return (
    <Stack spacing={4}>
      <Flex justify="space-between" align={{ base: 'stretch', md: 'flex-start' }} gap={3} flexWrap="wrap">
        <Box flex="1" minW="220px">
          <Heading size="md" mb={1}>
            Export
          </Heading>
          <Text fontSize="sm" color="text.secondary">
            Download the Template 1 board pack (Improvement value report), or pick another hand-off:
            CSV for finance, on-screen one-pager, waste summary, or ESG pack.
          </Text>
        </Box>
        <Button
          colorScheme="primary"
          leftIcon={<Download size={16} />}
          onClick={() => void downloadPdf()}
          isLoading={pdfBusy}
          loadingText="Building PDF…"
          flexShrink={0}
        >
          Download PDF
        </Button>
      </Flex>

      <HStack spacing={2} flexWrap="wrap">
        {(
          [
            ['register', 'Finance CSV'],
            ['board', 'Board one-pager'],
            ['waste', 'Waste / growth summary'],
            ['esg', 'ESG hand-off'],
          ] as const
        ).map(([k, l]) => (
          <Button
            key={k}
            size="sm"
            variant={tab === k ? 'solid' : 'outline'}
            colorScheme={tab === k ? 'primary' : undefined}
            onClick={() => setTab(k)}
          >
            {l}
          </Button>
        ))}
      </HStack>

      {tab === 'register' && (
        <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl" bg="gray.50">
          <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color="text.muted" mb={1}>
            For finance systems · machine-readable
          </Text>
          <Heading size="sm" mb={2}>
            Claims ledger CSV
          </Heading>
          <Text fontSize="sm" color="text.secondary" mb={3}>
            Flat file with one row per entry. Import into Excel or your finance tool.
          </Text>
          <HStack mb={3}>
            <Button
              size="sm"
              colorScheme="primary"
              onClick={() => download(`t4l_claims_ledger_${today}.csv`, registerCsv)}
            >
              Download CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => void copy(registerCsv)}>
              Copy
            </Button>
          </HStack>
          <Textarea value={registerCsv} readOnly rows={14} fontFamily="mono" fontSize="xs" bg="white" />
        </Box>
      )}

      {tab === 'board' && (
        <Box
          p={0}
          border="1px solid"
          borderColor="brand.primary"
          rounded="xl"
          overflow="hidden"
          bg="white"
          className="sheet"
        >
          <Box bgGradient="linear(to-r, #350e6f, #8b5a3c)" color="white" px={6} py={5}>
            <Flex justify="space-between" align="flex-start" gap={4} flexWrap="wrap">
              <Box>
                <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="0.08em" opacity={0.9}>
                  Transformation Leader · Board pack
                </Text>
                <Heading size="md" mt={1} color="white">
                  Improvement value report
                </Heading>
                <Text fontSize="sm" opacity={0.85} mt={1}>
                  Prepared {today} · validated claims only
                </Text>
              </Box>
              <Button size="sm" bg="whiteAlpha.200" color="white" _hover={{ bg: 'whiteAlpha.300' }} onClick={() => window.print()}>
                Print / PDF
              </Button>
            </Flex>
          </Box>
          <Box px={6} py={5}>
            <SimpleMoney cash={cash} avoid={avoid} capHours={capHours} />
            <Text fontSize="sm" my={4} color="text.secondary">
              <b>Basis of preparation.</b> Figures come from claims with a locked baseline from a
              named system, valued from finance-returned rates, reduced for attribution, realisation
              and evidence confidence. Cash, avoidance and capacity are never summed.
            </Text>
            <Heading size="xs" mb={2} textTransform="uppercase" letterSpacing="0.06em" color="text.muted">
              Recognised improvements
            </Heading>
            <Stack spacing={0}>
              {validated.map((e) => (
                <Flex
                  key={e.id}
                  justify="space-between"
                  fontSize="sm"
                  py={2.5}
                  borderBottom="1px solid"
                  borderColor="border.subtle"
                >
                  <Text>
                    {e.title} · {e.date}
                  </Text>
                  <Text fontFamily="mono" fontWeight="semibold">
                    {formatMoney(Number(e.usdValue || 0))}
                  </Text>
                </Flex>
              ))}
              {validated.length === 0 && (
                <Text fontSize="sm" color="text.secondary">
                  No recognised claims yet.
                </Text>
              )}
            </Stack>
          </Box>
        </Box>
      )}

      {tab === 'waste' && (
        <Box p={5} border="1px dashed" borderColor="orange.300" rounded="xl" bg="orange.50">
          <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color="orange.700" mb={1}>
            Pattern report · ops / lean lens
          </Text>
          <Heading size="sm" mb={1}>
            Where value is coming from
          </Heading>
          <Text fontSize="sm" color="text.secondary" mb={4}>
            Count and value by waste type and revenue growth pattern, not a finance ledger.
          </Text>
          <Heading size="xs" mb={2}>
            Wastes
          </Heading>
          <Stack spacing={2} mb={4}>
            {(wasteRows.length
              ? wasteRows
              : IMPACT_WASTES.map((w) => ({ k: w.k, label: w.n, count: 0, value: 0 }))
            ).map((w) => (
              <Flex key={w.k} justify="space-between" fontSize="sm" bg="white" px={3} py={2} rounded="md">
                <Text>{w.label}</Text>
                <HStack spacing={4}>
                  <Text color="text.muted">{w.count} claims</Text>
                  <Text fontFamily="mono">{formatMoney(w.value)}</Text>
                </HStack>
              </Flex>
            ))}
          </Stack>
          <Heading size="xs" mb={2}>
            Growth patterns
          </Heading>
          <Stack spacing={2}>
            {(growthRows.length
              ? growthRows
              : IMPACT_GROWTH.map((g) => ({ k: g.k, label: g.n, count: 0, value: 0 }))
            ).map((g) => (
              <Flex key={g.k} justify="space-between" fontSize="sm" bg="white" px={3} py={2} rounded="md">
                <Text>{g.label}</Text>
                <HStack spacing={4}>
                  <Text color="text.muted">{g.count} claims</Text>
                  <Text fontFamily="mono">{formatMoney(g.value)}</Text>
                </HStack>
              </Flex>
            ))}
          </Stack>
          <Button mt={4} size="sm" colorScheme="orange" variant="outline" onClick={() => window.print()}>
            Print / PDF
          </Button>
        </Box>
      )}

      {tab === 'esg' && (
        <Box p={5} border="2px solid" borderColor="green.600" rounded="xl" bg="green.50">
          <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" color="green.800" mb={1}>
            ESG team hand-off · not financially valued
          </Text>
          <Heading size="sm" mb={1}>
            ESG contributions
          </Heading>
          <Text fontSize="sm" color="text.secondary" mb={3}>
            Own units only. Not tiered, not aggregated with the financial register.
          </Text>
          <Stack spacing={2}>
            {esg.map((e) => (
              <Flex
                key={e.id}
                justify="space-between"
                fontSize="sm"
                gap={3}
                bg="white"
                px={3}
                py={2}
                rounded="md"
                borderLeft="3px solid"
                borderColor="green.500"
              >
                <Box>
                  <Text fontWeight="medium">{e.esgMetric || e.title}</Text>
                  <Text fontSize="xs" color="text.muted">
                    {(
                      IMPACT_ESG_PILLARS.find((p) =>
                        p.n.toLowerCase().includes(String(e.esgCategory || '').toLowerCase()),
                      ) || IMPACT_ESG_PILLARS[0]
                    ).n}{' '}
                    · {e.date}
                  </Text>
                </Box>
                <Text fontFamily="mono" fontWeight="semibold">
                  {e.esgQty ?? e.peopleImpacted}
                </Text>
              </Flex>
            ))}
            {esg.length === 0 && <Text fontSize="sm">No ESG entries yet.</Text>}
          </Stack>
          <Button mt={4} size="sm" colorScheme="green" variant="outline" onClick={() => window.print()}>
            Print / PDF
          </Button>
        </Box>
      )}
    </Stack>
  )
}

const SimpleMoney: React.FC<{ cash: number; avoid: number; capHours: number }> = ({
  cash,
  avoid,
  capHours,
}) => (
  <Flex gap={4} flexWrap="wrap" mb={2}>
    {[
      ['Cash impact / period', formatMoney(cash)],
      ['Cost avoidance / period', formatMoney(avoid)],
      ['Capacity released', `${capHours.toFixed(1)} hrs`],
    ].map(([l, v]) => (
      <Box
        key={l}
        flex="1"
        minW="160px"
        p={4}
        border="1px solid"
        borderColor="border.subtle"
        rounded="lg"
        bg="gray.50"
      >
        <Text fontSize="xs" color="text.muted" textTransform="uppercase" fontWeight="bold">
          {l}
        </Text>
        <Text fontSize="xl" fontWeight="bold" mt={1}>
          {v}
        </Text>
      </Box>
    ))}
  </Flex>
)
