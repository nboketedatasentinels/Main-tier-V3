import React, { useMemo } from 'react'
import { Box, Flex, Progress, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'
import {
  IMPACT_CATS,
  IMPACT_GROWTH,
  IMPACT_WASTES,
  claimInputsFromRecord,
  formatMoney,
  formatMoneyK,
  valuation,
  type ImpactRateCard,
} from '@/config/impactValueEngine'
import type { ImpactLogRecord } from '@/services/impactLogService'
import { ImpactHelpButton } from '@/components/impact/ImpactHelpModal'
import type { ImpactHelpKey } from '@/config/impactHelp'

type Props = {
  entries: ImpactLogRecord[]
  orgEntries: ImpactLogRecord[]
  rates: ImpactRateCard[]
  onHelp: (k: ImpactHelpKey) => void
  onOpenClaim: (e: ImpactLogRecord) => void
}

const PIE_COLORS = {
  cash: '#f4540c',
  avoidance: '#350e6f',
  capacity: '#eab130',
} as const

const isClaim = (e: ImpactLogRecord) =>
  e.entryKind === 'claim' || (!e.entryKind && e.categoryGroup === 'business')

const isValidated = (e: ImpactLogRecord, rates: ImpactRateCard[]) => {
  if (!isClaim(e)) return false
  if (e.claimStatus === 'Recognized' || e.verificationStatus === 'approved') {
    const inputs = claimInputsFromRecord(e)
    if (!inputs) return Number(e.usdValue || 0) > 0
    return valuation(inputs, rates).tier === 3
  }
  return false
}

const isSubmitted = (e: ImpactLogRecord) => {
  if (!isClaim(e)) return false
  const s = e.claimStatus || ''
  return s !== 'Reversed' && s !== ''
}

export const ImpactValueDashboard: React.FC<Props> = ({
  entries,
  orgEntries,
  rates,
  onHelp,
  onOpenClaim,
}) => {
  const pool = orgEntries.length ? orgEntries : entries
  const claims = pool.filter(isClaim)
  const validated = claims.filter((e) => isValidated(e, rates))
  const submitted = claims.filter(isSubmitted)

  const moneyOf = (list: ImpactLogRecord[], bucket?: string) =>
    list.reduce((s, e) => {
      if (bucket && e.claim?.bucket !== bucket) return s
      if (bucket === undefined && e.claim?.bucket === 'capacity') return s
      const inputs = claimInputsFromRecord(e)
      const net = inputs ? valuation(inputs, rates).net : Number(e.usdValue || 0)
      return s + net
    }, 0)

  const cash = moneyOf(validated, 'cash')
  const avoid = moneyOf(validated, 'avoidance')
  const capacity$ = moneyOf(validated, 'capacity')
  const headline = cash + avoid
  const annualRun = headline * 12
  const capHours = validated
    .filter((e) => e.claim?.bucket === 'capacity')
    .reduce((s, e) => s + Number(e.hours || 0), 0)

  const awaitingApproval = claims
    .filter((e) => {
      const st = e.claimStatus || ''
      return (
        st === 'Submitted' ||
        st === 'Measure Owner Confirmed' ||
        st === 'Finance Validated' ||
        (!st && e.verificationStatus === 'pending')
      )
    })
    .reduce((s, e) => {
      const inputs = claimInputsFromRecord(e)
      return s + (inputs ? valuation(inputs, rates).net : Number(e.usdValue || 0))
    }, 0)

  const pieData = [
    { name: 'Cash impact', value: cash, key: 'cash' as const },
    { name: 'Cost avoidance', value: avoid, key: 'avoidance' as const },
    { name: 'Capacity (indicative)', value: capacity$, key: 'capacity' as const },
  ].filter((d) => d.value > 0)

  const byCat = IMPACT_CATS.map((c) => ({
    ...c,
    v: moneyOf(validated.filter((e) => e.claim?.cat === c.k)),
  }))
  const maxCat = Math.max(1, ...byCat.map((c) => c.v))

  const sumWaste = IMPACT_WASTES.map((w) => {
    const set = validated.filter((c) => c.claim?.waste === w.k && c.claim?.cat !== 'rev')
    const v = set.reduce((s, e) => {
      const inputs = claimInputsFromRecord(e)
      return s + (inputs ? valuation(inputs, rates).net : Number(e.usdValue || 0))
    }, 0)
    return { ...w, v, count: set.length }
  }).sort((a, b) => b.v - a.v)

  const sumGrowth = IMPACT_GROWTH.map((g) => {
    const set = validated.filter((c) => c.claim?.growth === g.k && c.claim?.cat === 'rev')
    const v = set.reduce((s, e) => {
      const inputs = claimInputsFromRecord(e)
      return s + (inputs ? valuation(inputs, rates).net : Number(e.usdValue || 0))
    }, 0)
    return { ...g, v, count: set.length }
  }).sort((a, b) => b.v - a.v)

  const maxWaste = Math.max(1, ...sumWaste.map((w) => w.v))
  const wasteWithValue = sumWaste.filter((w) => w.v > 0 || w.count > 0)

  const months = useMemo(() => {
    const map = new Map<string, number>()
    validated.forEach((e) => {
      const key = (e.date || '').slice(0, 7) || 'unknown'
      if (e.claim?.bucket === 'capacity') return
      const inputs = claimInputsFromRecord(e)
      const net = inputs ? valuation(inputs, rates).net : Number(e.usdValue || 0)
      map.set(key, (map.get(key) || 0) + net)
    })
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6)
  }, [validated, rates])

  const maxMonth = Math.max(1, ...months.map(([, v]) => v))
  const approvedCount = validated.length
  const submittedCount = submitted.length
  const approvalPct = submittedCount ? Math.round((approvedCount / submittedCount) * 100) : 0

  return (
    <Stack spacing={5}>
      {/* Hero: your savings */}
      <Box
        p={{ base: 4, md: 6 }}
        rounded="2xl"
        bgGradient="linear(135deg, #27062e 0%, #350e6f 55%, #5a1a4a 100%)"
        color="white"
        overflow="hidden"
        position="relative"
      >
        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.08em" opacity={0.75} mb={1}>
          Your savings
          <ImpactHelpButton k="buckets" onOpen={onHelp} />
        </Text>
        <Flex
          direction={{ base: 'column', md: 'row' }}
          align={{ base: 'stretch', md: 'center' }}
          gap={{ base: 4, md: 8 }}
        >
          <Box flex="1">
            <Text fontSize={{ base: '3xl', md: '4xl' }} fontWeight="bold" lineHeight="1.1">
              {formatMoney(headline)}
            </Text>
            <Text fontSize="sm" opacity={0.85} mt={2} maxW="420px">
              Approved cash + cost avoidance. Annual run-rate{' '}
              <Box as="span" fontWeight="semibold" color="#f9db59">
                {formatMoney(annualRun)}
              </Box>
              .
            </Text>
            <SimpleGrid columns={3} spacing={3} mt={5} maxW="420px">
              <Box>
                <Text fontSize="10px" textTransform="uppercase" opacity={0.7}>
                  Cash
                </Text>
                <Text fontSize="md" fontWeight="bold">
                  {formatMoneyK(cash)}
                </Text>
              </Box>
              <Box>
                <Text fontSize="10px" textTransform="uppercase" opacity={0.7}>
                  Avoidance
                </Text>
                <Text fontSize="md" fontWeight="bold">
                  {formatMoneyK(avoid)}
                </Text>
              </Box>
              <Box>
                <Text fontSize="10px" textTransform="uppercase" opacity={0.7}>
                  Capacity
                </Text>
                <Text fontSize="md" fontWeight="bold">
                  {capHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs
                </Text>
                <Text fontSize="10px" opacity={0.65}>
                  ~{formatMoneyK(capacity$)} indicative
                </Text>
              </Box>
            </SimpleGrid>
          </Box>

          <Box w={{ base: '100%', md: '220px' }} h="180px" flexShrink={0}>
            {pieData.length === 0 ? (
              <Flex h="100%" align="center" justify="center">
                <Text fontSize="sm" opacity={0.7} textAlign="center">
                  No approved savings yet
                </Text>
              </Flex>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {pieData.map((d) => (
                      <Cell key={d.key} fill={PIE_COLORS[d.key]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => formatMoney(value)}
                    contentStyle={{
                      borderRadius: 8,
                      border: 'none',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Box>
        </Flex>
      </Box>

      {/* Submitted vs approved */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl" bg="surface.default">
          <Text fontSize="xs" fontWeight="bold" color="brand.accent" mb={3}>
            CLAIMS · SUBMITTED VS APPROVED
          </Text>
          <Flex justify="space-between" mb={2}>
            <Box>
              <Text fontSize="2xl" fontWeight="bold">
                {submittedCount}
              </Text>
              <Text fontSize="xs" color="text.muted">
                Submitted
              </Text>
            </Box>
            <Box textAlign="right">
              <Text fontSize="2xl" fontWeight="bold" color="brand.accent">
                {approvedCount}
              </Text>
              <Text fontSize="xs" color="text.muted">
                Approved
              </Text>
            </Box>
          </Flex>
          <Progress
            value={approvalPct}
            size="md"
            rounded="full"
            colorScheme="orange"
            bg="gray.100"
          />
          <Text fontSize="xs" color="text.secondary" mt={2}>
            {approvalPct}% of submitted claims approved
            {awaitingApproval > 0
              ? ` · ${formatMoneyK(awaitingApproval)} awaiting approval`
              : ''}
          </Text>
        </Box>

        <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl" bg="surface.default">
          <Text fontSize="xs" fontWeight="bold" color="brand.accent" mb={2}>
            SAVINGS BY MONTH
          </Text>
          {months.length === 0 ? (
            <Flex h="120px" align="center" justify="center">
              <Text fontSize="sm" color="text.secondary">
                No monthly savings yet.
              </Text>
            </Flex>
          ) : (
            <Flex align="flex-end" gap={2} h="120px">
              {months.map(([m, v]) => (
                <Flex key={m} flex={1} direction="column" align="center" h="100%" justify="flex-end">
                  <Text fontSize="10px" color="text.muted" mb={1}>
                    {v ? formatMoneyK(v) : ''}
                  </Text>
                  <Box
                    w="100%"
                    h={`${Math.max(6, (v / maxMonth) * 100)}px`}
                    bg="brand.primary"
                    rounded="sm"
                    transition="height 0.3s ease"
                  />
                  <Text fontSize="10px" color="text.muted" mt={1}>
                    {m.slice(5)}
                  </Text>
                </Flex>
              ))}
            </Flex>
          )}
        </Box>
      </SimpleGrid>

      {/* Where savings come from */}
      <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl">
        <Flex align="center" mb={1} gap={1}>
          <Text fontSize="xs" fontWeight="bold" color="brand.accent">
            WHERE YOUR SAVINGS COME FROM
          </Text>
          <ImpactHelpButton k="waste" onOpen={onHelp} />
        </Flex>
        <Text fontSize="sm" color="text.secondary" mb={4}>
          Approved claims by waste type and growth type.
        </Text>

        {wasteWithValue.length === 0 && sumGrowth.every((g) => !g.count) ? (
          <Text fontSize="sm" color="text.secondary">
            Log claims with a waste or growth type to see the breakdown here.
          </Text>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            <Stack spacing={3}>
              <Text fontSize="sm" fontWeight="semibold">
                Waste removed
              </Text>
              {(wasteWithValue.length ? wasteWithValue : sumWaste.slice(0, 4)).map((w) => (
                <Box key={w.k}>
                  <Flex justify="space-between" fontSize="sm" mb={1}>
                    <Text>
                      {w.n}{' '}
                      <Text as="span" fontSize="xs" color="text.muted">
                        · {w.count}
                      </Text>
                    </Text>
                    <Text fontFamily="mono">{w.v ? formatMoneyK(w.v) : '—'}</Text>
                  </Flex>
                  <Progress
                    value={(w.v / maxWaste) * 100}
                    size="sm"
                    colorScheme="purple"
                    rounded="full"
                  />
                </Box>
              ))}
            </Stack>
            <Stack spacing={2}>
              <Text fontSize="sm" fontWeight="semibold">
                Revenue growth
              </Text>
              {sumGrowth.map((g) => (
                <Flex key={g.k} justify="space-between" fontSize="sm" py={1}>
                  <Text color={g.count ? undefined : 'text.muted'}>
                    {g.n}
                    {g.count > 0 ? (
                      <Text as="span" fontSize="xs" color="text.muted" ml={1}>
                        · {g.count}
                      </Text>
                    ) : null}
                  </Text>
                  <Text fontFamily="mono" color={g.v ? undefined : 'text.muted'}>
                    {g.v ? formatMoneyK(g.v) : '—'}
                  </Text>
                </Flex>
              ))}
            </Stack>
          </SimpleGrid>
        )}
      </Box>

      <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl">
        <Text fontSize="xs" fontWeight="bold" color="brand.accent" mb={3}>
          BY CATEGORY
        </Text>
        <Stack spacing={3}>
          {byCat.map((c) => (
            <Box key={c.k}>
              <Flex justify="space-between" fontSize="sm" mb={1}>
                <Text>{c.n}</Text>
                <Text fontFamily="mono">{formatMoneyK(c.v)}</Text>
              </Flex>
              <Progress value={(c.v / maxCat) * 100} size="sm" colorScheme="orange" rounded="full" />
            </Box>
          ))}
        </Stack>
      </Box>

      <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl">
        <Text fontSize="xs" fontWeight="bold" color="brand.accent" mb={3}>
          TOP APPROVED CLAIMS
        </Text>
        <Stack spacing={2}>
          {validated
            .slice()
            .sort((a, b) => Number(b.usdValue || 0) - Number(a.usdValue || 0))
            .slice(0, 8)
            .map((e) => (
              <Flex
                key={e.id}
                as="button"
                textAlign="left"
                w="100%"
                justify="space-between"
                p={2}
                rounded="md"
                _hover={{ bg: 'surface.subtle' }}
                onClick={() => onOpenClaim(e)}
              >
                <Text fontSize="sm" fontWeight="medium" noOfLines={1} pr={3}>
                  {e.title}
                </Text>
                <Text fontSize="sm" fontFamily="mono" flexShrink={0}>
                  {formatMoney(Number(e.usdValue || 0))}
                </Text>
              </Flex>
            ))}
          {validated.length === 0 && (
            <Text fontSize="sm" color="text.secondary">
              No approved claims yet.
            </Text>
          )}
        </Stack>
      </Box>
    </Stack>
  )
}
