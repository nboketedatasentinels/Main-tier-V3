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
  Upload,
  Users,
} from 'lucide-react'
import { addDoc, collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { format, isAfter, isBefore, startOfMonth, subMonths } from 'date-fns'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { ESGCategory } from '@/types'

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

  const preview = useMemo(() => calculateImpactPreview(formValues), [formValues])

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
    if (!profile?.companyId) return

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

    const list = activeTab === 'personal' ? entries : companyEntries
    return list.filter((entry) => {
      const entryDate = new Date(entry.date)
      return !isBefore(entryDate, start) && isBefore(entryDate, nextMonth)
    })
  }, [activeTab, companyEntries, entries, monthCursor])

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
      const payload: Omit<ImpactLogEntry, 'id'> = {
        userId: user.uid,
        companyId: profile?.companyId,
        title: formValues.title || 'Impact Activity',
        description: formValues.description || '',
        categoryGroup: formValues.categoryGroup || 'esg',
        esgCategory: formValues.categoryGroup === 'esg' ? formValues.esgCategory : undefined,
        activityType: formValues.categoryGroup === 'esg' ? formValues.activityType : undefined,
        businessCategory: formValues.categoryGroup === 'business' ? formValues.businessCategory : undefined,
        businessActivity: formValues.categoryGroup === 'business' ? formValues.businessActivity : undefined,
        liftPillars: getPillarsForActivity(
          formValues.categoryGroup === 'esg' ? formValues.activityType : formValues.businessActivity,
        ),
        date: formValues.date || format(new Date(), 'yyyy-MM-dd'),
        hours: Number(formValues.hours) || 0,
        peopleImpacted: Number(formValues.peopleImpacted) || 0,
        usdValue: Number(formValues.usdValue) || 0,
        outcomeLabel: formValues.outcomeLabel,
        verificationLevel: formValues.verificationLevel || 'Tier 1: Self-Reported',
        verifierEmail: formValues.verifierEmail,
        evidenceLink: formValues.evidenceLink,
        points: preview.points,
        impactValue: preview.impactValue,
        scp: preview.scp,
        verificationMultiplier: preview.verificationMultiplier,
        createdAt: new Date().toISOString(),
      }

      await addDoc(collection(db, 'impact_logs'), payload)

      toast({
        title: 'Impact logged successfully!',
        description: `You earned ${preview.points} points`,
        status: 'success',
      })
      onClose()
    } catch (error) {
      toast({
        title: 'Unable to log impact',
        description: (error as Error).message,
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
          <Heading size="lg" color="gray.900">
            Impact Log
          </Heading>
          <Text color="gray.600">Track and measure your real-world impact</Text>
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
              <Stat key={card.label} p={4} bg="white" shadow="xs" rounded="lg" border="1px solid" borderColor="gray.100">
                <HStack justify="space-between" mb={3}>
                  <Box p={2} rounded="full" bg={`${card.color}10`} color={card.color}>
                    <Icon as={card.icon} />
                  </Box>
                  <Tooltip label={card.help}>
                    <Icon as={InfoIcon} color="gray.400" />
                  </Tooltip>
                </HStack>
                <StatLabel color="gray.600">{card.label}</StatLabel>
                <StatNumber color="gray.900" fontSize="xl">
                  {card.label === 'USD Saved/Created' ? card.value : card.value.toLocaleString()}
                </StatNumber>
                <StatHelpText>{card.help}</StatHelpText>
              </Stat>
            ))}
          </SimpleGrid>

          <Grid templateColumns={{ base: '1fr', xl: '1.2fr 1fr' }} gap={4} mb={6}>
            <Box p={4} bg="white" rounded="lg" border="1px solid" borderColor="gray.100" shadow="xs">
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

            <Box p={4} bg="white" rounded="lg" border="1px solid" borderColor="gray.100" shadow="xs">
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

          <TableContainer bg="white" border="1px solid" borderColor="gray.100" rounded="lg" shadow="xs">
            <Table size="sm">
              <Thead bg="gray.50">
                <Tr>
                  <Th>Date</Th>
                  <Th>Title</Th>
                  <Th>Category</Th>
                  <Th isNumeric>Hours</Th>
                  <Th isNumeric>USD</Th>
                  <Th isNumeric>People</Th>
                  <Th>Verification</Th>
                </Tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <Tr>
                    <Td colSpan={7}>
                      <Skeleton height="18px" />
                    </Td>
                  </Tr>
                ) : filteredEntries.length === 0 ? (
                  <Tr>
                    <Td colSpan={7}>
                      <Text color="gray.500">No entries found for this period.</Text>
                    </Td>
                  </Tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <Tr key={entry.id} _hover={{ bg: 'gray.50' }}>
                      <Td>{format(new Date(entry.date), 'dd MMM yyyy')}</Td>
                      <Td>
                        <Text fontWeight="semibold">{entry.title}</Text>
                        <Text color="gray.500" fontSize="sm" noOfLines={1}>
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

            <Box p={4} bg="white" border="1px solid" borderColor="gray.100" rounded="lg" shadow="xs">
              <HStack mb={3}>
                <Icon as={TrendingUp} color="purple.500" />
                <Text fontWeight="bold">Impact Momentum</Text>
              </HStack>
              <Stack spacing={2}>
                <Flex align="center" justify="space-between">
                  <Text color="gray.600">Points Today</Text>
                  <Badge colorScheme="purple">{stats.points.toLocaleString()}</Badge>
                </Flex>
                <Flex align="center" justify="space-between">
                  <Text color="gray.600">Hours this month</Text>
                  <Badge colorScheme="blue">{stats.hours}</Badge>
                </Flex>
                <Divider />
                <Text color="gray.700" fontWeight="medium">
                  Daily micro-challenge progress
                </Text>
                <Button w="full" colorScheme="purple" onClick={onOpen}>
                  Log Impact Now
                </Button>
              </Stack>
            </Box>

            <Box p={4} bg="gray.900" color="white" rounded="lg" shadow="md" border="1px solid" borderColor="purple.700">
              <Text fontSize="lg" fontWeight="bold" mb={2}>
                Gamification Goals
              </Text>
              <Text color="purple.100">Keep your streak alive by logging impact every day.</Text>
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

            <Box p={4} bg="white" border="1px solid" borderColor="gray.100" rounded="lg" shadow="xs">
              <Text fontWeight="bold" mb={2}>
                Privacy & Consent
              </Text>
              <Text color="gray.600">
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
                  colorScheme={formValues.categoryGroup === 'esg' ? 'green' : 'gray'}
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
                  colorScheme={formValues.categoryGroup === 'business' ? 'blue' : 'gray'}
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
                    <Badge key={pillar} colorScheme={liftPillarColors[pillar] as any} px={2} py={1} rounded="md">
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
                <Text fontSize="sm" color="gray.500">
                  Provide specific details about what you did and the outcomes achieved
                </Text>
              </Box>

              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <Icon as={Clock} color="gray.400" />
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
                    <Icon as={Users} color="gray.400" />
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
                    <Icon as={ShieldCheck} color="gray.400" />
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
                      <Icon as={LinkIcon} color="gray.400" />
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
                    <Text color="gray.600">Points Earned</Text>
                    <Text fontSize="2xl" fontWeight="bold">
                      {preview.points.toLocaleString()}
                    </Text>
                  </Box>
                  <Box>
                    <Text color="gray.600">Impact Value</Text>
                    <Text fontSize="2xl" fontWeight="bold">{formatCurrency(preview.impactValue)}</Text>
                  </Box>
                  <Box>
                    <Text color="gray.600">Social Capital Points</Text>
                    <Text fontSize="2xl" fontWeight="bold">{preview.scp}</Text>
                  </Box>
                  <Box>
                    <Text color="gray.600">Verification</Text>
                    <Text fontSize="lg" fontWeight="semibold">{formValues.verificationLevel}</Text>
                  </Box>
                </SimpleGrid>
              </Box>

              <Text fontSize="sm" color="gray.500">
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

const InfoIcon = (props: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)
