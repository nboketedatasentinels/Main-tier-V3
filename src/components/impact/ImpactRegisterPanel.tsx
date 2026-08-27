import React, { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Select,
  Stack,
  Text,
} from '@chakra-ui/react'
import {
  CLAIM_STATE_ORDER,
  IMPACT_CATS,
  IMPACT_GROWTH,
  IMPACT_WASTES,
  claimInputsFromRecord,
  formatMoney,
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

export const ImpactRegisterPanel: React.FC<Props> = ({ entries, rates, onHelp, onOpenClaim }) => {
  const [status, setStatus] = useState('All')
  const [tier, setTier] = useState('All')
  const [kind, setKind] = useState('All')

  const rows = useMemo(() => {
    return entries.filter((e) => {
      const k = e.entryKind || (e.categoryGroup === 'esg' ? 'esg' : 'claim')
      if (kind !== 'All' && k !== kind) return false
      const st = e.claimStatus || e.verificationStatus || ''
      if (status !== 'All' && st !== status) return false
      if (tier !== 'All') {
        const inputs = claimInputsFromRecord(e)
        const t = inputs ? valuation(inputs, rates).tier : Number(e.claim?.tier || 0)
        if (String(t) !== tier) return false
      }
      return true
    })
  }, [entries, status, tier, kind, rates])

  const statuses = [
    'All',
    ...new Set(entries.map((e) => e.claimStatus || e.verificationStatus).filter(Boolean) as string[]),
  ]

  return (
    <Stack spacing={4}>
      <Box>
        <Heading size="md" mb={1}>
          Claims ledger
          <ImpactHelpButton k="journey" onOpen={onHelp} />
        </Heading>
        <Text fontSize="sm" color="text.secondary">
          Every logged claim, activity, and ESG entry. Dashboard figures drill back here. Org rates
          live under Value register.
        </Text>
      </Box>

      <HStack spacing={3} flexWrap="wrap">
        <FormControl maxW="200px">
          <FormLabel fontSize="xs">Status</FormLabel>
          <Select size="sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl maxW="140px">
          <FormLabel fontSize="xs">Tier</FormLabel>
          <Select size="sm" value={tier} onChange={(e) => setTier(e.target.value)}>
            {['All', '3', '2', '1'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl maxW="160px">
          <FormLabel fontSize="xs">Type</FormLabel>
          <Select size="sm" value={kind} onChange={(e) => setKind(e.target.value)}>
            {['All', 'claim', 'activity', 'esg'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </FormControl>
      </HStack>

      <Stack spacing={2}>
        {rows.map((e) => {
          const k = e.entryKind || (e.categoryGroup === 'esg' ? 'esg' : 'claim')
          const inputs = claimInputsFromRecord(e)
          const v = inputs ? valuation(inputs, rates) : null
          const cat = IMPACT_CATS.find((c) => c.k === e.claim?.cat)
          const sub =
            e.claim?.cat === 'rev'
              ? IMPACT_GROWTH.find((g) => g.k === e.claim?.growth)?.n
              : IMPACT_WASTES.find((w) => w.k === e.claim?.waste)?.n
          const st = String(e.claimStatus || e.verificationStatus || '')
          const at = CLAIM_STATE_ORDER.indexOf(st as (typeof CLAIM_STATE_ORDER)[number])

          return (
            <Flex
              key={e.id}
              as="button"
              w="100%"
              textAlign="left"
              p={3}
              border="1px solid"
              borderColor="border.subtle"
              rounded="md"
              justify="space-between"
              gap={3}
              flexWrap="wrap"
              _hover={{ bg: 'orange.50' }}
              onClick={() => onOpenClaim(e)}
            >
              <Box>
                <HStack spacing={2} mb={1} flexWrap="wrap">
                  <Text fontFamily="mono" fontSize="xs" color="text.muted">
                    {e.id.slice(0, 8)}
                  </Text>
                  <Badge>{k}</Badge>
                  {v && <Badge colorScheme="purple">Tier {v.tier}</Badge>}
                  <Badge variant="outline">{st || '-'}</Badge>
                </HStack>
                <Text fontWeight="semibold">{e.title}</Text>
                <Text fontSize="xs" color="text.muted">
                  {e.date}
                  {cat ? ` · ${cat.n}` : ''}
                  {sub ? ` · ${sub}` : ''}
                </Text>
                {k === 'claim' && at >= 0 && (
                  <HStack spacing={1} mt={2}>
                    {CLAIM_STATE_ORDER.map((s, i) => (
                      <Box
                        key={s}
                        title={s}
                        w="16px"
                        h="4px"
                        rounded="full"
                        bg={i < at ? 'green.400' : i === at ? 'yellow.400' : 'gray.200'}
                      />
                    ))}
                  </HStack>
                )}
              </Box>
              <Text fontFamily="mono" fontSize="sm">
                {k === 'claim' && v && v.tier > 1 && st !== 'Reversed'
                  ? formatMoney(v.net)
                  : k === 'esg'
                    ? 'not valued'
                    : '-'}
              </Text>
            </Flex>
          )
        })}
        {rows.length === 0 && (
          <Text fontSize="sm" color="text.secondary">
            No rows match these filters.
          </Text>
        )}
      </Stack>
      <Text fontSize="xs" color="text.muted">
        {rows.length} of {entries.length} entries. Click a row for the record, waterfall, and audit
        trail.
      </Text>
    </Stack>
  )
}
