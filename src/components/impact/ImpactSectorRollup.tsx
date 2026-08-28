/**
 * T4L admin-only rollup: verified claims by sector / waste / standard measure.
 * Ported from Desktop/T4L_Claim_Flow_v4.html `roll()`.
 */
import React, { useMemo } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Heading,
  Progress,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { CLAIM_FLOW_WASTES, presetOf } from '@/config/impactClaimFlowV4'
import { formatMoney } from '@/config/impactValueEngine'
import type { ImpactLogRecord } from '@/services/impactLogService'
import { ImpactHelpButton } from '@/components/impact/ImpactHelpModal'
import type { ImpactHelpKey } from '@/config/impactHelp'

type Props = {
  entries: ImpactLogRecord[]
  onHelp: (k: ImpactHelpKey) => void
}

function isVerified(e: ImpactLogRecord): boolean {
  const status = e.claimStatus || e.verificationStatus
  if (status === 'Recognized' || status === 'approved') return true
  const tier = Number(e.claim?.tier ?? 0)
  return tier >= 3 && (e.verificationStatus === 'approved' || e.claimStatus === 'Recognized')
}

function claimValue(e: ImpactLogRecord): number {
  return Number(e.usdValue || e.claim?.net || 0) || 0
}

function sectorOf(e: ImpactLogRecord): string {
  const fromClaim = String(e.claim?.industry || '').trim()
  if (fromClaim) return fromClaim
  return 'Unassigned sector'
}

function BarList({
  rows,
  color,
}: {
  rows: { label: string; value: number }[]
  color: string
}) {
  const mx = Math.max(...rows.map((r) => r.value), 1)
  if (!rows.length) {
    return (
      <Text fontSize="sm" color="text.secondary">
        No verified figures yet.
      </Text>
    )
  }
  return (
    <Stack spacing={2}>
      {rows.map((r) => (
        <Box
          key={r.label}
          display="grid"
          gridTemplateColumns={{ base: '1fr', sm: '150px 1fr 88px' }}
          gap={2}
          alignItems="center"
          fontSize="sm"
        >
          <Text noOfLines={2}>{r.label}</Text>
          <Progress
            value={(r.value / mx) * 100}
            size="sm"
            borderRadius="md"
            sx={{ '& > div': { bg: color } }}
            bg="blackAlpha.100"
          />
          <Text fontFamily="mono" textAlign={{ base: 'left', sm: 'right' }} fontSize="xs">
            {formatMoney(r.value)}
          </Text>
        </Box>
      ))}
    </Stack>
  )
}

function aggregate(map: Record<string, number>): { label: string; value: number }[] {
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

export const ImpactSectorRollup: React.FC<Props> = ({ entries, onHelp }) => {
  const claims = useMemo(
    () => entries.filter((e) => e.entryKind === 'claim' || e.categoryGroup === 'business'),
    [entries],
  )
  const verified = useMemo(() => claims.filter(isVerified), [claims])
  const unverifiedTotal = useMemo(
    () =>
      claims.filter((c) => !isVerified(c)).reduce((s, c) => s + Number(c.claim?.net || 0), 0),
    [claims],
  )

  const bySec = useMemo(() => {
    const m: Record<string, number> = {}
    verified.forEach((c) => {
      const k = sectorOf(c)
      m[k] = (m[k] || 0) + claimValue(c)
    })
    return aggregate(m)
  }, [verified])

  const byWaste = useMemo(() => {
    const m: Record<string, number> = {}
    verified
      .filter((c) => c.claim?.cat !== 'rev')
      .forEach((c) => {
        const wasteKey = String(c.claim?.waste || '')
        const label =
          CLAIM_FLOW_WASTES.find((w) => w.k === wasteKey)?.n ||
          String(c.businessActivity || 'Other')
        m[label] = (m[label] || 0) + claimValue(c)
      })
    return aggregate(m)
  }, [verified])

  const byPreset = useMemo(() => {
    const m: Record<string, number> = {}
    verified.forEach((c) => {
      const p = presetOf(String(c.claim?.presetId || ''))
      if (!p) return
      m[p.name] = (m[p.name] || 0) + claimValue(c)
    })
    return aggregate(m)
  }, [verified])

  const verifiedTotal = bySec.reduce((s, r) => s + r.value, 0)
  const mining = bySec.find((r) => /mining/i.test(r.label))?.value || 0
  const telecom = bySec.find((r) => /telecom/i.test(r.label))?.value || 0

  return (
    <Box p={5} border="1px solid" borderColor="border.subtle" rounded="xl" bg="surface.default">
      <Text fontSize="xs" color="brand.accent" fontWeight="bold" textTransform="uppercase" mb={1}>
        Verified only · T4L admin
      </Text>
      <Heading size="md" mb={2}>
        What this adds up to
        <ImpactHelpButton k="integrity" onOpen={onHelp} />
      </Heading>
      <Text fontSize="sm" color="text.secondary" mb={5} maxW="70ch">
        By sector is for T4L admin so we see how organisations are doing on the platform. Only
        figures checked by the client&apos;s own people and locked are quoted here. Claimed but
        unchecked numbers stay separate and never mix in.
      </Text>

      <Alert status="info" rounded="lg" mb={5}>
        <AlertIcon />
        <Box>
          <AlertTitle fontSize="sm">Platform rollup</AlertTitle>
          <AlertDescription fontSize="sm">
            Standard preset ids (for example WAIT-TASK) roll up across clients. Custom measures stay
            with the client and do not appear under &quot;By standard measure&quot;.
          </AlertDescription>
        </Box>
      </Alert>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={6}>
        <Box p={4} rounded="lg" bg="green.50" border="1px solid" borderColor="green.100">
          <Text fontSize="xs" color="text.secondary" mb={1}>
            Verified across all clients
          </Text>
          <Text fontSize="2xl" fontWeight="bold" color="green.700">
            {formatMoney(verifiedTotal)}
          </Text>
          <Text fontSize="xs" color="text.muted">
            a month · {verified.length} improvements · locked
          </Text>
        </Box>
        <Box p={4} rounded="lg" bg="orange.50" border="1px solid" borderColor="orange.100">
          <Text fontSize="xs" color="text.secondary" mb={1}>
            Claimed, not yet checked
          </Text>
          <Text fontSize="2xl" fontWeight="bold" color="orange.700">
            {formatMoney(unverifiedTotal)}
          </Text>
          <Text fontSize="xs" color="text.muted">
            {claims.length - verified.length} in progress · never quoted
          </Text>
        </Box>
        <Box p={4} rounded="lg" bg="purple.50" border="1px solid" borderColor="purple.100">
          <Text fontSize="xs" color="text.secondary" mb={1}>
            Standard measures used
          </Text>
          <Text fontSize="2xl" fontWeight="bold" color="purple.800">
            {byPreset.length}
          </Text>
          <Text fontSize="xs" color="text.muted">
            Only standard measures roll up
          </Text>
        </Box>
      </SimpleGrid>

      <Heading size="sm" mb={2}>
        By sector
      </Heading>
      <Box mb={6}>
        <BarList rows={bySec} color="#350e6f" />
      </Box>

      <Heading size="sm" mb={2}>
        By what was in the way
      </Heading>
      <Box mb={6}>
        <BarList rows={byWaste} color="#eab130" />
      </Box>

      <Heading size="sm" mb={2}>
        By standard measure
      </Heading>
      <Box mb={6}>
        <BarList rows={byPreset} color="#38a169" />
      </Box>

      <Alert status="success" rounded="lg" variant="left-accent">
        <AlertIcon />
        <AlertDescription fontSize="sm">
          What we can say today: verified savings of {formatMoney(mining)} a month in mining and{' '}
          {formatMoney(telecom)} a month in telecommunications, across {verified.length} improvements
          checked and locked by clients&apos; own finance teams.
        </AlertDescription>
      </Alert>
    </Box>
  )
}
