import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Button,
  Card,
  CardBody,
  Checkbox,
  Collapse,
  Divider,
  Flex,
  HStack,
  Icon,
  Stack,
  Text,
  Textarea,
  VStack,
  Badge,
  SimpleGrid,
  useToast,
  Progress,
} from '@chakra-ui/react'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  MessageSquare,
  Phone,
  ShieldAlert,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  History,
  LayoutDashboard,
} from 'lucide-react'
import { parseISO, isValid, differenceInHours } from 'date-fns'
import type { PartnerInterventionSummary } from '@/hooks/partner/usePartnerInterventions'
import { EngagementChart } from '@/components/admin/EngagementChart'

interface AtRiskInterventionFlowProps {
  intervention: PartnerInterventionSummary
  engagementTrend: { label: string; value: number }[]
  onAction: (action: string, caseId: string, additionalData?: Record<string, unknown>) => Promise<void>
  onBack: () => void
  isSuperAdmin?: boolean
}

type DecisionType = 'intervention' | 'escalate' | 'extension' | null
type ExecutionState = 'idle' | 'in_progress' | 'completing' | 'completed'
type OutcomeType = 'improved' | 'no_change' | 'worsened' | null

export const AtRiskInterventionFlow: React.FC<AtRiskInterventionFlowProps> = ({
  intervention,
  engagementTrend,
  onAction,
  onBack,
  isSuperAdmin = false,
}) => {
  const toast = useToast()
  const [decision, setDecision] = useState<DecisionType>(null)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [executionState, setExecutionState] = useState<ExecutionState>('idle')
  const [outcome, setOutcome] = useState<OutcomeType>(null)
  const [isContextExpanded, setIsContextExpanded] = useState(false)
  const [extensionReason, setExtensionReason] = useState('')
  const [escalationReason, setEscalationReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Real-time countdown for escalation
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const timeInState = useMemo(() => {
    if (!intervention.statusChangedAt) return 'N/A'
    try {
      const date = parseISO(intervention.statusChangedAt)
      if (!isValid(date)) return 'N/A'
      return `${differenceInHours(now, date)}h`
    } catch {
      return 'N/A'
    }
  }, [intervention.statusChangedAt, now])

  const nextEscalation = useMemo(() => {
    if (!intervention.deadline) return { label: 'N/A', isOverdue: false }
    try {
      const date = parseISO(intervention.deadline)
      if (!isValid(date)) return { label: 'N/A', isOverdue: false }
      const diff = differenceInHours(date, now)
      return {
        label: diff > 0 ? `${diff}h` : 'Overdue',
        isOverdue: diff <= 0,
        hours: diff
      }
    } catch {
      return { label: 'N/A', isOverdue: false }
    }
  }, [intervention.deadline, now])

  const isEscalated = intervention.status === 'escalated'

  const handleConfirmDecision = async () => {
    if (!decision) return
    setIsLoading(true)
    try {
      if (decision === 'intervention') {
        await onAction('start_intervention', intervention.id)
        setExecutionState('in_progress')
      } else if (decision === 'escalate') {
        if (!escalationReason) {
          toast({ title: 'Reason required', description: 'Please provide a reason for escalation', status: 'warning' })
          setIsLoading(false)
          return
        }
        await onAction('escalate_now', intervention.id, { reason: escalationReason })
      } else if (decision === 'extension') {
        if (!extensionReason) {
          toast({ title: 'Reason required', description: 'Please provide a reason for extension', status: 'warning' })
          setIsLoading(false)
          return
        }
        await onAction('request_extension', intervention.id, { reason: extensionReason })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompleteIntervention = async () => {
    if (!outcome) {
      toast({ title: 'Outcome required', description: 'Please select an outcome to complete', status: 'warning' })
      return
    }
    setIsLoading(true)
    try {
      await onAction('complete_intervention', intervention.id, { outcome })
      setExecutionState('completed')
      toast({ title: 'Intervention completed', status: 'success' })
    } finally {
      setIsLoading(false)
    }
  }

  // --- RENDERING COMPONENTS ---

  const StickyHeader = (
    <Box
      position="sticky"
      top="-2px"
      zIndex={100}
      bg="white"
      p={4}
      borderRadius="lg"
      border="1px solid"
      borderColor="red.200"
      boxShadow="lg"
      mb={6}
    >
      <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
        <VStack align="flex-start" spacing={0}>
          <HStack spacing={2}>
            <Text color="red.600" fontWeight="extrabold" fontSize="sm" letterSpacing="wider">
              🔴 CRITICAL RISK — ACTION REQUIRED
            </Text>
          </HStack>
          <Text fontWeight="bold" fontSize="lg">Learner: {intervention.target}</Text>
          <Text fontSize="xs" color="brand.subtleText">Organization: {intervention.organizationCode || 'N/A'}</Text>
        </VStack>

        <HStack spacing={8}>
          <VStack align="center" spacing={0}>
            <Text fontSize="2xs" color="brand.subtleText" textTransform="uppercase" fontWeight="bold">Time in state</Text>
            <Text fontWeight="bold" fontSize="md">{timeInState}</Text>
          </VStack>
          <VStack align="center" spacing={0}>
            <Text fontSize="2xs" color="brand.subtleText" textTransform="uppercase" fontWeight="bold">Escalates in</Text>
            <HStack spacing={1}>
              <Clock
                size={14}
                color={
                  nextEscalation.isOverdue
                    ? 'var(--chakra-colors-danger-DEFAULT)'
                    : 'var(--chakra-colors-accent-warning)'
                }
              />
              <Text color={nextEscalation.isOverdue ? 'red.600' : 'red.500'} fontWeight="bold" fontSize="md">
                {nextEscalation.label}
              </Text>
            </HStack>
          </VStack>
          <VStack align="center" spacing={0}>
            <Text fontSize="2xs" color="brand.subtleText" textTransform="uppercase" fontWeight="bold">Owner</Text>
            <Text fontWeight="bold" fontSize="md">You</Text>
          </VStack>
        </HStack>

        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft />} onClick={onBack}>
          Back
        </Button>
      </Flex>
    </Box>
  )

  const SystemVerdict = (
    <Card bg="white" border="1px solid" borderColor="brand.border" mb={6}>
      <CardBody>
        <Stack spacing={4}>
          <HStack>
            <AlertCircle size={20} color="var(--chakra-colors-danger-DEFAULT)" />
            <Text fontWeight="bold" fontSize="md">WHY THIS LEARNER IS AT RISK</Text>
            <Badge colorScheme="green" variant="subtle" ml="auto">
              ✔ System-validated risk assessment
            </Badge>
          </HStack>
          <Box p={4} bg="red.50" borderRadius="md" borderLeft="4px solid" borderColor="red.500">
            <VStack align="flex-start" spacing={3}>
              <Stack spacing={2} w="full">
                {(intervention.riskVerdicts || ['Engagement below threshold']).map((verdict, idx) => (
                  <HStack key={idx} spacing={3}>
                    <Box w="6px" h="6px" borderRadius="full" bg="red.500" />
                    <Text fontSize="sm" color="red.700" fontWeight="medium">{verdict}</Text>
                  </HStack>
                ))}
              </Stack>
            </VStack>
          </Box>
        </Stack>
      </CardBody>
    </Card>
  )

  const RequiredDecision = (
    <Card
      bg="white"
      border="2px solid"
      borderColor={decision ? 'brand.primary' : 'orange.300'}
      mb={6}
      boxShadow={decision ? 'none' : '0 0 15px rgba(251, 146, 60, 0.2)'}
    >
      <CardBody>
        <Stack spacing={6}>
          <VStack align="flex-start" spacing={1}>
            <Text fontWeight="black" fontSize="lg" color="brand.text">YOU MUST CHOOSE ONE ACTION</Text>
            <Text fontSize="sm" color="brand.subtleText">Page is locked until a selection is made</Text>
          </VStack>

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <Box
              p={5}
              borderRadius="xl"
              border="2px solid"
              borderColor={decision === 'intervention' ? 'brand.primary' : 'brand.border'}
              bg={decision === 'intervention' ? 'purple.50' : 'white'}
              cursor="pointer"
              onClick={() => { setDecision('intervention'); setIsConfirmed(false); }}
              transition="all 0.2s"
              _hover={{ borderColor: 'brand.primary' }}
              position="relative"
            >
              {decision === 'intervention' && (
                <Badge colorScheme="purple" position="absolute" top={-3} left={4}>SELECTED</Badge>
              )}
              <VStack align="flex-start" spacing={3}>
                <VStack align="flex-start" spacing={0}>
                  <Text fontWeight="bold" fontSize="md">Option A — Start Intervention</Text>
                  <Text fontSize="xs" color="green.600" fontWeight="bold">Recommended by system</Text>
                </VStack>
                <Divider />
                <Stack spacing={1} fontSize="xs" color="brand.subtleText">
                  <Text>• Intervention type: Mentor check-in</Text>
                  <Text>• Expected duration: 15–30 mins</Text>
                  <Text>• Due within: 24 hours</Text>
                </Stack>
                <Button size="sm" colorScheme="purple" w="full" variant={decision === 'intervention' ? 'solid' : 'outline'}>
                  Select Option A
                </Button>
              </VStack>
            </Box>

            <Box
              p={5}
              borderRadius="xl"
              border="2px solid"
              borderColor={decision === 'escalate' ? 'red.500' : 'brand.border'}
              bg={decision === 'escalate' ? 'red.50' : 'white'}
              cursor="pointer"
              onClick={() => { setDecision('escalate'); setIsConfirmed(false); }}
              transition="all 0.2s"
              _hover={{ borderColor: 'red.500' }}
              position="relative"
            >
              {decision === 'escalate' && (
                <Badge colorScheme="red" position="absolute" top={-3} left={4} variant="solid">SELECTED</Badge>
              )}
              <VStack align="flex-start" spacing={3}>
                <VStack align="flex-start" spacing={0}>
                  <Text fontWeight="bold" fontSize="md">Option B — Escalate to Admin</Text>
                  <Text fontSize="xs" color="brand.subtleText">Use if blocked or unavailable</Text>
                </VStack>
                <Divider />
                <Stack spacing={1} fontSize="xs" color="brand.subtleText">
                  <Text>• Immediate handoff</Text>
                  <Text>• Partner actions lock</Text>
                  <Text>• Requires valid reason</Text>
                </Stack>
                <Button size="sm" colorScheme="red" w="full" variant={decision === 'escalate' ? 'solid' : 'outline'}>
                  Select Option B
                </Button>
              </VStack>
            </Box>

            <Box
              p={5}
              borderRadius="xl"
              border="2px solid"
              borderColor={decision === 'extension' ? 'orange.500' : 'brand.border'}
              bg={decision === 'extension' ? 'orange.50' : 'white'}
              cursor="pointer"
              onClick={() => { setDecision('extension'); setIsConfirmed(false); }}
              transition="all 0.2s"
              _hover={{ borderColor: 'orange.500' }}
              position="relative"
            >
              {decision === 'extension' && (
                <Badge colorScheme="orange" position="absolute" top={-3} left={4} variant="solid">SELECTED</Badge>
              )}
              <VStack align="flex-start" spacing={3}>
                <VStack align="flex-start" spacing={0}>
                  <Text fontWeight="bold" fontSize="md">Option C — Request Extension</Text>
                  <Text fontSize="xs" color="brand.subtleText">Controlled, logged request</Text>
                </VStack>
                <Divider />
                <Stack spacing={1} fontSize="xs" color="brand.subtleText">
                  <Text>• Max: 24 hours</Text>
                  <Text>• Requires justification</Text>
                  <Text>• Counts against SLA score</Text>
                </Stack>
                <Button size="sm" colorScheme="orange" w="full" variant={decision === 'extension' ? 'solid' : 'outline'}>
                  Select Option C
                </Button>
              </VStack>
            </Box>
          </SimpleGrid>

          {decision && (
            <Box p={6} bg="gray.50" borderRadius="lg" border="1px dashed" borderColor="brand.border">
              <Stack spacing={4}>
                <Text fontWeight="bold">DECISION CONFIRMATION</Text>
                {decision === 'escalate' && (
                  <Textarea
                    placeholder="Provide reason for escalation..."
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    bg="white"
                  />
                )}
                {decision === 'extension' && (
                  <Textarea
                    placeholder="Justify extension request..."
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                    bg="white"
                  />
                )}
                <Checkbox
                  colorScheme="purple"
                  isChecked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                >
                  <Text fontSize="sm" fontWeight="medium">
                    I acknowledge responsibility for this learner’s outcome within the defined SLA.
                  </Text>
                </Checkbox>
                <Button
                  colorScheme="purple"
                  size="lg"
                  isDisabled={!isConfirmed || isLoading}
                  isLoading={isLoading}
                  onClick={handleConfirmDecision}
                >
                  Confirm & Proceed
                </Button>
              </Stack>
            </Box>
          )}
        </Stack>
      </CardBody>
    </Card>
  )

  const ContextSections = (
    <Box mb={6}>
      <Button
        variant="ghost"
        rightIcon={isContextExpanded ? <ChevronUp /> : <ChevronDown />}
        onClick={() => setIsContextExpanded(!isContextExpanded)}
        mb={2}
        size="sm"
      >
        {isContextExpanded ? 'Hide context' : 'View context (Activity & History)'}
      </Button>
      <Collapse in={isContextExpanded || executionState !== 'idle'}>
        <Stack spacing={4}>
          <Card bg="white" border="1px solid" borderColor="brand.border">
            <CardBody>
              <Stack spacing={4}>
                <HStack>
                  <LayoutDashboard size={18} />
                  <Text fontWeight="bold">Engagement Trend</Text>
                </HStack>
                <EngagementChart
                  data={engagementTrend}
                  title="Engagement trend (annotated)"
                  subtitle="Activity trend for selected learner"
                  valueLabel="Actions"
                />
              </Stack>
            </CardBody>
          </Card>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <Card bg="white" border="1px solid" borderColor="brand.border">
              <CardBody>
                <VStack align="flex-start" spacing={3}>
                  <HStack>
                    <History size={18} />
                    <Text fontWeight="bold">Previous Interventions</Text>
                  </HStack>
                  <Text fontSize="sm" color="brand.subtleText">No previous interventions recorded for this learner.</Text>
                </VStack>
              </CardBody>
            </Card>
            <Card bg="white" border="1px solid" borderColor="brand.border">
              <CardBody>
                <VStack align="flex-start" spacing={3}>
                  <HStack>
                    <MessageSquare size={18} />
                    <Text fontWeight="bold">Notes & History</Text>
                  </HStack>
                  <Text fontSize="sm" color="brand.subtleText">System Flagged Risk: {timeInState} ago</Text>
                  <Divider />
                  <Text fontSize="sm" color="brand.subtleText">Initial Case Discovery</Text>
                </VStack>
              </CardBody>
            </Card>
          </SimpleGrid>
        </Stack>
      </Collapse>
    </Box>
  )

  const ExecutionMode = (
    <Card bg="purple.50" border="2px solid" borderColor="brand.primary" mb={6} boxShadow="xl">
      <CardBody>
        <Stack spacing={6}>
          <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} wrap="wrap" gap={3}>
            <VStack align="flex-start" spacing={0}>
              <Text fontWeight="black" fontSize="xl" color="brand.text">ACTIVE INTERVENTION MODE</Text>
              <HStack wrap="wrap">
                <Badge colorScheme="purple">In Progress</Badge>
                <Text fontSize="sm" color="brand.subtleText">SLA expires in {nextEscalation.label}</Text>
              </HStack>
            </VStack>
            <Box textAlign={{ base: 'left', md: 'right' }} w={{ base: 'full', md: 'auto' }}>
              <Text fontSize="2xs" fontWeight="bold" color="brand.subtleText" textTransform="uppercase">Progress</Text>
              <Progress value={40} colorScheme="purple" w={{ base: 'full', md: '150px' }} borderRadius="full" size="sm" mt={1} />
            </Box>
          </Flex>

          <Box p={6} bg="white" borderRadius="xl" border="1px solid" borderColor="brand.border">
            <Stack spacing={4}>
              <Text fontWeight="bold" fontSize="md">Required next steps:</Text>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                <Button variant="outline" leftIcon={<Phone size={18} />} colorScheme="purple">Schedule Call</Button>
                <Button variant="outline" leftIcon={<MessageSquare size={18} />} colorScheme="purple">Send Message</Button>
                <Button variant="outline" leftIcon={<CheckCircle2 size={18} />} colorScheme="purple">Log Outcome</Button>
              </SimpleGrid>
            </Stack>
          </Box>

          <Box p={6} bg="white" borderRadius="xl" border="1px solid" borderColor="brand.border">
            <Stack spacing={4}>
              <Text fontWeight="bold" fontSize="md">Select Intervention Outcome:</Text>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                <Box
                  p={4}
                  borderRadius="lg"
                  border="2px solid"
                  borderColor={outcome === 'improved' ? 'green.500' : 'brand.border'}
                  bg={outcome === 'improved' ? 'green.50' : 'white'}
                  cursor="pointer"
                  onClick={() => setOutcome('improved')}
                  textAlign="center"
                >
                  <Text fontWeight="bold" color="green.700">✅ Improved</Text>
                </Box>
                <Box
                  p={4}
                  borderRadius="lg"
                  border="2px solid"
                  borderColor={outcome === 'no_change' ? 'orange.500' : 'brand.border'}
                  bg={outcome === 'no_change' ? 'orange.50' : 'white'}
                  cursor="pointer"
                  onClick={() => setOutcome('no_change')}
                  textAlign="center"
                >
                  <Text fontWeight="bold" color="orange.700">⚠️ No change</Text>
                </Box>
                <Box
                  p={4}
                  borderRadius="lg"
                  border="2px solid"
                  borderColor={outcome === 'worsened' ? 'red.500' : 'brand.border'}
                  bg={outcome === 'worsened' ? 'red.50' : 'white'}
                  cursor="pointer"
                  onClick={() => setOutcome('worsened')}
                  textAlign="center"
                >
                  <Text fontWeight="bold" color="red.700">❌ Worsened</Text>
                </Box>
              </SimpleGrid>

              {outcome && (
                <VStack spacing={4} mt={2} align="stretch">
                  <Box p={3} bg="blue.50" borderRadius="md" borderLeft="4px solid" borderColor="blue.400">
                    <Text fontSize="xs" fontWeight="bold" color="blue.700">System Response:</Text>
                    <Text fontSize="sm" color="blue.800">
                      {outcome === 'improved' ? 'Case will be moved to Watch list and reassessed in 7 days.' :
                       outcome === 'no_change' ? 'SLA will be reset once. Continued stagnation will trigger escalation.' :
                       'Immediate auto-escalation to Super Admin will be triggered.'}
                    </Text>
                  </Box>
                  <Button
                    colorScheme="purple"
                    size="lg"
                    onClick={handleCompleteIntervention}
                    isLoading={isLoading}
                  >
                    Complete Intervention
                  </Button>
                </VStack>
              )}
            </Stack>
          </Box>

          <Text fontSize="xs" color="brand.subtleText" textAlign="center">
            Note: You cannot leave this page without saving or completing the intervention.
          </Text>
        </Stack>
      </CardBody>
    </Card>
  )

  const EscalatedView = (
    <Box>
      <Box p={6} bg="black" borderRadius="xl" color="white" boxShadow="2xl" border="2px solid" borderColor="gray.700" mb={6}>
        <HStack spacing={6} align="flex-start">
          <ShieldAlert size={40} color="var(--chakra-colors-accent-warning)" />
          <VStack align="flex-start" spacing={1} flex={1}>
            <Text fontWeight="black" fontSize="2xl" letterSpacing="tight">⚫ ESCALATED TO SUPER ADMIN</Text>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} w="full" mt={4}>
              <VStack align="flex-start" spacing={0}>
                <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="bold">Reason</Text>
                <Text fontWeight="bold" color="red.400">{intervention.escalationReason || 'SLA Breach'}</Text>
              </VStack>
              <VStack align="flex-start" spacing={0}>
                <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="bold">Assigned Admin</Text>
                <Text fontWeight="bold">{intervention.assignedAdminName || 'Governance Team'}</Text>
              </VStack>
              <VStack align="flex-start" spacing={0}>
                <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="bold">Time</Text>
                <Text fontWeight="bold">{intervention.statusChangedAt ? new Date(intervention.statusChangedAt).toLocaleString() : 'Recently'}</Text>
              </VStack>
            </SimpleGrid>
          </VStack>
        </HStack>
      </Box>

      <Card bg="gray.50" border="1px solid" borderColor="border.control" mb={6}>
        <CardBody>
          <VStack align="flex-start" spacing={4}>
            <HStack>
              <Icon as={ShieldAlert} color="gray.500" />
              <Text fontWeight="bold">Partner Access: Read-only</Text>
            </HStack>
            <Text fontSize="sm" color="gray.600">
              This case is now under Super Admin governance. You may add comments for the audit trail but cannot modify the risk state or outcome.
            </Text>
            <Textarea placeholder="Add a comment for the Super Admin..." bg="white" />
            <Button size="sm" variant="outline" colorScheme="gray">Add Comment</Button>
          </VStack>
        </CardBody>
      </Card>
    </Box>
  )

  const SuperAdminControls = (
    <Card bg="blue.50" border="1px solid" borderColor="blue.200" mb={6} boxShadow="md">
      <CardBody>
        <Stack spacing={4}>
          <HStack justify="space-between">
            <HStack spacing={3}>
              <Box p={2} bg="blue.500" color="white" borderRadius="md">
                <ShieldAlert size={20} />
              </Box>
              <VStack align="flex-start" spacing={0}>
                <Text fontWeight="bold" fontSize="lg">Super Admin Authority</Text>
                <Text fontSize="sm" color="blue.700">Higher authority controls mirrored view</Text>
              </VStack>
            </HStack>
            <Badge colorScheme="blue" variant="solid">Admin Controls Active</Badge>
          </HStack>

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
            <Button size="sm" colorScheme="blue" leftIcon={<TrendingDown size={14} />}>Override Plan</Button>
            <Button size="sm" colorScheme="orange">Assign Senior Mentor</Button>
            <Button size="sm" colorScheme="red">Suspend Learner / Org</Button>
          </SimpleGrid>

          <HStack pt={2} justify="flex-end" spacing={3}>
            <Button size="sm" variant="outline" colorScheme="blue">View Partner Decision Timeline</Button>
            <Button size="sm" variant="solid" colorScheme="green" leftIcon={<CheckCircle2 size={14} />}>Close Case (Resolved)</Button>
          </HStack>
        </Stack>
      </CardBody>
    </Card>
  )

  // --- MAIN RENDER LOGIC ---

  return (
    <Box maxW="1000px" mx="auto" pb={20}>
      {StickyHeader}

      {isEscalated ? (
        <>
          {EscalatedView}
          {isSuperAdmin && SuperAdminControls}
          {ContextSections}
        </>
      ) : executionState === 'in_progress' || executionState === 'completed' ? (
        <>
          {ExecutionMode}
          {ContextSections}
        </>
      ) : (
        <>
          {SystemVerdict}
          {RequiredDecision}
          {ContextSections}
        </>
      )}

      {/* Accountability Note (Footer) */}
      <Box mt={10} textAlign="center">
        <Text fontSize="xs" color="brand.subtleText">
          This intervention flow is governed by the Transformation Leadership Council SLA guidelines.
          <br />
          All decisions and timeframes are logged for performance auditing.
        </Text>
      </Box>
    </Box>
  )
}
