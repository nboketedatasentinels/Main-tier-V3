import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  differenceInHours,
  isValid,
  parseISO,
} from 'date-fns'
import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  Flex,
  HStack,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react'
import { EngagementChart } from '@/components/admin/EngagementChart'
import { RiskAnalysisCard, type DataWarning, type RiskLevel, type RiskReason } from '@/components/admin/RiskAnalysisCard'
import NudgeControlPanel from '@/components/partner/nudges/NudgeControlPanel'
import NudgeTemplateManager from '@/components/partner/nudges/NudgeTemplateManager'
import NudgeEffectivenessDashboard from '@/components/partner/nudges/NudgeEffectivenessDashboard'
import NudgeAutomationRules from '@/components/partner/nudges/NudgeAutomationRules'
import NudgeHistory from '@/components/partner/nudges/NudgeHistory'
import RealTimeEffectivenessMonitor from '@/components/partner/nudges/RealTimeEffectivenessMonitor'
import TemplatePerformanceAnalytics from '@/components/partner/nudges/TemplatePerformanceAnalytics'
import NudgeInsightsReportGenerator from '@/components/partner/nudges/NudgeInsightsReportGenerator'
import { getActiveNudgeTemplates } from '@/services/nudgeService'
import { useAuth } from '@/hooks/useAuth'
import type { PartnerUser } from '@/hooks/usePartnerDashboardData'
import type { PartnerInterventionSummary } from '@/hooks/partner/usePartnerInterventions'
import type { NudgeTemplateRecord } from '@/types/nudges'

interface AtRiskCommandPanelProps {
  engagementTrend: { label: string; value: number }[]
  riskLevelList: RiskLevel[]
  riskReasons: RiskReason[]
  dataQualityWarnings: DataWarning[]
  interventions: PartnerInterventionSummary[]
  atRiskUsers: PartnerUser[]
  onAction?: (action: string, caseId: string, additionalData?: any) => Promise<void>
}

import { AlertCircle, ArrowLeft, Clock, ShieldAlert, TrendingDown } from 'lucide-react'

export const AtRiskCommandPanel: React.FC<AtRiskCommandPanelProps> = ({
  engagementTrend,
  riskLevelList,
  riskReasons,
  dataQualityWarnings,
  interventions,
  atRiskUsers,
  onAction,
}) => {
  const { isSuperAdmin } = useAuth()
  const [activeTemplates, setActiveTemplates] = useState<NudgeTemplateRecord[]>([])
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const supportEmail = 'support@transformation4leaders.com'

  const loadTemplates = useCallback(async () => {
    setTemplateLoading(true)
    setTemplateLoadError(null)
    try {
      const templates = await getActiveNudgeTemplates()
      setActiveTemplates(templates)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to load nudge templates', error)
      setActiveTemplates([])
      setTemplateLoadError(
        `Nudge templates could not be loaded. Please confirm your Firebase configuration and Firestore access. (${message})`,
      )
    } finally {
      setTemplateLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  const selectedCase = interventions.find(i => i.id === selectedCaseId)

  const timeInState = useMemo(() => {
    if (!selectedCase?.statusChangedAt) return 'N/A'
    try {
      const date = parseISO(selectedCase.statusChangedAt)
      if (!isValid(date)) return 'N/A'
      return `${differenceInHours(new Date(), date)} hours`
    } catch {
      return 'N/A'
    }
  }, [selectedCase?.statusChangedAt])

  const nextEscalation = useMemo(() => {
    if (!selectedCase?.deadline) return 'N/A'
    try {
      const date = parseISO(selectedCase.deadline)
      if (!isValid(date)) return 'N/A'
      const diff = differenceInHours(date, new Date())
      return diff > 0 ? `${diff} hours` : 'Overdue'
    } catch {
      return 'N/A'
    }
  }, [selectedCase?.deadline])

  const handleCaseAction = async (action: string, additionalData?: any) => {
    if (!selectedCaseId || !onAction) return
    await onAction(action, selectedCaseId, additionalData)
  }

  const renderOverview = () => (
    <Stack spacing={8}>
      <VStack align="flex-start" spacing={1} mb={2}>
        <HStack spacing={3}>
          <Text fontSize="2xl" fontWeight="bold" color="brand.text">
            At-Risk Command Panel
          </Text>
          <Badge colorScheme="red" variant="solid" px={3} py={1} borderRadius="full">
            🔴 {interventions.filter(i => i.status === 'critical').length} Critical
          </Badge>
        </HStack>
        <Text color="brand.subtleText">
          Learners requiring immediate intervention
        </Text>
      </VStack>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <RiskAnalysisCard
            title="At-risk accounts"
            badgeLabel="Partner scoped"
            badgeColor="purple"
            levels={riskLevelList}
            reasons={riskReasons}
            warnings={dataQualityWarnings}
            scopeNote="Only assigned organizations are included"
          />
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center">
              <Text fontWeight="bold" color="brand.text">Active Intervention Cases</Text>
              <Badge colorScheme="purple">Action Required</Badge>
            </HStack>
            <Stack spacing={3}>
              {interventions.map(item => (
                <HStack
                  key={item.id}
                  justify="space-between"
                  p={4}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor={item.status === 'critical' ? 'red.200' : 'brand.border'}
                  bg={item.status === 'critical' ? 'red.50' : 'brand.accent'}
                  _hover={{ borderColor: 'brand.primary', shadow: 'sm' }}
                  cursor="pointer"
                  onClick={() => setSelectedCaseId(item.id)}
                >
                  <HStack spacing={4}>
                    <Box p={2} borderRadius="md" bg="white" color={item.status === 'critical' ? 'red.500' : 'purple.500'}>
                      {item.status === 'critical' ? <ShieldAlert size={20} /> : <AlertCircle size={20} />}
                    </Box>
                    <VStack align="flex-start" spacing={0}>
                      <HStack>
                        <Text fontWeight="bold">{item.name}</Text>
                        {item.status === 'critical' && <Badge colorScheme="red">Critical</Badge>}
                      </HStack>
                      <Text fontSize="sm" color="brand.subtleText">{item.target} • {item.reason}</Text>
                    </VStack>
                  </HStack>
                  <Button size="sm" colorScheme="purple" variant="outline" rightIcon={<ArrowLeft style={{ transform: 'rotate(180deg)' }} />}>
                    Manage Case
                  </Button>
                </HStack>
              ))}
              {interventions.length === 0 && (
                <Text color="brand.subtleText" textAlign="center" py={4}>No active intervention cases.</Text>
              )}
            </Stack>
          </Stack>
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={3}>
            <HStack justify="space-between" align="center">
              <Text fontWeight="bold" color="brand.text">Risk signals</Text>
              <Badge colorScheme="orange">Data quality</Badge>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={3}>
              {riskReasons.map(reason => (
                <Box
                  key={reason.label}
                  p={3}
                  borderRadius="md"
                  border="1px solid"
                  borderColor="brand.border"
                  bg="brand.accent"
                >
                  <HStack justify="space-between">
                    <Text fontWeight="semibold" color="brand.text">{reason.label}</Text>
                    <Badge colorScheme={reason.color}>{reason.count}</Badge>
                  </HStack>
                </Box>
              ))}
            </SimpleGrid>
            {dataQualityWarnings.map(warning => (
              <HStack
                key={warning.message}
                justify="space-between"
                p={3}
                borderRadius="md"
                bg="yellow.50"
                color="orange.700"
                border="1px solid"
                borderColor="yellow.200"
              >
                <Text fontSize="sm">{warning.message}</Text>
                <Badge colorScheme="orange">Review</Badge>
              </HStack>
            ))}
          </Stack>
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          {templateLoadError ? (
            <Stack
              spacing={3}
              p={4}
              mb={4}
              border="1px solid"
              borderColor="red.200"
              bg="red.50"
              borderRadius="lg"
            >
              <Text fontWeight="semibold" color="red.700">Nudge templates unavailable</Text>
              <Text fontSize="sm" color="red.700">
                {templateLoadError} If the issue persists, contact support at {supportEmail}.
              </Text>
              <HStack>
                <Button size="sm" colorScheme="red" onClick={() => void loadTemplates()} isLoading={templateLoading}>
                  Retry
                </Button>
                <Button size="sm" variant="outline" onClick={() => {}}>
                  Dismiss
                </Button>
              </HStack>
            </Stack>
          ) : null}
          <NudgeControlPanel users={atRiskUsers} templates={activeTemplates} />
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <NudgeTemplateManager />
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <NudgeAutomationRules />
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <RealTimeEffectivenessMonitor />
        </CardBody>
      </Card>

      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <NudgeEffectivenessDashboard />
        </CardBody>
      </Card>

      <Accordion allowToggle>
        <AccordionItem border="1px solid" borderColor="brand.border" borderRadius="lg" bg="white">
          <h2>
            <AccordionButton p={4}>
              <Box flex="1" textAlign="left" fontWeight="bold">
                Engagement & Context Data
              </Box>
              <AccordionIcon />
            </AccordionButton>
          </h2>
          <AccordionPanel pb={6}>
            <Stack spacing={6}>
              <EngagementChart
                data={engagementTrend}
                title="Engagement trends"
                subtitle="14-day activity across assigned organizations"
                valueLabel="Registrations"
              />
              <TemplatePerformanceAnalytics />
              <NudgeHistory />
              <NudgeInsightsReportGenerator />
            </Stack>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </Stack>
  )

  const renderCaseView = () => {
    if (!selectedCase) return null

    return (
      <Stack spacing={6}>
        {/* Sticky Header */}
        <Box
          position="sticky"
          top="-2px"
          zIndex={10}
          bg="white"
          p={4}
          borderRadius="lg"
          border="1px solid"
          borderColor="brand.border"
          boxShadow="md"
        >
          <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
            <HStack spacing={4}>
              <Button variant="ghost" size="sm" leftIcon={<ArrowLeft />} onClick={() => setSelectedCaseId(null)}>
                Back to Pipeline
              </Button>
              <Divider orientation="vertical" height="24px" />
              <VStack align="flex-start" spacing={0}>
                <Text fontWeight="bold" fontSize="lg">At-Risk Intervention Panel</Text>
                <Text fontSize="xs" color="brand.subtleText">Learner: {selectedCase.target}</Text>
              </VStack>
            </HStack>
            <HStack spacing={6}>
              <VStack align="center" spacing={0}>
                <Text fontSize="2xs" color="brand.subtleText" textTransform="uppercase" fontWeight="bold">Risk Level</Text>
                {selectedCase.status === 'escalated' ? (
                  <Badge bg="black" color="white" variant="solid" fontSize="sm">⚫ Escalated</Badge>
                ) : (
                  <Badge colorScheme="red" variant="solid" fontSize="sm">🔴 Critical</Badge>
                )}
              </VStack>
              <VStack align="center" spacing={0}>
                <Text fontSize="2xs" color="brand.subtleText" textTransform="uppercase" fontWeight="bold">Time in State</Text>
                <HStack spacing={1}>
                  <Clock size={12} />
                  <Text fontWeight="bold">{timeInState}</Text>
                </HStack>
              </VStack>
              <VStack align="center" spacing={0}>
                <Text fontSize="2xs" color="brand.subtleText" textTransform="uppercase" fontWeight="bold">Next Escalation</Text>
                <Text color={nextEscalation === 'Overdue' ? 'red.600' : 'red.500'} fontWeight="bold">
                  {nextEscalation}
                </Text>
              </VStack>
            </HStack>
          </Flex>
        </Box>

        {/* Escalation Banner (High priority if escalated) */}
        {selectedCase.status === 'escalated' && (
          <Box p={4} bg="black" borderRadius="lg" color="white" boxShadow="xl" border="2px solid" borderColor="gray.700">
            <HStack spacing={4} align="flex-start">
              <ShieldAlert size={24} color="#F56565" />
              <VStack align="flex-start" spacing={1}>
                <Text fontWeight="bold" fontSize="md">⚠️ This case has been escalated to Super Admin</Text>
                <Text fontSize="sm" color="gray.400">
                  Escalation triggered: {selectedCase.statusChangedAt ? new Date(selectedCase.statusChangedAt).toLocaleString() : 'Recently'} ({selectedCase.escalationReason || 'SLA Breach'})
                </Text>
                <Text fontSize="sm" color="gray.400">
                  Assigned Super Admin: {selectedCase.assignedAdminName || 'Governance Team'}
                </Text>
              </VStack>
            </HStack>
          </Box>
        )}

        {/* Primary Risk Summary (System Verdict) */}
        <Card bg="white" border="1px solid" borderColor="brand.border">
          <CardBody>
            <Stack spacing={4}>
              <HStack>
                <AlertCircle size={20} color="#E53E3E" />
                <Text fontWeight="bold" fontSize="md">Primary Risk Summary</Text>
              </HStack>
              <Box p={4} bg="red.50" borderRadius="md" borderLeft="4px solid" borderColor="red.500">
                <VStack align="flex-start" spacing={3}>
                  <Text fontWeight="bold" color="red.800">Why this learner is at risk:</Text>
                  <Stack spacing={2} w="full">
                    {(selectedCase?.riskVerdicts || ['Engagement below threshold']).map((verdict, idx) => (
                      <HStack key={idx} spacing={3}>
                        <Box w="6px" h="6px" borderRadius="full" bg="red.500" />
                        <Text fontSize="sm" color="red.700">{verdict}</Text>
                      </HStack>
                    ))}
                  </Stack>
                  <Badge colorScheme="red" variant="subtle" mt={2}>
                    System-validated risk state
                  </Badge>
                </VStack>
              </Box>
            </Stack>
          </CardBody>
        </Card>

        {/* Intervention Responsibility Panel (Required Action) */}
        <Card
          bg="white"
          border="1px solid"
          borderColor="brand.border"
          boxShadow="sm"
          opacity={selectedCase.status === 'escalated' ? 0.7 : 1}
          pointerEvents={selectedCase.status === 'escalated' ? 'none' : 'auto'}
        >
          <CardBody>
            <Stack spacing={4}>
              <HStack justify="space-between">
                <HStack spacing={3}>
                  <Box p={2} bg="purple.50" color="purple.500" borderRadius="md">
                    <TrendingDown size={20} />
                  </Box>
                  <VStack align="flex-start" spacing={0}>
                    <Text fontWeight="bold" fontSize="lg">Intervention Required</Text>
                    <Text fontSize="sm" color="brand.subtleText">Partner-owned action pipeline</Text>
                  </VStack>
                </HStack>
                <Badge colorScheme="orange" variant="outline" p={2} borderRadius="md">
                  Due in 24 hours
                </Badge>
              </HStack>

              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} p={4} bg="brand.accent" borderRadius="lg">
                <VStack align="flex-start" spacing={0}>
                  <Text fontSize="xs" color="brand.subtleText" textTransform="uppercase" fontWeight="bold">Action Type</Text>
                  <Text fontWeight="semibold">Mentor Check-in</Text>
                </VStack>
                <VStack align="flex-start" spacing={0}>
                  <Text fontSize="xs" color="brand.subtleText" textTransform="uppercase" fontWeight="bold">SLA Deadline</Text>
                  <Text fontWeight="semibold">
                    {selectedCase?.deadline ? new Date(selectedCase.deadline).toLocaleString() : 'Pending'}
                  </Text>
                </VStack>
                <VStack align="flex-start" spacing={0}>
                  <Text fontSize="xs" color="brand.subtleText" textTransform="uppercase" fontWeight="bold">Current Status</Text>
                  <Badge colorScheme="gray">Not Started</Badge>
                </VStack>
              </SimpleGrid>

              <HStack spacing={4} pt={2}>
                <Button
                  colorScheme="purple"
                  size="lg"
                  flex={1}
                  leftIcon={<ArrowLeft style={{ transform: 'rotate(180deg)' }} />}
                  isDisabled={selectedCase.status === 'escalated'}
                  onClick={() => handleCaseAction('start_intervention')}
                >
                  {selectedCase.status === 'escalated' ? 'Case Locked' : 'Start Intervention'}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  isDisabled={selectedCase.status === 'escalated'}
                  onClick={() => handleCaseAction('request_extension')}
                >
                  Request Extension
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  colorScheme="red"
                  leftIcon={<ShieldAlert size={18} />}
                  isDisabled={selectedCase.status === 'escalated'}
                  onClick={() => handleCaseAction('escalate_early')}
                >
                  Escalate Early
                </Button>
              </HStack>

              <Text fontSize="xs" color="brand.subtleText" textAlign="center">
                ❌ Partners cannot dismiss risk or downgrade severity manually.
              </Text>
            </Stack>
          </CardBody>
        </Card>

        {/* Super Admin Authority Panel */}
        {isSuperAdmin && (
          <Card bg="blue.50" border="1px solid" borderColor="blue.200" boxShadow="sm">
            <CardBody>
              <Stack spacing={4}>
                <HStack justify="space-between">
                  <HStack spacing={3}>
                    <Box p={2} bg="blue.500" color="white" borderRadius="md">
                      <ShieldAlert size={20} />
                    </Box>
                    <VStack align="flex-start" spacing={0}>
                      <Text fontWeight="bold" fontSize="lg">Super Admin Authority</Text>
                      <Text fontSize="sm" color="blue.700">Expanded governance controls</Text>
                    </VStack>
                  </HStack>
                  <Badge colorScheme="blue" variant="solid">Admin View</Badge>
                </HStack>

                <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={3}>
                  <Button size="sm" colorScheme="blue" onClick={() => handleCaseAction('admin_override')}>Override Plan</Button>
                  <Button size="sm" colorScheme="orange" onClick={() => handleCaseAction('admin_assign_mentor')}>Assign Senior Mentor</Button>
                  <Button size="sm" colorScheme="red" onClick={() => handleCaseAction('admin_suspend')}>Suspend Learner/Org</Button>
                  <Button size="sm" variant="outline" colorScheme="blue" onClick={() => handleCaseAction('admin_modify_threshold')}>Modify Thresholds</Button>
                </SimpleGrid>

                <HStack pt={2} justify="flex-end">
                  <Button size="sm" variant="ghost" colorScheme="blue" onClick={() => handleCaseAction('admin_audit_sla')}>Audit Partner Action SLA</Button>
                  <Button size="sm" variant="solid" colorScheme="green" onClick={() => handleCaseAction('admin_close')}>Close Case (Resolved)</Button>
                </HStack>
              </Stack>
            </CardBody>
          </Card>
        )}

        {/* Resolution Feedback Loop (Visible after resolution or escalation) */}
        {(selectedCase.status === 'escalated' || selectedCase.status === 'active') && (
          <Card bg="gray.50" border="1px dashed" borderColor="gray.300">
            <CardBody>
              <Stack spacing={4}>
                <Text fontWeight="bold" fontSize="md">Post-Escalation Feedback Loop</Text>
                <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                  <VStack align="flex-start" spacing={3}>
                    <Text fontSize="sm" fontWeight="bold">Resolution Summary</Text>
                    <Stack spacing={2} fontSize="sm">
                      <HStack><Text fontWeight="semibold">Root cause:</Text><Text>Systemic engagement drop</Text></HStack>
                      <HStack><Text fontWeight="semibold">Actions taken:</Text><Text>Senior mentor assigned</Text></HStack>
                      <HStack><Text fontWeight="semibold">Outcome:</Text><Text>Pending reassessment</Text></HStack>
                    </Stack>
                  </VStack>
                  <VStack align="flex-start" spacing={3}>
                    <Text fontSize="sm" fontWeight="bold">Partner Feedback Prompt</Text>
                    <Textarea
                      placeholder="What prevented earlier resolution for this learner?"
                      fontSize="sm"
                      bg="white"
                    />
                    <Button size="xs" colorScheme="purple">Submit Feedback</Button>
                  </VStack>
                </SimpleGrid>
              </Stack>
            </CardBody>
          </Card>
        )}

        {/* Expected Outcome & Next Steps */}
        <Card bg="white" border="1px solid" borderColor="brand.border">
          <CardBody>
            <Stack spacing={3}>
              <Text fontWeight="bold">Expected Outcome</Text>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                <Box p={3} bg="green.50" borderRadius="md">
                  <Text fontSize="xs" fontWeight="bold" color="green.700">Target</Text>
                  <Text fontSize="sm">Engagement score ≥ 7.5</Text>
                </Box>
                <Box p={3} bg="blue.50" borderRadius="md">
                  <Text fontSize="xs" fontWeight="bold" color="blue.700">Deadline</Text>
                  <Text fontSize="sm">Reassessment in 7 days</Text>
                </Box>
                <Box p={3} bg="purple.50" borderRadius="md">
                  <Text fontSize="xs" fontWeight="bold" color="purple.700">Failure Mode</Text>
                  <Text fontSize="sm">Auto-escalation if no change</Text>
                </Box>
              </SimpleGrid>
            </Stack>
          </CardBody>
        </Card>

        {/* Case Context & History (Progressive Disclosure) */}
        <Accordion allowMultiple defaultIndex={[0]}>
          <AccordionItem border="1px solid" borderColor="brand.border" borderRadius="lg" bg="white" mb={4}>
            <h2>
              <AccordionButton p={4}>
                <Box flex="1" textAlign="left" fontWeight="bold">
                  Learner Activity Context
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <Stack spacing={6}>
                <EngagementChart
                  data={engagementTrend}
                  title="Individual engagement trend"
                  subtitle="Activity trend for selected learner"
                  valueLabel="Actions"
                />
              </Stack>
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem border="1px solid" borderColor="brand.border" borderRadius="lg" bg="white">
            <h2>
              <AccordionButton p={4}>
                <Box flex="1" textAlign="left" fontWeight="bold">
                  Full Case Audit Log
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <Stack spacing={3} fontSize="sm">
                <HStack justify="space-between">
                  <Text color="brand.subtleText">System Flagged Risk</Text>
                  <Text>18 hours ago</Text>
                </HStack>
                <Divider />
                <HStack justify="space-between">
                  <Text color="brand.subtleText">Last Partner Action</Text>
                  <Text>None recorded</Text>
                </HStack>
                <Divider />
                <HStack justify="space-between">
                  <Text color="brand.subtleText">SLA Tracking Started</Text>
                  <Text>18 hours ago</Text>
                </HStack>
              </Stack>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>

      </Stack>
    )
  }

  return selectedCaseId ? renderCaseView() : renderOverview()
}
