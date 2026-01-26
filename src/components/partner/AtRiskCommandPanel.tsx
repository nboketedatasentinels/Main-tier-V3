import React, { useCallback, useEffect, useState } from 'react'
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
  HStack,
  SimpleGrid,
  Stack,
  Text,
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
import { AtRiskInterventionFlow } from '@/components/partner/AtRiskInterventionFlow'
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
  onAction?: (action: string, caseId: string, additionalData?: Record<string, unknown>) => Promise<void>
}

import { AlertCircle, ArrowLeft, ShieldAlert } from 'lucide-react'

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

  const handleCaseAction = async (
    action: string,
    caseId: string,
    additionalData?: Record<string, unknown>,
  ) => {
    if (!onAction) return
    await onAction(action, caseId, additionalData)
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
      <AtRiskInterventionFlow
        intervention={selectedCase}
        engagementTrend={engagementTrend}
        onAction={handleCaseAction}
        onBack={() => setSelectedCaseId(null)}
        isSuperAdmin={isSuperAdmin}
      />
    )
  }

  return selectedCaseId ? renderCaseView() : renderOverview()
}
