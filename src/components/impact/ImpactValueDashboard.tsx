import React, { useMemo } from 'react'
import { Box, Flex, Icon, Progress, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  CheckCircle2,
  FolderTree,
  Leaf,
  PieChart as PieChartIcon,
  Trophy,
} from 'lucide-react'
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

type TileTheme = {
  iconBg: string
  iconShadow: string
  ornamentBg: string
  hoverShadow: string
  hoverBorder: string
}

const tileThemes = {
  purple: {
    iconBg: '#350e6f',
    iconShadow: '0 4px 12px rgba(53, 14, 111, 0.3)',
    ornamentBg: 'purple.50',
    hoverShadow: '0 8px 25px rgba(139, 92, 246, 0.15)',
    hoverBorder: 'purple.200',
  },
  orange: {
    iconBg: 'linear-gradient(135deg, #f4540c 0%, #c2410c 100%)',
    iconShadow: '0 4px 12px rgba(244, 84, 12, 0.3)',
    ornamentBg: 'orange.50',
    hoverShadow: '0 8px 25px rgba(244, 84, 12, 0.15)',
    hoverBorder: 'orange.200',
  },
  green: {
    iconBg: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
    iconShadow: '0 4px 12px rgba(4, 120, 87, 0.3)',
    ornamentBg: 'green.50',
    hoverShadow: '0 8px 25px rgba(16, 185, 129, 0.15)',
    hoverBorder: 'green.200',
  },
  yellow: {
    iconBg: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
    iconShadow: '0 4px 12px rgba(217, 119, 6, 0.3)',
    ornamentBg: 'yellow.50',
    hoverShadow: '0 8px 25px rgba(217, 119, 6, 0.15)',
    hoverBorder: 'yellow.200',
  },
} as const satisfies Record<string, TileTheme>

const DashCard = ({
  label,
  icon,
  theme,
  help,
  children,
}: {
  label: string
  icon: LucideIcon
  theme: keyof typeof tileThemes
  help?: React.ReactNode
  children: React.ReactNode
}) => {
  const styles = tileThemes[theme]
  return (
    <Box
      p={5}
      bg="white"
      borderRadius="xl"
      border="1px solid"
      borderColor="gray.100"
      boxShadow="0 2px 8px rgba(0,0,0,0.04)"
      _hover={{
        transform: 'translateY(-2px)',
        boxShadow: styles.hoverShadow,
        borderColor: styles.hoverBorder,
      }}
      transition="all 0.3s ease"
      position="relative"
      overflow="hidden"
    >
      <Box
        position="absolute"
        top={0}
        right={0}
        w="60px"
        h="60px"
        bg={styles.ornamentBg}
        borderRadius="0 0 0 100%"
        pointerEvents="none"
      />
      <Flex w={10} h={10} bg={styles.iconBg} borderRadius="xl" align="center" justify="center" mb={3} boxShadow={styles.iconShadow} position="relative">
        <Icon as={icon} boxSize={5} color="white" />
      </Flex>
      <Flex align="center" gap={1} mb={3} position="relative">
        <Text
          fontSize="xs"
          color="gray.500"
          fontWeight="semibold"
          textTransform="uppercase"
          letterSpacing="wide"
        >
          {label}
        </Text>
        {help}
      </Flex>
      <Box position="relative">{children}</Box>
    </Box>
  )
}

const MiniStat = ({
  label,
  value,
  sub,
  theme,
}: {
  label: string
  value: string
  sub?: string
  theme: keyof typeof tileThemes
}) => {
  const styles = tileThemes[theme]
  return (
    <Box
      p={3}
      bg="white"
      borderRadius="xl"
      border="1px solid"
      borderColor="gray.100"
      boxShadow="0 2px 8px rgba(0,0,0,0.04)"
      position="relative"
      overflow="hidden"
      _hover={{
        transform: 'translateY(-1px)',
        boxShadow: styles.hoverShadow,
        borderColor: styles.hoverBorder,
      }}
      transition="all 0.3s ease"
    >
      <Box
        position="absolute"
        top={0}
        right={0}
        w="36px"
        h="36px"
        bg={styles.ornamentBg}
        borderRadius="0 0 0 100%"
        pointerEvents="none"
      />
      <Text
        fontSize="10px"
        textTransform="uppercase"
        fontWeight="bold"
        color="gray.500"
        letterSpacing="0.06em"
        position="relative"
      >
        {label}
      </Text>
      <Text fontSize="md" fontWeight="800" color="gray.800" mt={0.5} position="relative" lineHeight="1.2">
        {value}
      </Text>
      {sub ? (
        <Text fontSize="10px" color="gray.500" mt={0.5} position="relative">
          {sub}
        </Text>
      ) : null}
    </Box>
  )
}

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
      <DashCard
        label="Your savings"
        icon={PieChartIcon}
        theme="purple"
        help={<ImpactHelpButton k="buckets" onOpen={onHelp} />}
      >
        <Flex
          direction={{ base: 'column', md: 'row' }}
          align={{ base: 'stretch', md: 'center' }}
          gap={{ base: 4, md: 8 }}
        >
          <Box flex="1">
            <Text
              fontSize={{ base: '3xl', md: '4xl' }}
              fontWeight="800"
              lineHeight="1.1"
              color="gray.800"
              letterSpacing="-0.02em"
            >
              {formatMoney(headline)}
            </Text>
            <Text fontSize="sm" color="gray.500" mt={2} maxW="440px" lineHeight="1.5">
              Approved cash + cost avoidance. Annual run-rate{' '}
              <Box as="span" fontWeight="bold" color="#b45309">
                {formatMoney(annualRun)}
              </Box>
              .
            </Text>
            <SimpleGrid columns={3} spacing={3} mt={5} maxW="440px">
              <MiniStat label="Cash" value={formatMoneyK(cash)} theme="orange" />
              <MiniStat label="Avoidance" value={formatMoneyK(avoid)} theme="purple" />
              <MiniStat
                label="Capacity"
                value={`${capHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs`}
                sub={`~${formatMoneyK(capacity$)} indicative`}
                theme="yellow"
              />
            </SimpleGrid>
          </Box>

          <Box
            w={{ base: '100%', md: '220px' }}
            h="180px"
            flexShrink={0}
            rounded="xl"
            bg="white"
            border="1px solid"
            borderColor="gray.100"
            boxShadow="0 2px 8px rgba(0,0,0,0.04)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            position="relative"
            overflow="hidden"
          >
            <Box
              position="absolute"
              top={0}
              right={0}
              w="48px"
              h="48px"
              bg="orange.50"
              borderRadius="0 0 0 100%"
              pointerEvents="none"
            />
            {pieData.length === 0 ? (
              <Text fontSize="sm" color="gray.500" textAlign="center" px={4}>
                No approved savings yet
              </Text>
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
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {pieData.map((d) => (
                      <Cell key={d.key} fill={PIE_COLORS[d.key]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => formatMoney(value)}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 12,
                      color: '#27062e',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Box>
        </Flex>
      </DashCard>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <DashCard label="Claims · submitted vs approved" icon={CheckCircle2} theme="orange">
          <Flex justify="space-between" mb={2}>
            <Box>
              <Text fontSize="2xl" fontWeight="bold" color="gray.800" lineHeight="1.1">
                {submittedCount}
              </Text>
              <Text fontSize="xs" color="gray.500">
                Submitted
              </Text>
            </Box>
            <Box textAlign="right">
              <Text fontSize="2xl" fontWeight="bold" color="#f4540c" lineHeight="1.1">
                {approvedCount}
              </Text>
              <Text fontSize="xs" color="gray.500">
                Approved
              </Text>
            </Box>
          </Flex>
          <Progress value={approvalPct} size="md" rounded="full" colorScheme="orange" bg="gray.100" />
          <Text fontSize="xs" color="gray.500" mt={2}>
            {approvalPct}% of submitted claims approved
            {awaitingApproval > 0 ? ` · ${formatMoneyK(awaitingApproval)} awaiting approval` : ''}
          </Text>
        </DashCard>

        <DashCard label="Savings by month" icon={BarChart3} theme="purple">
          {months.length === 0 ? (
            <Flex h="120px" align="center" justify="center">
              <Text fontSize="sm" color="gray.500">
                No monthly savings yet.
              </Text>
            </Flex>
          ) : (
            <Flex align="flex-end" gap={2} h="120px">
              {months.map(([m, v]) => (
                <Flex key={m} flex={1} direction="column" align="center" h="100%" justify="flex-end">
                  <Text fontSize="10px" color="gray.500" mb={1}>
                    {v ? formatMoneyK(v) : ''}
                  </Text>
                  <Box
                    w="100%"
                    h={`${Math.max(6, (v / maxMonth) * 100)}px`}
                    bg="#350e6f"
                    rounded="sm"
                    transition="height 0.3s ease"
                  />
                  <Text fontSize="10px" color="gray.500" mt={1}>
                    {m.slice(5)}
                  </Text>
                </Flex>
              ))}
            </Flex>
          )}
        </DashCard>
      </SimpleGrid>

      <DashCard
        label="Where your savings come from"
        icon={Leaf}
        theme="green"
        help={<ImpactHelpButton k="waste" onOpen={onHelp} />}
      >
        <Text fontSize="sm" color="gray.500" mb={4}>
          Approved claims by waste type and growth type.
        </Text>

        {wasteWithValue.length === 0 && sumGrowth.every((g) => !g.count) ? (
          <Text fontSize="sm" color="gray.500">
            Log claims with a waste or growth type to see the breakdown here.
          </Text>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            <Stack spacing={3}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.800">
                Waste removed
              </Text>
              {(wasteWithValue.length ? wasteWithValue : sumWaste.slice(0, 4)).map((w) => (
                <Box key={w.k}>
                  <Flex justify="space-between" fontSize="sm" mb={1}>
                    <Text>
                      {w.n}{' '}
                      <Text as="span" fontSize="xs" color="gray.500">
                        · {w.count}
                      </Text>
                    </Text>
                    <Text fontFamily="mono">{w.v ? formatMoneyK(w.v) : '—'}</Text>
                  </Flex>
                  <Progress value={(w.v / maxWaste) * 100} size="sm" colorScheme="purple" rounded="full" />
                </Box>
              ))}
            </Stack>
            <Stack spacing={2}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.800">
                Revenue growth
              </Text>
              {sumGrowth.map((g) => (
                <Flex key={g.k} justify="space-between" fontSize="sm" py={1}>
                  <Text color={g.count ? 'gray.800' : 'gray.400'}>
                    {g.n}
                    {g.count > 0 ? (
                      <Text as="span" fontSize="xs" color="gray.500" ml={1}>
                        · {g.count}
                      </Text>
                    ) : null}
                  </Text>
                  <Text fontFamily="mono" color={g.v ? 'gray.800' : 'gray.400'}>
                    {g.v ? formatMoneyK(g.v) : '—'}
                  </Text>
                </Flex>
              ))}
            </Stack>
          </SimpleGrid>
        )}
      </DashCard>

      <DashCard label="By category" icon={FolderTree} theme="orange">
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
      </DashCard>

      <DashCard label="Top approved claims" icon={Trophy} theme="yellow">
        <Stack spacing={2}>
          {validated
            .slice()
            .sort((a, b) => Number(b.usdValue || 0) - Number(a.usdValue || 0))
            .slice(0, 8)
            .map((e) => (
              <Flex
                key={e.id}
                as="button"
                type="button"
                textAlign="left"
                w="100%"
                justify="space-between"
                p={2}
                rounded="md"
                _hover={{ bg: 'gray.50' }}
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
            <Text fontSize="sm" color="gray.500">
              No approved claims yet.
            </Text>
          )}
        </Stack>
      </DashCard>
    </Stack>
  )
}
