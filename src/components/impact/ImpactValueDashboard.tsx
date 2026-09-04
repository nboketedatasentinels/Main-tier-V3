import React, { useMemo } from 'react'
import { Box, Flex, Icon, Progress, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  BarChart3,
  CheckCircle2,
  Clock3,
  FolderTree,
  Leaf,
  PieChart as PieChartIcon,
  Shield,
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
  cash: '#350e6f',
  avoidance: '#6b7280',
  capacity: '#c4a574',
} as const

/** Professional shell — white, gray border, soft shadow, deep-plum icon only */
const DashCard = ({
  label,
  icon,
  help,
  children,
}: {
  label: string
  icon: LucideIcon
  help?: React.ReactNode
  children: React.ReactNode
}) => (
  <Box
    p={5}
    bg="white"
    borderRadius="xl"
    border="1px solid"
    borderColor="gray.100"
    boxShadow="0 2px 8px rgba(0,0,0,0.04)"
    _hover={{
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 20px rgba(39,6,46,0.08)',
      borderColor: 'gray.200',
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
      bg="gray.50"
      borderRadius="0 0 0 100%"
      pointerEvents="none"
    />
    <Flex
      w={10}
      h={10}
      bg="#350e6f"
      borderRadius="xl"
      align="center"
      justify="center"
      mb={3}
      boxShadow="0 4px 12px rgba(53, 14, 111, 0.22)"
      position="relative"
    >
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

const MiniStat = ({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string
  sub?: string
  icon: LucideIcon
}) => (
  <Box
    p={3.5}
    bg="white"
    borderRadius="xl"
    border="1px solid"
    borderColor="gray.100"
    boxShadow="0 1px 4px rgba(0,0,0,0.03)"
    position="relative"
    overflow="hidden"
    _hover={{
      transform: 'translateY(-1px)',
      boxShadow: '0 6px 16px rgba(39,6,46,0.07)',
      borderColor: 'gray.200',
    }}
    transition="all 0.3s ease"
  >
    <Box
      position="absolute"
      top={0}
      right={0}
      w="40px"
      h="40px"
      bg="gray.50"
      borderRadius="0 0 0 100%"
      pointerEvents="none"
    />
    <Flex align="center" gap={2} mb={2} position="relative">
      <Flex
        w="28px"
        h="28px"
        borderRadius="lg"
        align="center"
        justify="center"
        bg="gray.100"
        flexShrink={0}
      >
        <Icon as={icon} boxSize={3.5} color="#350e6f" />
      </Flex>
      <Text
        fontSize="10px"
        textTransform="uppercase"
        fontWeight="bold"
        color="gray.500"
        letterSpacing="0.06em"
      >
        {label}
      </Text>
    </Flex>
    <Text
      fontSize={{ base: 'lg', md: 'xl' }}
      fontWeight="800"
      color="#27062e"
      position="relative"
      lineHeight="1.15"
      letterSpacing="-0.02em"
    >
      {value}
    </Text>
    {sub ? (
      <Text fontSize="10px" color="gray.500" mt={1} position="relative">
        {sub}
      </Text>
    ) : null}
  </Box>
)

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
      <Box
        p={{ base: 4, md: 6 }}
        borderRadius="xl"
        border="1px solid"
        borderColor="gray.100"
        boxShadow="0 2px 8px rgba(0,0,0,0.04)"
        position="relative"
        overflow="hidden"
        bg="white"
        transition="all 0.3s ease"
        _hover={{
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 20px rgba(39,6,46,0.08)',
          borderColor: 'gray.200',
        }}
      >
        <Box
          position="absolute"
          top={0}
          right={0}
          w="72px"
          h="72px"
          bg="gray.50"
          borderRadius="0 0 0 100%"
          pointerEvents="none"
        />

        <Flex align="center" gap={3} mb={4} position="relative">
          <Flex
            w={10}
            h={10}
            bg="#350e6f"
            borderRadius="xl"
            align="center"
            justify="center"
            boxShadow="0 4px 12px rgba(53, 14, 111, 0.22)"
            flexShrink={0}
          >
            <Icon as={PieChartIcon} boxSize={5} color="white" />
          </Flex>
          <Box flex="1" minW={0}>
            <Flex align="center" gap={1}>
              <Text
                fontSize="xs"
                color="gray.500"
                fontWeight="semibold"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                Your savings
              </Text>
              <ImpactHelpButton k="buckets" onOpen={onHelp} />
            </Flex>
            <Text fontSize="sm" color="gray.600" mt={0.5}>
              Approved cash + cost avoidance only
            </Text>
          </Box>
          <Flex
            display={{ base: 'none', sm: 'flex' }}
            align="center"
            gap={1.5}
            px={3}
            py={1.5}
            rounded="full"
            bg="gray.50"
            border="1px solid"
            borderColor="gray.100"
          >
            <Text fontSize="xs" fontWeight="semibold" color="gray.700">
              {approvedCount} approved
            </Text>
          </Flex>
        </Flex>

        <Flex
          direction={{ base: 'column', md: 'row' }}
          align={{ base: 'stretch', md: 'center' }}
          gap={{ base: 5, md: 8 }}
          position="relative"
        >
          <Box flex="1">
            <Text
              fontSize={{ base: '4xl', md: '5xl' }}
              fontWeight="800"
              lineHeight="1"
              color="#27062e"
              letterSpacing="-0.03em"
            >
              {formatMoney(headline)}
            </Text>

            <Flex mt={3} align="center" gap={2} flexWrap="wrap">
              <Flex
                align="center"
                gap={2}
                px={3}
                py={2}
                rounded="lg"
                bg="gray.50"
                border="1px solid"
                borderColor="gray.100"
              >
                <Icon as={Clock3} boxSize={3.5} color="gray.500" />
                <Text fontSize="xs" color="gray.600">
                  Annual run-rate
                </Text>
                <Text fontSize="sm" fontWeight="800" color="#27062e">
                  {formatMoney(annualRun)}
                </Text>
              </Flex>
              {awaitingApproval > 0 ? (
                <Flex
                  align="center"
                  gap={2}
                  px={3}
                  py={2}
                  rounded="lg"
                  bg="gray.50"
                  border="1px solid"
                  borderColor="gray.100"
                >
                  <Text fontSize="xs" color="gray.600">
                    In pipeline
                  </Text>
                  <Text fontSize="sm" fontWeight="800" color="#27062e">
                    {formatMoneyK(awaitingApproval)}
                  </Text>
                </Flex>
              ) : null}
            </Flex>

            <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3} mt={5}>
              <MiniStat label="Cash" value={formatMoneyK(cash)} icon={Banknote} />
              <MiniStat label="Avoidance" value={formatMoneyK(avoid)} icon={Shield} />
              <MiniStat
                label="Capacity"
                value={`${capHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs`}
                sub={`~${formatMoneyK(capacity$)} indicative`}
                icon={Clock3}
              />
            </SimpleGrid>
          </Box>

          <Box
            w={{ base: '100%', md: '240px' }}
            flexShrink={0}
            rounded="xl"
            bg="gray.50"
            border="1px solid"
            borderColor="gray.100"
            p={3}
            position="relative"
            overflow="hidden"
          >
            <Text
              fontSize="10px"
              fontWeight="bold"
              textTransform="uppercase"
              letterSpacing="0.08em"
              color="gray.500"
              mb={1}
              position="relative"
            >
              Mix
            </Text>
            <Box h="150px" position="relative">
              {pieData.length === 0 ? (
                <Flex h="100%" align="center" justify="center">
                  <Text fontSize="sm" color="gray.500" textAlign="center" px={4}>
                    No approved savings yet
                  </Text>
                </Flex>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={68}
                        paddingAngle={3}
                        stroke="#fff"
                        strokeWidth={3}
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
                  <Flex
                    position="absolute"
                    inset={0}
                    align="center"
                    justify="center"
                    pointerEvents="none"
                    direction="column"
                  >
                    <Text fontSize="10px" color="gray.500" fontWeight="semibold" textTransform="uppercase">
                      Total
                    </Text>
                    <Text fontSize="sm" fontWeight="800" color="#27062e" lineHeight="1.1">
                      {formatMoneyK(headline + capacity$)}
                    </Text>
                  </Flex>
                </>
              )}
            </Box>
            {pieData.length > 0 ? (
              <Stack spacing={1.5} mt={1} position="relative">
                {pieData.map((d) => (
                  <Flex key={d.key} align="center" justify="space-between" fontSize="xs">
                    <Flex align="center" gap={2}>
                      <Box w="8px" h="8px" borderRadius="full" bg={PIE_COLORS[d.key]} />
                      <Text color="gray.600">{d.name.replace(' (indicative)', '')}</Text>
                    </Flex>
                    <Text fontWeight="bold" color="gray.800">
                      {formatMoneyK(d.value)}
                    </Text>
                  </Flex>
                ))}
              </Stack>
            ) : null}
          </Box>
        </Flex>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <DashCard label="Claims · submitted vs approved" icon={CheckCircle2}>
          <Flex justify="space-between" mb={2}>
            <Box>
              <Text fontSize="2xl" fontWeight="bold" color="#27062e" lineHeight="1.1">
                {submittedCount}
              </Text>
              <Text fontSize="xs" color="gray.500">
                Submitted
              </Text>
            </Box>
            <Box textAlign="right">
              <Text fontSize="2xl" fontWeight="bold" color="#350e6f" lineHeight="1.1">
                {approvedCount}
              </Text>
              <Text fontSize="xs" color="gray.500">
                Approved
              </Text>
            </Box>
          </Flex>
          <Progress value={approvalPct} size="md" rounded="full" colorScheme="purple" bg="gray.100" />
          <Text fontSize="xs" color="gray.500" mt={2}>
            {approvalPct}% of submitted claims approved
            {awaitingApproval > 0 ? ` · ${formatMoneyK(awaitingApproval)} awaiting approval` : ''}
          </Text>
        </DashCard>

        <DashCard label="Savings by month" icon={BarChart3}>
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

      <DashCard label="By category" icon={FolderTree}>
        <Stack spacing={3}>
          {byCat.map((c) => (
            <Box key={c.k}>
              <Flex justify="space-between" fontSize="sm" mb={1}>
                <Text>{c.n}</Text>
                <Text fontFamily="mono">{formatMoneyK(c.v)}</Text>
              </Flex>
              <Progress value={(c.v / maxCat) * 100} size="sm" colorScheme="purple" rounded="full" />
            </Box>
          ))}
        </Stack>
      </DashCard>

      <DashCard label="Top approved claims" icon={Trophy}>
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
