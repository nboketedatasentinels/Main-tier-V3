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
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  Heading,
  HStack,
  Link,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import {
  CLAIM_STATE_ORDER,
  bandNeedsFinance,
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
  /** Start a new claim prefilled from this one. */
  onDuplicate?: (entry: ImpactLogRecord) => void
}

const isHttpUrl = (s: string) => /^https?:\/\//i.test(s.trim())

const approvalLabel = (entry: ImpactLogRecord, tier: number | null) => {
  const st = String(entry.claimStatus || entry.verificationStatus || '')
  if (st === 'Reversed') return { label: 'Reversed', color: 'red' as const }
  if (st === 'Returned for Revision') return { label: 'Needs revision', color: 'orange' as const }
  if (st === 'Recognized' || entry.verificationStatus === 'approved' || tier === 3) {
    return { label: 'Approved', color: 'green' as const }
  }
  if (st === 'Submitted') return { label: 'Awaiting confirmation', color: 'blue' as const }
  if (st) return { label: st, color: 'purple' as const }
  return { label: 'Pending', color: 'gray' as const }
}

export const ImpactClaimDrawer: React.FC<Props> = ({
  entry,
  rates,
  canModerate,
  onClose,
  onChanged,
  onDuplicate,
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
  const approval = approvalLabel(entry, v?.tier ?? (Number(entry.claim?.tier ?? 0) || null))
  const intervention = String(entry.claim?.intervention || entry.description || '').trim()
  const evidenceType = String(entry.claim?.source || entry.claim?.evidenceType || '').trim()
  const evidenceRef = String(entry.claim?.evidence || entry.evidenceLink || '').trim()
  const valueLink = String(entry.claim?.valueEvidenceLink || '').trim()
  const moneyGained = Number(entry.claim?.moneyGained || 0)
  const goalDir = String(entry.claim?.goalDir || '')
  const where = String(entry.claim?.scope || '').trim()
  const isClaim =
    entry.entryKind === 'claim' || (!entry.entryKind && entry.categoryGroup === 'business')

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

  const needsFinance =
    entry.needsFinance === true ||
    (entry.needsFinance !== false && Boolean(v && bandNeedsFinance(v.net)))

  const advance = () =>
    run(async () => {
      const next = nextClaimStatus(status, { needsFinance })
      if (!next) throw new Error('Nothing to advance.')
      const recognized = next === 'Recognized'
      const ownerConfirmed = next === 'Measure Owner Confirmed'
      const financeValidated = next === 'Finance Validated'
      const nextTier = recognized
        ? 3
        : ownerConfirmed || financeValidated
          ? 2
          : Number(entry.claim?.tier || 1)
      const nextUsd =
        recognized || ownerConfirmed || financeValidated
          ? Math.round(v?.net ?? Number(entry.claim?.net ?? entry.usdValue ?? 0))
          : entry.usdValue
      await patchImpactLog(entry.id, {
        claimStatus: next,
        verificationStatus: recognized ? 'approved' : 'pending',
        verificationLevel:
          nextTier === 3
            ? 'Tier 3: Verified'
            : nextTier === 2
              ? 'Tier 2: Partner Verified'
              : 'Tier 1: Self-Reported',
        usdValue: nextUsd,
        impactValue: recognized ? nextUsd : entry.impactValue,
        claim: {
          ...(entry.claim || {}),
          tier: nextTier,
          sustain90: recognized ? 'Not yet due' : entry.claim?.sustain90,
        },
        auditLine: `${new Date().toISOString().slice(0, 16)} · status → ${next}`,
      })
    }, `Moved to ${nextClaimStatus(status, { needsFinance })}`)

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

  const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <Box py={2} borderBottom="1px solid" borderColor="border.subtle">
      <Text fontSize="xs" color="text.muted" fontWeight="bold" textTransform="uppercase" mb={0.5}>
        {label}
      </Text>
      <Text fontSize="sm" whiteSpace="pre-wrap">
        {children}
      </Text>
    </Box>
  )

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
            <Badge colorScheme={approval.color}>{approval.label}</Badge>
            {v && <Badge>Baseline {v.grade}</Badge>}
            {entry.claim?.bucket != null && (
              <Badge colorScheme="green">{String(entry.claim.bucket)}</Badge>
            )}
            <Badge variant="outline">
              {cat?.n || '-'} · {sub || '-'}
            </Badge>
            {entry.ownerEmail && status === 'Submitted' && (
              <Badge colorScheme="blue">Awaiting owner · {entry.ownerEmail}</Badge>
            )}
            {needsFinance && status === 'Measure Owner Confirmed' && entry.financeEmail && (
              <Badge colorScheme="orange">Awaiting finance · {entry.financeEmail}</Badge>
            )}
          </HStack>

          {canModerate && status === 'Submitted' && (
            <Box mb={4} p={3} bg="blue.50" borderLeft="3px solid" borderColor="blue.400" rounded="md">
              <Text fontSize="sm" color="gray.800">
                Measure owner was emailed a confirm link
                {entry.ownerEmail ? ` (${entry.ownerEmail})` : ''}. You can also advance status here
                after reviewing the answers - same gate as the email confirmation.
              </Text>
            </Box>
          )}

          {typeof entry.claim?.reverseReason === 'string' && entry.claim.reverseReason && (
            <Box mb={4} p={3} bg="red.50" borderLeft="3px solid" borderColor="red.400" rounded="md">
              <Text fontSize="sm">{String(entry.claim.reverseReason)}</Text>
            </Box>
          )}

          <Text fontSize="xs" fontWeight="bold" color="brand.accent" mb={1} letterSpacing="0.06em">
            WHAT YOU WROTE
          </Text>
          <Box mb={4} p={3} bg="surface.subtle" rounded="lg">
            {intervention ? (
              <DetailRow label="What changed">{intervention}</DetailRow>
            ) : (
              <Text fontSize="sm" color="text.secondary" mb={2}>
                No written description on this entry.
              </Text>
            )}
            {where ? <DetailRow label="Where">{where}</DetailRow> : null}
            {goalDir ? (
              <DetailRow label="Goal direction">
                {goalDir === 'up' || goalDir === 'increase'
                  ? 'Increase from baseline'
                  : 'Decrease from baseline'}
              </DetailRow>
            ) : null}
            {moneyGained > 0 ? (
              <DetailRow label="Money gained / saved (your estimate)">
                {formatMoney(moneyGained)} / month
              </DetailRow>
            ) : null}
            {evidenceType ? <DetailRow label="Evidence type">{evidenceType}</DetailRow> : null}
            {evidenceRef ? (
              <DetailRow label="Evidence reference">
                {isHttpUrl(evidenceRef) ? (
                  <Link href={evidenceRef.trim()} isExternal color="brand.primary">
                    {evidenceRef}
                  </Link>
                ) : (
                  evidenceRef
                )}
              </DetailRow>
            ) : null}
            {valueLink ? (
              <DetailRow label="Value evidence link">
                {isHttpUrl(valueLink) ? (
                  <Link href={valueLink.trim()} isExternal color="brand.primary">
                    {valueLink}
                  </Link>
                ) : (
                  valueLink
                )}
              </DetailRow>
            ) : null}
            {(entry.verifierName || entry.ownerEmail) && (
              <DetailRow label="Measure owner">
                {[entry.verifierName, entry.ownerEmail].filter(Boolean).join(' · ')}
              </DetailRow>
            )}
          </Box>

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
                    {approval.label === 'Approved' && v ? formatMoney(v.net) : '—'}
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
                VALUE BREAKDOWN
              </Text>
              {[
                ['Gross', v.gross],
                [`After attribution ${inputs?.attribution ?? 100}%`, v.afterA],
                [`After realisation`, v.afterR],
                [`After confidence`, v.afterC],
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
          <Box
            fontSize="xs"
            fontFamily="mono"
            color="text.secondary"
            pl={3}
            borderLeft="2px solid"
            borderColor="border.subtle"
            mb={4}
          >
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
                {(status === 'Submitted' ||
                  status === 'Measure Owner Confirmed' ||
                  status === 'Finance Validated') && (
                  <>
                    <Button size="sm" colorScheme="primary" isLoading={busy} onClick={() => void advance()}>
                      Advance status
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      colorScheme="orange"
                      isLoading={busy}
                      onClick={() => void sendBack()}
                    >
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
                    <Button
                      size="sm"
                      colorScheme="red"
                      variant="outline"
                      isLoading={busy}
                      onClick={() => void check90(false)}
                    >
                      90 day: not holding
                    </Button>
                  </>
                )}
              </Stack>
            </>
          )}
        </DrawerBody>
        {isClaim && onDuplicate && (
          <DrawerFooter borderTopWidth="1px">
            <Button
              w="100%"
              colorScheme="primary"
              variant="outline"
              onClick={() => onDuplicate(entry)}
            >
              Duplicate for new impact
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  )
}
