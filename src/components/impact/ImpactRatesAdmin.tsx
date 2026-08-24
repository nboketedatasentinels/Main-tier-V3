import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import {
  IMPACT_INDUSTRIES,
  IMPACT_RATE_LIB,
  formatMoney,
  rateOf,
} from '@/config/impactValueEngine'
import {
  deleteImpactValueRate,
  listImpactValueRates,
  publishImpactValueRate,
  upsertImpactValueRate,
  type ImpactValueRateRow,
} from '@/services/impactRatesService'
import { ImpactHelpButton } from '@/components/impact/ImpactHelpModal'
import type { ImpactHelpKey } from '@/config/impactHelp'

type Props = {
  companyId?: string | null
  userId?: string
  onHelp: (k: ImpactHelpKey) => void
  onRatesChanged: (rates: ImpactValueRateRow[]) => void
}

export const ImpactRatesAdmin: React.FC<Props> = ({
  companyId,
  userId,
  onHelp,
  onRatesChanged,
}) => {
  const toast = useToast()
  const [rates, setRates] = useState<ImpactValueRateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [industry, setIndustry] = useState<string>('mining')
  const [showToLearners, setShowToLearners] = useState(false)
  const [calc, setCalc] = useState({ before: 6, after: 1.5, per: 12, rateId: '' })
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    setLoading(true)
    try {
      const rows = await listImpactValueRates(companyId)
      setRates(rows)
      onRatesChanged(rows)
      if (!calc.rateId && rows[0]) setCalc((c) => ({ ...c, rateId: rows[0].id }))
    } catch (err) {
      toast({
        status: 'error',
        title: 'Could not load rates',
        description: err instanceof Error ? err.message : 'Try again',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const orgRates = rates.filter((r) => r.scope === 'Organisation')
  const globRates = rates.filter((r) => r.scope === 'Global benchmark')
  const ind = IMPACT_INDUSTRIES.find((i) => i.k === industry) || IMPACT_INDUSTRIES[0]

  const calcOut = useMemo(() => {
    const r = rateOf(calc.rateId || orgRates[0]?.id || 'R2', rates)
    const saved = Math.max(0, calc.before - calc.after)
    const monthly = saved * calc.per
    const money = monthly * r.hourly
    return { saved, monthly, money, annual: money * 12, r }
  }, [calc, rates, orgRates])

  const addRole = async (grade: string) => {
    setBusy(true)
    try {
      await upsertImpactValueRate({
        companyId,
        status: 'Draft',
        scope: 'Organisation',
        country: 'Botswana',
        grade,
        annualCost: 0,
        hours: 1880,
        margin: 0,
        defect: 0,
        source: `Added from ${ind.n} role list`,
        createdBy: userId,
      })
      await reload()
    } catch (err) {
      toast({
        status: 'error',
        title: 'Could not add grade',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const saveRow = async (row: ImpactValueRateRow, patch: Partial<ImpactValueRateRow>) => {
    setBusy(true)
    try {
      await upsertImpactValueRate({
        id: row.id,
        companyId: row.companyId ?? companyId,
        status: 'Draft',
        scope: row.scope,
        country: patch.country ?? row.country,
        grade: patch.grade ?? row.grade,
        annualCost: patch.annualCost ?? row.annualCost,
        hours: patch.hours ?? row.hours,
        margin: patch.margin ?? row.margin,
        defect: patch.defect ?? row.defect,
        source: 'Edited by programme administrator',
        approvedBy: 'Re-approval needed',
        createdBy: userId,
      })
      await reload()
    } catch (err) {
      toast({
        status: 'error',
        title: 'Could not save',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack spacing={5}>
      <Box p={4} border="1px solid" borderColor="purple.100" bg="purple.50" rounded="xl">
        <Text fontSize="xs" color="brand.accent" fontWeight="bold" textTransform="uppercase" mb={1}>
          Administrator screen
        </Text>
        <Heading size="md" mb={1}>
          Value rates
          <ImpactHelpButton k="rates" onOpen={onHelp} />
        </Heading>
        <Text fontSize="sm" color="text.secondary" mb={3}>
          Practitioners never type money. Finance returns cost-of-employment figures once; the
          platform derives hourly rates.
        </Text>
        <Checkbox isChecked={showToLearners} onChange={(e) => setShowToLearners(e.target.checked)}>
          Show rate figures to practitioners (off by default)
        </Checkbox>
      </Box>

      <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl">
        <Heading size="sm" mb={2}>
          What kind of rate do you need
        </Heading>
        <Box overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Improvement</Th>
                <Th>Rate needed</Th>
                <Th>Finance supplies</Th>
              </Tr>
            </Thead>
            <Tbody>
              {IMPACT_RATE_LIB.map((l) => (
                <Tr key={l.pat}>
                  <Td fontWeight="medium">{l.pat}</Td>
                  <Td>{l.rate}</Td>
                  <Td color="text.secondary">{l.needs}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>

      <Box p={4} border="1px solid" borderColor="yellow.200" bg="orange.50" rounded="xl">
        <Heading size="sm" mb={2}>
          Try it · manual → digital report
          <ImpactHelpButton k="annual" onOpen={onHelp} />
        </Heading>
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={3}>
          <FormControl>
            <FormLabel fontSize="xs">Hours before</FormLabel>
            <Input
              type="number"
              size="sm"
              value={calc.before}
              onChange={(e) => setCalc((c) => ({ ...c, before: Number(e.target.value) }))}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs">Hours after</FormLabel>
            <Input
              type="number"
              size="sm"
              value={calc.after}
              onChange={(e) => setCalc((c) => ({ ...c, after: Number(e.target.value) }))}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs">Times / month</FormLabel>
            <Input
              type="number"
              size="sm"
              value={calc.per}
              onChange={(e) => setCalc((c) => ({ ...c, per: Number(e.target.value) }))}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs">Whose time</FormLabel>
            <Select
              size="sm"
              value={calc.rateId}
              onChange={(e) => setCalc((c) => ({ ...c, rateId: e.target.value }))}
            >
              {orgRates.concat(globRates).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.country} · {r.grade}
                </option>
              ))}
            </Select>
          </FormControl>
        </SimpleGrid>
        <SimpleGrid columns={4} spacing={3}>
          {[
            ['Saved each time', `${calcOut.saved.toFixed(1)} hrs`],
            ['Hours / month', `${calcOut.monthly.toFixed(1)} hrs`],
            ['Value / month', formatMoney(calcOut.money)],
            ['Year run-rate', formatMoney(calcOut.annual)],
          ].map(([l, v]) => (
            <Box key={l} p={3} bg="white" rounded="lg" border="1px solid" borderColor="border.subtle">
              <Text fontSize="xs" color="text.muted">
                {l}
              </Text>
              <Text fontWeight="bold">{v}</Text>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl">
        <Heading size="sm" mb={2}>
          Whose time are we pricing
        </Heading>
        <FormControl maxW="360px" mb={3}>
          <FormLabel fontSize="xs">Industry</FormLabel>
          <Select size="sm" value={industry} onChange={(e) => setIndustry(e.target.value)}>
            {IMPACT_INDUSTRIES.map((i) => (
              <option key={i.k} value={i.k}>
                {i.n}
              </option>
            ))}
          </Select>
          <FormHelperText>Typical unit: {ind.unit}</FormHelperText>
        </FormControl>
        <Wrap>
          {ind.roles.map((role) => {
            const have = orgRates.some((r) => r.grade === role)
            return (
              <WrapItem key={role}>
                <Button
                  size="sm"
                  variant={have ? 'solid' : 'outline'}
                  colorScheme={have ? 'primary' : undefined}
                  isDisabled={have || busy || loading}
                  onClick={() => void addRole(role)}
                >
                  {role}
                  {have ? ' ✓' : ''}
                </Button>
              </WrapItem>
            )
          })}
        </Wrap>
        <Button mt={3} size="sm" variant="outline" onClick={() => void addRole('Name this grade')}>
          Add blank grade row
        </Button>
      </Box>

      <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl">
        <Heading size="sm" mb={3}>
          Grade bands
        </Heading>
        <Box overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Status</Th>
                <Th>Country</Th>
                <Th>Grade</Th>
                <Th isNumeric>Annual cost</Th>
                <Th isNumeric>Hours</Th>
                <Th isNumeric>Hourly</Th>
                <Th isNumeric>Margin</Th>
                <Th isNumeric>Per item</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {orgRates.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <Badge colorScheme={r.status === 'Published' ? 'green' : 'yellow'}>{r.status}</Badge>
                  </Td>
                  <Td>
                    <Input
                      size="xs"
                      defaultValue={r.country}
                      onBlur={(e) => void saveRow(r, { country: e.target.value })}
                    />
                  </Td>
                  <Td>
                    <Input
                      size="xs"
                      defaultValue={r.grade}
                      onBlur={(e) => void saveRow(r, { grade: e.target.value })}
                    />
                  </Td>
                  <Td isNumeric>
                    <Input
                      size="xs"
                      type="number"
                      defaultValue={r.annualCost}
                      onBlur={(e) => void saveRow(r, { annualCost: Number(e.target.value) })}
                    />
                  </Td>
                  <Td isNumeric>
                    <Input
                      size="xs"
                      type="number"
                      defaultValue={r.hours}
                      onBlur={(e) => void saveRow(r, { hours: Number(e.target.value) })}
                    />
                  </Td>
                  <Td isNumeric>
                    <Text fontWeight="bold">
                      {showToLearners || true ? `$${r.hourly.toFixed(2)}` : '•••'}
                    </Text>
                  </Td>
                  <Td isNumeric>
                    <Input
                      size="xs"
                      type="number"
                      defaultValue={r.margin}
                      onBlur={(e) => void saveRow(r, { margin: Number(e.target.value) })}
                    />
                  </Td>
                  <Td isNumeric>
                    <Input
                      size="xs"
                      type="number"
                      defaultValue={r.defect}
                      onBlur={(e) => void saveRow(r, { defect: Number(e.target.value) })}
                    />
                  </Td>
                  <Td>
                    <HStack>
                      {r.status === 'Draft' && (
                        <Button
                          size="xs"
                          colorScheme="primary"
                          isLoading={busy}
                          onClick={() =>
                            void publishImpactValueRate(r.id).then(() => reload())
                          }
                        >
                          Publish
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() =>
                          void deleteImpactValueRate(r.id)
                            .then(() => reload())
                            .catch((err) =>
                              toast({
                                status: 'error',
                                title: err instanceof Error ? err.message : 'Delete failed',
                              }),
                            )
                        }
                      >
                        Remove
                      </Button>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
        {orgRates.length === 0 && !loading && (
          <Alert status="info" mt={3} rounded="md">
            <AlertIcon />
            <AlertDescription fontSize="sm">
              No organisation rates yet. Add roles from the industry list, or apply migration 0074
              and publish grades finance returned.
            </AlertDescription>
          </Alert>
        )}
      </Box>

      <Box p={4} border="1px solid" borderColor="border.subtle" rounded="xl">
        <Heading size="sm" mb={2}>
          Global benchmarks (indicative)
        </Heading>
        <Stack spacing={1}>
          {globRates.map((r) => (
            <Flex key={r.id} justify="space-between" fontSize="sm">
              <Text>
                {r.country} · {r.grade}
              </Text>
              <Text fontFamily="mono">${r.hourly}/hr</Text>
            </Flex>
          ))}
        </Stack>
        <Text fontSize="xs" color="text.secondary" mt={2}>
          Used at Tier 2 until a country/grade rate is published.
        </Text>
      </Box>
    </Stack>
  )
}
