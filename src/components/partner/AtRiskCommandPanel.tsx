import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Checkbox,
  Collapse,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Radio,
  RadioGroup,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  TagCloseButton,
  TagLabel,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  VStack,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { EngagementChart } from '@/components/admin/EngagementChart'
import { AtRiskInterventionFlow } from '@/components/partner/AtRiskInterventionFlow'
import SendNudgeModal from '@/components/partner/nudges/SendNudgeModal'
import SendQuickNudgeModal from '@/components/partner/nudges/SendQuickNudgeModal'
import { createNudgeTemplateRecord, getActiveNudgeTemplates } from '@/services/nudgeService'
import { useAuth } from '@/hooks/useAuth'
import type { PartnerUser } from '@/hooks/usePartnerDashboardData'
import type { PartnerInterventionSummary } from '@/hooks/partner/usePartnerInterventions'
import type { NudgeChannel, NudgeTemplateRecord } from '@/types/nudges'
import type { DataWarning, RiskLevel, RiskReason } from '@/components/admin/RiskAnalysisCard'
import { Check, Filter, HelpCircle, Plus } from 'lucide-react'
import { getDisplayName } from '@/utils/displayName'

export interface AtRiskNudgePayload {
  users: PartnerUser[]
  template: NudgeTemplateRecord
  channel: NudgeChannel
  message: string
  scheduleAt?: string
}

type CampaignSegment = 'all' | 'new_joiners' | 'returning' | 'critical'
type CampaignScheduleMode = 'send-now' | 'tomorrow' | 'custom' | 'drip'

interface AtRiskCommandPanelProps {
  engagementTrend: { label: string; value: number }[]
  riskLevelList: RiskLevel[]
  riskReasons: RiskReason[]
  dataQualityWarnings: DataWarning[]
  interventions: PartnerInterventionSummary[]
  atRiskUsers: PartnerUser[]
  onAction?: (action: string, caseId: string, additionalData?: Record<string, unknown>) => Promise<void>
  onSendNudges?: (payload: AtRiskNudgePayload) => Promise<{ success: number; failed: number }>
}

const cardStyle = {
  bg: 'white',
  border: '1px solid',
  borderColor: 'brand.border',
  borderRadius: 'lg',
  boxShadow: 'sm',
}

const defaultFilters = {
  organization: 'All organizations',
  status: 'All statuses',
  risk: 'All risk levels',
  week: 'All weeks',
  belowWeeklyTarget: false,
  currentWeekOnly: false,
  compareHealthy: false,
}

const riskScoreColor = (score: number) => {
  if (score >= 85) return 'red'
  if (score >= 70) return 'orange'
  if (score >= 55) return 'yellow'
  return 'green'
}

const parseDate = (value?: string) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDate = (value?: string) => {
  const date = parseDate(value)
  if (!date) return '—'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const daysSince = (value?: string) => {
  const date = parseDate(value)
  if (!date) return null
  const diffMs = Date.now() - date.getTime()
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)))
}

/**
 * Build risk score based on ALL available user data signals:
 * - Weekly points data (most accurate when available)
 * - Progress percentage from profile
 * - Total points earned vs journey expectations
 * - Days since last activity
 * - Risk status classification
 *
 * Score range: 25 (low risk) to 100 (critical risk)
 */
const buildRiskScore = (user: PartnerUser) => {
  let score = 50 // Start at neutral
  let dataSignals = 0

  // Signal 1: Weekly progress (most accurate when available)
  if (user.weeklyRequired > 0) {
    const weeklyCompletion = Math.min(1, user.weeklyEarned / user.weeklyRequired)
    // 100% weekly completion → -25, 0% → +25
    score += (1 - weeklyCompletion) * 50 - 25
    dataSignals++
  }

  // Signal 2: Overall progress percent
  if (user.progressPercent > 0) {
    // High progress → lower risk, low progress → higher risk
    // 100% → -20, 0% → +20
    score += (1 - user.progressPercent / 100) * 40 - 20
    dataSignals++
  }

  // Signal 3: Total points relative to journey week
  if (user.totalPoints && user.totalPoints > 0) {
    // Expected: ~6,667 points per week for 6W journey (40,000 / 6 weeks)
    const expectedPerWeek = 6667
    const expected = expectedPerWeek * Math.max(1, user.currentWeek)
    const pointsRatio = Math.min(1.5, user.totalPoints / expected) // Cap at 150%
    // On track (1.0) → -15, ahead (1.5) → -22, behind (0.5) → -7
    score += (1 - pointsRatio) * 30 - 15
    dataSignals++
  }

  // Signal 4: Days inactive (if lastActive is available)
  const lastActiveDate = user.lastActiveAt || user.lastActive
  if (lastActiveDate) {
    const daysInactive = daysSince(lastActiveDate) ?? 0
    // Active today (0 days) → -10, 7 days → 0, 14+ days → +10
    const inactivityPenalty = Math.min(10, Math.max(-10, (daysInactive - 7) * 1.5))
    score += inactivityPenalty
    dataSignals++
  }

  // Signal 5: Risk status baseline
  const statusScore: Record<string, number> = {
    engaged: -15,
    watch: 0,
    concern: 10,
    at_risk: 15,
    critical: 20,
  }
  score += statusScore[user.riskStatus] ?? 5
  dataSignals++

  // If we have no meaningful data signals (only status), indicate uncertainty
  if (dataSignals <= 1) {
    // Base score primarily on status with some variance from current week
    const weekPenalty = Math.min(15, user.currentWeek * 3) // Later weeks = higher risk if no data
    score = 55 + (statusScore[user.riskStatus] ?? 5) + weekPenalty
  }

  // Clamp to valid range
  return Math.max(25, Math.min(100, Math.round(score)))
}

const buildSparkline = (user: PartnerUser) => {
  const seed = user.weeklyRequired ? (user.weeklyEarned / user.weeklyRequired) * 100 : user.progressPercent
  const normalized = Number.isFinite(seed) ? seed : 50
  return Array.from({ length: 6 }).map((_, index) => {
    const variance = (index - 2.5) * 6
    return Math.max(8, Math.min(100, normalized + variance))
  })
}

export const AtRiskCommandPanel: React.FC<AtRiskCommandPanelProps> = ({
  engagementTrend,
  dataQualityWarnings,
  interventions,
  atRiskUsers,
  onAction,
  onSendNudges,
}) => {
  const { isSuperAdmin, user, profile } = useAuth()
  const toast = useToast()
  const [activeTemplates, setActiveTemplates] = useState<NudgeTemplateRecord[]>([])
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [quickNudgeUser, setQuickNudgeUser] = useState<PartnerUser | null>(null)
  const [queueLoading, setQueueLoading] = useState(false)
  const [filters, setFilters] = useState(defaultFilters)
  const [draftFilters, setDraftFilters] = useState(defaultFilters)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [activeReason, setActiveReason] = useState<string | null>(null)
  const [selectedLearners, setSelectedLearners] = useState<string[]>([])
  const [nudgeRecipientIds, setNudgeRecipientIds] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<'name' | 'risk' | 'inactive' | 'lastActivity' | 'status'>('risk')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [campaignStep, setCampaignStep] = useState(1)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [campaignSegment, setCampaignSegment] = useState<CampaignSegment>('all')
  const [campaignRecipientIds, setCampaignRecipientIds] = useState<string[]>([])
  const [campaignSubject, setCampaignSubject] = useState('')
  const [campaignMessage, setCampaignMessage] = useState('')
  const [campaignChannel, setCampaignChannel] = useState<NudgeChannel>('both')
  const [campaignScheduleMode, setCampaignScheduleMode] = useState<CampaignScheduleMode>('send-now')
  const [campaignScheduleAt, setCampaignScheduleAt] = useState('')
  const [campaignSending, setCampaignSending] = useState(false)
  const [campaignTemplateSaving, setCampaignTemplateSaving] = useState(false)
  const [tipExpanded, setTipExpanded] = useState(true)
  const {
    isOpen: isNudgeModalOpen,
    onOpen: openNudgeModal,
    onClose: closeNudgeModal,
  } = useDisclosure()
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

  // Get unique organizations from users for filter dropdown
  const uniqueOrganizations = useMemo(() => {
    const orgs = new Set(atRiskUsers.map(user => user.companyCode).filter(Boolean))
    return Array.from(orgs).sort()
  }, [atRiskUsers])

  // Get unique weeks from users for filter dropdown
  const uniqueWeeks = useMemo(() => {
    const weeks = new Set(atRiskUsers.map(user => user.currentWeek).filter(w => w > 0))
    return Array.from(weeks).sort((a, b) => a - b)
  }, [atRiskUsers])

  const filteredLearners = useMemo(() => {
    let list = [...atRiskUsers]

    // Organization filter
    if (filters.organization !== 'All organizations') {
      list = list.filter(user => user.companyCode === filters.organization)
    }

    // Status filter
    if (filters.status !== 'All statuses') {
      list = list.filter(user => user.status === filters.status)
    }

    // Risk level filter
    if (filters.risk !== 'All risk levels') {
      list = list.filter(user => user.riskStatus === filters.risk)
    }

    // Week filter
    if (filters.week !== 'All weeks') {
      const weekNum = parseInt(filters.week.replace('Week ', ''), 10)
      list = list.filter(user => user.currentWeek === weekNum)
    }

    // Below weekly target filter
    if (filters.belowWeeklyTarget) {
      list = list.filter(user => user.weeklyEarned < user.weeklyRequired)
    }

    // Current week only filter
    if (filters.currentWeekOnly) {
      const currentWeek = Math.max(...atRiskUsers.map(u => u.currentWeek || 0), 1)
      list = list.filter(user => user.currentWeek === currentWeek)
    }

    if (activeReason) {
      list = list.filter(user => user.riskReasons?.includes(activeReason))
    }

    const sorted = list.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1
      if (sortKey === 'name') return a.name.localeCompare(b.name) * direction
      if (sortKey === 'risk') return (buildRiskScore(a) - buildRiskScore(b)) * direction
      if (sortKey === 'inactive') return ((daysSince(a.lastActiveAt || a.lastActive) ?? 0) - (daysSince(b.lastActiveAt || b.lastActive) ?? 0)) * direction
      if (sortKey === 'lastActivity') {
        return ((parseDate(a.lastActiveAt || a.lastActive)?.getTime() ?? 0) - (parseDate(b.lastActiveAt || b.lastActive)?.getTime() ?? 0)) * direction
      }
      return a.status.localeCompare(b.status) * direction
    })

    return sorted
  }, [atRiskUsers, activeReason, filters, sortDirection, sortKey])

  const toggleSort = (key: typeof sortKey) => {
    if (key === sortKey) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  const activeFilterTags = useMemo(() => {
    const tags: { label: string; key: keyof typeof filters }[] = []
    if (filters.organization !== defaultFilters.organization) tags.push({ label: `Org: ${filters.organization}`, key: 'organization' })
    if (filters.status !== defaultFilters.status) tags.push({ label: `Status: ${filters.status}`, key: 'status' })
    if (filters.risk !== defaultFilters.risk) tags.push({ label: `Risk: ${filters.risk}`, key: 'risk' })
    if (filters.week !== defaultFilters.week) tags.push({ label: filters.week, key: 'week' })
    if (filters.belowWeeklyTarget) tags.push({ label: 'Below cycle points target', key: 'belowWeeklyTarget' })
    if (filters.currentWeekOnly) tags.push({ label: 'Current week only', key: 'currentWeekOnly' })
    if (filters.compareHealthy) tags.push({ label: 'Compare to healthy learners', key: 'compareHealthy' })
    return tags
  }, [filters])

  const handleResetFilters = () => {
    setFilters(defaultFilters)
    setDraftFilters(defaultFilters)
    setActiveReason(null)
  }

  const handleRemoveTag = (key: keyof typeof filters) => {
    setFilters(prev => ({ ...prev, [key]: defaultFilters[key] }))
  }

  const handleSelectLearner = (id: string) => {
    setSelectedLearners(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id],
    )
  }

  const handleSelectAll = () => {
    if (selectedLearners.length === filteredLearners.length) {
      setSelectedLearners([])
      return
    }
    setSelectedLearners(filteredLearners.map(user => user.id))
  }

  const atRiskUserLookup = useMemo(
    () => new Map(atRiskUsers.map((user) => [user.id, user])),
    [atRiskUsers],
  )

  const nudgeRecipients = useMemo(
    () => nudgeRecipientIds
      .map((id) => atRiskUserLookup.get(id))
      .filter((user): user is PartnerUser => Boolean(user)),
    [atRiskUserLookup, nudgeRecipientIds],
  )

  const handleStartBulkQueue = async () => {
    if (!onAction || selectedLearners.length === 0) return
    const selectedUsers = selectedLearners
      .map((id) => atRiskUserLookup.get(id))
      .filter((user): user is PartnerUser => Boolean(user))

    if (!selectedUsers.length) return

    setQueueLoading(true)
    try {
      const results = await Promise.allSettled(
        selectedUsers.map((user) =>
          onAction('add_to_intervention_queue', user.id, {
            target: getDisplayName(user, 'Member'),
            name: 'At-risk intervention',
            reason: user.riskReasons?.[0] || 'Flagged from At-Risk command panel',
            riskStatus: user.riskStatus,
            riskReasons: user.riskReasons || [],
            organizationCode: user.companyCode || '',
            userId: user.id,
            silent: true,
          }),
        ),
      )

      const successCount = results.filter((result) => result.status === 'fulfilled').length
      const failedCount = results.length - successCount

      if (successCount > 0) {
        setSelectedLearners((prev) => prev.filter((id) => !selectedUsers.some((user) => user.id === id)))
      }

      toast({
        title: successCount > 0 ? 'Queue updated' : 'Queue update failed',
        description:
          failedCount > 0
            ? `${successCount} queued, ${failedCount} failed.`
            : `${successCount} learner${successCount === 1 ? '' : 's'} added to the intervention queue.`,
        status: failedCount > 0 ? 'warning' : 'success',
        duration: 4000,
      })
    } finally {
      setQueueLoading(false)
    }
  }

  const handleOpenNudgeComposer = (userIds: string[]) => {
    if (!userIds.length) return

    if (!onSendNudges) {
      toast({
        title: 'Nudges unavailable',
        description: 'Nudge delivery is not configured right now.',
        status: 'warning',
      })
      return
    }

    if (templateLoading) {
      toast({
        title: 'Templates still loading',
        description: 'Please wait for nudge templates to load.',
        status: 'info',
      })
      return
    }

    if (templateLoadError || activeTemplates.length === 0) {
      toast({
        title: 'Templates unavailable',
        description: 'Nudges require at least one active template.',
        status: 'warning',
      })
      return
    }

    const deduped = Array.from(new Set(userIds)).filter((id) => atRiskUserLookup.has(id))
    if (!deduped.length) return

    setNudgeRecipientIds(deduped)
    openNudgeModal()
  }

  const handleSendNudges = async (payload: {
    templateId: string
    channel: NudgeChannel
    message: string
    scheduleAt?: string
  }) => {
    if (!onSendNudges) {
      throw new Error('Nudge sending is not configured for this dashboard.')
    }

    const template = activeTemplates.find((item) => item.id === payload.templateId)
    if (!template) {
      throw new Error('Selected template no longer exists.')
    }

    const effectiveTemplate =
      payload.message && payload.message.trim() && payload.message.trim() !== template.message_body
        ? { ...template, message_body: payload.message.trim() }
        : template

    const summary = await onSendNudges({
      users: nudgeRecipients,
      template: effectiveTemplate,
      channel: payload.channel,
      message: payload.message,
      scheduleAt: payload.scheduleAt,
    })

    toast({
      title: summary.failed > 0 ? 'Nudges partially sent' : 'Nudges sent',
      description: `Success: ${summary.success}. Failed: ${summary.failed}.`,
      status: summary.failed > 0 ? 'warning' : 'success',
      duration: 4000,
    })

    if (summary.failed === 0) {
      closeNudgeModal()
      setNudgeRecipientIds([])
    }

    return summary
  }

  const campaignSteps = ['Recipients', 'Template', 'Preview', 'Schedule']
  const activeTemplate = activeTemplates.find(template => template.id === selectedTemplateId)

  const campaignAudience = useMemo(() => {
    if (campaignSegment === 'critical') {
      return atRiskUsers.filter((user) => user.riskStatus === 'critical' || user.riskStatus === 'at_risk')
    }

    if (campaignSegment === 'new_joiners') {
      return atRiskUsers.filter((user) => {
        const startedAt = parseDate(user.programStartDate || user.createdAt || user.registrationDate)
        if (!startedAt) return false
        const diffDays = Math.round((Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24))
        return diffDays >= 0 && diffDays <= 14
      })
    }

    if (campaignSegment === 'returning') {
      return atRiskUsers.filter((user) => {
        const inactiveDays = daysSince(user.lastActiveAt || user.lastActive) ?? 999
        return inactiveDays <= 7 && user.progressPercent >= 30
      })
    }

    return atRiskUsers
  }, [atRiskUsers, campaignSegment])

  useEffect(() => {
    setCampaignRecipientIds((prev) => prev.filter((id) => campaignAudience.some((user) => user.id === id)))
  }, [campaignAudience])

  useEffect(() => {
    if (!activeTemplate) return
    setCampaignSubject(activeTemplate.subject || '')
    setCampaignMessage(activeTemplate.message_body || '')
  }, [activeTemplate])

  const selectedCampaignRecipients = useMemo(
    () =>
      campaignRecipientIds
        .map((id) => atRiskUserLookup.get(id))
        .filter((user): user is PartnerUser => Boolean(user)),
    [atRiskUserLookup, campaignRecipientIds],
  )

  const campaignPreviewRecipient = selectedCampaignRecipients[0] || campaignAudience[0] || null

  const previewCampaignText = useCallback(
    (value: string) => {
      if (!value) return value
      if (!campaignPreviewRecipient) return value

      const recipientName = getDisplayName(campaignPreviewRecipient, 'Member')
      const inactiveDays = daysSince(campaignPreviewRecipient.lastActiveAt || campaignPreviewRecipient.lastActive) ?? 0
      const engagementScore = buildRiskScore(campaignPreviewRecipient)
      const weeklyPoints = `${campaignPreviewRecipient.weeklyEarned}/${campaignPreviewRecipient.weeklyRequired || 0}`

      return value
        .replace(/{{\s*userName\s*}}/g, recipientName)
        .replace(/{{\s*organizationName\s*}}/g, campaignPreviewRecipient.companyCode || 'Your organization')
        .replace(/{{\s*daysInactive\s*}}/g, `${inactiveDays}`)
        .replace(/{{\s*engagementScore\s*}}/g, `${engagementScore}`)
        .replace(/{{\s*weeklyPoints\s*}}/g, weeklyPoints)
    },
    [campaignPreviewRecipient],
  )

  const resetCampaignComposer = useCallback(() => {
    setCampaignStep(1)
    setSelectedTemplateId(null)
    setCampaignRecipientIds([])
    setCampaignSegment('all')
    setCampaignSubject('')
    setCampaignMessage('')
    setCampaignChannel('both')
    setCampaignScheduleMode('send-now')
    setCampaignScheduleAt('')
  }, [])

  const effectiveCampaignTemplate = useMemo<NudgeTemplateRecord | null>(() => {
    const subject = campaignSubject.trim()
    const message = campaignMessage.trim()

    if (activeTemplate) {
      return {
        ...activeTemplate,
        subject: subject || activeTemplate.subject,
        message_body: message || activeTemplate.message_body,
      }
    }

    if (!subject || !message) return null

    return {
      id: 'custom-campaign-template',
      name: 'Custom campaign message',
      subject,
      message_body: message,
      template_type: 'Encouragement' as const,
      target_audience: 'At-risk learners',
      is_active: false,
      created_at: null,
      updated_at: null,
    }
  }, [activeTemplate, campaignMessage, campaignSubject])

  const allCampaignRecipientsSelected = campaignAudience.length > 0 && campaignRecipientIds.length === campaignAudience.length

  const handleToggleCampaignRecipient = (id: string) => {
    setCampaignRecipientIds((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ))
  }

  const handleToggleAllCampaignRecipients = () => {
    if (allCampaignRecipientsSelected) {
      setCampaignRecipientIds([])
      return
    }
    setCampaignRecipientIds(campaignAudience.map((user) => user.id))
  }

  const handleInsertToken = (token: 'userName' | 'organizationName' | 'daysInactive' | 'engagementScore' | 'weeklyPoints') => {
    setCampaignMessage((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}{{${token}}}`)
  }

  const handleCampaignNext = () => {
    if (campaignStep === 1 && campaignRecipientIds.length === 0) {
      toast({
        title: 'Select recipients',
        description: 'Choose at least one recipient before continuing.',
        status: 'warning',
      })
      return
    }

    if (campaignStep === 2) {
      if (!campaignSubject.trim() && !campaignMessage.trim()) {
        toast({
          title: 'Add campaign content',
          description: 'Choose a template or compose a custom subject and message.',
          status: 'warning',
        })
        return
      }
      if (!campaignSubject.trim() || !campaignMessage.trim()) {
        toast({
          title: 'Complete your message',
          description: 'Subject and message body are both required.',
          status: 'warning',
        })
        return
      }
    }

    setCampaignStep((prev) => Math.min(4, prev + 1))
  }

  const handleStartCampaignFromScratch = () => {
    setSelectedTemplateId(null)
    setCampaignSubject('')
    setCampaignMessage('')
  }

  const handleSaveCampaignTemplate = async () => {
    const subject = campaignSubject.trim()
    const message = campaignMessage.trim()
    if (!subject || !message) {
      toast({
        title: 'Complete your message',
        description: 'Subject and message body are both required before saving.',
        status: 'warning',
      })
      return
    }

    setCampaignTemplateSaving(true)
    try {
      const baseName = subject.length > 42 ? `${subject.slice(0, 42).trimEnd()}...` : subject
      const created = await createNudgeTemplateRecord({
        name: baseName || 'Campaign template',
        subject,
        message_body: message,
        template_type: campaignSegment === 'critical' ? 'Critical Alert' : 'Encouragement',
        target_audience: 'At-risk learners',
        is_active: true,
      })

      setActiveTemplates((prev) => [created, ...prev])
      setSelectedTemplateId(created.id)
      toast({
        title: 'Template saved',
        description: 'The campaign template is now available for reuse.',
        status: 'success',
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to save template.'
      toast({
        title: 'Template save failed',
        description: errorMessage,
        status: 'error',
      })
    } finally {
      setCampaignTemplateSaving(false)
    }
  }

  const handleSendCampaignTest = async () => {
    if (!onSendNudges) {
      toast({
        title: 'Nudges unavailable',
        description: 'Nudge delivery is not configured right now.',
        status: 'warning',
      })
      return
    }

    if (!effectiveCampaignTemplate || !campaignPreviewRecipient) {
      toast({
        title: 'Missing test data',
        description: 'Select a template and at least one recipient to send a test.',
        status: 'warning',
      })
      return
    }

    setCampaignSending(true)
    try {
      const summary = await onSendNudges({
        users: [campaignPreviewRecipient],
        template: effectiveCampaignTemplate,
        channel: campaignChannel,
        message: campaignMessage,
      })

      toast({
        title: summary.failed > 0 ? 'Test nudge failed' : 'Test nudge sent',
        description: `Success: ${summary.success}. Failed: ${summary.failed}.`,
        status: summary.failed > 0 ? 'warning' : 'success',
      })
    } finally {
      setCampaignSending(false)
    }
  }

  const handleSendCampaign = async () => {
    if (!onSendNudges) {
      toast({
        title: 'Nudges unavailable',
        description: 'Nudge delivery is not configured right now.',
        status: 'warning',
      })
      return
    }

    if (!effectiveCampaignTemplate) {
      toast({
        title: 'Template required',
        description: 'Select and configure a template before sending.',
        status: 'warning',
      })
      return
    }

    if (selectedCampaignRecipients.length === 0) {
      toast({
        title: 'No recipients selected',
        description: 'Choose at least one recipient before sending.',
        status: 'warning',
      })
      return
    }

    if (campaignScheduleMode === 'drip') {
      toast({
        title: 'Drip campaigns unavailable',
        description: 'Drip campaign enrollment is not enabled yet.',
        status: 'info',
      })
      return
    }

    let scheduleAt: string | undefined
    if (campaignScheduleMode === 'tomorrow') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(9, 0, 0, 0)
      scheduleAt = tomorrow.toISOString()
    }

    if (campaignScheduleMode === 'custom') {
      const customSchedule = parseDate(campaignScheduleAt)
      if (!customSchedule) {
        toast({
          title: 'Invalid schedule time',
          description: 'Select a valid date and time for scheduled delivery.',
          status: 'warning',
        })
        return
      }

      if (customSchedule.getTime() <= Date.now()) {
        toast({
          title: 'Schedule must be in the future',
          description: 'Choose a future date and time for the campaign.',
          status: 'warning',
        })
        return
      }

      scheduleAt = customSchedule.toISOString()
    }

    setCampaignSending(true)
    try {
      const summary = await onSendNudges({
        users: selectedCampaignRecipients,
        template: effectiveCampaignTemplate,
        channel: campaignChannel,
        message: campaignMessage,
        scheduleAt,
      })

      const scheduleLabel = scheduleAt ? new Date(scheduleAt).toLocaleString() : null
      toast({
        title: summary.failed > 0 ? 'Campaign partially processed' : scheduleAt ? 'Campaign scheduled' : 'Campaign sent',
        description: `${scheduleLabel ? `Scheduled for ${scheduleLabel}. ` : ''}Success: ${summary.success}. Failed: ${summary.failed}.`,
        status: summary.failed > 0 ? 'warning' : 'success',
      })

      if (summary.failed === 0) {
        resetCampaignComposer()
      }
    } finally {
      setCampaignSending(false)
    }
  }

  const renderOverview = () => (
    <Stack spacing={6}>
      <SimpleGrid columns={{ base: 1, lg: 4 }} spacing={4}>
        <Card {...cardStyle}>
          <CardBody>
            <Text fontSize="sm" color="brand.subtleText">Priority learners</Text>
            <Text fontSize="2xl" fontWeight="bold" color="brand.text">{filteredLearners.length}</Text>
            <Text fontSize="sm" color="brand.subtleText">Need immediate outreach</Text>
          </CardBody>
        </Card>
        <Card {...cardStyle}>
          <CardBody>
            <Text fontSize="sm" color="brand.subtleText">Critical alerts</Text>
            <Text fontSize="2xl" fontWeight="bold" color="red.500">
              {filteredLearners.filter(user => user.riskStatus === 'critical').length}
            </Text>
            <Text fontSize="sm" color="brand.subtleText">High-risk learners</Text>
          </CardBody>
        </Card>
        <Card {...cardStyle}>
          <CardBody>
            <Text fontSize="sm" color="brand.subtleText">Intervention queue</Text>
            <Text fontSize="2xl" fontWeight="bold" color="brand.text">{interventions.length}</Text>
            <Text fontSize="sm" color="brand.subtleText">Cases awaiting action</Text>
          </CardBody>
        </Card>
        <Card {...cardStyle}>
          <CardBody>
            <Text fontSize="sm" color="brand.subtleText">Data quality checks</Text>
            <Text fontSize="2xl" fontWeight="bold" color="brand.text">{dataQualityWarnings.length}</Text>
            <Text fontSize="sm" color="brand.subtleText">Signals needing review</Text>
          </CardBody>
        </Card>
      </SimpleGrid>

      <Card {...cardStyle}>
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center">
              <HStack spacing={2}>
                <Filter size={18} />
                <Text fontWeight="semibold" color="brand.text">Filters</Text>
              </HStack>
              <Button size="sm" variant="ghost" onClick={() => setShowMoreFilters(prev => !prev)}>
                {showMoreFilters ? 'Hide filters' : 'More filters'}
              </Button>
            </HStack>
            <SimpleGrid columns={{ base: 1, md: 4 }} spacing={3}>
              <Select
                value={draftFilters.organization}
                onChange={(event) => setDraftFilters(prev => ({ ...prev, organization: event.target.value }))}
              >
                <option>All organizations</option>
                {uniqueOrganizations.map(org => (
                  <option key={org} value={org}>{org}</option>
                ))}
              </Select>
              <Select
                value={draftFilters.week}
                onChange={(event) => setDraftFilters(prev => ({ ...prev, week: event.target.value }))}
              >
                <option>All weeks</option>
                {uniqueWeeks.map(week => (
                  <option key={week} value={`Week ${week}`}>Week {week}</option>
                ))}
              </Select>
              <Select
                value={draftFilters.status}
                onChange={(event) => setDraftFilters(prev => ({ ...prev, status: event.target.value }))}
              >
                <option>All statuses</option>
                <option>Active</option>
                <option>Paused</option>
                <option>Onboarding</option>
              </Select>
              <Select
                value={draftFilters.risk}
                onChange={(event) => setDraftFilters(prev => ({ ...prev, risk: event.target.value }))}
              >
                <option>All risk levels</option>
                <option value="critical">Critical</option>
                <option value="concern">Concern</option>
                <option value="at_risk">At Risk</option>
              </Select>
            </SimpleGrid>
            <Collapse in={showMoreFilters}>
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mt={2}>
                <Checkbox
                  isChecked={draftFilters.belowWeeklyTarget}
                  onChange={(event) => setDraftFilters(prev => ({ ...prev, belowWeeklyTarget: event.target.checked }))}
                >
                  Below cycle points target
                </Checkbox>
                <Checkbox
                  isChecked={draftFilters.currentWeekOnly}
                  onChange={(event) => setDraftFilters(prev => ({ ...prev, currentWeekOnly: event.target.checked }))}
                >
                  Current week only
                </Checkbox>
                <Checkbox
                  isChecked={draftFilters.compareHealthy}
                  onChange={(event) => setDraftFilters(prev => ({ ...prev, compareHealthy: event.target.checked }))}
                >
                  Compare to healthy learners
                </Checkbox>
              </SimpleGrid>
            </Collapse>
            <HStack justify="space-between">
              <HStack spacing={3}>
                <Button
                  colorScheme="purple"
                  size="sm"
                  onClick={() => setFilters(draftFilters)}
                >
                  Apply
                </Button>
                <Button variant="link" size="sm" onClick={handleResetFilters}>
                  Reset
                </Button>
              </HStack>
              <Text fontSize="sm" color="brand.subtleText">
                Showing {filteredLearners.length} learners
              </Text>
            </HStack>
            {activeFilterTags.length > 0 && (
              <HStack spacing={2} flexWrap="wrap">
                {activeFilterTags.map(tag => (
                  <Tag key={tag.label} colorScheme="purple" borderRadius="full">
                    <TagLabel>{tag.label}</TagLabel>
                    <TagCloseButton onClick={() => handleRemoveTag(tag.key)} />
                  </Tag>
                ))}
              </HStack>
            )}
          </Stack>
        </CardBody>
      </Card>

      <Card {...cardStyle}>
        <CardBody>
          <Stack spacing={4}>
            <HStack justify="space-between" align="center">
              <Text fontWeight="semibold" color="brand.text">At-risk learners</Text>
              <HStack spacing={2}>
                <Button
                  size="sm"
                  variant="outline"
                  isDisabled={selectedLearners.length === 0 || queueLoading}
                  isLoading={queueLoading}
                  onClick={() => void handleStartBulkQueue()}
                >
                  Add to Queue
                </Button>
                <Button
                  size="sm"
                  colorScheme="purple"
                  isDisabled={selectedLearners.length === 0}
                  onClick={() => handleOpenNudgeComposer(selectedLearners)}
                >
                  Send Nudge
                </Button>
              </HStack>
            </HStack>
            <Box overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>
                      <Checkbox
                        isChecked={selectedLearners.length === filteredLearners.length && filteredLearners.length > 0}
                        onChange={handleSelectAll}
                      />
                    </Th>
                    <Th onClick={() => toggleSort('name')} cursor="pointer">Learner Name</Th>
                    <Th>Points Earned</Th>
                    <Th onClick={() => toggleSort('inactive')} cursor="pointer">Days Inactive</Th>
                    <Th onClick={() => toggleSort('lastActivity')} cursor="pointer">Last Activity</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredLearners.map(user => {
                    const inactiveDays = daysSince(user.lastActiveAt || user.lastActive)

                    return (
                      <Tr key={user.id} _hover={{ bg: 'brand.accent' }}>
                        <Td>
                          <Checkbox
                            isChecked={selectedLearners.includes(user.id)}
                            onChange={() => handleSelectLearner(user.id)}
                          />
                        </Td>
                        <Td>
                          <VStack align="flex-start" spacing={0}>
                            <Text fontWeight="semibold">{getDisplayName(user, 'Member')}</Text>
                            <Text fontSize="xs" color="brand.subtleText">{user.email}</Text>
                          </VStack>
                        </Td>
                        <Td>
                          <Text fontWeight="medium">
                            {(user.totalPoints ?? 0).toLocaleString()}
                          </Text>
                        </Td>
                        <Td>{inactiveDays ?? '—'}</Td>
                        <Td>{formatDate(user.lastActiveAt || user.lastActive)}</Td>
                        <Td>
                          <HStack spacing={2}>
                            <Button size="xs" variant="outline">View Profile</Button>
                            <Button
                              size="xs"
                              colorScheme="purple"
                              onClick={() => setQuickNudgeUser(user)}
                            >
                              Send Nudge
                            </Button>
                          </HStack>
                        </Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </Box>
            {filteredLearners.length === 0 && (
              <Stack spacing={2} align="center" py={8}>
                <Text fontWeight="semibold" color="brand.text">No at-risk learners found</Text>
                <Text color="brand.subtleText" textAlign="center">
                  All learners are on track. Check back later or adjust your filters to expand the view.
                </Text>
              </Stack>
            )}
          </Stack>
        </CardBody>
      </Card>

      <SimpleGrid columns={{ base: 1, lg: 1 }} spacing={4}>
        <Card {...cardStyle}>
          <CardBody>
            <Stack spacing={3}>
              <HStack justify="space-between">
                <Text fontWeight="semibold" color="brand.text">Intervention queue</Text>
                <Badge colorScheme="purple">Action required</Badge>
              </HStack>
              <Stack spacing={3}>
                {interventions.map(item => (
                  <HStack
                    key={item.id}
                    justify="space-between"
                    p={3}
                    borderRadius="md"
                    border="1px solid"
                    borderColor={item.status === 'critical' ? 'red.200' : 'brand.border'}
                    bg={item.status === 'critical' ? 'red.50' : 'brand.accent'}
                  >
                    <VStack align="flex-start" spacing={0}>
                      <HStack>
                        <Text fontWeight="semibold">{item.name}</Text>
                        {item.status === 'critical' && <Badge colorScheme="red">Critical</Badge>}
                      </HStack>
                      <Text fontSize="xs" color="brand.subtleText">{item.target} • {item.reason}</Text>
                    </VStack>
                    <Button size="xs" variant="outline" onClick={() => setSelectedCaseId(item.id)}>
                      Manage Case
                    </Button>
                  </HStack>
                ))}
                {interventions.length === 0 && (
                  <Text color="brand.subtleText">No intervention cases are waiting right now.</Text>
                )}
              </Stack>
            </Stack>
          </CardBody>
        </Card>
      </SimpleGrid>
    </Stack>
  )

  const renderCampaigns = () => (
    <Stack spacing={6}>
      <Card {...cardStyle}>
        <CardBody>
          <Stack spacing={4}>
            <HStack spacing={4} flexWrap="wrap">
              {campaignSteps.map((step, index) => {
                const stepIndex = index + 1
                const isComplete = campaignStep > stepIndex
                const isActive = campaignStep === stepIndex

                return (
                  <HStack key={step} spacing={2} opacity={isActive || isComplete ? 1 : 0.5}>
                    <Box
                      w="28px"
                      h="28px"
                      borderRadius="full"
                      bg={isComplete ? 'green.500' : isActive ? 'purple.500' : 'gray.200'}
                      color={isComplete || isActive ? 'white' : 'gray.700'}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      fontSize="sm"
                      fontWeight="bold"
                    >
                      {isComplete ? <Check size={16} /> : stepIndex}
                    </Box>
                    <Text fontWeight="semibold">{step}</Text>
                  </HStack>
                )
              })}
            </HStack>
            <Divider />
            {campaignStep === 1 && (
              <Stack spacing={4}>
                <HStack justify="space-between">
                  <Text fontWeight="semibold" color="brand.text">Select recipients</Text>
                  <Select
                    maxW="260px"
                    value={campaignSegment}
                    onChange={(event) => setCampaignSegment(event.target.value as CampaignSegment)}
                  >
                    <option value="all">All at-risk learners</option>
                    <option value="new_joiners">New joiners (14 days)</option>
                    <option value="returning">Returning learners</option>
                    <option value="critical">Critical risk</option>
                  </Select>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="sm" color="brand.subtleText">Showing {campaignAudience.length} learners</Text>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleToggleAllCampaignRecipients}
                    isDisabled={campaignAudience.length === 0}
                  >
                    {allCampaignRecipientsSelected ? 'Clear all' : 'Select all'}
                  </Button>
                </HStack>
                <Box maxH="260px" overflowY="auto" border="1px solid" borderColor="brand.border" borderRadius="md">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Recipient</Th>
                        <Th>Risk Level</Th>
                        <Th>Days Inactive</Th>
                        <Th>Include</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {campaignAudience.map(user => (
                        <Tr key={user.id}>
                          <Td>{getDisplayName(user, 'Member')}</Td>
                          <Td>
                            <Badge colorScheme={riskScoreColor(buildRiskScore(user))}>{user.riskStatus}</Badge>
                          </Td>
                          <Td>{daysSince(user.lastActiveAt || user.lastActive) ?? '—'}</Td>
                          <Td>
                            <Checkbox
                              isChecked={campaignRecipientIds.includes(user.id)}
                              onChange={() => handleToggleCampaignRecipient(user.id)}
                            />
                          </Td>
                        </Tr>
                      ))}
                      {campaignAudience.length === 0 && (
                        <Tr>
                          <Td colSpan={4}>
                            <Text fontSize="sm" color="brand.subtleText">No learners match this segment.</Text>
                          </Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </Box>
                <Text fontSize="sm" color="brand.subtleText">
                  Selected recipients: {campaignRecipientIds.length}
                </Text>
              </Stack>
            )}
            {campaignStep === 2 && (
              <Stack spacing={4}>
                {templateLoadError ? (
                  <Box p={3} borderRadius="md" bg="red.50" border="1px solid" borderColor="red.200">
                    <Text fontWeight="semibold" color="red.700">Nudge templates unavailable</Text>
                    <Text fontSize="sm" color="red.700">
                      {templateLoadError} If the issue persists, contact support at {supportEmail}.
                    </Text>
                    <Button
                      size="sm"
                      colorScheme="red"
                      mt={2}
                      onClick={() => void loadTemplates()}
                      isLoading={templateLoading}
                    >
                      Retry
                    </Button>
                  </Box>
                ) : (
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                    {activeTemplates.slice(0, 5).map(template => (
                      <Card key={template.id} {...cardStyle}>
                        <CardBody>
                          <Stack spacing={2}>
                            <Text fontWeight="semibold">{template.name}</Text>
                            <Text fontSize="sm" color="brand.subtleText" noOfLines={2}>
                              {template.message_body}
                            </Text>
                            <Button
                              size="sm"
                              colorScheme="purple"
                              variant={selectedTemplateId === template.id ? 'solid' : 'outline'}
                              onClick={() => setSelectedTemplateId(template.id)}
                              isDisabled={templateLoading}
                            >
                              Use template
                            </Button>
                          </Stack>
                        </CardBody>
                      </Card>
                    ))}
                    <Card {...cardStyle}>
                      <CardBody>
                        <Stack spacing={3} align="center" textAlign="center">
                          <Plus size={24} />
                          <Text fontWeight="semibold">Create New Template</Text>
                          <Text fontSize="sm" color="brand.subtleText">Build a custom message for this audience.</Text>
                          <Button size="sm" variant="outline" onClick={handleStartCampaignFromScratch}>
                            Start from scratch
                          </Button>
                        </Stack>
                      </CardBody>
                    </Card>
                  </SimpleGrid>
                )}
                <Divider />
                <Stack spacing={3}>
                  <HStack justify="space-between">
                    <Text fontWeight="semibold">Template editor</Text>
                    <Menu>
                      <MenuButton as={Button} size="sm" variant="outline">
                        Insert Variable
                      </MenuButton>
                      <MenuList>
                        <MenuItem onClick={() => handleInsertToken('userName')}>Learner Name</MenuItem>
                        <MenuItem onClick={() => handleInsertToken('weeklyPoints')}>Points Accumulated</MenuItem>
                        <MenuItem onClick={() => handleInsertToken('engagementScore')}>Engagement Rate</MenuItem>
                        <MenuItem onClick={() => handleInsertToken('daysInactive')}>Days Since Last Activity</MenuItem>
                      </MenuList>
                    </Menu>
                  </HStack>
                  <FormControl>
                    <FormLabel>Subject line</FormLabel>
                    <Input
                      placeholder="Subject line"
                      value={campaignSubject}
                      onChange={(event) => setCampaignSubject(event.target.value)}
                    />
                    <Text fontSize="xs" color="brand.subtleText">{campaignSubject.length} / 80 characters</Text>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Message body</FormLabel>
                    <Textarea
                      rows={6}
                      placeholder="Write your nudge message here..."
                      value={campaignMessage}
                      onChange={(event) => setCampaignMessage(event.target.value)}
                    />
                  </FormControl>
                  <HStack spacing={3}>
                    <Button
                      colorScheme="purple"
                      size="sm"
                      onClick={() => void handleSaveCampaignTemplate()}
                      isLoading={campaignTemplateSaving}
                    >
                      Save as Template
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCampaignNext}>
                      Use Once
                    </Button>
                  </HStack>
                  <Box p={4} borderRadius="md" bg="brand.accent" border="1px dashed" borderColor="brand.border">
                    <Text fontWeight="semibold">Preview</Text>
                    <Text fontSize="sm" color="brand.subtleText">
                      {previewCampaignText(campaignSubject || activeTemplate?.subject || 'Subject line preview')}
                    </Text>
                    <Text fontSize="sm" mt={2}>
                      {previewCampaignText(
                        campaignMessage || activeTemplate?.message_body || 'Choose a template or write a message to preview.',
                      )}
                    </Text>
                  </Box>
                </Stack>
              </Stack>
            )}
            {campaignStep === 3 && (
              <Stack spacing={3}>
                <Text fontWeight="semibold">Preview message</Text>
                <Box p={4} borderRadius="md" bg="brand.accent" border="1px solid" borderColor="brand.border">
                  <Text fontWeight="semibold">
                    Subject: {previewCampaignText(campaignSubject || activeTemplate?.subject || 'We are here to help')}
                  </Text>
                  <Text mt={2}>
                    {previewCampaignText(
                      campaignMessage || activeTemplate?.message_body || 'Hi there, we noticed your points pace dipped this cycle. Let us know how we can help.',
                    )}
                  </Text>
                </Box>
                <Text fontSize="sm" color="brand.subtleText">
                  Test recipient: {campaignPreviewRecipient ? getDisplayName(campaignPreviewRecipient, 'Member') : 'No recipient selected'}
                </Text>
                <Button size="sm" variant="outline" onClick={() => void handleSendCampaignTest()} isLoading={campaignSending}>
                  Send test message
                </Button>
              </Stack>
            )}
            {campaignStep === 4 && (
              <Stack spacing={3}>
                <FormControl maxW="280px">
                  <FormLabel>Delivery channel</FormLabel>
                  <Select value={campaignChannel} onChange={(event) => setCampaignChannel(event.target.value as NudgeChannel)}>
                    <option value="email">Email</option>
                    <option value="in_app">In-app notification</option>
                    <option value="both">Email + in-app</option>
                  </Select>
                </FormControl>
                <Text fontWeight="semibold">Schedule delivery for:</Text>
                <RadioGroup value={campaignScheduleMode} onChange={(value) => setCampaignScheduleMode(value as CampaignScheduleMode)}>
                  <Stack spacing={3}>
                    <Radio value="send-now">Send immediately</Radio>
                    <Radio value="tomorrow">Tomorrow morning</Radio>
                    <Radio value="custom">Schedule for specific time</Radio>
                    <Radio value="drip">Add to drip campaign</Radio>
                  </Stack>
                </RadioGroup>
                {campaignScheduleMode === 'custom' && (
                  <Input
                    type="datetime-local"
                    maxW="260px"
                    value={campaignScheduleAt}
                    onChange={(event) => setCampaignScheduleAt(event.target.value)}
                  />
                )}
                {campaignScheduleMode !== 'send-now' && (
                  <Text fontSize="sm" color="brand.subtleText">
                    Scheduled sends are queued for later delivery. Drip mode is still in progress.
                  </Text>
                )}
              </Stack>
            )}
            <Divider />
            <HStack justify="space-between">
              <Button
                variant="outline"
                size="sm"
                isDisabled={campaignStep === 1}
                onClick={() => setCampaignStep(prev => Math.max(1, prev - 1))}
              >
                Back
              </Button>
              <Button
                colorScheme="purple"
                size="sm"
                onClick={() => {
                  if (campaignStep === 4) {
                    void handleSendCampaign()
                    return
                  }
                  handleCampaignNext()
                }}
                isLoading={campaignStep === 4 && campaignSending}
              >
                {campaignStep === 4 ? 'Send Campaign' : 'Next'}
              </Button>
            </HStack>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )

  const renderAnalytics = () => (
    <Stack spacing={6}>
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
        {[
          { label: 'Active campaigns', value: 6, trend: '↑ 12% vs last month', benchmark: 'Average: 4' },
          { label: 'Open rate', value: '87%', trend: '↑ 12% vs last month', benchmark: 'Average: 65%' },
          { label: 'Response rate', value: '34%', trend: '↑ 5% vs last month', benchmark: 'Average: 28%' },
          { label: 'Re-engagement rate', value: '22%', trend: '↓ 2% vs last month', benchmark: 'Average: 25%' },
        ].map(stat => (
          <Card key={stat.label} {...cardStyle}>
            <CardBody>
              <Text fontSize="sm" color="brand.subtleText">{stat.label}</Text>
              <Text fontSize="2xl" fontWeight="bold">{stat.value}</Text>
              <Text fontSize="xs" color="brand.subtleText">{stat.trend}</Text>
              <Text fontSize="xs" color="brand.subtleText">{stat.benchmark}</Text>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      <Card {...cardStyle}>
        <CardBody>
          <Stack spacing={3}>
            <HStack justify="space-between">
              <Text fontWeight="semibold">Campaign performance</Text>
              <Badge colorScheme="purple">Updated daily</Badge>
            </HStack>
            <EngagementChart
              data={engagementTrend}
              title="Campaign results"
              subtitle="Opens, clicks, and responses over time"
              valueLabel="Engagement"
            />
          </Stack>
        </CardBody>
      </Card>

      <Card {...cardStyle}>
        <CardBody>
          <Stack spacing={2}>
            <Button variant="ghost" size="sm" onClick={() => setTipExpanded(prev => !prev)}>
              Tip: Smaller campaigns (under 10 learners) see better response rates.
            </Button>
            <Collapse in={tipExpanded}>
              <Text fontSize="sm" color="brand.subtleText">
                Give learners 48 hours to respond before you follow up with another nudge.
              </Text>
            </Collapse>
          </Stack>
        </CardBody>
      </Card>

      <Card {...cardStyle}>
        <CardBody>
          <Stack spacing={3}>
            <Text fontWeight="semibold">Campaign performance detail</Text>
            <Box overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Campaign Name</Th>
                    <Th>Sent</Th>
                    <Th>Opened</Th>
                    <Th>Clicked</Th>
                    <Th>Responses</Th>
                    <Th>Conversion</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {activeTemplates.slice(0, 4).map(template => (
                    <Tr key={template.id}>
                      <Td>{template.name}</Td>
                      <Td>120</Td>
                      <Td>98</Td>
                      <Td>72</Td>
                      <Td>24</Td>
                      <Td>20%</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </Stack>
        </CardBody>
      </Card>

      <Card {...cardStyle}>
        <CardBody>
          <Stack spacing={3}>
            <HStack justify="space-between">
              <Text fontWeight="semibold">Real-time effectiveness</Text>
              <Text fontSize="xs" color="brand.subtleText">Updated every 30 seconds</Text>
            </HStack>
            <Stack spacing={2}>
              {[
                'Last nudge sent 5 min ago → Opened by Sarah M.',
                'New response received from David R.',
                'Nudge opened by Priya K. (2 min ago)',
              ].map(item => (
                <HStack key={item} justify="space-between">
                  <Text fontSize="sm">{item}</Text>
                  <Badge colorScheme="green">Live</Badge>
                </HStack>
              ))}
            </Stack>
          </Stack>
        </CardBody>
      </Card>
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

  return selectedCaseId ? (
    renderCaseView()
  ) : (
    <Stack spacing={6}>
      <HStack justify="space-between" align={{ base: 'flex-start', md: 'center' }}>
        <Stack spacing={1}>
          <Text fontSize="2xl" fontWeight="bold" color="brand.text">
            At-Risk Command Panel
          </Text>
          <Text color="brand.subtleText">
            Identify and support learners who need intervention
          </Text>
        </Stack>
        <Menu>
          <MenuButton as={IconButton} aria-label="Help" icon={<HelpCircle size={18} />} variant="outline" />
          <MenuList>
            <MenuItem>Help Center</MenuItem>
            <MenuItem>Documentation</MenuItem>
            <MenuItem>Contact Support</MenuItem>
          </MenuList>
        </Menu>
      </HStack>

      <Tabs variant="soft-rounded" colorScheme="purple">
        <TabList>
          <Tab>Overview</Tab>
          <Tab>Campaigns</Tab>
          <Tab>Analytics</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            {renderOverview()}
          </TabPanel>
          <TabPanel px={0}>
            {renderCampaigns()}
          </TabPanel>
          <TabPanel px={0}>
            {renderAnalytics()}
          </TabPanel>
        </TabPanels>
      </Tabs>

      <SendNudgeModal
        isOpen={isNudgeModalOpen}
        onClose={() => {
          closeNudgeModal()
          setNudgeRecipientIds([])
        }}
        users={nudgeRecipients.map((user) => ({
          id: user.id,
          name: getDisplayName(user, 'Member'),
          email: user.email,
          riskLevel: user.riskStatus,
          lastActive: user.lastActiveAt || user.lastActive,
          engagementScore: buildRiskScore(user),
        }))}
        templates={activeTemplates}
        onConfirm={handleSendNudges}
      />

      {quickNudgeUser && (
        <SendQuickNudgeModal
          isOpen={Boolean(quickNudgeUser)}
          onClose={() => setQuickNudgeUser(null)}
          user={quickNudgeUser}
          adminId={profile?.id ?? user?.uid ?? ''}
        />
      )}

    </Stack>
  )
}
