import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Skeleton,
  Spacer,
  Stack,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tooltip,
  Tr,
  useBreakpointValue,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { Tooltip as RechartsTooltip, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Link as LinkIcon,
  Plus,
  ShieldCheck,
  Target,
  TrendingUp,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { FirebaseError } from 'firebase/app'
import { format, isAfter, isBefore, startOfMonth, subMonths } from 'date-fns'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { ESGCategory, UserRole } from '@/types'
import { removeUndefinedFields } from '@/utils/firestore'
import { JOURNEY_META, getActivitiesForJourney, getMonthNumber, type ActivityDef, type JourneyType } from '@/config/pointsConfig'
import { awardChecklistPoints, revokeChecklistPoints } from '@/services/pointsService'

interface ImpactLogEntry {
  id: string
  userId: string
  companyId?: string
  title: string
  description: string
  categoryGroup: 'esg' | 'business'
  esgCategory?: ESGCategory
  activityType?: string
  businessCategory?: string
  businessActivity?: string
  liftPillars?: string[]
  date: string
  hours: number
  peopleImpacted: number
  usdValue?: number
  outcomeLabel?: string
  verificationLevel: string
  verifierEmail?: string
  evidenceLink?: string
  points: number
  impactValue: number
  scp: number
  verificationMultiplier: number
  createdAt: string
}

const esgActivities = [
  'Workshop Delivered',
  'Process Change',
  'Coaching/Mentoring',
  'Automation',
  'Policy/Standard',
  'Training Session',
  'Community Outreach',
  'Kaizen/Continuous Improvement',
  'Pilot/MVP',
  'Other',
]

const businessActivities = [
  'Defects',
  'Overproduction',
  'Waiting',
  'Non-Utilized Talent',
  'Transportation',
  'Inventory',
  'Motion',
  'Extra Processing',
]

const liftPillarColors: Record<string, string> = {
  'Leading Self': 'purple',
  'Fostering Teams': 'blue',
  'Innovating with Tech': 'green',
  'Transforming Business': 'orange',
}

const verificationMultipliers: Record<string, number> = {
  'Tier 1: Self-Reported': 1,
  'Tier 2: Partner Verified': 1.5,
  'Tier 3: Evidence Uploaded': 2,
  'Tier 4: Third-Party Verified': 2.5,
}

const basePoints = 500

const getPillarsForActivity = (activity?: string): string[] => {
  if (!activity) return []
  const normalized = activity.toLowerCase()

  if (normalized.includes('coaching') || normalized.includes('mentoring')) {
    return ['Fostering Teams', 'Leading Self']
  }

  if (normalized.includes('automation') || normalized.includes('process')) {
    return ['Innovating with Tech', 'Transforming Business']
  }

  if (normalized.includes('training') || normalized.includes('workshop')) {
    return ['Fostering Teams', 'Leading Self']
  }

  if (normalized.includes('community') || normalized.includes('outreach')) {
    return ['Fostering Teams']
  }

  return ['Transforming Business']
}

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })

const buildCsv = (entries: ImpactLogEntry[]) => {
  const headers = [
    'Date',
    'Title',
    'Description',
    'Category',
    'Activity',
    'Hours',
    'People Impacted',
    'USD Value',
    'Verification',
    'Points',
    'Impact Value',
    'SCP',
    'Evidence',
  ]

  const rows = entries.map((entry) => [
    entry.date,
    entry.title,
    entry.description,
    entry.categoryGroup === 'esg' ? entry.esgCategory : entry.businessCategory,
    entry.activityType || entry.businessActivity,
    entry.hours,
    entry.peopleImpacted,
    entry.usdValue ?? 0,
    entry.verificationLevel,
    entry.points,
    entry.impactValue,
    entry.scp,
    entry.evidenceLink || '',
  ])

  return [headers, ...rows].map((row) => row.join(',')).join('\n')
}

const calculateImpactPreview = (values: Partial<ImpactLogEntry>) => {
  const verificationMultiplier = verificationMultipliers[values.verificationLevel || 'Tier 1: Self-Reported'] || 1
  const categoryMultiplier = values.categoryGroup === 'business' ? 1.15 : 1
  const hours = Number(values.hours) || 0
  const usd = Number(values.usdValue) || 0
  const people = Number(values.peopleImpacted) || 0

  const hourPoints = hours * 25
  const usdPoints = usd * 0.05
  const totalPoints = (basePoints + hourPoints + usdPoints) * categoryMultiplier * verificationMultiplier

  const baseImpactRate = values.esgCategory === ESGCategory.GOVERNANCE ? 1.1 : values.esgCategory === ESGCategory.SOCIAL ? 0.9 : 1
  const impactValue = (hours * 75 * baseImpactRate + people * 10) * verificationMultiplier
  const scp = (hours * 5 + people * 2.5) * verificationMultiplier

  return {
    points: Math.round(totalPoints),
    impactValue: Math.round(impactValue),
    scp: Math.round(scp),
    verificationMultiplier,
  }
}

export const ImpactLogPage: React.FC = () => {
  const { user, profile } = useAuth()
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const {
    isOpen: isQuickOpen,
    onOpen: onOpenQuick,
    onClose: onCloseQuick,
  } = useDisclosure()
  const [activeTab, setActiveTab] = useState<'personal' | 'company'>('personal')
  const [entries, setEntries] = useState<ImpactLogEntry[]>([])
  const [companyEntries, setCompanyEntries] = useState<ImpactLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [monthCursor, setMonthCursor] = useState<Date>(new Date())
  const [isExporting, setIsExporting] = useState(false)
  const [formValues, setFormValues] = useState<Partial<ImpactLogEntry>>({
    title: '',
    description: '',
    categoryGroup: 'esg',
    esgCategory: ESGCategory.ENVIRONMENTAL,
    activityType: esgActivities[0],
    businessCategory: 'Cost Savings',
    businessActivity: businessActivities[0],
    hours: 1,
    peopleImpacted: 0,
    usdValue: 0,
    verificationLevel: 'Tier 1: Self-Reported',
    date: format(new Date(), 'yyyy-MM-dd'),
  })
  const isEsgActive = formValues.categoryGroup === 'esg'
  const isBusinessActive = formValues.categoryGroup === 'business'

  const preview = useMemo(() => calculateImpactPreview(formValues), [formValues])

  const resolveJourneyType = (): JourneyType => {
    if (profile?.journeyType) return profile.journeyType
    return profile?.role === UserRole.FREE_USER ? '4W' : '6W'
  }

  const resolveImpactActivity = (journeyType: JourneyType): ActivityDef | undefined => {
    return getActivitiesForJourney(journeyType).find((activity) => activity.id === 'impact_log')
  }

  const resolveWeekNumberForDate = (dateString: string, journeyType: JourneyType): number => {
    const meta = JOURNEY_META[journeyType]
    if (!profile?.journeyStartDate) {
      const fallbackWeek = profile?.currentWeek ?? 1
      return Math.min(Math.max(1, fallbackWeek), meta.weeks)
    }

    const startDate = new Date(profile.journeyStartDate)
    const impactDate = new Date(dateString)
    const diffMs = impactDate.getTime() - startDate.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const weekNumber = Math.floor(diffDays / 7) + 1
    return Math.min(Math.max(1, weekNumber), meta.weeks)
  }

  useEffect(() => {
    if (!user?.uid) return

    const q = query(collection(db, 'impact_logs'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ImpactLogEntry[]
      setEntries(data)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user?.uid])

  useEffect(() => {
    if (!profile?.companyId) {
      setCompanyEntries([])
      return
    }

    const q = query(
      collection(db, 'impact_logs'),
      where('companyId', '==', profile.companyId),
      orderBy('createdAt', 'desc'),
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ImpactLogEntry[]
      setCompanyEntries(data)
    })

    return () => unsubscribe()
  }, [profile?.companyId])

  const filteredEntries = useMemo(() => {
    const start = startOfMonth(monthCursor)
    const nextMonth = new Date(start)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    const list = activeTab === 'personal' || !profile?.companyId ? entries : companyEntries
    return list.filter((entry) => {
      const entryDate = new Date(entry.date)
      return !isBefore(entryDate, start) && isBefore(entryDate, nextMonth)
    })
  }, [activeTab, companyEntries, entries, monthCursor, profile?.companyId])

  const chartCategoryData = useMemo(() => {
    const map = new Map<string, { hours: number; usd: number }>()
    filteredEntries.forEach((entry) => {
      const key = entry.categoryGroup === 'esg' ? entry.esgCategory || 'ESG' : entry.businessCategory || 'Business'
      const current = map.get(key) || { hours: 0, usd: 0 }
      map.set(key, {
        hours: current.hours + (entry.hours || 0),
        usd: current.usd + (entry.usdValue || 0),
      })
    })

    return Array.from(map.entries()).map(([name, values]) => ({
      name,
      Hours: values.hours,
      USD: values.usd,
    }))
  }, [filteredEntries])

  const monthlyTrendData = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, idx) => {
      const month = startOfMonth(subMonths(monthCursor, 5 - idx))
      const end = new Date(month)
      end.setMonth(end.getMonth() + 1)
      return {
        label: format(month, 'MMM yyyy'),
        start: month,
        end,
      }
    })

    return months.map(({ label, start, end }) => {
      
      const list = activeTab === 'personal' ? entries : companyEntries
      const monthEntries = list.filter((entry) => {
        const entryDate = new Date(entry.date)
        return !isBefore(entryDate, start) && isBefore(entryDate, end)
      })

      return {
        name: label,
        Entries: monthEntries.length,
        Hours: monthEntries.reduce((sum, e) => sum + (e.hours || 0), 0),
        USD: monthEntries.reduce((sum, e) => sum + (e.usdValue || 0), 0),
      }
    })
  }, [activeTab, companyEntries, entries, monthCursor])

  const stats = useMemo(() => {
    return {
      activities: filteredEntries.length,
      people: filteredEntries.reduce((sum, e) => sum + (e.peopleImpacted || 0), 0),
      hours: filteredEntries.reduce((sum, e) => sum + (e.hours || 0), 0),
      usd: filteredEntries.reduce((sum, e) => sum + (e.usdValue || 0), 0),
      points: filteredEntries.reduce((sum, e) => sum + (e.points || 0), 0),
    }
  }, [filteredEntries])

  const handleSubmit = async () => {
    if (!user?.uid) return

    if (!formValues.description || !formValues.date || (!formValues.hours && !formValues.peopleImpacted)) {
      toast({
        title: 'Missing details',
        description: 'Please complete required fields and include at least hours or people impacted.',
        status: 'warning',
      })
      return
    }

    try {
      const payload = removeUndefinedFields<Omit<ImpactLogEntry, 'id'>>({
        userId: user.uid,
        ...(profile?.companyId ? { companyId: profile.companyId } : {}),
        title: formValues.title || 'Impact Activity',
        description: formValues.description || '',
        categoryGroup: formValues.categoryGroup || 'esg',
        ...(formValues.categoryGroup === 'esg'
          ? {
              esgCategory: formValues.esgCategory,
              activityType: formValues.activityType,
            }
          : {
              businessCategory: formValues.businessCategory,
              businessActivity: formValues.businessActivity,
            }),
        liftPillars: getPillarsForActivity(
          formValues.categoryGroup === 'esg' ? formValues.activityType : formValues.businessActivity,
        ),
        date: formValues.date || format(new Date(), 'yyyy-MM-dd'),
        hours: Number(formValues.hours) || 0,
        peopleImpacted: Number(formValues.peopleImpacted) || 0,
        usdValue: Number(formValues.usdValue) || 0,
        ...(formValues.outcomeLabel ? { outcomeLabel: formValues.outcomeLabel } : {}),
        verificationLevel: formValues.verificationLevel || 'Tier 1: Self-Reported',
        ...(formValues.verifierEmail ? { verifierEmail: formValues.verifierEmail } : {}),
        ...(formValues.evidenceLink ? { evidenceLink: formValues.evidenceLink } : {}),
        points: preview.points,
        impactValue: preview.impactValue,
        scp: preview.scp,
        verificationMultiplier: preview.verificationMultiplier,
        createdAt: new Date().toISOString(),
      })

      await addDoc(collection(db, 'impact_logs'), payload)

      const journeyType = resolveJourneyType()
      const activity = resolveImpactActivity(journeyType)
      const weekNumber = resolveWeekNumberForDate(payload.date, journeyType)
      const monthNumber = getMonthNumber(weekNumber)
      const weekSuffix =
        profile?.currentWeek && profile.currentWeek !== weekNumber
          ? ` Points awarded to Week ${weekNumber} based on activity date.`
          : ''
      let toastStatus: 'success' | 'warning' = 'success'
      let toastTitle = 'Impact logged successfully!'
      let toastDescription = 'Your entry has been saved.'

      if (activity) {
        const ledgerRef = doc(db, 'pointsLedger', `${user.uid}__w${weekNumber}__${activity.id}`)
        const ledgerSnap = await getDoc(ledgerRef)

        if (ledgerSnap.exists()) {
          toastStatus = 'warning'
          toastDescription = "You've already earned Impact Log points this week."
        } else {
          const monthQuery = query(
            collection(db, 'pointsLedger'),
            where('uid', '==', user.uid),
            where('activityId', '==', activity.id),
            where('monthNumber', '==', monthNumber),
          )
          const monthSnapshot = await getDocs(monthQuery)

          if (monthSnapshot.size >= activity.maxPerMonth) {
            toastStatus = 'warning'
            toastDescription = 'You have reached the Impact Log monthly points limit.'
          } else {
            try {
              await awardChecklistPoints({
                uid: user.uid,
                journeyType,
                weekNumber,
                activity,
                source: 'impact_log_submission',
              })
              toastTitle = 'Impact logged and points awarded!'
              toastDescription = `You earned ${activity.points} points.${weekSuffix}`
            } catch (awardError) {
              if (import.meta.env.DEV) {
                console.error('Impact log points award failed', awardError)
              }
              toastStatus = 'warning'
              toastDescription = 'Impact logged, but points could not be awarded. Please try again later.'
            }
          }
        }
      }

      toast({
        title: toastTitle,
        description: toastDescription,
        status: toastStatus,
      })
      onClose()
    } catch (error) {
      const errorMessage = error instanceof FirebaseError ? error.message : (error as Error)?.message || 'Unknown error'

      if (import.meta.env.DEV) {
        console.error('Impact log submission failed', error)
      }

      toast({
        title: 'Unable to log impact',
        description: errorMessage,
        status: 'error',
      })
    }
  }

  const handleDeleteEntry = async (entry: ImpactLogEntry) => {
    if (!user?.uid) return

    try {
      await deleteDoc(doc(db, 'impact_logs', entry.id))

      const journeyType = resolveJourneyType()
      const activity = resolveImpactActivity(journeyType)

      if (activity) {
        const weekNumber = resolveWeekNumberForDate(entry.date, journeyType)
        const remainingInWeek = entries.filter(
          (item) => item.id !== entry.id && resolveWeekNumberForDate(item.date, journeyType) === weekNumber,
        )

        if (remainingInWeek.length === 0) {
          await revokeChecklistPoints({
            uid: user.uid,
            journeyType,
            weekNumber,
            activity,
          })
        }
      }

      toast({
        title: 'Impact entry deleted',
        description: 'Your Impact Log entry has been removed.',
        status: 'success',
      })
    } catch (error) {
      const errorMessage = error instanceof FirebaseError ? error.message : (error as Error)?.message || 'Unknown error'
      toast({
        title: 'Unable to delete impact entry',
        description: errorMessage,
        status: 'error',
      })
    }
  }

  const handleExport = () => {
    const exportList = activeTab === 'personal' ? entries : companyEntries
    setIsExporting(true)
    const csv = buildCsv(exportList)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute(
      'download',
      `${activeTab === 'personal' ? 'personal-impact-data' : 'company-impact-data'}-${format(new Date(), 'yyyy-MM-dd')}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setIsExporting(false)
    toast({
      title: 'Export ready',
      description: `Exported ${exportList.length} entries spanning your selected range`,
      status: 'success',
    })
  }

  const statCards = [
    {
      label: 'Impact Activities',
      value: stats.activities,
      help: 'Impact activities logged this month',
      icon: Target,
      color: 'purple.500',
    },
    {
      label: 'People Impacted',
      value: stats.people,
      help: 'Total individuals reached',
      icon: Users,
      color: 'teal.500',
    },
    {
      label: 'Hours',
      value: stats.hours,
      help: 'Hours contributed',
      icon: Clock,
      color: 'blue.500',
    },
    {
      label: 'USD Saved/Created',
      value: formatCurrency(stats.usd || 0),
      help: 'Estimated financial value',
      icon: ShieldCheck,
      color: 'green.500',
    },
    {
      label: 'Points Earned',
      value: stats.points,
      help: 'Points from verified activities',
      icon: Check,
      color: 'orange.500',
    },
  ]

  const isMobile = useBreakpointValue({ base: true, md: false })

  return (
    <Box>
      <Flex align="center" mb={6} gap={3} wrap="wrap">
        <Icon as={Target} color="purple.500" boxSize={7} />
        <Box>
          <Heading size="lg" color="text.primary">
            Impact Log
          </Heading>
          <Text color="text.secondary">Track and measure your real-world impact</Text>
        </Box>
        <Spacer />
        {!isMobile && (
          <HStack spacing={3}>
            <Button variant="outline" leftIcon={<Download size={18} />} onClick={handleExport} isLoading={isExporting}>
              {activeTab === 'personal' ? 'Export Personal Data' : 'Export Company Data'}
            </Button>
            <Button colorScheme="purple" leftIcon={<Plus size={18} />} onClick={onOpen}>
              New Entry
            </Button>
          </HStack>
        )}
      </Flex>

      <Flex mb={4} p={4} rounded="lg" bg="purple.50" border="1px solid" borderColor="purple.100" align="center" gap={4}>
        <Icon as={Plus} color="purple.500" />
        <Box>
          <Text fontWeight="semibold" color="purple.800">
            First time logging impact?
          </Text>
          <Text color="purple.700">
            Click "New Entry" to record the outcome, hours, and proof of your latest win. We will guide you through each field.
          </Text>
        </Box>
        <Spacer />
        <Button colorScheme="purple" variant="solid" onClick={onOpen}>
          Let&apos;s do it
        </Button>
      </Flex>

      <HStack spacing={3} mb={4}>
        <Button
          leftIcon={<Target size={16} />}
          colorScheme={activeTab === 'personal' ? 'purple' : 'gray'}
          variant={activeTab === 'personal' ? 'solid' : 'ghost'}
          onClick={() => setActiveTab('personal')}
        >
          Personal
        </Button>
        <Button
          leftIcon={<Users size={16} />}
          colorScheme={activeTab === 'company' ? 'orange' : 'gray'}
          variant={activeTab === 'company' ? 'solid' : 'ghost'}
          onClick={() => setActiveTab('company')}
          isDisabled={!profile?.companyId}
        >
          Company Impact
        </Button>
      </HStack>

      <Grid templateColumns={{ base: '1fr', lg: '3fr 1fr' }} gap={6}>
        <GridItem>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} spacing={4} mb={6}>
            {statCards.map((card) => (
              <Stat key={card.label} p={4} bg="surface.default" shadow="xs" rounded="lg" border="1px solid" borderColor="border.subtle">
                <HStack justify="space-between" mb={3}>
                  <Box p={2} rounded="full" bg={`${card.color}10`} color={card.color}>
                    <Icon as={card.icon} />
                  </Box>
                  <Tooltip label={card.help}>
                    <Icon as={InfoIcon} color="text.muted" />
                  </Tooltip>
                </HStack>
                <StatLabel color="text.secondary">{card.label}</StatLabel>
                <StatNumber color="text.primary" fontSize="xl">
                  {card.label === 'USD Saved/Created' ? card.value : card.value.toLocaleString()}
                </StatNumber>
                <StatHelpText>{card.help}</StatHelpText>
              </Stat>
            ))}
          </SimpleGrid>

          <Grid templateColumns={{ base: '1fr', xl: '1.2fr 1fr' }} gap={4} mb={6}>
            <Box p={4} bg="surface.default" rounded="lg" border="1px solid" borderColor="border.subtle" shadow="xs">
              <HStack mb={4} justify="space-between">
                <Text fontWeight="bold">Impact Activities by Category</Text>
                <Badge colorScheme="purple">Dual Axis</Badge>
              </HStack>
              <Box height="250px">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartCategoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <RechartsTooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="Hours" fill="#4c6fff" radius={4} />
                    <Bar yAxisId="right" dataKey="USD" fill="#22c55e" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Box>

            <Box p={4} bg="surface.default" rounded="lg" border="1px solid" borderColor="border.subtle" shadow="xs">
              <HStack mb={4} justify="space-between">
                <Text fontWeight="bold">Monthly Trend</Text>
                <Badge colorScheme="orange">Last 6 months</Badge>
              </HStack>
              <Box height="250px">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Entries" stroke="#a855f7" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="Hours" stroke="#3b82f6" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="USD" stroke="#22c55e" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          </Grid>

          <Flex align="center" mb={3}>
            <Heading size="md">Your Impact Activities ({filteredEntries.length})</Heading>
            <Spacer />
            <HStack spacing={2}>
              <IconButton
                aria-label="Previous month"
                icon={<ChevronLeft size={16} />}
                variant="ghost"
                onClick={() => setMonthCursor((prev) => subMonths(prev, 1))}
              />
              <Text fontWeight="medium">{format(monthCursor, 'yyyy-MM')}</Text>
              <IconButton
                aria-label="Next month"
                icon={<ChevronRight size={16} />}
                variant="ghost"
                onClick={() => {
                  const next = new Date(monthCursor)
                  next.setMonth(next.getMonth() + 1)
                  if (!isAfter(next, new Date())) setMonthCursor(next)
                }}
              />
            </HStack>
          </Flex>

          <TableContainer bg="surface.default" border="1px solid" borderColor="border.subtle" rounded="lg" shadow="xs">
            <Table size="sm">
              <Thead bg="surface.subtle">
                <Tr>
                  <Th>Date</Th>
                  <Th>Title</Th>
                  <Th>Category</Th>
                  <Th isNumeric>Hours</Th>
                  <Th isNumeric>USD</Th>
                  <Th isNumeric>People</Th>
                  <Th>Verification</Th>
                  {activeTab === 'personal' && <Th />}
                </Tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <Tr>
                    <Td colSpan={activeTab === 'personal' ? 8 : 7}>
                      <Skeleton height="18px" />
                    </Td>
                  </Tr>
                ) : filteredEntries.length === 0 ? (
                  <Tr>
                    <Td colSpan={activeTab === 'personal' ? 8 : 7}>
                      <Text color="text.muted">No entries found for this period.</Text>
                    </Td>
                  </Tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <Tr key={entry.id} _hover={{ bg: 'surface.subtle' }}>
                      <Td>{format(new Date(entry.date), 'dd MMM yyyy')}</Td>
                      <Td>
                        <Text fontWeight="semibold">{entry.title}</Text>
                        <Text color="text.muted" fontSize="sm" noOfLines={1}>
                          {entry.description}
                        </Text>
                      </Td>
                      <Td>
                        <Badge colorScheme={entry.categoryGroup === 'esg' ? 'green' : 'blue'}>
                          {entry.categoryGroup === 'esg' ? entry.esgCategory : entry.businessCategory}
                        </Badge>
                      </Td>
                      <Td isNumeric>{entry.hours}</Td>
                      <Td isNumeric>{entry.usdValue?.toLocaleString() || '0'}</Td>
                      <Td isNumeric>{entry.peopleImpacted}</Td>
                      <Td>
                        <Badge colorScheme={entry.verificationMultiplier > 1 ? 'purple' : 'gray'}>
                          {entry.verificationLevel}
                        </Badge>
                      </Td>
                      {activeTab === 'personal' && entry.userId === user?.uid && (
                        <Td>
                          <Tooltip label="Delete entry">
                            <IconButton
                              aria-label="Delete impact entry"
                              icon={<Trash2 size={16} />}
                              size="sm"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() => handleDeleteEntry(entry)}
                            />
                          </Tooltip>
                        </Td>
                      )}
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </TableContainer>
        </GridItem>

        <GridItem>
          <Stack spacing={4}>
            {isMobile && (
              <Button colorScheme="purple" leftIcon={<Plus size={18} />} onClick={onOpenQuick}>
                Quick Log Impact
              </Button>
            )}

            <Box p={4} bg="surface.default" border="1px solid" borderColor="border.subtle" rounded="lg" shadow="xs">
              <HStack mb={3}>
                <Icon as={TrendingUp} color="purple.500" />
                <Text fontWeight="bold">Impact Momentum</Text>
              </HStack>
              <Stack spacing={2}>
                <Flex align="center" justify="space-between">
                  <Text color="text.secondary">Points Today</Text>
                  <Badge colorScheme="purple">{stats.points.toLocaleString()}</Badge>
                </Flex>
                <Flex align="center" justify="space-between">
                  <Text color="text.secondary">Hours this month</Text>
                  <Badge colorScheme="blue">{stats.hours}</Badge>
                </Flex>
                <Divider />
                <Text color="text.secondary" fontWeight="medium">
                  Daily micro-challenge progress
                </Text>
                <Button w="full" colorScheme="purple" onClick={onOpen}>
                  Log Impact Now
                </Button>
              </Stack>
            </Box>

            <Box p={4} bg="surface.default" color="text.primary" rounded="lg" shadow="md" border="1px solid" borderColor="accent.purpleBorder">
              <Text fontSize="lg" fontWeight="bold" mb={2}>
                Gamification Goals
              </Text>
              <Text color="text.secondary">Keep your streak alive by logging impact every day.</Text>
              <Stack spacing={2} mt={4}>
                <Flex justify="space-between" align="center">
                  <Text>Daily Goal</Text>
                  <Badge colorScheme="green">On Track</Badge>
                </Flex>
                <Flex justify="space-between" align="center">
                  <Text>Weekly Streak</Text>
                  <Badge colorScheme="yellow">3 days</Badge>
                </Flex>
                <Flex justify="space-between" align="center">
                  <Text>Achievements</Text>
                  <Badge colorScheme="pink">7 badges</Badge>
                </Flex>
              </Stack>
            </Box>

            <Box p={4} bg="surface.default" border="1px solid" borderColor="border.subtle" rounded="lg" shadow="xs">
              <Text fontWeight="bold" mb={2}>
                Privacy & Consent
              </Text>
              <Text color="text.secondary">
                ESG impact data is publicly aggregated. Business data stays private to the Transformation Leader.
              </Text>
            </Box>
          </Stack>
        </GridItem>
      </Grid>

      <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Log Your Impact</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <HStack spacing={3}>
                <Button
                  colorScheme={isEsgActive ? 'green' : 'gray'}
                  variant={isEsgActive ? 'solid' : 'outline'}
                  size="lg"
                  leftIcon={isEsgActive ? <Check size={18} /> : undefined}
                  fontWeight={isEsgActive ? 'semibold' : 'medium'}
                  boxShadow={isEsgActive ? 'md' : 'none'}
                  transform={isEsgActive ? 'scale(1.02)' : 'scale(1)'}
                  transition="all 0.2s ease"
                  aria-pressed={isEsgActive}
                  color={isEsgActive ? 'white' : 'gray.600'}
                  onClick={() =>
                    setFormValues((prev) => ({
                      ...prev,
                      categoryGroup: 'esg',
                      esgCategory: ESGCategory.ENVIRONMENTAL,
                      activityType: esgActivities[0],
                    }))
                  }
                >
                  ESG Impact
                </Button>
                <Button
                  colorScheme={isBusinessActive ? 'blue' : 'gray'}
                  variant={isBusinessActive ? 'solid' : 'outline'}
                  size="lg"
                  leftIcon={isBusinessActive ? <Check size={18} /> : undefined}
                  fontWeight={isBusinessActive ? 'semibold' : 'medium'}
                  boxShadow={isBusinessActive ? 'md' : 'none'}
                  transform={isBusinessActive ? 'scale(1.02)' : 'scale(1)'}
                  transition="all 0.2s ease"
                  aria-pressed={isBusinessActive}
                  color={isBusinessActive ? 'white' : 'gray.600'}
                  onClick={() =>
                    setFormValues((prev) => ({
                      ...prev,
                      categoryGroup: 'business',
                      businessCategory: 'Cost Savings',
                      businessActivity: businessActivities[0],
                    }))
                  }
                >
                  Business Impact
                </Button>
              </HStack>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <Box>
                  <Text fontWeight="medium">ESG Category</Text>
                  <Select
                    mt={1}
                    value={formValues.esgCategory}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, esgCategory: e.target.value as ESGCategory }))}
                    isDisabled={formValues.categoryGroup !== 'esg'}
                  >
                    <option value={ESGCategory.ENVIRONMENTAL}>Environmental</option>
                    <option value={ESGCategory.SOCIAL}>Social</option>
                    <option value={ESGCategory.GOVERNANCE}>Governance</option>
                  </Select>
                </Box>

                <Box>
                  <Text fontWeight="medium">Activity Type</Text>
                  <Select
                    mt={1}
                    value={formValues.activityType}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, activityType: e.target.value }))}
                    isDisabled={formValues.categoryGroup !== 'esg'}
                  >
                    {esgActivities.map((activity) => (
                      <option key={activity}>{activity}</option>
                    ))}
                  </Select>
                </Box>

                <Box>
                  <Text fontWeight="medium">Primary Category</Text>
                  <Select
                    mt={1}
                    value={formValues.businessCategory}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, businessCategory: e.target.value }))}
                    isDisabled={formValues.categoryGroup !== 'business'}
                  >
                    <option>Cost Savings</option>
                    <option>Efficiency Gains</option>
                  </Select>
                </Box>

                <Box>
                  <Text fontWeight="medium">Specific Activity (8 wastes)</Text>
                  <Select
                    mt={1}
                    value={formValues.businessActivity}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, businessActivity: e.target.value }))}
                    isDisabled={formValues.categoryGroup !== 'business'}
                  >
                    {businessActivities.map((activity) => (
                      <option key={activity}>{activity}</option>
                    ))}
                  </Select>
                </Box>
              </SimpleGrid>

              <Box>
                <Text fontWeight="medium">LIFT Framework Pillars</Text>
                <HStack spacing={2} mt={2}>
                  {getPillarsForActivity(
                    formValues.categoryGroup === 'esg' ? formValues.activityType : formValues.businessActivity,
                  ).map((pillar) => (
                    <Badge key={pillar} colorScheme={liftPillarColors[pillar]} px={2} py={1} rounded="md">
                      {pillar}
                    </Badge>
                  ))}
                </HStack>
              </Box>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <Box>
                  <Text fontWeight="medium">Title</Text>
                  <Input
                    mt={1}
                    placeholder="Give this impact a short title"
                    value={formValues.title}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </Box>
                <Box>
                  <Text fontWeight="medium">Date</Text>
                  <Input
                    mt={1}
                    type="date"
                    max={format(new Date(), 'yyyy-MM-dd')}
                    value={formValues.date}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </Box>
              </SimpleGrid>

              <Box>
                <Text fontWeight="medium">Description</Text>
                <Textarea
                  mt={1}
                  rows={4}
                  placeholder="Describe your impact activity in detail..."
                  value={formValues.description}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, description: e.target.value }))}
                />
                <Text fontSize="sm" color="text.muted">
                  Provide specific details about what you did and the outcomes achieved
                </Text>
              </Box>

              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <Icon as={Clock} color="text.muted" />
                  </InputLeftElement>
                  <Input
                    type="number"
                    step="0.25"
                    min={0}
                    placeholder="Hours"
                    value={formValues.hours}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, hours: Number(e.target.value) }))}
                  />
                </InputGroup>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <Icon as={Users} color="text.muted" />
                  </InputLeftElement>
                  <Input
                    type="number"
                    min={0}
                    placeholder="People Impacted"
                    value={formValues.peopleImpacted}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, peopleImpacted: Number(e.target.value) }))}
                  />
                </InputGroup>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <Icon as={ShieldCheck} color="text.muted" />
                  </InputLeftElement>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Outcome metric (USD)"
                    value={formValues.usdValue}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, usdValue: Number(e.target.value) }))}
                  />
                </InputGroup>
              </SimpleGrid>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <Box>
                  <Text fontWeight="medium">Verification Level</Text>
                  <Select
                    mt={1}
                    value={formValues.verificationLevel}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, verificationLevel: e.target.value }))}
                  >
                    {Object.keys(verificationMultipliers).map((tier) => (
                      <option key={tier}>{tier}</option>
                    ))}
                  </Select>
                </Box>
                <Box>
                  <Text fontWeight="medium">External Verifier Email</Text>
                  <Input
                    mt={1}
                    type="email"
                    placeholder="Required for partner verification"
                    value={formValues.verifierEmail}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, verifierEmail: e.target.value }))}
                  />
                </Box>
              </SimpleGrid>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <Box>
                  <Text fontWeight="medium">Evidence Link</Text>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <Icon as={LinkIcon} color="text.muted" />
                  </InputLeftElement>
                    <Input
                      placeholder="https://drive.google.com/file/..."
                      value={formValues.evidenceLink}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, evidenceLink: e.target.value, verificationLevel: 'Tier 3: Evidence Uploaded' }))}
                    />
                  </InputGroup>
                </Box>
                <Box>
                  <Text fontWeight="medium">Outcome Metric Label</Text>
                  <Input
                    mt={1}
                    placeholder="USD saved, Hours reduced"
                    value={formValues.outcomeLabel}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, outcomeLabel: e.target.value }))}
                  />
                </Box>
              </SimpleGrid>

              <Box p={4} bgGradient="linear(to-r, blue.50, purple.50)" border="1px solid" borderColor="purple.100" rounded="lg">
                <HStack justify="space-between" mb={3}>
                  <Text fontWeight="bold">Impact Calculation Preview</Text>
                  <Badge colorScheme="purple">{preview.verificationMultiplier.toFixed(1)}×</Badge>
                </HStack>
                <SimpleGrid columns={{ base: 1, md: 4 }} spacing={3}>
                  <Box>
                    <Text color="text.secondary">Points Earned</Text>
                    <Text fontSize="2xl" fontWeight="bold">
                      {preview.points.toLocaleString()}
                    </Text>
                  </Box>
                  <Box>
                    <Text color="text.secondary">Impact Value</Text>
                    <Text fontSize="2xl" fontWeight="bold">{formatCurrency(preview.impactValue)}</Text>
                  </Box>
                  <Box>
                    <Text color="text.secondary">Social Capital Points</Text>
                    <Text fontSize="2xl" fontWeight="bold">{preview.scp}</Text>
                  </Box>
                  <Box>
                    <Text color="text.secondary">Verification</Text>
                    <Text fontSize="lg" fontWeight="semibold">{formValues.verificationLevel}</Text>
                  </Box>
                </SimpleGrid>
              </Box>

              <Text fontSize="sm" color="text.muted">
                ESG impact data (people impacted) is aggregated publicly. Business data is private to the Transformation Leader.
              </Text>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="purple" leftIcon={<Upload size={16} />} onClick={handleSubmit}>
              Submit Impact
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isQuickOpen} onClose={onCloseQuick} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Quick Log</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Input
                placeholder="Title"
                value={formValues.title}
                onChange={(e) => setFormValues((prev) => ({ ...prev, title: e.target.value }))}
              />
              <Textarea
                placeholder="Description"
                value={formValues.description}
                onChange={(e) => setFormValues((prev) => ({ ...prev, description: e.target.value }))}
              />
              <Select
                value={formValues.activityType}
                onChange={(e) => setFormValues((prev) => ({ ...prev, activityType: e.target.value }))}
              >
                <option>Leadership Development</option>
                <option>Team Building</option>
                <option>Process Improvement</option>
                <option>Digital Transformation</option>
                <option>Mentoring</option>
                <option>Knowledge Sharing</option>
                <option>Community Engagement</option>
                <option>Sustainability</option>
                <option>Innovation</option>
                <option>Other</option>
              </Select>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="Hours"
                  value={formValues.hours}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, hours: Number(e.target.value) }))}
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="People Impacted"
                  value={formValues.peopleImpacted}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, peopleImpacted: Number(e.target.value) }))}
                />
              </SimpleGrid>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCloseQuick}>
              Cancel
            </Button>
            <Button colorScheme="purple" onClick={handleSubmit} leftIcon={<Upload size={16} />}>
              Submit
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}

const InfoIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)
