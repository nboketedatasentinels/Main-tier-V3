import React from 'react'
import { Badge, Box, Flex, Heading, Progress, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import {
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
  rates: ImpactRateCard[]
  onHelp: (k: ImpactHelpKey) => void
  onOpenClaim: (e: ImpactLogRecord) => void
}

export const ImpactWastePanel: React.FC<Props> = ({ entries, rates, onHelp, onOpenClaim }) => {
  const claims = entries.filter(
    (e) =>
      (e.entryKind === 'claim' || (!e.entryKind && e.categoryGroup === 'business')) &&
      (e.claimStatus === 'Recognized' || e.verificationStatus === 'approved'),
  )

  const sumWaste = IMPACT_WASTES.map((w) => {
    const set = claims.filter((c) => c.claim?.waste === w.k && c.claim?.cat !== 'rev')
    const v = set.reduce((s, e) => {
      const inputs = claimInputsFromRecord(e)
      return s + (inputs ? valuation(inputs, rates).net : Number(e.usdValue || 0))
    }, 0)
    return { ...w, v, count: set.length, rows: set }
  }).sort((a, b) => b.v - a.v)

  const sumGrowth = IMPACT_GROWTH.map((g) => {
    const set = claims.filter((c) => c.claim?.growth === g.k && c.claim?.cat === 'rev')
    const v = set.reduce((s, e) => {
      const inputs = claimInputsFromRecord(e)
      return s + (inputs ? valuation(inputs, rates).net : Number(e.usdValue || 0))
    }, 0)
    return { ...g, v, count: set.length }
  }).sort((a, b) => b.v - a.v)

  const maxW = Math.max(1, ...sumWaste.map((w) => w.v))
  const top = sumWaste[0]
  const none = sumWaste.filter((w) => !w.count)

  return (
    <Stack spacing={5}>
      <Box>
        <Heading size="md" mb={1}>
          Where value comes from
          <ImpactHelpButton k="waste" onOpen={onHelp} />
        </Heading>
        <Text fontSize="sm" color="text.secondary">
          Every claim filed against one of the 8 wastes, or a type of revenue growth.
        </Text>
      </Box>

      <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl">
        <Text fontWeight="semibold" mb={3}>
          Validated value by waste
        </Text>
        <Stack spacing={3}>
          {sumWaste.map((w) => (
            <Box key={w.k}>
              <Flex justify="space-between" fontSize="sm" mb={1}>
                <Box>
                  <Text fontWeight="medium">{w.n}</Text>
                  <Text fontSize="xs" color="text.muted">
                    {w.d} · {w.count} claim{w.count === 1 ? '' : 's'}
                  </Text>
                </Box>
                <Text fontFamily="mono">{w.v ? formatMoneyK(w.v) : '-'}</Text>
              </Flex>
              <Progress value={(w.v / maxW) * 100} size="sm" colorScheme="purple" rounded="full" />
            </Box>
          ))}
        </Stack>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} mt={4}>
          {top && top.count > 0 && (
            <Box p={3} bg="orange.50" borderLeft="3px solid" borderColor="brand.accent" rounded="md">
              <Text fontSize="sm" fontWeight="semibold">
                Repeating win: {top.n}
              </Text>
              <Text fontSize="xs" color="text.secondary">
                {top.count} validated claims. One waste that keeps producing value usually means one
                root cause across processes.
              </Text>
            </Box>
          )}
          {none.length > 0 && (
            <Box p={3} bg="blue.50" borderLeft="3px solid" borderColor="blue.400" rounded="md">
              <Text fontSize="sm" fontWeight="semibold">
                Nothing claimed yet against {none.length} wastes
              </Text>
              <Text fontSize="xs" color="text.secondary">
                {none.map((w) => w.n).join(', ')}. Either clean, or nobody has looked yet.
              </Text>
            </Box>
          )}
        </SimpleGrid>
      </Box>

      <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl">
        <Text fontWeight="semibold" mb={3}>
          Revenue growth types
        </Text>
        <Stack spacing={2}>
          {sumGrowth.map((g) => (
            <Flex key={g.k} justify="space-between" fontSize="sm">
              <Text>
                {g.n} <Badge ml={2}>{g.count}</Badge>
              </Text>
              <Text fontFamily="mono">{g.v ? formatMoney(g.v) : '-'}</Text>
            </Flex>
          ))}
        </Stack>
        <Text fontSize="xs" color="text.secondary" mt={3}>
          Revenue is always counted at gross margin, never at gross revenue.
        </Text>
      </Box>

      <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl">
        <Text fontWeight="semibold" mb={3}>
          Claims behind these bars
        </Text>
        <Stack spacing={2}>
          {claims
            .slice()
            .sort((a, b) => Number(b.usdValue || 0) - Number(a.usdValue || 0))
            .map((e) => (
              <Flex
                key={e.id}
                as="button"
                w="100%"
                textAlign="left"
                justify="space-between"
                p={2}
                rounded="md"
                _hover={{ bg: 'surface.subtle' }}
                onClick={() => onOpenClaim(e)}
              >
                <Text fontSize="sm">{e.title}</Text>
                <Text fontSize="sm" fontFamily="mono">
                  {formatMoney(Number(e.usdValue || 0))}
                </Text>
              </Flex>
            ))}
          {claims.length === 0 && (
            <Text fontSize="sm" color="text.secondary">
              No recognised claims yet.
            </Text>
          )}
        </Stack>
      </Box>
    </Stack>
  )
}
