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

type Props = {
  entries: ImpactLogRecord[]
  rates: ImpactRateCard[]
}

type Tab = 'register' | 'board' | 'waste' | 'esg' | 'json'

function csvEscape(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const ImpactExportPanel: React.FC<Props> = ({ entries, rates }) => {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('register')
  const today = format(new Date(), 'yyyy-MM-dd')

  const claims = entries.filter((e) => e.entryKind === 'claim' || (!e.entryKind && e.categoryGroup === 'business'))
  const validated = claims.filter(
    (e) => e.claimStatus === 'Recognized' || e.verificationStatus === 'approved',
  )
  const esg = entries.filter((e) => e.entryKind === 'esg' || e.categoryGroup === 'esg')

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

  const auditJson = useMemo(
    () =>
      JSON.stringify(
        {
          exported_at: today,
          policy: {
            headline_tiers: [3],
            buckets_never_summed: true,
            annualisation_requires_90d_check: true,
            points_tracked: 'journey dashboard, not the impact log',
          },
          rates,
          entries,
        },
        null,
        2,
      ),
    [today, rates, entries],
  )

  const download = (name: string, text: string) => {
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
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

  return (
    <Stack spacing={4}>
      <Box>
        <Heading size="md" mb={1}>
          Export
        </Heading>
        <Text fontSize="sm" color="text.secondary">
          Register for finance, one-pager for the sponsor, ESG hand-off, audit JSON.
        </Text>
      </Box>

      <HStack spacing={2} flexWrap="wrap">
        {(
          [
            ['register', 'Value register (CSV)'],
            ['board', 'Board one-pager'],
            ['waste', 'Waste summary'],
            ['esg', 'ESG hand-off'],
            ['json', 'Audit JSON'],
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
        <Box>
          <HStack mb={3}>
            <Button size="sm" colorScheme="primary" onClick={() => download(`t4l_value_register_${today}.csv`, registerCsv)}>
              Download CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => void copy(registerCsv)}>
              Copy
            </Button>
          </HStack>
          <Textarea value={registerCsv} readOnly rows={14} fontFamily="mono" fontSize="xs" />
        </Box>
      )}

      {tab === 'board' && (
        <Box p={6} border="1px solid" borderColor="border.subtle" rounded="xl" bg="white" className="sheet">
          <Flex justify="space-between" borderBottom="2px solid" borderColor="brand.accent" pb={3} mb={4}>
            <Box>
              <Text fontSize="xs" color="brand.accent" fontWeight="bold" textTransform="uppercase">
                Transformation Leader · LIFT
              </Text>
              <Heading size="sm">Improvement value report</Heading>
              <Text fontSize="sm" color="text.secondary">
                Prepared {today}
              </Text>
            </Box>
            <Button size="sm" onClick={() => window.print()}>
              Print / PDF
            </Button>
          </Flex>
          <SimpleMoney cash={cash} avoid={avoid} capHours={capHours} />
          <Text fontSize="sm" my={4}>
            <b>Basis of preparation.</b> Figures come from claims with a locked baseline from a named
            system, valued from finance-returned rates, reduced for attribution, realisation and
            evidence confidence. Cash, avoidance and capacity are never summed.
          </Text>
          <Stack spacing={1}>
            {validated.map((e) => (
              <Flex key={e.id} justify="space-between" fontSize="sm" py={1} borderBottom="1px solid" borderColor="border.subtle">
                <Text>
                  {e.title} · {e.date}
                </Text>
                <Text fontFamily="mono">{formatMoney(Number(e.usdValue || 0))}</Text>
              </Flex>
            ))}
          </Stack>
        </Box>
      )}

      {tab === 'waste' && (
        <Box p={5} border="1px solid" borderColor="border.subtle" rounded="xl">
          <Heading size="sm" mb={3}>
            Pattern report · wastes & growth
          </Heading>
          <Stack spacing={2}>
            {IMPACT_WASTES.map((w) => {
              const n = validated.filter((c) => c.claim?.waste === w.k).length
              return (
                <Flex key={w.k} justify="space-between" fontSize="sm">
                  <Text>{w.n}</Text>
                  <Text>{n} claims</Text>
                </Flex>
              )
            })}
          </Stack>
          <Button mt={4} size="sm" onClick={() => window.print()}>
            Print / PDF
          </Button>
        </Box>
      )}

      {tab === 'esg' && (
        <Box p={5} border="1px solid" borderColor="border.subtle" rounded="xl">
          <Heading size="sm" mb={1}>
            ESG hand-off
          </Heading>
          <Text fontSize="sm" color="text.secondary" mb={3}>
            Not valued, not tiered, not aggregated with the financial register.
          </Text>
          <Stack spacing={2}>
            {esg.map((e) => (
              <Flex key={e.id} justify="space-between" fontSize="sm" gap={3}>
                <Box>
                  <Text fontWeight="medium">{e.esgMetric || e.title}</Text>
                  <Text fontSize="xs" color="text.muted">
                    {(IMPACT_ESG_PILLARS.find((p) => p.n.toLowerCase().includes(String(e.esgCategory || '').toLowerCase())) ||
                      IMPACT_ESG_PILLARS[0]
                    ).n}{' '}
                    · {e.date}
                  </Text>
                </Box>
                <Text fontFamily="mono">{e.esgQty ?? e.peopleImpacted}</Text>
              </Flex>
            ))}
            {esg.length === 0 && <Text fontSize="sm">No ESG entries yet.</Text>}
          </Stack>
        </Box>
      )}

      {tab === 'json' && (
        <Box>
          <HStack mb={3}>
            <Button size="sm" colorScheme="primary" onClick={() => download(`t4l_impact_audit_${today}.json`, auditJson)}>
              Download JSON
            </Button>
            <Button size="sm" variant="outline" onClick={() => void copy(auditJson)}>
              Copy
            </Button>
          </HStack>
          <Textarea value={auditJson} readOnly rows={16} fontFamily="mono" fontSize="xs" />
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
      <Box key={l} flex="1" minW="160px" p={3} border="1px solid" borderColor="border.subtle" rounded="md">
        <Text fontSize="xs" color="text.muted" textTransform="uppercase" fontWeight="bold">
          {l}
        </Text>
        <Text fontSize="xl" fontWeight="bold">
          {v}
        </Text>
      </Box>
    ))}
  </Flex>
)
