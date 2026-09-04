import React, { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Icon,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { CheckCircle2, ClipboardList, Clock3, Filter } from 'lucide-react'
import {
  CLAIM_STATE_ORDER,
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
  rates: ImpactRateCard[]
  onHelp: (k: ImpactHelpKey) => void
  onOpenClaim: (e: ImpactLogRecord) => void
}

const isApproved = (e: ImpactLogRecord) =>
  e.claimStatus === 'Recognized' || e.verificationStatus === 'approved'

const Shell = ({
  label,
  icon,
  help,
  children,
  right,
}: {
  label: string
  icon: React.ElementType
  help?: React.ReactNode
  children: React.ReactNode
  right?: React.ReactNode
}) => (
  <Box
    p={5}
    bg="white"
    borderRadius="xl"
    border="1px solid"
    borderColor="gray.200"
    boxShadow="0 1px 3px rgba(0,0,0,0.04)"
  >
    <Flex align="flex-start" gap={3} mb={4}>
      <Flex
        w={10}
        h={10}
        bg="#350e6f"
        borderRadius="xl"
        align="center"
        justify="center"
        boxShadow="0 4px 12px rgba(53, 14, 111, 0.18)"
        flexShrink={0}
      >
        <Icon as={icon} boxSize={5} color="white" />
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
            {label}
          </Text>
          {help}
        </Flex>
      </Box>
      {right}
    </Flex>
    {children}
  </Box>
)

export const ImpactRegisterPanel: React.FC<Props> = ({ entries, rates, onHelp, onOpenClaim }) => {
  const [status, setStatus] = useState('All')
  const [approval, setApproval] = useState('All')
  const [kind, setKind] = useState('All')

  const rows = useMemo(() => {
    return entries.filter((e) => {
      const k = e.entryKind || (e.categoryGroup === 'esg' ? 'esg' : 'claim')
      if (kind !== 'All' && k !== kind) return false
      const st = e.claimStatus || e.verificationStatus || ''
      if (status !== 'All' && st !== status) return false
      if (approval === 'Approved' && !isApproved(e)) return false
      if (approval === 'Awaiting' && (isApproved(e) || st === 'Reversed')) return false
      if (approval === 'Reversed' && st !== 'Reversed') return false
      return true
    })
  }, [entries, status, approval, kind])

  const statuses = [
    'All',
    ...new Set(entries.map((e) => e.claimStatus || e.verificationStatus).filter(Boolean) as string[]),
  ]

  const approvedCount = entries.filter(isApproved).length
  const awaitingCount = entries.filter((e) => {
    const st = e.claimStatus || e.verificationStatus || ''
    return !isApproved(e) && st !== 'Reversed' && st !== ''
  }).length
  const approvedValue = entries
    .filter(isApproved)
    .reduce((s, e) => {
      const inputs = claimInputsFromRecord(e)
      return s + (inputs ? valuation(inputs, rates).net : Number(e.usdValue || 0))
    }, 0)

  return (
    <Stack spacing={4}>
      <Shell
        label="Claims ledger"
        icon={ClipboardList}
        help={<ImpactHelpButton k="journey" onOpen={onHelp} />}
        right={
          <Text fontSize="xs" color="gray.500" display={{ base: 'none', md: 'block' }}>
            {rows.length} of {entries.length} shown
          </Text>
        }
      >
        <Text fontSize="sm" color="gray.600" mb={5} maxW="640px" lineHeight="1.5">
          Every improvement claim and ESG entry. Click a row to see what you wrote, evidence, and
          status — or duplicate it for a new impact.
        </Text>

        <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3} mb={1}>
          <Box p={3.5} bg="white" border="1px solid" borderColor="gray.200" borderRadius="xl">
            <Flex align="center" gap={2} mb={1}>
              <Flex w="28px" h="28px" borderRadius="lg" align="center" justify="center" bg="gray.100">
                <Icon as={CheckCircle2} boxSize={3.5} color="#350e6f" />
              </Flex>
              <Text fontSize="10px" textTransform="uppercase" fontWeight="bold" color="gray.500" letterSpacing="0.06em">
                Approved
              </Text>
            </Flex>
            <Text fontSize="xl" fontWeight="800" color="#27062e" letterSpacing="-0.02em">
              {approvedCount}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={0.5}>
              {formatMoneyK(approvedValue)} valued
            </Text>
          </Box>
          <Box p={3.5} bg="white" border="1px solid" borderColor="gray.200" borderRadius="xl">
            <Flex align="center" gap={2} mb={1}>
              <Flex w="28px" h="28px" borderRadius="lg" align="center" justify="center" bg="gray.100">
                <Icon as={Clock3} boxSize={3.5} color="#350e6f" />
              </Flex>
              <Text fontSize="10px" textTransform="uppercase" fontWeight="bold" color="gray.500" letterSpacing="0.06em">
                Awaiting
              </Text>
            </Flex>
            <Text fontSize="xl" fontWeight="800" color="#27062e" letterSpacing="-0.02em">
              {awaitingCount}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={0.5}>
              Pending confirmation
            </Text>
          </Box>
          <Box p={3.5} bg="white" border="1px solid" borderColor="gray.200" borderRadius="xl">
            <Flex align="center" gap={2} mb={1}>
              <Flex w="28px" h="28px" borderRadius="lg" align="center" justify="center" bg="gray.100">
                <Icon as={ClipboardList} boxSize={3.5} color="#350e6f" />
              </Flex>
              <Text fontSize="10px" textTransform="uppercase" fontWeight="bold" color="gray.500" letterSpacing="0.06em">
                Total entries
              </Text>
            </Flex>
            <Text fontSize="xl" fontWeight="800" color="#27062e" letterSpacing="-0.02em">
              {entries.length}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={0.5}>
              Claims + ESG
            </Text>
          </Box>
        </SimpleGrid>
      </Shell>

      <Shell label="Filters" icon={Filter}>
        <HStack spacing={3} flexWrap="wrap" align="flex-end">
          <FormControl maxW="200px">
            <FormLabel fontSize="xs" color="gray.500" mb={1}>
              Status
            </FormLabel>
            <Select
              size="sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              bg="white"
              borderColor="gray.200"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl maxW="160px">
            <FormLabel fontSize="xs" color="gray.500" mb={1}>
              Approval
            </FormLabel>
            <Select
              size="sm"
              value={approval}
              onChange={(e) => setApproval(e.target.value)}
              bg="white"
              borderColor="gray.200"
            >
              {['All', 'Approved', 'Awaiting', 'Reversed'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl maxW="160px">
            <FormLabel fontSize="xs" color="gray.500" mb={1}>
              Type
            </FormLabel>
            <Select
              size="sm"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              bg="white"
              borderColor="gray.200"
            >
              {['All', 'claim', 'activity', 'esg'].map((t) => (
                <option key={t} value={t}>
                  {t === 'claim' ? 'improvement' : t}
                </option>
              ))}
            </Select>
          </FormControl>
        </HStack>
      </Shell>

      <Shell
        label="Entries"
        icon={ClipboardList}
        right={
          <Text fontSize="xs" color="gray.500">
            Click a row to open
          </Text>
        }
      >
        <Stack spacing={2.5}>
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
            const approved = isApproved(e)
            const amount =
              k === 'claim' && approved && v
                ? formatMoney(v.net)
                : k === 'claim' && Number(e.usdValue || e.claim?.net || 0)
                  ? `~${formatMoney(Number(e.usdValue || e.claim?.net || 0))}`
                  : k === 'esg'
                    ? 'not valued'
                    : '—'

            return (
              <Flex
                key={e.id}
                as="button"
                type="button"
                w="100%"
                textAlign="left"
                p={4}
                bg="white"
                border="1px solid"
                borderColor="gray.200"
                borderRadius="xl"
                justify="space-between"
                gap={3}
                flexWrap="wrap"
                align="flex-start"
                transition="all 0.2s ease"
                _hover={{
                  borderColor: 'gray.300',
                  boxShadow: '0 4px 12px rgba(39,6,46,0.06)',
                  transform: 'translateY(-1px)',
                }}
                onClick={() => onOpenClaim(e)}
              >
                <Box minW={0} flex="1">
                  <HStack spacing={2} mb={1.5} flexWrap="wrap">
                    <Text fontFamily="mono" fontSize="xs" color="gray.400">
                      {e.id.slice(0, 8)}
                    </Text>
                    <Badge
                      bg="gray.100"
                      color="gray.700"
                      textTransform="uppercase"
                      fontSize="9px"
                      letterSpacing="0.04em"
                      px={2}
                      py={0.5}
                      borderRadius="md"
                      fontWeight="bold"
                    >
                      {k === 'claim' ? 'improvement' : k}
                    </Badge>
                    <Badge
                      bg={approved ? '#350e6f' : st === 'Reversed' ? 'gray.500' : 'gray.100'}
                      color={approved || st === 'Reversed' ? 'white' : 'gray.700'}
                      textTransform="none"
                      fontSize="10px"
                      px={2}
                      py={0.5}
                      borderRadius="md"
                      fontWeight="semibold"
                    >
                      {approved
                        ? 'Approved'
                        : st === 'Submitted'
                          ? 'Awaiting confirmation'
                          : st || 'Pending'}
                    </Badge>
                  </HStack>
                  <Text fontWeight="semibold" color="#27062e" noOfLines={1}>
                    {e.title}
                  </Text>
                  <Text fontSize="xs" color="gray.500" noOfLines={2} mt={0.5} lineHeight="1.45">
                    {e.date}
                    {cat ? ` · ${cat.n}` : ''}
                    {sub ? ` · ${sub}` : ''}
                    {e.description ? ` · ${e.description}` : ''}
                  </Text>
                  {k === 'claim' && at >= 0 && (
                    <HStack spacing={1} mt={2.5}>
                      {CLAIM_STATE_ORDER.map((s, i) => (
                        <Box
                          key={s}
                          title={s}
                          w="16px"
                          h="4px"
                          rounded="full"
                          bg={i < at ? '#350e6f' : i === at ? '#9ca3af' : 'gray.200'}
                        />
                      ))}
                    </HStack>
                  )}
                </Box>
                <Text
                  fontFamily="mono"
                  fontSize="sm"
                  fontWeight="bold"
                  color="#27062e"
                  flexShrink={0}
                  pt={0.5}
                >
                  {amount}
                </Text>
              </Flex>
            )
          })}
          {rows.length === 0 && (
            <Flex
              py={10}
              align="center"
              justify="center"
              border="1px dashed"
              borderColor="gray.200"
              borderRadius="xl"
            >
              <Text fontSize="sm" color="gray.500">
                No rows match these filters.
              </Text>
            </Flex>
          )}
        </Stack>
      </Shell>
    </Stack>
  )
}
