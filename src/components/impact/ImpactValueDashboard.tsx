import React, { useMemo } from 'react'
import { Badge, Box, Flex, Heading, Progress, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import {
  CLAIM_STATE_ORDER,
  IMPACT_CATS,
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

const isClaim = (e: ImpactLogRecord) => e.entryKind === 'claim' || (!e.entryKind && e.categoryGroup === 'business')

const isValidated = (e: ImpactLogRecord, rates: ImpactRateCard[]) => {
  if (!isClaim(e)) return false
  if (e.claimStatus === 'Recognized' || e.verificationStatus === 'approved') {
    const inputs = claimInputsFromRecord(e)
    if (!inputs) return Number(e.usdValue || 0) > 0
    return valuation(inputs, rates).tier === 3
  }
  return false
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
  const capHours = validated
    .filter((e) => e.claim?.bucket === 'capacity')
    .reduce((s, e) => s + Number(e.hours || 0), 0)
  const pipeline = claims
    .filter((e) => {
      const inputs = claimInputsFromRecord(e)
      return inputs && valuation(inputs, rates).tier === 2 && e.claimStatus !== 'Reversed'
    })
    .reduce((s, e) => {
      const inputs = claimInputsFromRecord(e)!
      return s + valuation(inputs, rates).net
    }, 0)

  const funnel = CLAIM_STATE_ORDER.map((s) => ({
    s,
    n: claims.filter((c) => (c.claimStatus || '') === s).length,
  })).concat([
    { s: 'Returned for Revision' as const, n: claims.filter((c) => c.claimStatus === 'Returned for Revision').length },
    { s: 'Reversed' as const, n: claims.filter((c) => c.claimStatus === 'Reversed').length },
  ])

  const byCat = IMPACT_CATS.map((c) => ({
    ...c,
    v: moneyOf(
      validated.filter((e) => e.claim?.cat === c.k),
    ),
  }))
  const maxCat = Math.max(1, ...byCat.map((c) => c.v))

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

  return (
    <Stack spacing={5}>
      <Box>
        <Heading size="md" mb={1}>
          Value dashboard
        </Heading>
        <Text fontSize="sm" color="text.secondary">
          Headline is Tier 3 / recognised claims only.
          <ImpactHelpButton k="tier" onOpen={onHelp} />
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
        {[
          {
            l: 'Headline per period',
            v: formatMoney(headline),
            n: `Cash + avoidance. Annual run-rate ${formatMoney(headline * 12)} (separate column).`,
            hi: true,
          },
          { l: 'Cash impact', v: formatMoney(cash), n: 'Traceable to a P&L or budget line', hi: false },
          { l: 'Cost avoidance', v: formatMoney(avoid), n: 'Spend that did not happen', hi: false },
          {
            l: 'Capacity released',
            v: `${capHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs`,
            n: `Indicative ${formatMoney(capacity$)}. Never added to headline.`,
            hi: false,
          },
        ].map((k) => (
          <Box
            key={k.l}
            p={4}
            border="1px solid"
            borderColor={k.hi ? 'yellow.200' : 'border.subtle'}
            rounded="xl"
            bg={k.hi ? 'orange.50' : 'surface.default'}
          >
            <Text fontSize="xs" textTransform="uppercase" color="text.muted" fontWeight="bold">
              {k.l}
            </Text>
            <Text fontSize="2xl" fontWeight="bold" mt={1} color={k.hi ? 'brand.accent' : undefined}>
              {k.v}
            </Text>
            <Text fontSize="xs" color="text.secondary" mt={1}>
              {k.n}
            </Text>
          </Box>
        ))}
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl">
          <Text fontSize="xs" fontWeight="bold" color="brand.accent" mb={2}>
            VALUE BY MONTH
          </Text>
          {months.length === 0 ? (
            <Text fontSize="sm" color="text.secondary">
              No validated monthly value yet.
            </Text>
          ) : (
            <Flex align="flex-end" gap={2} h="140px">
              {months.map(([m, v]) => (
                <Flex key={m} flex={1} direction="column" align="center" h="100%" justify="flex-end">
                  <Text fontSize="10px" color="text.muted" mb={1}>
                    {v ? formatMoneyK(v) : ''}
                  </Text>
                  <Box
                    w="100%"
                    h={`${Math.max(4, (v / maxMonth) * 100)}px`}
                    bg="brand.primary"
                    rounded="sm"
                  />
                  <Text fontSize="10px" color="text.muted" mt={1}>
                    {m.slice(5)}
                  </Text>
                </Flex>
              ))}
            </Flex>
          )}
          <Text fontSize="xs" color="text.secondary" mt={3}>
            Tier 2 pipeline: {formatMoney(pipeline)}
            <ImpactHelpButton k="buckets" onOpen={onHelp} />
          </Text>
        </Box>

        <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl">
          <Text fontSize="xs" fontWeight="bold" color="brand.accent" mb={2}>
            CLAIM FUNNEL
            <ImpactHelpButton k="journey" onOpen={onHelp} />
          </Text>
          <Stack spacing={2}>
            {funnel.map((f) => (
              <Box key={f.s}>
                <Flex justify="space-between" fontSize="sm" mb={1}>
                  <Text>{f.s}</Text>
                  <Badge>{f.n}</Badge>
                </Flex>
                <Progress
                  value={claims.length ? (f.n / Math.max(1, claims.length)) * 100 : 0}
                  size="sm"
                  colorScheme="yellow"
                  rounded="full"
                />
              </Box>
            ))}
          </Stack>
        </Box>
      </SimpleGrid>

      <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl">
        <Text fontSize="xs" fontWeight="bold" color="brand.accent" mb={3}>
          BY PRIMARY CATEGORY
        </Text>
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
      </Box>

      <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl">
        <Text fontSize="xs" fontWeight="bold" color="brand.accent" mb={3}>
          TOP VALIDATED CLAIMS
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
                <Text fontSize="sm" fontWeight="medium">
                  {e.title}
                </Text>
                <Text fontSize="sm" fontFamily="mono">
                  {formatMoney(Number(e.usdValue || 0))}
                </Text>
              </Flex>
            ))}
          {validated.length === 0 && (
            <Text fontSize="sm" color="text.secondary">
              No recognised Tier 3 claims yet.
            </Text>
          )}
        </Stack>
      </Box>
    </Stack>
  )
}
