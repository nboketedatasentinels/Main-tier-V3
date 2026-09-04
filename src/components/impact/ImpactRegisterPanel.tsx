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
import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, ClipboardList, Clock3, ListFilter } from 'lucide-react'
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

/** Same white card shell as Your savings */
const DashCard = ({
  label,
  icon,
  help,
  right,
  children,
}: {
  label: string
  icon: LucideIcon
  help?: React.ReactNode
  right?: React.ReactNode
  children: React.ReactNode
}) => (
  <Box
    p={5}
    bg="white"
    borderRadius="xl"
    border="1px solid"
    borderColor="gray.200"
    boxShadow="0 1px 3px rgba(0,0,0,0.04)"
    _hover={{
      boxShadow: '0 6px 16px rgba(39,6,46,0.06)',
      borderColor: 'gray.300',
    }}
    transition="all 0.2s ease"
  >
    <Flex align="center" gap={3} mb={4}>
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
    borderColor="gray.200"
    boxShadow="0 1px 2px rgba(0,0,0,0.03)"
  >
    <Flex align="center" gap={2} mb={2}>
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
      lineHeight="1.15"
      letterSpacing="-0.02em"
    >
      {value}
    </Text>
    {sub ? (
      <Text fontSize="10px" color="gray.500" mt={1}>
        {sub}
      </Text>
    ) : null}
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
    <Stack spacing={5}>
      <DashCard
        label="Claims ledger"
        icon={ClipboardList}
        help={<ImpactHelpButton k="journey" onOpen={onHelp} />}
        right={
          <Flex
            display={{ base: 'none', sm: 'flex' }}
            align="center"
            px={3}
            py={1.5}
            rounded="full"
            bg="white"
            border="1px solid"
            borderColor="gray.200"
          >
            <Text fontSize="xs" fontWeight="semibold" color="gray.700">
              {rows.length} of {entries.length} shown
            </Text>
          </Flex>
        }
      >
        <Text fontSize="sm" color="gray.600" mb={5} maxW="640px" lineHeight="1.5">
          Every improvement claim and ESG entry. Click a row to see what you wrote, evidence, and
          status — or duplicate it for a new impact.
        </Text>

        <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3} mb={5}>
          <MiniStat
            label="Approved"
            value={String(approvedCount)}
            sub={`${formatMoneyK(approvedValue)} valued`}
            icon={CheckCircle2}
          />
          <MiniStat
            label="Awaiting"
            value={String(awaitingCount)}
            sub="Pending confirmation"
            icon={Clock3}
          />
          <MiniStat
            label="Total entries"
            value={String(entries.length)}
            sub="Claims + ESG"
            icon={ClipboardList}
          />
        </SimpleGrid>

        <Box pt={1} borderTop="1px solid" borderColor="gray.100">
          <Flex align="center" gap={2} mb={3} mt={4}>
            <Icon as={ListFilter} boxSize={3.5} color="gray.500" />
            <Text
              fontSize="10px"
              fontWeight="bold"
              textTransform="uppercase"
              letterSpacing="0.08em"
              color="gray.500"
            >
              Filters
            </Text>
          </Flex>
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
                borderRadius="lg"
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
                borderRadius="lg"
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
                borderRadius="lg"
              >
                {['All', 'claim', 'activity', 'esg'].map((t) => (
                  <option key={t} value={t}>
                    {t === 'claim' ? 'improvement' : t}
                  </option>
                ))}
              </Select>
            </FormControl>
          </HStack>
        </Box>
      </DashCard>

      <DashCard
        label="Entries"
        icon={ClipboardList}
        right={
          <Text fontSize="xs" color="gray.500">
            Click a row to open
          </Text>
        }
      >
        <Stack spacing={3}>
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

            const statusLabel = approved
              ? 'Approved'
              : st === 'Submitted'
                ? 'Awaiting confirmation'
                : st || 'Pending'

            return (
              <Box
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
                boxShadow="0 1px 2px rgba(0,0,0,0.03)"
                transition="all 0.2s ease"
                _hover={{
                  borderColor: 'gray.300',
                  boxShadow: '0 6px 16px rgba(39,6,46,0.06)',
                  transform: 'translateY(-1px)',
                }}
                onClick={() => onOpenClaim(e)}
              >
                <Flex justify="space-between" gap={4} align="flex-start">
                  <Box minW={0} flex="1">
                    <Text
                      fontWeight="bold"
                      fontSize="md"
                      color="#27062e"
                      noOfLines={1}
                      letterSpacing="-0.01em"
                      mb={1}
                    >
                      {e.title || 'Untitled'}
                    </Text>
                    <Text fontSize="xs" color="gray.500" noOfLines={2} lineHeight="1.45" mb={2.5}>
                      {e.date}
                      {cat ? ` · ${cat.n}` : ''}
                      {sub ? ` · ${sub}` : ''}
                      {e.description ? ` · ${e.description}` : ''}
                    </Text>
                    <HStack spacing={2} flexWrap="wrap">
                      <Badge
                        bg="gray.100"
                        color="gray.600"
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
                        bg={approved ? '#350e6f' : 'gray.100'}
                        color={approved ? 'white' : 'gray.700'}
                        textTransform="none"
                        fontSize="10px"
                        px={2}
                        py={0.5}
                        borderRadius="md"
                        fontWeight="semibold"
                      >
                        {statusLabel}
                      </Badge>
                      <Text fontFamily="mono" fontSize="10px" color="gray.400">
                        {e.id.slice(0, 8)}
                      </Text>
                    </HStack>
                    {k === 'claim' && at >= 0 && (
                      <HStack spacing={1} mt={3}>
                        {CLAIM_STATE_ORDER.map((s, i) => (
                          <Box
                            key={s}
                            title={s}
                            w="18px"
                            h="4px"
                            rounded="full"
                            bg={i < at ? '#350e6f' : i === at ? '#9ca3af' : 'gray.200'}
                          />
                        ))}
                      </HStack>
                    )}
                  </Box>
                  <Box textAlign="right" flexShrink={0} minW="88px">
                    <Text
                      fontSize={{ base: 'lg', md: 'xl' }}
                      fontWeight="800"
                      color="#27062e"
                      letterSpacing="-0.02em"
                      lineHeight="1.1"
                    >
                      {amount}
                    </Text>
                    <Text fontSize="10px" color="gray.500" mt={1} textTransform="uppercase" letterSpacing="0.04em">
                      {approved ? 'Approved $' : k === 'esg' ? 'ESG' : 'Indicative'}
                    </Text>
                  </Box>
                </Flex>
              </Box>
            )
          })}
          {rows.length === 0 && (
            <Flex
              py={12}
              align="center"
              justify="center"
              border="1px dashed"
              borderColor="gray.200"
              borderRadius="xl"
              bg="white"
            >
              <Text fontSize="sm" color="gray.500">
                No rows match these filters.
              </Text>
            </Flex>
          )}
        </Stack>
      </DashCard>
    </Stack>
  )
}
