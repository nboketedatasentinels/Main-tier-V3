/**
 * Learner-facing value register: org rate cards when the partner allows visibility.
 * Rates always drive claim valuation in the background whether figures are shown or not.
 */
import React, { useMemo } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Heading,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { formatMoney, type ImpactRateCard } from '@/config/impactValueEngine'
import { ImpactHelpButton } from '@/components/impact/ImpactHelpModal'
import type { ImpactHelpKey } from '@/config/impactHelp'

type Props = {
  rates: ImpactRateCard[]
  showFigures: boolean
  onHelp: (k: ImpactHelpKey) => void
}

export const ImpactRatesViewer: React.FC<Props> = ({ rates, showFigures, onHelp }) => {
  const orgRates = useMemo(
    () => rates.filter((r) => r.scope === 'Organisation' && (r as { status?: string }).status !== 'Draft'),
    [rates],
  )
  const published = orgRates.length
    ? orgRates
    : rates.filter((r) => r.scope === 'Organisation')

  return (
    <Stack spacing={4}>
      <Box>
        <Heading size="md" mb={1}>
          Value register
          <ImpactHelpButton k="rates" onOpen={onHelp} />
        </Heading>
        <Text fontSize="sm" color="text.secondary">
          Your organisation&apos;s standard rates for valuing improvements. Finance sets these;
          you never type money into a claim.
        </Text>
      </Box>

      {!showFigures ? (
        <Alert status="info" borderRadius="lg" variant="left-accent">
          <AlertIcon />
          <AlertDescription fontSize="sm">
            Your organisation keeps the dollar figures private. Claims still auto-calculate from
            these rates in the background. Ask your partner if you need the register visible.
          </AlertDescription>
        </Alert>
      ) : published.length === 0 ? (
        <Alert status="warning" borderRadius="lg" variant="left-accent">
          <AlertIcon />
          <AlertDescription fontSize="sm">
            No organisation rates published yet. Your partner or finance team needs to fill the
            value register before claims can use org-specific pricing.
          </AlertDescription>
        </Alert>
      ) : (
        <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl" overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Country</Th>
                <Th>Grade / role</Th>
                <Th isNumeric>Hourly</Th>
                <Th isNumeric>Margin / unit</Th>
                <Th isNumeric>Cost / defect</Th>
                <Th>Source</Th>
              </Tr>
            </Thead>
            <Tbody>
              {published.map((r) => (
                <Tr key={r.id}>
                  <Td>{r.country}</Td>
                  <Td>
                    <Text fontWeight="medium">{r.grade}</Text>
                    <Badge mt={1} fontSize="xs">
                      {r.scope}
                    </Badge>
                  </Td>
                  <Td isNumeric fontFamily="mono">
                    {formatMoney(r.hourly)}
                  </Td>
                  <Td isNumeric fontFamily="mono">
                    {formatMoney(r.margin)}
                  </Td>
                  <Td isNumeric fontFamily="mono">
                    {formatMoney(r.defect)}
                  </Td>
                  <Td>
                    <Text fontSize="xs" color="text.muted" noOfLines={2}>
                      {r.source || '-'}
                    </Text>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Stack>
  )
}
