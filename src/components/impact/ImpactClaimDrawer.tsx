import React, { useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import {
  CLAIM_STATE_ORDER,
  claimInputsFromRecord,
  formatMoney,
  nextClaimStatus,
  valuation,
  IMPACT_CATS,
  IMPACT_WASTES,
  IMPACT_GROWTH,
  type ImpactRateCard,
} from '@/config/impactValueEngine'
import { patchImpactLog, type ImpactLogRecord } from '@/services/impactLogService'

type Props = {
  entry: ImpactLogRecord | null
  rates: ImpactRateCard[]
  canModerate: boolean
  onClose: () => void
  onChanged: () => void
}

export const ImpactClaimDrawer: React.FC<Props> = ({
  entry,
  rates,
  canModerate,
  onClose,
  onChanged,
}) => {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  if (!entry) return null

  const inputs = claimInputsFromRecord(entry)
  const v = inputs ? valuation(inputs, rates) : null
  const status = String(entry.claimStatus || entry.verificationStatus || 'Submitted')
  const audit = Array.isArray(entry.claim?.auditTrail)
    ? (entry.claim!.auditTrail as string[])
    : Array.isArray((entry as { auditTrail?: string[] }).auditTrail)
      ? ((entry as { auditTrail?: string[] }).auditTrail as string[])
      : []
  const cat = IMPACT_CATS.find((c) => c.k === entry.claim?.cat)
  const sub =
    entry.claim?.cat === 'rev'
      ? IMPACT_GROWTH.find((g) => g.k === entry.claim?.growth)?.n
      : IMPACT_WASTES.find((w) => w.k === entry.claim?.waste)?.n

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      toast({ status: 'success', title: ok })
      onChanged()
    } catch (err) {
      toast({
        status: 'error',
        title: 'Action failed',
        description: err instanceof Error ? err.message : 'Try again',
      })
    } finally {
      setBusy(false)
    }
  }

  const advance = () =>
    run(async () => {
      const next = nextClaimStatus(status)
      if (!next) throw new Error('Nothing to advance.')
      const recognized = next === 'Recognized'
      await patchImpactLog(entry.id, {
        claimStatus: next,
        verificationStatus: recognized ? 'approved' : 'pending',
        usdValue: recognized && v ? Math.round(v.net) : entry.usdValue,
        claim: {
          ...(entry.claim || {}),
          sustain90: recognized ? 'Not yet due' : entry.claim?.sustain90,
        },
        auditLine: `${new Date().toISOString().slice(0, 16)} · status → ${next}`,
      })
    }, `Moved to ${nextClaimStatus(status)}`)

  const sendBack = () =>
    run(async () => {
      await patchImpactLog(entry.id, {
        claimStatus: 'Returned for Revision',
        verificationStatus: 'pending',
        claim: {
          ...(entry.claim || {}),
          reverseReason:
            note.trim() ||
            'Sent back: attach source extract and extend the measurement window to three periods.',
        },
        auditLine: `${new Date().toISOString().slice(0, 16)} · sent back for revision`,
      })
      setNote('')
    }, 'Sent back for revision')

  const resubmit = () =>
    run(async () => {
      await patchImpactLog(entry.id, {
        claimStatus: 'Submitted',
        claim: { ...(entry.claim || {}), reverseReason: '' },
        auditLine: `${new Date().toISOString().slice(0, 16)} · resubmitted`,
      })
    }, 'Resubmitted')

  const check90 = (holding: boolean) =>
    run(async () => {
      if (holding) {
        await patchImpactLog(entry.id, {
          claim: {
            ...(entry.claim || {}),
            sustain90: 'Holding',
            sustain180: 'Due in 90 days',
          },
          auditLine: `${new Date().toISOString().slice(0, 16)} · 90 day check: holding`,
        })
      } else {
        await patchImpactLog(entry.id, {
          claimStatus: 'Reversed',
          verificationStatus: 'rejected',
          usdValue: 0,
          claim: {
            ...(entry.claim || {}),
            sustain90: 'Not holding',
            reverseReason: '90 day check returned Not holding. Value removed from the register.',
          },
          auditLine: `${new Date().toISOString().slice(0, 16)} · 90 day check: reversed`,
        })
      }
    }, holding ? 'Marked holding' : 'Claim reversed')

  const at = CLAIM_STATE_ORDER.indexOf(status as (typeof CLAIM_STATE_ORDER)[number])

  return (
    <Drawer isOpen={Boolean(entry)} placement="right" size="md" onClose={onClose}>
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>
          <Text fontSize="xs" color="text.muted" textTransform="uppercase">
            {entry.id.slice(0, 8)} · {status}
          </Text>
          <Heading size="sm" mt={1}>
            {entry.title}
          </Heading>
        </DrawerHeader>
        <DrawerBody>
          <HStack spacing={2} flexWrap="wrap" mb={4}>
            {v && <Badge colorScheme="purple">Tier {v.tier}</Badge>}
            {v && <Badge>Baseline {v.grade}</Badge>}
            {entry.claim?.bucket != null && <Badge colorScheme="green">{String(entry.claim.bucket)}</Badge>}
            <Badge variant="outline">
              {cat?.n || '-'} · {sub || '-'}
            </Badge>
          </HStack>

          {typeof entry.claim?.reverseReason === 'string' && entry.claim.reverseReason && (
            <Box mb={4} p={3} bg="red.50" borderLeft="3px solid" borderColor="red.400" rounded="md">
              <Text fontSize="sm">{String(entry.claim.reverseReason)}</Text>
            </Box>
          )}

          {inputs && (
            <Box mb={4}>
              <Text fontSize="xs" fontWeight="bold" color="text.muted" mb={2}>
                BEFORE / AFTER
              </Text>
              <Flex gap={4}>
                <Box flex={1}>
                  <Text fontSize="xs" color="text.muted">
                    Before
                  </Text>
                  <Text fontWeight="bold">
                    {inputs.base} {inputs.unit}
                  </Text>
                </Box>
                <Box flex={1}>
                  <Text fontSize="xs" color="text.muted">
                    After
                  </Text>
                  <Text fontWeight="bold">
                    {inputs.post} {inputs.unit}
                  </Text>
                </Box>
                <Box flex={1}>
                  <Text fontSize="xs" color="text.muted">
                    Net / period
                  </Text>
                  <Text fontWeight="bold" color="brand.primary">
                    {v && v.tier > 1 ? formatMoney(v.net) : '-'}
                  </Text>
                </Box>
              </Flex>
            </Box>
          )}

          <Text fontSize="xs" fontWeight="bold" color="text.muted" mb={2}>
            JOURNEY
          </Text>
          <Stack spacing={2} mb={4}>
            {CLAIM_STATE_ORDER.map((s, i) => (
              <Flex key={s} gap={3} align="flex-start">
                <Box
                  mt={1}
                  w="10px"
                  h="10px"
                  rounded="full"
                  bg={i < at ? 'green.400' : i === at ? 'yellow.400' : 'gray.200'}
                  flexShrink={0}
                />
                <Text fontSize="sm" fontWeight={i === at ? 'semibold' : 'normal'}>
                  {s}
                </Text>
              </Flex>
            ))}
          </Stack>

          {v && (
            <Box mb={4} p={3} border="1px solid" borderColor="border.subtle" rounded="lg">
              <Text fontSize="xs" fontWeight="bold" color="text.muted" mb={2}>
                WATERFALL
              </Text>
              {[
                ['Gross', v.gross],
                [`After attribution ${inputs?.attribution ?? 100}%`, v.afterA],
                [`After realisation`, v.afterR],
                [`After confidence (Tier ${v.tier})`, v.afterC],
                ['Less cost to deliver', -v.cost],
                ['Net', v.net],
              ].map(([label, val]) => (
                <Flex key={String(label)} justify="space-between" fontSize="sm" py={0.5}>
                  <Text color="text.secondary">{label}</Text>
                  <Text fontFamily="mono">{formatMoney(Number(val))}</Text>
                </Flex>
              ))}
            </Box>
          )}

          <Text fontSize="xs" fontWeight="bold" color="text.muted" mb={2}>
            AUDIT TRAIL
          </Text>
          <Box fontSize="xs" fontFamily="mono" color="text.secondary" pl={3} borderLeft="2px solid" borderColor="border.subtle" mb={4}>
            {audit.length === 0 ? (
              <Text>No audit lines yet.</Text>
            ) : (
              audit.map((line, i) => (
                <Text key={i} py={0.5}>
                  {line}
                </Text>
              ))
            )}
          </Box>

          {canModerate && (
            <>
              <Divider mb={3} />
              <Textarea
                size="sm"
                placeholder="Optional note for send-back…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                mb={3}
                rows={2}
              />
              <Stack spacing={2}>
                {(status === 'Submitted' || status === 'Measure Owner Confirmed') && (
                  <>
                    <Button size="sm" colorScheme="primary" isLoading={busy} onClick={() => void advance()}>
                      Advance status
                    </Button>
                    <Button size="sm" variant="outline" colorScheme="orange" isLoading={busy} onClick={() => void sendBack()}>
                      Send back
                    </Button>
                  </>
                )}
                {status === 'Returned for Revision' && (
                  <Button size="sm" colorScheme="primary" isLoading={busy} onClick={() => void resubmit()}>
                    Mark fixed & resubmit
                  </Button>
                )}
                {status === 'Recognized' && entry.claim?.sustain90 === 'Not yet due' && (
                  <>
                    <Button size="sm" colorScheme="green" isLoading={busy} onClick={() => void check90(true)}>
                      90 day: holding
                    </Button>
                    <Button size="sm" colorScheme="red" variant="outline" isLoading={busy} onClick={() => void check90(false)}>
                      90 day: not holding
                    </Button>
                  </>
                )}
              </Stack>
            </>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
