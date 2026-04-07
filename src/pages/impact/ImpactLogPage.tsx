import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
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
  Spinner,
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
  Checkbox,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  useBreakpointValue,
  useDisclosure,
  useToast,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import { Tooltip as RechartsTooltip, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Leaf,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
  Upload,
  Users,
  Share2,
  Linkedin,
  Twitter,
  Instagram,
} from 'lucide-react'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { FirebaseError } from 'firebase/app'
import { format, isAfter, isBefore, startOfMonth, subMonths } from 'date-fns'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'
import { ESGCategory } from '@/types'
import {
  BUSINESS_CATEGORY_HELPER_TEXT,
  BUSINESS_PRIMARY_CATEGORIES,
  BUSINESS_SECONDARY_WASTES,
  DEFAULT_BUSINESS_WASTE,
  ESG_CATEGORY_HELPER_TEXT,
  businessCategoryRequiresWaste,
  getActivityTypesForBusinessCategory,
  getActivityTypesForEsgCategory,
  getDefaultActivityTypeForCategory,
  getLiftPillarsForSelection,
  isActivityTypeAllowedForCategory,
  isValidBusinessWaste,
  toCanonicalActivityType,
  type ActivityType,
  type BusinessPrimaryCategory,
  type BusinessSecondaryWaste,
} from '@/config/impactLogMappings'
import { isFreeUser } from '@/utils/membership'
import { removeUndefinedFields } from '@/utils/firestore';
import { JOURNEY_META, getActivitiesForJourney, getMonthNumber, type ActivityDef, type JourneyType } from '@/config/pointsConfig';
import { awardChecklistPoints, revokeChecklistPoints } from '@/services/pointsService';
import { awardPointsForImpactLog } from '@/services/pointsTransactionService'
import PointsDashboard from '@/components/PointsDashboard'
import { generateImpactPdfReport } from '@/reports/impactPdfReport'
import { isValidUrl } from '@/utils/validation';
import { awardBadge } from '@/services/badgeService';
import type { IDetectedBarcode } from '@yudiel/react-qr-scanner'
import { Scanner } from '@yudiel/react-qr-scanner'
import { validateOrganizationPartner } from '@/services/organizationService'
import { syncPartnerImpactLogs } from '@/services/partnerImpactService'
/**
 * Represents a single impact log entry.
 * The requirements for `verifierEmail` and `evidenceLink` are conditional based on the `verificationLevel`.
 */
export interface ImpactLogEntry {
  id: string
  userId: string
  sourcePlatform?: 'transformation_tier' | 't4l_partner'
  sourceRecordId?: string
  sourceSyncedAt?: string
  readOnly?: boolean
  companyId?: string
  title: string
  description: string
  categoryGroup: 'esg' | 'business'
  esgCategory?: ESGCategory
  activityType?: ActivityType | string
  businessCategory?: BusinessPrimaryCategory
  businessActivity?: BusinessSecondaryWaste | string
  liftPillars?: string[]
  date: string
  hours: number
  peopleImpacted: number
  usdValue?: number
  outcomeLabel?: string
  /**
   * The level of verification for the impact log entry.
   * - 'Tier 1: Self-Reported': No additional evidence required.
   * - 'Tier 2: Partner Verified': `verifierEmail` is required.
   * - 'Tier 3: Evidence Uploaded': `evidenceLink` is required.
   * - 'Tier 4: Third-Party Verified': Both `verifierEmail` and `evidenceLink` are required.
   */
  verificationLevel: string
  /** The email of the person who can verify the impact. Required for Tier 2 and Tier 4. */
  verifierEmail?: string
  /** A URL to evidence supporting the impact. Required for Tier 3 and Tier 4. */
  evidenceLink?: string
  transformationPartnerId?: string
  transformationPartnerName?: string
  partnerValidationStatus?: 'active' | 'inactive' | 'unknown'
  points: number
  impactValue: number
  scp: number
  verificationMultiplier: number
  unitRateApplied?: number
  volHourRateApplied?: number
  sasbTopic?: string
  usdValueSource?: 'auto' | 'manual'
  createdAt: string
}

type VerificationTier =
  | 'Tier 1: Self-Reported'
  | 'Tier 2: Partner Verified'
  | 'Tier 3: Evidence Uploaded'
  | 'Tier 4: Third-Party Verified'

const verificationMultipliers: Record<VerificationTier, number> = {
  'Tier 1: Self-Reported': 1,
  'Tier 2: Partner Verified': 1.5,
  'Tier 3: Evidence Uploaded': 2,
  'Tier 4: Third-Party Verified': 2.5,
}

const verificationRequirements: Record<VerificationTier, { verifierEmail: boolean; evidenceLink: boolean; description: string }> = {
  'Tier 1: Self-Reported': {
    verifierEmail: false,
    evidenceLink: false,
    description: 'Standard, self-reported impact. No external validation required.',
  },
  'Tier 2: Partner Verified': {
    verifierEmail: true,
    evidenceLink: false,
    description: 'Requires an email from a colleague or manager who can verify the impact.',
  },
  'Tier 3: Evidence Uploaded': {
    verifierEmail: false,
    evidenceLink: true,
    description: 'Requires a link to supporting evidence (e.g., document, presentation, video).',
  },
  'Tier 4: Third-Party Verified': {
    verifierEmail: true,
    evidenceLink: true,
    description: 'Requires both an external verifier email and a link to evidence.',
  },
}

const basePoints = 500

const VOLUNTEER_HOURLY_RATE = 33.49
const DEFAULT_ESG_UNIT_RATE = 150

const formatVerificationLabel = (
  _entry: Partial<ImpactLogEntry> & { verificationTier?: string },
): string => {
  // Always display a simple "Tier 1" label in the UI,
  // regardless of the underlying verification tier value.
  // This keeps the backend logic intact while simplifying what users see.
  return 'Tier 1'
}

type EsgRateConfig = {
  unit: string
  rate: number
  sasbTopic: string
}

const ESG_RATE_CONFIG: Partial<Record<ESGCategory, Record<string, EsgRateConfig>>> = {
  [ESGCategory.ENVIRONMENTAL]: {
    'Tree Planting': { unit: 'Trees planted', rate: 5.0, sasbTopic: 'Ecological Impacts' },
    'Clean-up Drive': { unit: 'Kg waste collected', rate: 2.5, sasbTopic: 'Waste & Hazardous Materials' },
    'Carbon Reduction': { unit: 'Tonnes CO2 avoided', rate: 50.0, sasbTopic: 'GHG Emissions' },
    'Water Conservation': { unit: 'Litres saved', rate: 0.005, sasbTopic: 'Water & Wastewater Mgmt' },
    'Renewable Energy': { unit: 'kWh generated', rate: 0.1, sasbTopic: 'Energy Management' },
    Other: { unit: 'Units', rate: DEFAULT_ESG_UNIT_RATE, sasbTopic: 'General' },
  },
  [ESGCategory.SOCIAL]: {
    'Training / Workshop': { unit: 'People trained', rate: 150.0, sasbTopic: 'Human Capital Development' },
    Mentorship: { unit: 'People mentored', rate: 500.0, sasbTopic: 'Human Capital Development' },
    'Community Engagement': { unit: 'People reached', rate: 25.0, sasbTopic: 'Community Relations' },
    'Health Initiative': { unit: 'People served', rate: 75.0, sasbTopic: 'Access & Affordability' },
    'Education Access': { unit: 'Learners supported', rate: 100.0, sasbTopic: 'Human Capital Development' },
    'Job Creation / Placement': { unit: 'Jobs created', rate: 2000.0, sasbTopic: 'Labour Practices' },
    Volunteering: { unit: 'Volunteer hours', rate: 33.49, sasbTopic: 'Community Relations' },
  },
  [ESGCategory.GOVERNANCE]: {
    'Policy Development': { unit: 'Policies created', rate: 3000.0, sasbTopic: 'Business Ethics' },
    'Compliance Training': { unit: 'People trained', rate: 200.0, sasbTopic: 'Business Ethics' },
    'Board Advisory': { unit: 'Orgs advised', rate: 5000.0, sasbTopic: 'Mgmt of Legal & Regulatory' },
    'Digital Transformation': { unit: 'Orgs transformed', rate: 10000.0, sasbTopic: 'Systemic Risk Mgmt' },
    'Transparency Initiative': { unit: 'Reports published', rate: 2500.0, sasbTopic: 'Business Ethics' },
  },
}

const getEsgRateInfo = (
  values: Partial<ImpactLogEntry>,
): { unitRate: number; unitLabel: string; sasbTopic: string } => {
  if (values.categoryGroup !== 'esg' || !values.esgCategory) {
    return { unitRate: Number(values.usdValue) || 0, unitLabel: 'USD (manual)', sasbTopic: 'General' }
  }

  const categoryRates = ESG_RATE_CONFIG[values.esgCategory]
  const activityKey = (values.activityType || '').toString()

  const match =
    (categoryRates && categoryRates[activityKey]) ||
    categoryRates?.Other ||
    { unit: 'Units', rate: DEFAULT_ESG_UNIT_RATE, sasbTopic: 'General' }

  return { unitRate: match.rate, unitLabel: match.unit, sasbTopic: match.sasbTopic }
}

const computeEsgUsdValue = (values: Partial<ImpactLogEntry>): number => {
  if (values.categoryGroup !== 'esg') {
    return Number(values.usdValue) || 0
  }

  // For ESG, we treat `peopleImpacted` as the generic impact unit count
  // (people, trees, kg, litres, kWh, etc., depending on activity).
  const impactUnits = Number(values.peopleImpacted) || 0
  const hours = Number(values.hours) || 0
  const { unitRate } = getEsgRateInfo(values)

  return impactUnits * unitRate + hours * VOLUNTEER_HOURLY_RATE
}

const getEsgBreakdown = (values: Partial<ImpactLogEntry>): {
  impactUsd: number
  hoursUsd: number
  totalUsd: number
} => {
  if (values.categoryGroup !== 'esg') {
    const usd = Number(values.usdValue) || 0
    return { impactUsd: usd, hoursUsd: 0, totalUsd: usd }
  }

  const impactUnits = Number(values.peopleImpacted) || 0
  const hours = Number(values.hours) || 0
  const { unitRate } = getEsgRateInfo(values)

  const impactUsd = impactUnits * unitRate
  const hoursUsd = hours * VOLUNTEER_HOURLY_RATE

  return { impactUsd, hoursUsd, totalUsd: impactUsd + hoursUsd }
}

export interface ExportFilters {
  dateRange: {
    start: Date
    end: Date
  }
  impactType: 'all' | 'esg' | 'business'
  esgCategory?: 'environmental' | 'social' | 'governance'
  wasteCategory?: string
  verificationTier?: 'tier_1' | 'tier_2' | 'tier_3'
  entryType?: 'all' | 'individual' | 'shared_event'
}

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const formatCategoryLabel = (value?: string) => {
  if (!value) return 'the selected category'
  return value
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const BUSINESS_WASTE_HELPER_TEXT: Record<string, string> = {
  Defects:
    'Errors, rework, or mistakes that require additional time and resources to fix (e.g., incorrect reports or products).',
  Overproduction:
    'Producing more than is needed or earlier than needed, tying up time and resources without creating value.',
  Waiting:
    'Idle time when people, information, or materials are delayed and cannot move to the next step in the process.',
  'Non-Utilized Talent':
    'Underusing people’s skills, creativity, or experience, such as not involving the right people in problem-solving.',
  Transportation:
    'Unnecessary movement of materials, products, or information between locations that does not add value.',
  Inventory:
    'Holding more stock, work-in-progress, or information than needed, which can hide problems and increase cost.',
  Motion:
    'Unnecessary movement of people within a workspace (searching, walking, reaching) caused by poor layout or tools.',
  'Extra Processing':
    'Doing more work than required (over-processing), such as unnecessary approvals, features, or formatting.',
}

/* Temporarily unused helper kept for future CSV export wiring.
const buildCsv = (entries: ImpactLogEntry[]) => {
  const headers = [
    'Source',
    'Source Record ID',
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
    'Outcome Label',
    'Evidence',
  ]

  const rows = entries.map((entry) => [
    entry.sourcePlatform || 'transformation_tier',
    entry.sourceRecordId || '',
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
    entry.outcomeLabel || '',
    entry.evidenceLink || '',
  ])

  return [headers, ...rows].map((row) => row.join(',')).join('\n')
}
*/

const calculateImpactPreview = (values: Partial<ImpactLogEntry>) => {
  const verificationMultiplier = verificationMultipliers[(values.verificationLevel || 'Tier 1: Self-Reported') as VerificationTier] || 1
  const categoryMultiplier = values.categoryGroup === 'business' ? 1.15 : 1
  const hours = Number(values.hours) || 0
  const usd = values.categoryGroup === 'esg' ? computeEsgUsdValue(values) : Number(values.usdValue) || 0
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

type BulkUploadRow = {
  rowIndex: number
  raw: Record<string, string>
  errors: string[]
}

export const ImpactLogPage: React.FC = () => {
  const { user, profile } = useAuth()
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [activeTab, setActiveTab] = useState<'personal' | 'company'>('personal')
  const [entries, setEntries] = useState<ImpactLogEntry[]>([])
  const [companyEntries, setCompanyEntries] = useState<ImpactLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [monthCursor, setMonthCursor] = useState<Date>(new Date())
  const [, setPartnerSync] = useState<{
    status: 'idle' | 'syncing' | 'success' | 'skipped' | 'error'
    message?: string
    importedCount?: number
    updatedCount?: number
    lastSyncedAt?: string
  }>({ status: 'idle' })
  const [partnerValidation, setPartnerValidation] = useState<{
    status: 'idle' | 'loading' | 'valid' | 'invalid' | 'error'
    partnerId?: string
    partnerName?: string
    message?: string
  }>({ status: 'idle' })
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [bulkFileName, setBulkFileName] = useState<string | null>(null)
  const [bulkRows, setBulkRows] = useState<BulkUploadRow[]>([])
  const [bulkValidCount, setBulkValidCount] = useState(0)
  const [bulkErrorCount, setBulkErrorCount] = useState(0)
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [, setExportMode] = useState<'csv' | 'pdf'>('csv')
  const [isPdfExporting, setIsPdfExporting] = useState(false)
  const [isSubmittingImpact, setIsSubmittingImpact] = useState(false)
  const shareDisclosure = useDisclosure()
  const [exportFilters, setExportFilters] = useState<ExportFilters>(() => {
    const start = startOfMonth(new Date())
    const end = new Date()
    return {
      dateRange: { start, end },
      impactType: 'all',
      entryType: 'all',
    }
  })
  const defaultEsgCategory = ESGCategory.ENVIRONMENTAL
  const defaultBusinessCategory = BUSINESS_PRIMARY_CATEGORIES[0]
  const [formValues, setFormValues] = useState<Partial<ImpactLogEntry>>({
    title: '',
    description: '',
    categoryGroup: 'esg',
    esgCategory: defaultEsgCategory,
    activityType: 'Tree Planting',
    businessCategory: defaultBusinessCategory,
    businessActivity: DEFAULT_BUSINESS_WASTE,
    hours: 0,
    peopleImpacted: 0,
    usdValue: 0,
    verificationLevel: 'Tier 1: Self-Reported',
    date: format(new Date(), 'yyyy-MM-dd'),
  })
  const isEsgActive = formValues.categoryGroup === 'esg'
  const isBusinessActive = formValues.categoryGroup === 'business'
  const esgActivityOptions = useMemo(() => {
    if (formValues.esgCategory === ESGCategory.ENVIRONMENTAL) {
      return [
        'Tree Planting',
        'Clean-up Drive',
        'Carbon Reduction',
        'Water Conservation',
        'Renewable Energy',
        'Other',
      ]
    }
    return getActivityTypesForEsgCategory(formValues.esgCategory)
  }, [formValues.esgCategory])
  const businessActivityOptions = useMemo(
    () => getActivityTypesForBusinessCategory(formValues.businessCategory),
    [formValues.businessCategory],
  )
  const activityTypeOptions = isEsgActive ? esgActivityOptions : businessActivityOptions
  const activityTypeCategoryLabel = isEsgActive ? formValues.esgCategory : formValues.businessCategory
  const isBusinessWasteRequired = businessCategoryRequiresWaste(formValues.businessCategory)
  const liftPillars = useMemo(
    () =>
      getLiftPillarsForSelection({
        categoryGroup: formValues.categoryGroup,
        esgCategory: formValues.esgCategory,
        businessCategory: formValues.businessCategory,
        activityType: formValues.activityType,
        businessActivity: formValues.businessActivity,
      }),
    [
      formValues.activityType,
      formValues.businessActivity,
      formValues.businessCategory,
      formValues.categoryGroup,
      formValues.esgCategory,
    ],
  )

  const preview = useMemo(() => calculateImpactPreview(formValues), [formValues])
  const esgBreakdown = useMemo(
    () => getEsgBreakdown(formValues),
    [
      formValues.categoryGroup,
      formValues.esgCategory,
      formValues.activityType,
      formValues.peopleImpacted,
      formValues.hours,
      formValues.usdValue,
    ],
  )
  const isTier2Eligible = partnerValidation.status === 'valid'
  const tier2HelperText = isTier2Eligible
    ? partnerValidation.partnerName
      ? `Partner verified with ${partnerValidation.partnerName}.`
      : 'Partner verification is available for your organization.'
    : partnerValidation.message || 'Tier 2 verification requires partner program enrollment.'

  const handleCategoryGroupChange = (group: 'esg' | 'business') => {
    setFormValues((prev) => {
      if (group === 'esg') {
        const nextEsgCategory = prev.esgCategory || defaultEsgCategory
        const nextActivity =
          nextEsgCategory === ESGCategory.ENVIRONMENTAL
            ? 'Tree Planting'
            : getDefaultActivityTypeForCategory('esg', nextEsgCategory, prev.activityType)
        return {
          ...prev,
          categoryGroup: 'esg',
          esgCategory: nextEsgCategory,
          activityType: nextActivity,
          businessCategory: undefined,
          businessActivity: undefined,
        }
      }

      const nextBusinessCategory = prev.businessCategory || defaultBusinessCategory
      const requiresWaste = businessCategoryRequiresWaste(nextBusinessCategory)
      return {
        ...prev,
        categoryGroup: 'business',
        businessCategory: nextBusinessCategory,
        activityType: getDefaultActivityTypeForCategory('business', nextBusinessCategory, prev.activityType),
        businessActivity: requiresWaste ? prev.businessActivity || DEFAULT_BUSINESS_WASTE : undefined,
        esgCategory: undefined,
      }
    })
  }

  const handleEsgCategoryChange = (category: ESGCategory) => {
    setFormValues((prev) => ({
      ...prev,
      esgCategory: category,
      activityType: getDefaultActivityTypeForCategory('esg', category, prev.activityType),
    }))
  }

  const handleBusinessCategoryChange = (category: BusinessPrimaryCategory) => {
    const requiresWaste = businessCategoryRequiresWaste(category)
    setFormValues((prev) => ({
      ...prev,
      businessCategory: category,
      activityType: getDefaultActivityTypeForCategory('business', category, prev.activityType),
      businessActivity: requiresWaste ? DEFAULT_BUSINESS_WASTE : undefined,
    }))
  }

  const handleActivityTypeChange = (value: string) => {
    setFormValues((prev) => ({
      ...prev,
      activityType: toCanonicalActivityType(value) || value,
    }))
  }

  const resolveJourneyType = (): JourneyType => {
    if (profile?.journeyType) return profile.journeyType
    return isFreeUser(profile) ? '4W' : '6W'
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

  const isPartnerSyncedEntry = (entry: ImpactLogEntry) => entry.sourcePlatform === 't4l_partner'

  const runPartnerSync = async (forceFullRefresh = false) => {
    if (!user?.uid) return
    setPartnerSync({ status: 'syncing' })

    try {
      const result = await syncPartnerImpactLogs({ forceFullRefresh })
      setPartnerSync({
        status: result.status,
        message: result.message,
        importedCount: result.importedCount,
        updatedCount: result.updatedCount,
        lastSyncedAt: result.lastSyncedAt,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Partner impact sync failed.'
      setPartnerSync({
        status: 'error',
        message,
      })
    }
  }

  useEffect(() => {
    let isMounted = true

    if (!profile?.companyId) {
      setPartnerValidation({
        status: 'invalid',
        message: 'Tier 2 verification is available only for organizations enrolled in the partner program.',
      })
      return () => {
        isMounted = false
      }
    }

    setPartnerValidation({ status: 'loading' })

    validateOrganizationPartner(profile.companyId)
      .then((result) => {
        if (!isMounted) return
        if (result.isValid) {
          setPartnerValidation({
            status: 'valid',
            partnerId: result.partnerId,
            partnerName: result.partnerName,
          })
        } else {
          setPartnerValidation({
            status: 'invalid',
            message: result.message || 'Partner program enrollment could not be validated.',
          })
        }
      })
      .catch((error) => {
        if (!isMounted) return
        const message = error instanceof Error ? error.message : 'Unable to verify partner enrollment right now.'
        setPartnerValidation({ status: 'error', message })
      })

    return () => {
      isMounted = false
    }
  }, [profile?.companyId])

  useEffect(() => {
    if (!isTier2Eligible && formValues.verificationLevel === 'Tier 2: Partner Verified') {
      setFormValues((prev) => ({
        ...prev,
        verificationLevel: 'Tier 1: Self-Reported',
        verifierEmail: '',
      }))
    }
  }, [formValues.verificationLevel, isTier2Eligible])

  useEffect(() => {
    if (!user?.uid) return
    void runPartnerSync(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) return

    const q = query(collection(db, 'impact_logs'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ImpactLogEntry[]
      setEntries(data)
      setLoading(false)
    }, (error) => {
      console.error('[ImpactLog] Personal entries listener error:', error)
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
    }, (error) => {
      console.error('[ImpactLog] Company entries listener error:', error)
    })

    return () => unsubscribe()
  }, [profile?.companyId])

  const filteredEntries = useMemo(() => {
    const start = startOfMonth(monthCursor)
    const nextMonth = new Date(start)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    const list = activeTab === 'personal' || !profile?.companyId ? entries : companyEntries
    const inRange = list.filter((entry) => {
      const entryDate = new Date(entry.date)
      return !isBefore(entryDate, start) && isBefore(entryDate, nextMonth)
    })

    // Sort so the most recently dated activity appears at the top
    return inRange.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
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

  const stats = useMemo(
    () => ({
      activities: filteredEntries.length,
      people: filteredEntries.reduce((sum, e) => sum + (e.peopleImpacted || 0), 0),
      hours: filteredEntries.reduce((sum, e) => sum + (e.hours || 0), 0),
      usd: filteredEntries.reduce((sum, e) => sum + (e.usdValue || 0), 0),
    }),
    [filteredEntries],
  )

  const buildShareMessage = () => {
    const parts: string[] = []

    if (stats.activities) {
      parts.push(
        `${stats.activities} impact ${stats.activities === 1 ? 'activity' : 'activities'}`,
      )
    }
    if (stats.people) {
      parts.push(`${stats.people.toLocaleString()} people impacted`)
    }
    if (stats.hours) {
      parts.push(`${stats.hours.toLocaleString()} hours contributed`)
    }
    if (stats.usd) {
      parts.push(`${formatCurrency(stats.usd || 0)} in estimated value`)
    }

    const summary =
      parts.length > 0
        ? parts.join(' • ')
        : 'Tracking my impact with Transformation Tier.'

    return `Proud to share my recent impact: ${summary}`
  }

  const handleShareSummary = (platform: 'linkedin' | 'x' | 'instagram') => {
    try {
      const text = buildShareMessage()

      const fallbackUrl =
        typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APP_BASE_URL
          ? (import.meta as any).env.VITE_APP_BASE_URL
          : ''

      const url =
        typeof window !== 'undefined' && window.location?.href
          ? window.location.href
          : fallbackUrl

      const encodedText = encodeURIComponent(text)
      const encodedUrl = encodeURIComponent(url)

      let shareUrl = ''

      switch (platform) {
        case 'linkedin':
          shareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedText}`
          break
        case 'x':
          shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`
          break
        case 'instagram': {
          if (typeof navigator !== 'undefined' && (navigator as any).clipboard) {
            ;(navigator as any).clipboard
              .writeText(url ? `${text} ${url}` : text)
              .catch(() => {
                // ignore clipboard errors
              })
          }
          shareUrl = 'https://www.instagram.com/'
          toast({
            title: 'Caption copied',
            description: 'Your impact caption has been copied. Paste it into Instagram.',
            status: 'info',
          })
          break
        }
      }

      if (shareUrl && typeof window !== 'undefined') {
        window.open(shareUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
      console.error('[ImpactLog] Failed to open share window', error)
      toast({
        title: 'Unable to share right now',
        description: 'Please try again in a moment.',
        status: 'error',
      })
    }
  }

  const applyFilters = (entriesToFilter: ImpactLogEntry[], filters: ExportFilters): ImpactLogEntry[] => {
    return entriesToFilter.filter((entry) => {
      const entryDate = new Date(entry.date)
      if (isBefore(entryDate, filters.dateRange.start) || isAfter(entryDate, filters.dateRange.end)) {
        return false
      }

      if (filters.impactType === 'esg' && entry.categoryGroup !== 'esg') return false
      if (filters.impactType === 'business' && entry.categoryGroup !== 'business') return false

      if (filters.esgCategory && entry.esgCategory !== filters.esgCategory) return false

      if (filters.wasteCategory && (entry as any).wastePrimary !== filters.wasteCategory) return false

      if (filters.verificationTier && (entry as any).verificationTier !== filters.verificationTier) return false

      if (filters.entryType && filters.entryType !== 'all') {
        const entryType = (entry as any).entryType || 'individual'
        if (filters.entryType === 'individual' && entryType === 'shared_event') return false
        if (filters.entryType === 'shared_event' && entryType !== 'shared_event') return false
      }

      return true
    })
  }

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const formatIntegerCsv = (value: number): string => {
    return Number.isFinite(value) ? value.toLocaleString('en-US') : '0'
  }

  const formatDecimalCsv = (value: number): string => {
    const n = Number.isFinite(value) ? value : 0
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const exportImpactCsv = (filters: ExportFilters) => {
    const allEntries = activeTab === 'personal' || !profile?.companyId ? entries : companyEntries
    const filtered = applyFilters(allEntries, filters)

    if (!filtered.length) {
      toast({
        title: 'No data to export',
        description: 'Try widening your date range or filter settings.',
        status: 'info',
      })
      return
    }

    const headers = [
      'Source',
      'Source Record ID',
      'Date',
      'Title',
      'Description',
      'Category Group',
      'ESG Category',
      'Business Category',
      'Activity Type',
      'Hours',
      'People Impacted',
      'USD Value',
      'USD Value Source',
      'Verification Tier',
      'Verifier Name',
      'Verified At',
      'SASB Topic',
      'Entry Type',
      'Event ID',
      'Evidence URL',
      'Outcome Statement',
      'Waste Primary',
      'Improvement Method',
    ]

    const rows = filtered.map((entry) => {
      const usdSource =
        (entry as any).usdValueSource || (entry.categoryGroup === 'esg' ? 'auto' : 'user_entered')
      const verificationTier = (entry as any).verificationTier || 'tier_1'
      const hours = entry.hours || 0
      const people = entry.peopleImpacted || 0
      const usd = entry.usdValue ?? 0

      return [
        entry.sourcePlatform || 'transformation_tier',
        entry.sourceRecordId || '',
        entry.date,
        entry.title,
        entry.description,
        entry.categoryGroup,
        entry.esgCategory || '',
        (entry as any).businessCategory || '',
        entry.activityType || entry.businessActivity || '',
        formatDecimalCsv(hours),
        formatIntegerCsv(people),
        formatDecimalCsv(usd),
        usdSource,
        verificationTier,
        (entry as any).verifierName || '',
        (entry as any).verifiedAt || '',
        (entry as any).sasbTopic || '',
        (entry as any).entryType || 'individual',
        (entry as any).eventId || '',
        entry.evidenceLink || '',
        (entry as any).outcomeStatement || '',
        (entry as any).wastePrimary || (entry as any).businessActivity || '',
        (entry as any).improvementMethod || '',
      ]
    })

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const filename = `impact-report-${format(exportFilters.dateRange.start, 'yyyy-MM')}.csv`
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;')
  }

  const BULK_HEADERS = [
    'impact_type',
    'date',
    'activity_title',
    'description',
    'esg_category',
    'esg_activity_type',
    'people_impacted',
    'hours_contributed',
    'waste_primary',
    'waste_secondary',
    'improvement_method',
    'usd_saved',
    'outcome_statement',
    'evidence_url',
    'usd_value',
    'verification_tier',
  ] as const

  type BulkHeader = (typeof BULK_HEADERS)[number]

  const downloadBulkTemplate = () => {
    const headerLine = BULK_HEADERS.join(',')
    const csv = headerLine
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'impactlog-bulk-template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const parseBulkCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) return []
    const [headerLine, ...dataLines] = lines
    const headers = headerLine.split(',').map((h) => h.replace(/^"|"$/g, '').trim()) as BulkHeader[]
    const headerIndex: Record<string, number> = {}
    headers.forEach((h, idx) => {
      headerIndex[h] = idx
    })

    const rows: BulkUploadRow[] = dataLines.map((line, idx) => {
      const cols = line.split(',')
      const raw: Record<string, string> = {}
      BULK_HEADERS.forEach((h) => {
        const value = cols[headerIndex[h] ?? -1] ?? ''
        raw[h] = value.replace(/^"|"$/g, '').trim()
      })
      return { rowIndex: idx + 2, raw, errors: [] } // +2 for header and 1-indexing
    })

    return rows
  }

  const validateBulkRows = (rows: BulkUploadRow[]): BulkUploadRow[] => {
    const now = new Date()
    const existingKeys = new Set(
      entries.map(
        (e) => `${e.date}__${(e.title || '').toLowerCase()}__${e.categoryGroup === 'esg' ? 'esg' : 'business_outcome'}`,
      ),
    )
    const seenKeys = new Set<string>()

    return rows.map((row) => {
      const errors: string[] = []
      const get = (h: BulkHeader) => row.raw[h] || ''

      const impactType = get('impact_type').toLowerCase()
      if (impactType !== 'esg' && impactType !== 'business_outcome') {
        errors.push('impact_type must be "esg" or "business_outcome".')
      }

      const dateStr = get('date')
      const date = dateStr ? new Date(dateStr) : null
      if (!date || Number.isNaN(date.getTime())) {
        errors.push('date is required and must be a valid YYYY-MM-DD date.')
      } else if (isAfter(date, now)) {
        errors.push('date cannot be in the future.')
      }

      const title = get('activity_title')
      if (!title) errors.push('activity_title is required.')

      const description = get('description')
      if (!description) errors.push('description is required.')

      if (impactType === 'esg') {
        const esgCategory = get('esg_category').toLowerCase()
        if (!esgCategory) errors.push('esg_category is required for ESG rows.')
        if (!get('esg_activity_type')) errors.push('esg_activity_type is required for ESG rows.')
        const people = Number(get('people_impacted') || '0')
        const hours = Number(get('hours_contributed') || '0')
        if (!people || people <= 0) errors.push('people_impacted must be a positive number for ESG rows.')
        if (hours < 0) errors.push('hours_contributed must be 0 or greater.')
        if (esgCategory && !['environmental', 'social', 'governance'].includes(esgCategory)) {
          errors.push('esg_category must be environmental, social, or governance.')
        }
      }

      if (impactType === 'business_outcome') {
        if (!get('waste_primary')) errors.push('waste_primary is required for Business Outcome rows.')
        if (!get('improvement_method')) errors.push('improvement_method is required for Business Outcome rows.')
        const usdSaved = Number(get('usd_saved') || '0')
        if (!usdSaved || usdSaved <= 0) errors.push('usd_saved must be a positive number for Business Outcome rows.')
        if (!get('outcome_statement')) errors.push('outcome_statement is required for Business Outcome rows.')

        const wasteCode = get('waste_primary').toUpperCase()
        if (!['DEF', 'OVR', 'WAI', 'NUT', 'TRA', 'INV', 'MOT', 'EXP'].includes(wasteCode)) {
          errors.push('waste_primary must be one of DEF, OVR, WAI, NUT, TRA, INV, MOT, EXP.')
        }
      }

      if (date && impactType && title) {
        const key = `${format(date, 'yyyy-MM-dd')}__${title.toLowerCase()}__${impactType}`
        if (existingKeys.has(key)) {
          errors.push('Potential duplicate: same date, title, and impact_type already exists.')
        }
        if (seenKeys.has(key)) {
          errors.push('Duplicate inside this file: same date, title, and impact_type appears multiple times.')
        }
        seenKeys.add(key)
      }

      return { ...row, errors }
    })
  }

  const handleBulkFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = String(e.target?.result || '')
      const parsed = parseBulkCsv(text)
      const validated = validateBulkRows(parsed)
      const validCount = validated.filter((r) => r.errors.length === 0).length
      const errorCount = validated.length - validCount
      setBulkFileName(file.name)
      setBulkRows(validated)
      setBulkValidCount(validCount)
      setBulkErrorCount(errorCount)
    }
    reader.readAsText(file)
  }

  const handleBulkImport = async () => {
    if (!user?.uid) return
    if (!bulkRows.length) return

    const validRows = bulkRows.filter((r) => r.errors.length === 0)
    if (!validRows.length) {
      toast({
        title: 'No valid rows to import',
        status: 'warning',
      })
      return
    }

    setIsBulkProcessing(true)
    try {
      for (const row of validRows) {
        const get = (h: BulkHeader) => row.raw[h] || ''
        const impactType = get('impact_type').toLowerCase()
        const dateStr = get('date')
        const activityTitle = get('activity_title')
        const description = get('description')
        const evidenceUrl = get('evidence_url')

        let categoryGroup: 'esg' | 'business' = 'esg'
        let esgCategory: ESGCategory | undefined
        let activityTypeValue: string | undefined
        let businessCategory: BusinessPrimaryCategory | undefined
        let businessActivity: string | undefined
        let hours = 0
        let peopleImpacted = 0
        let usdValue = 0
        let unitRateApplied: number | undefined
        let volHourRateApplied: number | undefined
        let sasbTopic: string | undefined

        if (impactType === 'esg') {
          categoryGroup = 'esg'
          const esgCatStr = get('esg_category').toLowerCase()
          if (esgCatStr === 'environmental') esgCategory = ESGCategory.ENVIRONMENTAL
          else if (esgCatStr === 'social') esgCategory = ESGCategory.SOCIAL
          else if (esgCatStr === 'governance') esgCategory = ESGCategory.GOVERNANCE
          else esgCategory = defaultEsgCategory

          activityTypeValue = get('esg_activity_type')
          hours = Number(get('hours_contributed') || '0')
          peopleImpacted = Number(get('people_impacted') || '0')

          const { unitRate, sasbTopic: topic } = getEsgRateInfo({
            categoryGroup: 'esg',
            esgCategory,
            activityType: activityTypeValue,
            peopleImpacted,
            hours,
          })
          const rawUsd = computeEsgUsdValue({
            categoryGroup: 'esg',
            esgCategory,
            activityType: activityTypeValue,
            peopleImpacted,
            hours,
          })
          usdValue = Math.round(rawUsd * 100) / 100
          unitRateApplied = unitRate
          volHourRateApplied = VOLUNTEER_HOURLY_RATE
          sasbTopic = topic
        } else {
          categoryGroup = 'business'
          businessCategory = defaultBusinessCategory
          businessActivity = get('waste_primary').toUpperCase()
          hours = Number(get('hours_contributed') || '0')
          peopleImpacted = Number(get('people_impacted') || '0')
          usdValue = Math.round(Number(get('usd_saved') || '0') * 100) / 100
        }

        const payload = removeUndefinedFields<Omit<ImpactLogEntry, 'id'>>({
          userId: user.uid,
          sourcePlatform: 'transformation_tier',
          ...(profile?.companyId ? { companyId: profile.companyId } : {}),
          title: activityTitle || 'Impact Activity',
          description: description || '',
          categoryGroup,
          activityType: activityTypeValue,
          ...(categoryGroup === 'esg'
            ? {
                esgCategory,
              }
            : {
                businessCategory,
                businessActivity,
              }),
          date: dateStr || format(new Date(), 'yyyy-MM-dd'),
          hours,
          peopleImpacted,
          usdValue,
          verificationLevel: 'Tier 1: Self-Reported',
          ...(evidenceUrl ? { evidenceLink: evidenceUrl } : {}),
          ...(unitRateApplied
            ? {
                unitRateApplied,
                volHourRateApplied,
                sasbTopic,
                usdValueSource: 'auto' as const,
              }
            : { usdValueSource: 'manual' as const }),
          points: 0,
          impactValue: 0,
          scp: 0,
          verificationMultiplier: 1,
          createdAt: new Date().toISOString(),
        })

        await addDoc(collection(db, 'impact_logs'), payload)
      }

      toast({
        title: 'Bulk upload complete',
        description: `Imported ${validRows.length} entries.`,
        status: 'success',
      })
      setIsBulkOpen(false)
      setBulkRows([])
      setBulkFileName(null)
      setBulkValidCount(0)
      setBulkErrorCount(0)
    } catch (error) {
      const message = error instanceof FirebaseError ? error.message : 'Bulk upload failed.'
      toast({
        title: 'Bulk upload error',
        description: message,
        status: 'error',
      })
    } finally {
      setIsBulkProcessing(false)
    }
  }

  const handleSubmit = async () => {
    if (!user?.uid) return

    setIsSubmittingImpact(true)
    const errors: string[] = []
    const { verificationLevel, verifierEmail, evidenceLink, description, date, hours, peopleImpacted } = formValues
    const requirements = verificationRequirements[(verificationLevel || 'Tier 1: Self-Reported') as VerificationTier]
    const categoryGroup = formValues.categoryGroup || 'esg'

    // Ensure we always have a concrete ESG category + matching activity when logging ESG impact
    let effectiveEsgCategory = formValues.esgCategory || defaultEsgCategory
    let effectiveActivityType = formValues.activityType

    if (categoryGroup === 'esg') {
      if (!effectiveActivityType || !isActivityTypeAllowedForCategory('esg', effectiveEsgCategory, effectiveActivityType)) {
        effectiveActivityType = getDefaultActivityTypeForCategory('esg', effectiveEsgCategory, effectiveActivityType)
        // Persist the auto-selected values into form state so the UI stays in sync
        setFormValues((prev) => ({
          ...prev,
          esgCategory: effectiveEsgCategory,
          activityType: effectiveActivityType,
        }))
      }

      if (!isActivityTypeAllowedForCategory('esg', effectiveEsgCategory, effectiveActivityType)) {
        errors.push('Please choose a valid activity type for the selected ESG category.')
      }
    } else {
      if (!formValues.businessCategory) {
        errors.push('Please choose a primary business category.')
      }
      if (!isActivityTypeAllowedForCategory('business', formValues.businessCategory, formValues.activityType)) {
        errors.push('Please choose a valid activity type for the selected business category.')
      }
      if (businessCategoryRequiresWaste(formValues.businessCategory)) {
        if (!isValidBusinessWaste(formValues.businessActivity)) {
          errors.push('Please choose a valid business waste activity for the selected primary category.')
        }
      }
    }

    if (!description || !date || (!hours && !peopleImpacted)) {
      errors.push('Please complete all required fields (Description, Date, and either Hours or People Impacted).')
    }

    if (requirements.verifierEmail) {
      if (!verifierEmail) {
        errors.push('Verifier email is required for this verification tier.')
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verifierEmail)) {
        errors.push('Please enter a valid verifier email address.')
      }
    }

    if (requirements.evidenceLink) {
      if (!evidenceLink) {
        errors.push('Evidence link is required for this verification tier.')
      } else {
        const urlValidation = isValidUrl(evidenceLink)
        if (!urlValidation.isValid) {
          errors.push(urlValidation.message || 'The evidence link is not a valid URL.')
        }
      }
    }

    if (verificationLevel === 'Tier 2: Partner Verified' && !isTier2Eligible) {
      errors.push(tier2HelperText)
    }

    if (errors.length > 0) {
      errors.forEach((error) => {
        toast({
          title: 'Validation Error',
          description: error,
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      })
      setIsSubmittingImpact(false)
      return
    }

    if (!attestationChecked) {
      toast({
        title: 'Attestation required',
        description: 'Please confirm that this information is accurate to the best of your knowledge.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      setIsSubmittingImpact(false)
      return
    }

    try {
      const { unitRate, sasbTopic } = getEsgRateInfo({
        ...formValues,
        esgCategory: effectiveEsgCategory,
      })
      const rawUsd =
        categoryGroup === 'esg' ? computeEsgUsdValue(formValues) : Number(formValues.usdValue) || 0
      const usdValue = Math.round(rawUsd * 100) / 100

      const payload = removeUndefinedFields<Omit<ImpactLogEntry, 'id'>>({
        userId: user.uid,
        sourcePlatform: 'transformation_tier',
        ...(profile?.companyId ? { companyId: profile.companyId } : {}),
        title: formValues.title || 'Impact Activity',
        description: formValues.description || '',
        categoryGroup,
        activityType: formValues.activityType,
        ...(categoryGroup === 'esg'
          ? {
              esgCategory: effectiveEsgCategory,
            }
          : {
              businessCategory: formValues.businessCategory,
              businessActivity: formValues.businessActivity,
            }),
        liftPillars: liftPillars,
        date: formValues.date || format(new Date(), 'yyyy-MM-dd'),
        hours: Number(formValues.hours) || 0,
        peopleImpacted: Number(formValues.peopleImpacted) || 0,
        usdValue,
        ...(categoryGroup === 'esg'
          ? {
              unitRateApplied: unitRate,
              volHourRateApplied: VOLUNTEER_HOURLY_RATE,
              sasbTopic,
              usdValueSource: 'auto' as const,
            }
          : {
              usdValueSource: 'manual' as const,
            }),
        ...(formValues.outcomeLabel ? { outcomeLabel: formValues.outcomeLabel } : {}),
        verificationLevel: formValues.verificationLevel || 'Tier 1: Self-Reported',
        ...(formValues.verifierEmail ? { verifierEmail: formValues.verifierEmail } : {}),
        ...(formValues.evidenceLink ? { evidenceLink: formValues.evidenceLink } : {}),
        ...(formValues.verificationLevel === 'Tier 2: Partner Verified'
          ? {
              transformationPartnerId: partnerValidation.partnerId,
              transformationPartnerName: partnerValidation.partnerName,
              partnerValidationStatus: isTier2Eligible ? 'active' : 'inactive',
            }
          : {}),
        points: preview.points,
        impactValue: preview.impactValue,
        scp: preview.scp,
        verificationMultiplier: preview.verificationMultiplier,
        createdAt: new Date().toISOString(),
      })

      const docRef = await addDoc(collection(db, 'impact_logs'), payload);

      // Record additional engagement points in the separate points_transactions ledger.
      try {
        await awardPointsForImpactLog(user.uid, docRef.id)
      } catch (err) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[ImpactLog] Failed to record points transaction for impact log entry', err)
        }
      }

      const impactLogsQuery = query(collection(db, 'impact_logs'), where('userId', '==', user.uid));
      const impactLogsSnapshot = await getDocs(impactLogsQuery);
      if (impactLogsSnapshot.size >= 10) {
        await awardBadge(user.uid, 'impact-master');
      }

      const journeyType = resolveJourneyType();
      const activity = resolveImpactActivity(journeyType)
      const weekNumber = resolveWeekNumberForDate(payload.date, journeyType)
      const monthNumber = getMonthNumber(weekNumber)
      const weekSuffix =
        profile?.currentWeek && profile.currentWeek !== weekNumber
          ? ` Progress has been applied to Week ${weekNumber} based on the activity date.`
          : ''
      let toastStatus: 'success' | 'warning' = 'success'
      let toastTitle = 'Impact logged successfully!'
      let toastDescription = 'Your entry has been saved.'

      if (activity) {
        const ledgerRef = doc(db, 'pointsLedger', `${user.uid}__w${weekNumber}__${activity.id}`)
        const ledgerSnap = await getDoc(ledgerRef)

        if (ledgerSnap.exists()) {
          // Impact was saved successfully, just no additional journey points
          toastDescription = "Your impact has been logged successfully."
        } else {
          const monthQuery = query(
            collection(db, 'pointsLedger'),
            where('uid', '==', user.uid),
            where('activityId', '==', activity.id),
            where('monthNumber', '==', monthNumber),
          )
          const monthSnapshot = await getDocs(monthQuery)

          if (monthSnapshot.size >= activity.maxPerMonth) {
            // Impact was saved successfully, just reached monthly limit for bonus points
            toastDescription = 'Your impact has been logged successfully.'
          } else {
            try {
              await awardChecklistPoints({
                uid: user.uid,
                journeyType,
                weekNumber,
                activity: { ...activity, points: payload.points },
                source: 'impact_log_submission',
              })
              toastTitle = 'Impact logged and journey updated!'
              toastDescription = `Your contribution has been added to your journey progress.${weekSuffix}`
            } catch (awardError) {
              if (import.meta.env.DEV) {
                console.error('Impact log points award failed', awardError)
              }
              // Impact was still saved successfully
              toastDescription = 'Your impact has been logged successfully.'
            }
          }
        }
      }

      toast({
        title: toastTitle,
        description: toastDescription,
        status: toastStatus,
      })
      setIsSubmittingImpact(false)
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
      setIsSubmittingImpact(false)
    }
  }

  const handleDeleteEntry = async (entry: ImpactLogEntry) => {
    if (!user?.uid) return
    if (isPartnerSyncedEntry(entry)) {
      toast({
        title: 'Partner-synced entry',
        description: 'This entry came from T4L Partner and cannot be deleted here.',
        status: 'info',
      })
      return
    }

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
  ]

  const isMobile = useBreakpointValue({ base: true, md: false })
  const [wizardStep, setWizardStep] = useState<'category' | 'numbers' | 'describe' | 'confirm'>('category')
  const [attestationChecked, setAttestationChecked] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [isFetchingEvent, setIsFetchingEvent] = useState(false)
  const [pendingEvent, setPendingEvent] = useState<any | null>(null)

  const impactApiBase = `${import.meta.env.VITE_IMPACT_API_BASE_URL || import.meta.env.VITE_APP_BASE_URL}/api/impact`

  const extractEventId = (data: string): string | null => {
    // Pattern: /event/{id} (Transformation Tier internal links)
    const pathMatch = data.match(/\/event\/([a-zA-Z0-9_-]+)/)
    if (pathMatch) return pathMatch[1]

    // Pattern: ?event={id} or &event={id} (any URL with event query param, including T4L Ambassador QR codes)
    const queryMatch = data.match(/[?&]event=([a-zA-Z0-9_-]+)/)
    if (queryMatch) return queryMatch[1]

    try {
      const json = JSON.parse(data)
      if (typeof json.eventId === 'string' && json.eventId.trim()) return json.eventId.trim()
    } catch {
      // not JSON
    }
    if (/^[a-zA-Z0-9_-]{8,}$/.test(data.trim())) return data.trim()
    return null
  }

  const checkExistingEventEntry = async (eventId: string, userId: string): Promise<boolean> => {
    const q = query(
      collection(db, 'impact_logs'),
      where('eventId', '==', eventId),
      where('userId', '==', userId),
    )
    const snapshot = await getDocs(q)
    return !snapshot.empty
  }

  const fetchSharedEvent = async (eventId: string) => {
    try {
      const res = await fetch(`${impactApiBase}/events/${eventId}/public`)
      if (!res.ok) return null
      const body = await res.json()
      return body?.event ?? null
    } catch (error) {
      console.error('[ImpactLog] Failed to fetch shared event', error)
      return null
    }
  }

  const handleScanDecoded = async (decodedText: string | null) => {
    if (!decodedText) return
    setScannerError(null)
    setIsFetchingEvent(true)
    try {
      const eventId = extractEventId(decodedText)
      if (!eventId) {
        setScannerError('Invalid QR code. Please scan a valid Shared Impact Event code.')
        setIsFetchingEvent(false)
        return
      }

      // If user is not logged in, redirect to Ambassador platform's guest participation page
      if (!user) {
        const ambassadorBase = import.meta.env.VITE_IMPACT_API_BASE_URL || 'https://ambassadors.t4leader.com'
        window.location.href = `${ambassadorBase}/event-participate.html?event=${eventId}`
        return
      }

      const already = await checkExistingEventEntry(eventId, user.uid)
      if (already) {
        toast({
          title: 'Already logged',
          description: "You've already logged this shared event.",
          status: 'info',
        })
        setIsScannerOpen(false)
        setIsFetchingEvent(false)
        return
      }

      const event = await fetchSharedEvent(eventId)
      if (!event) {
        setScannerError('Event not found. Please check with the event organiser.')
        setIsFetchingEvent(false)
        return
      }

      setPendingEvent({ ...event, id: eventId })
      setIsScannerOpen(false)
    } catch (error) {
      console.error('[ImpactLog] QR scan processing failed', error)
      setScannerError('Failed to process QR code. Please try again.')
    } finally {
      setIsFetchingEvent(false)
    }
  }

  const confirmEventParticipation = async () => {
    if (!pendingEvent || !user) return
    try {
      const token = await user.getIdToken()
      const participantPayload = {
        name: profile ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || user.email : user.email,
        email: user.email ?? '',
        phone: profile?.phoneNumber ?? '',
        company: profile?.companyId ?? '',
        role: profile?.role ?? '',
        sourceUserId: user.uid,
        sourcePlatform: 'transformation_tier',
      }
      const res = await fetch(`${impactApiBase}/events/${pendingEvent.id}/participate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(participantPayload),
      })
      if (!res.ok) {
        const text = await res.text()
        console.error('[ImpactLog] participate failed', res.status, text)
        toast({
          title: 'Could not record participation',
          description: 'Please try again or contact support.',
          status: 'error',
        })
        return
      }

      toast({
        title: 'Participation recorded',
        description: `You'll receive credit for ${pendingEvent.title || 'this event'} after it is processed.`,
        status: 'success',
      })
      setPendingEvent(null)
    } catch (error) {
      console.error('[ImpactLog] participate exception', error)
      toast({
        title: 'Error',
        description: 'Failed to record your participation. Please try again.',
        status: 'error',
      })
    }
  }

  return (
    <Box bg="purple.25">
      <Flex align="center" mb={6} gap={3} wrap="wrap">
        <HStack spacing={3} align="center">
          <Icon as={Target} color="purple.500" boxSize={7} />
          <Box>
            <Heading size="lg" color="text.primary">
              Impact Log
            </Heading>
            <Text color="text.secondary">Track and measure your real-world impact</Text>
          </Box>
        </HStack>
        {!isMobile && (
          <Wrap spacing={3} justify="flex-start">
            <WrapItem>
              <Button
                variant="outline"
                leftIcon={<Download size={18} />}
                onClick={() => setIsBulkOpen(true)}
              >
                Bulk Upload (CSV)
              </Button>
            </WrapItem>
            <WrapItem>
              <Button
                variant="outline"
                leftIcon={<Download size={18} />}
                isLoading={isPdfExporting}
                loadingText="Exporting..."
                onClick={async () => {
                  setIsPdfExporting(true)
                  try {
                    const allEntries = activeTab === 'personal' || !profile?.companyId ? entries : companyEntries
                    await generateImpactPdfReport(allEntries, exportFilters, user, profile, applyFilters)
                    toast({
                      title: 'PDF exported',
                      description: 'Your impact report has been downloaded.',
                      status: 'success',
                    })
                  } catch (error) {
                    toast({
                      title: 'PDF export failed',
                      description: error instanceof Error ? error.message : 'Unknown error.',
                      status: 'error',
                    })
                  } finally {
                    setIsPdfExporting(false)
                  }
                }}
              >
                Export Impact Report
              </Button>
            </WrapItem>
            <WrapItem>
              <Button
                variant="outline"
                leftIcon={<Download size={18} />}
                onClick={() => {
                  setExportMode('csv')
                  setIsExportOpen(true)
                }}
              >
                Export CSV
              </Button>
            </WrapItem>
            <WrapItem>
              <Button
                variant="outline"
                leftIcon={<Share2 size={18} />}
                onClick={shareDisclosure.onOpen}
              >
                Share Impact
              </Button>
            </WrapItem>
            <WrapItem>
              <Button
                leftIcon={<Icon as={Target} />}
                colorScheme="teal"
                variant="solid"
                onClick={() => {
                  setScannerError(null)
                  setIsScannerOpen(true)
                }}
              >
                Scan Event QR
              </Button>
            </WrapItem>
            <WrapItem>
              <Button
                colorScheme="purple"
                leftIcon={<Plus size={18} />}
                onClick={() => {
                  setWizardStep('category')
                  setAttestationChecked(false)
                  onOpen()
                }}
              >
                New Entry
              </Button>
            </WrapItem>
          </Wrap>
        )}
      </Flex>

      {/* QR Scanner Modal */}
      <Modal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Scan Shared Impact Event QR Code</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>
              Scan the QR code from your partner event to log your participation. Impact will be calculated after the
              event is processed.
          </Text>
            {scannerError && (
              <Alert status="error" borderRadius="md" mb={4}>
                <AlertIcon />
                <Box>
                  <AlertTitle>Scan Failed</AlertTitle>
                  <AlertDescription>{scannerError}</AlertDescription>
        </Box>
              </Alert>
            )}
            <Box borderRadius="lg" overflow="hidden" bg="blackAlpha.50">
              <Scanner
                onScan={(codes: IDetectedBarcode[]) => {
                  const text = codes[0]?.rawValue || ''
                  if (text) {
                    void handleScanDecoded(text)
                  }
                }}
                onError={(err) => {
                  console.error('[ImpactLog] QR scanner error', err)
                  setScannerError('Unable to access camera or read QR code. Please try again.')
                }}
                constraints={{ facingMode: 'environment' }}
              />
            </Box>
            {isFetchingEvent && (
              <HStack mt={4} justify="center">
                <Spinner size="sm" />
                <Text>Fetching event details...</Text>
              </HStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setIsScannerOpen(false)}>
              Close
        </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Event confirmation modal */}
      <Modal isOpen={Boolean(pendingEvent)} onClose={() => setPendingEvent(null)} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Confirm Event Participation</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {pendingEvent && (
              <Stack spacing={4}>
                <Box p={4} bg="teal.50" borderRadius="md">
                  <Heading size="sm" color="teal.700">
                    {pendingEvent.title}
                  </Heading>
                  {pendingEvent.description && <Text mt={2}>{pendingEvent.description}</Text>}
                </Box>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <Stat>
                    <StatLabel>Partner</StatLabel>
                    <StatNumber fontSize="md">{pendingEvent.partnerName || 'Shared Impact Partner'}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Event Date</StatLabel>
                    <StatNumber fontSize="md">
                      {pendingEvent.date ? format(new Date(pendingEvent.date), 'MMM d, yyyy') : 'TBC'}
                    </StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Category</StatLabel>
                    <StatNumber fontSize="md">
                      {(pendingEvent.esgCategory || pendingEvent.categoryGroup || 'ESG').toString()}
                    </StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Activity</StatLabel>
                    <StatNumber fontSize="md">{pendingEvent.activityType || 'Shared Impact Event'}</StatNumber>
                  </Stat>
                </SimpleGrid>
                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>How Shared Impact Works</AlertTitle>
                    <AlertDescription fontSize="sm">
                      Your impact will be calculated after the organiser closes this event. Total impact will be divided
                      fairly among confirmed participants, based on the final participant list and event metrics.
                    </AlertDescription>
                  </Box>
                </Alert>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setPendingEvent(null)}>
              Cancel
        </Button>
            <Button colorScheme="teal" onClick={confirmEventParticipation}>
              Confirm Participation
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <HStack spacing={3} mb={4}>
        <Button
          leftIcon={<Target size={16} />}
          colorScheme={activeTab === 'personal' ? 'primary' : 'gray'}
          variant={activeTab === 'personal' ? 'primary' : 'ghost'}
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

      <Grid templateColumns={{ base: '1fr' }} gap={6}>
        <GridItem>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} spacing={4} mb={6}>
            {statCards.map((card) => (
              <Stat
                key={card.label}
                p={4}
                bg="surface.default"
                boxShadow="md"
                rounded="lg"
                border="1px solid"
                borderColor={card.color}
                textAlign="center"
              >
                <HStack justify="space-between" mb={3}>
                  <Box p={2} rounded="full" bg={`${card.color}10`} color={card.color}>
                    <Icon as={card.icon} />
                  </Box>
                  <Tooltip label={card.help}>
                    <Icon as={InfoIcon} color="text.muted" />
                  </Tooltip>
                </HStack>
                <Box textAlign="center">
                <StatLabel color="text.secondary">{card.label}</StatLabel>
                <StatNumber color="text.primary" fontSize="xl">
                  {card.label === 'USD Saved/Created' ? card.value : card.value.toLocaleString()}
                </StatNumber>
                <StatHelpText>{card.help}</StatHelpText>
                </Box>
              </Stat>
            ))}
            <PointsDashboard variant="compact" />
          </SimpleGrid>

          <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4} mb={6}>
            <Box p={4} bg="surface.default" rounded="lg" border="1px solid" borderColor="border.subtle" shadow="xs">
              <HStack mb={4} justify="space-between">
                <Text fontWeight="bold">Impact Activities by Category</Text>
                <Badge colorScheme="purple">Dual Axis</Badge>
              </HStack>
              <Box height="190px">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartCategoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis
                      yAxisId="left"
                      width={60}
                      tickFormatter={(value: number) =>
                        value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()
                      }
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      width={60}
                      tickFormatter={(value: number) =>
                        value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()
                      }
                    />
                    <RechartsTooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="Hours" fill="var(--chakra-colors-brand-primary)" radius={4} />
                    <Bar yAxisId="right" dataKey="USD" fill="var(--chakra-colors-success-500)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Box>

            <Box p={4} bg="surface.default" rounded="lg" border="1px solid" borderColor="border.subtle" shadow="xs">
              <HStack mb={4} justify="space-between">
                <Text fontWeight="bold">Monthly Trend</Text>
                <Badge colorScheme="orange">Last 6 months</Badge>
              </HStack>
              <Box height="190px">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis
                      width={70}
                      tickFormatter={(value: number) =>
                        value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()
                      }
                    />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Entries" stroke="var(--chakra-colors-brand-dark)" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="Hours" stroke="var(--chakra-colors-brand-primary)" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="USD" stroke="var(--chakra-colors-success-500)" strokeWidth={3} dot={false} />
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

          <TableContainer
            bg="surface.default"
            border="1px solid"
            borderColor="border.subtle"
            rounded="lg"
            shadow="xs"
            overflowX="auto"
            overflowY="auto"
            maxH="480px"
          >
            <Table size="sm" sx={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                {activeTab === 'personal' ? (
                  <>
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '34%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '4%' }} />
                  </>
                ) : (
                  <>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '36%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '7%' }} />
                  </>
                )}
              </colgroup>
              <Thead bg="surface.subtle">
                <Tr>
                  <Th whiteSpace="nowrap">Date</Th>
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
                    <Td colSpan={activeTab === 'personal' ? 9 : 8}>
                      <Skeleton height="18px" />
                    </Td>
                  </Tr>
                ) : filteredEntries.length === 0 ? (
                  <Tr>
                    <Td colSpan={activeTab === 'personal' ? 9 : 8}>
                      <Text color="text.muted">No entries found for this period.</Text>
                    </Td>
                  </Tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <Tr key={entry.id} _hover={{ bg: 'surface.subtle' }}>
                      <Td>{format(new Date(entry.date), 'dd MMM yyyy')}</Td>
                      <Td>
                        <Box maxW="100%" minW={0}>
                          <Tooltip
                            label={
                              <Text color="white" whiteSpace="normal" wordBreak="break-word" overflowWrap="anywhere">
                                {entry.title}
                              </Text>
                            }
                            hasArrow
                            placement="top-start"
                            maxW="360px"
                            bg="gray.800"
                            color="white"
                            portalProps={{ appendToParentPortal: false }}
                            zIndex="tooltip"
                          >
                            <Text
                              fontWeight="semibold"
                              display="block"
                              noOfLines={1}
                              wordBreak="break-word"
                              overflowWrap="anywhere"
                              lineHeight="1.4"
                            >
                              {entry.title}
                            </Text>
                          </Tooltip>
                          {entry.description && (
                            <Tooltip
                              label={
                                <Text color="white" whiteSpace="normal" wordBreak="break-word" overflowWrap="anywhere">
                                  {entry.description}
                                </Text>
                              }
                              hasArrow
                              placement="top-start"
                              maxW="360px"
                              bg="gray.800"
                              color="white"
                              portalProps={{ appendToParentPortal: false }}
                              zIndex="tooltip"
                            >
                              <Text
                                color="text.muted"
                                fontSize="sm"
                                display="block"
                                noOfLines={2}
                                wordBreak="break-word"
                                overflowWrap="anywhere"
                                lineHeight="1.4"
                                mt={1}
                              >
                                {entry.description}
                              </Text>
                            </Tooltip>
                          )}
                          {entry.outcomeLabel && (
                            <Text color="purple.600" fontSize="xs" fontWeight="medium" mt={1}>
                              Outcome: {entry.outcomeLabel}
                            </Text>
                          )}
                        </Box>
                      </Td>
                      <Td>
                        <Tooltip
                          label={entry.categoryGroup === 'esg' ? entry.esgCategory : entry.businessCategory}
                          hasArrow
                          placement="top-start"
                          maxW="240px"
                          bg="gray.800"
                          color="white"
                        >
                          <Badge colorScheme={entry.categoryGroup === 'esg' ? 'green' : 'blue'}>
                            {entry.categoryGroup === 'esg' ? 'ESG' : 'BUS'}
                          </Badge>
                        </Tooltip>
                      </Td>
                      <Td isNumeric>{entry.hours}</Td>
                      <Td isNumeric>
                        {typeof entry.usdValue === 'number'
                          ? entry.usdValue.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '0.00'}
                      </Td>
                      <Td isNumeric>{entry.peopleImpacted}</Td>
                      <Td>
                        <Badge colorScheme={entry.verificationMultiplier > 1 ? 'purple' : 'gray'}>
                          {formatVerificationLabel(entry)}
                        </Badge>
                      </Td>
                      {activeTab === 'personal' && (
                        <Td>
                          {entry.userId === user?.uid && !isPartnerSyncedEntry(entry) ? (
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
                          ) : (
                            <Text color="text.muted" fontSize="xs">
                              Read only
                            </Text>
                          )}
                        </Td>
                      )}
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </TableContainer>
        </GridItem>
      </Grid>

      <Modal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Export Impact Report</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
          <Stack spacing={4}>
              <Box>
                <FormLabel>Date range</FormLabel>
                <HStack>
                  <Input
                    type="date"
                    value={format(exportFilters.dateRange.start, 'yyyy-MM-dd')}
                    max={format(exportFilters.dateRange.end, 'yyyy-MM-dd')}
                    onChange={(e) =>
                      setExportFilters((prev) => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, start: new Date(e.target.value) },
                      }))
                    }
                  />
                  <Input
                    type="date"
                    value={format(exportFilters.dateRange.end, 'yyyy-MM-dd')}
                    min={format(exportFilters.dateRange.start, 'yyyy-MM-dd')}
                    onChange={(e) =>
                      setExportFilters((prev) => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, end: new Date(e.target.value) },
                      }))
                    }
                  />
                </HStack>
              </Box>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <FormControl>
                  <FormLabel>Impact type</FormLabel>
                  <Select
                    value={exportFilters.impactType}
                    onChange={(e) =>
                      setExportFilters((prev) => ({ ...prev, impactType: e.target.value as ExportFilters['impactType'] }))
                    }
                  >
                    <option value="all">All</option>
                    <option value="esg">ESG only</option>
                    <option value="business">Business outcomes only</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Entry type</FormLabel>
                  <Select
                    value={exportFilters.entryType || 'all'}
                    onChange={(e) =>
                      setExportFilters((prev) => ({ ...prev, entryType: e.target.value as ExportFilters['entryType'] }))
                    }
                  >
                    <option value="all">All</option>
                    <option value="individual">Individual only</option>
                    <option value="shared_event">Shared events only</option>
                  </Select>
                </FormControl>
              </SimpleGrid>

              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                <FormControl>
                  <FormLabel>ESG category</FormLabel>
                  <Select
                    placeholder="All"
                    value={exportFilters.esgCategory || ''}
                    onChange={(e) =>
                      setExportFilters((prev) => ({
                        ...prev,
                        esgCategory: (e.target.value || undefined) as ExportFilters['esgCategory'],
                      }))
                    }
                  >
                    <option value="environmental">Environmental</option>
                    <option value="social">Social</option>
                    <option value="governance">Governance</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Waste category (code)</FormLabel>
                  <Select
                    placeholder="All"
                    value={exportFilters.wasteCategory || ''}
                    onChange={(e) =>
                      setExportFilters((prev) => ({
                        ...prev,
                        wasteCategory: e.target.value || undefined,
                      }))
                    }
                  >
                    <option value="DEF">DEF</option>
                    <option value="OVR">OVR</option>
                    <option value="WAI">WAI</option>
                    <option value="NUT">NUT</option>
                    <option value="TRA">TRA</option>
                    <option value="INV">INV</option>
                    <option value="MOT">MOT</option>
                    <option value="EXP">EXP</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Verification tier</FormLabel>
                  <Select
                    placeholder="All"
                    value={exportFilters.verificationTier || ''}
                    onChange={(e) =>
                      setExportFilters((prev) => ({
                        ...prev,
                        verificationTier: (e.target.value || undefined) as ExportFilters['verificationTier'],
                      }))
                    }
                  >
                    <option value="tier_1">Tier 1</option>
                    <option value="tier_2">Tier 2</option>
                    <option value="tier_3">Tier 3</option>
                  </Select>
                </FormControl>
              </SimpleGrid>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setIsExportOpen(false)}>
              Cancel
              </Button>
            <Button
              colorScheme="purple"
              mr={3}
              onClick={() => exportImpactCsv(exportFilters)}
            >
              Export CSV
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={shareDisclosure.isOpen} onClose={shareDisclosure.onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Share your impact</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Text fontSize="sm" color="text.muted">
                Here is a preview of your post. It will use your current impact summary.
              </Text>
              <Box
                p={3}
                borderRadius="md"
                border="1px solid"
                borderColor="border.subtle"
                bg="surface.subtle"
              >
                <Text fontSize="sm" whiteSpace="pre-wrap">
                  {buildShareMessage()}
                </Text>
              </Box>
              <Text fontSize="xs" color="text.muted">
                A link to this page will be attached automatically where supported.
              </Text>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={2} flexWrap="wrap" justify="flex-end" w="100%">
              <Button variant="ghost" mr="auto" onClick={shareDisclosure.onClose}>
                Close
              </Button>
              <Button
                size="sm"
                leftIcon={<Linkedin size={16} />}
                colorScheme="linkedin"
                onClick={() => handleShareSummary('linkedin')}
              >
                LinkedIn
              </Button>
              <Button
                size="sm"
                leftIcon={<Twitter size={16} />}
                colorScheme="twitter"
                onClick={() => handleShareSummary('x')}
              >
                X (Twitter)
              </Button>
              <Button
                size="sm"
                leftIcon={<Instagram size={16} />}
                colorScheme="pink"
                onClick={() => handleShareSummary('instagram')}
              >
                Instagram
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isBulkOpen} onClose={() => setIsBulkOpen(false)} size="4xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Bulk Upload Impact Logs</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Text fontSize="sm" color="text.secondary">
                Download the template, add your ESG and Business Outcome activities, then upload the completed CSV. We
                will validate every row before importing.
                </Text>

              <Button variant="outline" leftIcon={<Download size={18} />} onClick={downloadBulkTemplate} alignSelf="flex-start">
                Download CSV Template
                </Button>

              <Box>
                <FormLabel>Upload completed template</FormLabel>
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleBulkFileChange}
                  bg="surface.default"
                />
                {bulkFileName && (
                  <Text fontSize="sm" color="text.secondary" mt={2}>
                    File: {bulkFileName}
                  </Text>
                )}
            </Box>

              {bulkRows.length > 0 && (
                <Box p={3} bg="blue.50" border="1px solid" borderColor="blue.100" rounded="lg">
                  <Text fontWeight="semibold">
                    Summary
              </Text>
                  <Text fontSize="sm" color="text.secondary">
                    {bulkValidCount} entries ready · {bulkErrorCount} rows with issues
                  </Text>
            </Box>
              )}

              {bulkErrorCount > 0 && (
                <Box maxH="220px" overflowY="auto" border="1px solid" borderColor="border.subtle" rounded="md" p={3}>
                  <Text fontWeight="semibold" mb={2}>
                    Errors
              </Text>
                  <Stack spacing={2} fontSize="sm">
                    {bulkRows
                      .filter((r) => r.errors.length > 0)
                      .slice(0, 25)
                      .map((row) => (
                        <Box key={row.rowIndex}>
                          <Text fontWeight="medium">Row {row.rowIndex}</Text>
              <Text color="text.secondary">
                            {row.errors.join(' ')}
              </Text>
            </Box>
                      ))}
                    {bulkErrorCount > 25 && (
                      <Text fontSize="xs" color="text.muted">
                        Showing first 25 rows with errors.
                      </Text>
                    )}
          </Stack>
                </Box>
              )}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setIsBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              colorScheme="purple"
              onClick={handleBulkImport}
              isLoading={isBulkProcessing}
              isDisabled={!bulkRows.length || bulkValidCount === 0}
            >
              Import {bulkValidCount || ''} Entries
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Log Your Impact</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              {/* Wizard step header */}
              <HStack spacing={6}>
                {(['category', 'numbers', 'describe', 'confirm'] as const).map((step) => {
                  const labels: Record<typeof step, string> = {
                    category: 'Category',
                    numbers: 'Numbers',
                    describe: 'Describe',
                    confirm: 'Confirm',
                  }
                  const isActive = wizardStep === step
                  return (
                    <Box key={step}>
                      <Text
                        fontWeight={isActive ? 'semibold' : 'medium'}
                        color={isActive ? 'brand.primary' : 'text.muted'}
                        borderBottomWidth="3px"
                        borderColor={isActive ? 'accent.warning' : 'transparent'}
                        pb={1}
                      >
                        {labels[step]}
                      </Text>
                    </Box>
                  )
                })}
              </HStack>
              <Box h="6px" w="100%" bg="gray.100" borderRadius="full" overflow="hidden">
                <Box
                  h="100%"
                  bg="accent.warning"
                  transition="width 0.25s ease-out"
                  width={
                    wizardStep === 'category'
                      ? '25%'
                      : wizardStep === 'numbers'
                      ? '50%'
                      : wizardStep === 'describe'
                      ? '75%'
                      : '100%'
                  }
                />
              </Box>

              {wizardStep === 'category' && (
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
                  onClick={() => handleCategoryGroupChange('esg')}
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
                  onClick={() => handleCategoryGroupChange('business')}
                >
                  Business Impact
                </Button>
              </HStack>

              {isEsgActive && (
                    <Stack spacing={4}>
                      <Box>
                        <Text fontWeight="semibold" mb={2}>
                          Choose ESG Category
                        </Text>
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                          <Box
                            as="button"
                            textAlign="left"
                            p={4}
                            display="flex"
                            flexDirection="column"
                            justifyContent="flex-start"
                            minH="170px"
                            rounded="xl"
                            borderWidth="2px"
                            borderColor={
                              formValues.esgCategory === ESGCategory.ENVIRONMENTAL ? 'green.400' : 'gray.200'
                            }
                            bg={
                              formValues.esgCategory === ESGCategory.ENVIRONMENTAL
                                ? 'linear-gradient(135deg, #E6F4EA, #F3FFF6)'
                                : 'surface.default'
                            }
                            boxShadow={formValues.esgCategory === ESGCategory.ENVIRONMENTAL ? 'md' : 'sm'}
                            _hover={{
                              borderColor: 'green.400',
                              boxShadow: 'md',
                              transform: 'translateY(-1px)',
                            }}
                            transition="all 0.15s ease-out"
                            onClick={() => handleEsgCategoryChange(ESGCategory.ENVIRONMENTAL)}
                          >
                            <HStack spacing={2} mb={1}>
                              <Icon as={Leaf} color="green.500" />
                              <Text fontWeight="bold">Environmental</Text>
                            </HStack>
                            <Text fontSize="sm" color="text.secondary">
                              {ESG_CATEGORY_HELPER_TEXT[ESGCategory.ENVIRONMENTAL]}
                            </Text>
                          </Box>

                          <Box
                            as="button"
                            textAlign="left"
                            p={4}
                            display="flex"
                            flexDirection="column"
                            justifyContent="flex-start"
                            minH="170px"
                            rounded="xl"
                            borderWidth="2px"
                            borderColor={formValues.esgCategory === ESGCategory.SOCIAL ? 'brand.primary' : 'gray.200'}
                            bg={
                              formValues.esgCategory === ESGCategory.SOCIAL
                                ? 'linear-gradient(135deg, #F4E9FF, #FDF3FF)'
                                : 'surface.default'
                            }
                            boxShadow={formValues.esgCategory === ESGCategory.SOCIAL ? 'md' : 'sm'}
                            _hover={{
                              borderColor: 'brand.primary',
                              boxShadow: 'md',
                              transform: 'translateY(-1px)',
                            }}
                            transition="all 0.15s ease-out"
                            onClick={() => handleEsgCategoryChange(ESGCategory.SOCIAL)}
                          >
                            <HStack spacing={2} mb={1}>
                              <Icon as={Users} color="purple.500" />
                              <Text fontWeight="bold">Social</Text>
                            </HStack>
                            <Text fontSize="sm" color="text.secondary">
                              {ESG_CATEGORY_HELPER_TEXT[ESGCategory.SOCIAL]}
                            </Text>
                          </Box>

                          <Box
                            as="button"
                            textAlign="left"
                            p={4}
                            display="flex"
                            flexDirection="column"
                            justifyContent="flex-start"
                            minH="170px"
                            rounded="xl"
                            borderWidth="2px"
                            borderColor={
                              formValues.esgCategory === ESGCategory.GOVERNANCE ? 'blue.400' : 'gray.200'
                            }
                            bg={
                              formValues.esgCategory === ESGCategory.GOVERNANCE
                                ? 'linear-gradient(135deg, #E7F1FF, #F3F7FF)'
                                : 'surface.default'
                            }
                            boxShadow={formValues.esgCategory === ESGCategory.GOVERNANCE ? 'md' : 'sm'}
                            _hover={{
                              borderColor: 'blue.400',
                              boxShadow: 'md',
                              transform: 'translateY(-1px)',
                            }}
                            transition="all 0.15s ease-out"
                            onClick={() => handleEsgCategoryChange(ESGCategory.GOVERNANCE)}
                          >
                            <HStack spacing={2} mb={1}>
                              <Icon as={ShieldCheck} color="blue.500" />
                              <Text fontWeight="bold">Governance</Text>
                            </HStack>
                            <Text fontSize="sm" color="text.secondary">
                              {ESG_CATEGORY_HELPER_TEXT[ESGCategory.GOVERNANCE]}
                            </Text>
                          </Box>
                        </SimpleGrid>
                      </Box>

                      <Box>
                        <Text fontWeight="semibold" mb={2}>
                          Activity Type
                        </Text>
                        <HStack spacing={2} wrap="wrap">
                          {activityTypeOptions.map((activity) => {
                            const isSelected = formValues.activityType === activity
                            return (
                              <Button
                                key={activity}
                                size="sm"
                                variant={isSelected ? 'solid' : 'outline'}
                                colorScheme={isSelected ? 'primary' : 'gray'}
                                onClick={() => handleActivityTypeChange(activity)}
                              >
                                {activity}
                              </Button>
                            )
                          })}
                        </HStack>
                        <Text fontSize="sm" color="text.muted" mt={1}>
                      {activityTypeOptions.length === 0
                        ? 'No activity types available for the selected category.'
                        : `Available activities for ${formatCategoryLabel(activityTypeCategoryLabel)}.`}
                        </Text>
                      </Box>
                    </Stack>
              )}

              {isBusinessActive && (
                    <Stack spacing={4}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <FormControl>
                    <FormLabel>Primary Business Category</FormLabel>
                    <Select
                      mt={1}
                      value={formValues.businessCategory}
                      onChange={(e) => handleBusinessCategoryChange(e.target.value as BusinessPrimaryCategory)}
                    >
                      {BUSINESS_PRIMARY_CATEGORIES.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </Select>
                    <FormHelperText>
                      {formValues.businessCategory ? BUSINESS_CATEGORY_HELPER_TEXT[formValues.businessCategory] : ''}
                    </FormHelperText>
                  </FormControl>

                  <FormControl isDisabled={activityTypeOptions.length === 0}>
                    <FormLabel>Activity Type</FormLabel>
                    <Select
                      mt={1}
                      value={formValues.activityType}
                      onChange={(e) => handleActivityTypeChange(e.target.value)}
                      isDisabled={activityTypeOptions.length === 0}
                    >
                      {activityTypeOptions.map((activity) => (
                        <option key={activity}>{activity}</option>
                      ))}
                    </Select>
                    <FormHelperText color={activityTypeOptions.length === 0 ? 'red.500' : 'text.muted'}>
                      {activityTypeOptions.length === 0
                        ? 'No activity types available for the selected category.'
                        : `Available activities for ${formatCategoryLabel(activityTypeCategoryLabel)}.`}
                    </FormHelperText>
                  </FormControl>
                      </SimpleGrid>

                      {isBusinessWasteRequired && (
                    <FormControl>
                      <FormLabel>Specific Activity (8 wastes)</FormLabel>
                          <HStack spacing={2} wrap="wrap">
                            {BUSINESS_SECONDARY_WASTES.map((activity) => {
                              const isSelected = formValues.businessActivity === activity
                              return (
                                <Tooltip
                                  key={activity}
                                  label={BUSINESS_WASTE_HELPER_TEXT[activity] || activity}
                                  hasArrow
                                  placement="top"
                                  bg="blue.50"
                                  color="blue.900"
                                  border="1px solid"
                                  borderColor="blue.100"
                                  maxW="320px"
                                >
                                  <Button
                                    size="sm"
                                    variant={isSelected ? 'solid' : 'outline'}
                                    colorScheme={isSelected ? 'blue' : 'gray'}
                                    onClick={() =>
                                      setFormValues((prev) => ({ ...prev, businessActivity: activity }))
                                    }
                                  >
                                    {activity}
                                  </Button>
                                </Tooltip>
                              )
                            })}
                          </HStack>
                      <FormHelperText>Choose the waste category most impacted by the activity.</FormHelperText>
                    </FormControl>
                      )}
                    </Stack>
                  )}
                </Stack>
              )}

              {wizardStep === 'describe' && (
                <Box>
                  <Text fontWeight="semibold" fontSize="lg" mb={2}>
                    Describe Your Impact
                  </Text>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} mb={3}>
                    <Box>
                      <Text fontWeight="medium">
                        Activity Title <Text as="span" color="red.500">*</Text>
                      </Text>
                  <Input
                    mt={1}
                        placeholder="e.g., Digital skills workshop for youth"
                    value={formValues.title}
                        maxLength={100}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, title: e.target.value }))}
                  />
                      <Text fontSize="xs" color="text.muted" mt={1}>
                        {(formValues.title || '').length}/100 characters
                      </Text>
                </Box>
                <Box>
                      <Text fontWeight="medium">
                        Date <Text as="span" color="red.500">*</Text>
                      </Text>
                  <Input
                    mt={1}
                    type="date"
                    max={format(new Date(), 'yyyy-MM-dd')}
                    value={formValues.date}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </Box>
              </SimpleGrid>

                  <Box mb={3}>
                    <Text fontWeight="medium">
                      Description <Text as="span" color="red.500">*</Text>
                    </Text>
                <Textarea
                  mt={1}
                  rows={4}
                      placeholder="Briefly describe what you did and the result..."
                  value={formValues.description}
                      maxLength={500}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, description: e.target.value }))}
                />
                    <Text fontSize="xs" color="text.muted" mt={1}>
                      {(formValues.description || '').length}/500 characters
                </Text>
              </Box>

                  <Box>
                    <Text fontWeight="medium">Evidence (Optional)</Text>
                    <Input
                      mt={1}
                      placeholder="URL to supporting evidence (photo, document, etc.)"
                      value={formValues.evidenceLink}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, evidenceLink: e.target.value }))}
                    />
                    <Text fontSize="sm" color="text.muted" mt={1}>
                      Adding evidence makes this entry eligible for Tier 3 verification.
                    </Text>
                  </Box>
                </Box>
              )}

              {wizardStep === 'numbers' && (
                <Stack spacing={4}>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <FormControl>
                  <FormLabel htmlFor="impact-people">People Impacted</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <Icon as={Users} color="text.muted" />
                    </InputLeftElement>
                        <NumberInput
                      min={0}
                          value={formValues.peopleImpacted === 0 ? '' : formValues.peopleImpacted}
                          onChange={(_, valueAsNumber) =>
                            setFormValues((prev) => ({
                              ...prev,
                              peopleImpacted: Number.isNaN(valueAsNumber) ? 0 : valueAsNumber,
                            }))
                          }
                        >
                          <NumberInputField id="impact-people" placeholder="People Impacted" pl={10} />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                  </InputGroup>
                </FormControl>
                <FormControl>
                      <FormLabel htmlFor="impact-hours">Hours Contributed</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                          <Icon as={Clock} color="text.muted" />
                    </InputLeftElement>
                        <NumberInput
                      min={0}
                          step={0.25}
                          value={formValues.hours === 0 ? '' : formValues.hours}
                          onChange={(_, valueAsNumber) =>
                            setFormValues((prev) => ({
                              ...prev,
                              hours: Number.isNaN(valueAsNumber) ? 0 : valueAsNumber,
                            }))
                          }
                        >
                          <NumberInputField id="impact-hours" placeholder="Hours" pl={10} />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                  </InputGroup>
                </FormControl>
              </SimpleGrid>

                  {isEsgActive && (() => {
                    const impactUnits = Number(formValues.peopleImpacted) || 0
                    const hoursVal = Number(formValues.hours) || 0
                    const { unitRate, unitLabel } = getEsgRateInfo(formValues)
                    return (
                      <Box p={4} bg="blue.50" border="1px solid" borderColor="blue.100" rounded="lg">
                        <Text fontWeight="semibold" mb={2}>
                          Estimated Social Value (auto-calculated)
                          </Text>
                        <Stack spacing={1} fontSize="sm" color="text.secondary">
                          <Text>
                            Impact:{' '}
                            <Text as="span" fontWeight="semibold" color="text.primary">
                              {impactUnits.toLocaleString()} × {formatCurrency(unitRate)} = {formatCurrency(esgBreakdown.impactUsd)}
                          </Text>
                          </Text>
                          <Text>
                            Hours:{' '}
                            <Text as="span" fontWeight="semibold" color="text.primary">
                              {hoursVal.toLocaleString()} × {formatCurrency(VOLUNTEER_HOURLY_RATE)} = {formatCurrency(esgBreakdown.hoursUsd)}
                          </Text>
                  </Text>
                          <Text mt={1}>
                            Total estimated social value:{' '}
                            <Text as="span" fontWeight="bold" color="text.primary">
                              {formatCurrency(esgBreakdown.totalUsd)}
                            </Text>
                          </Text>
                          <Text mt={2} fontSize="xs" color="text.muted">
                            Based on benchmark rates for this activity ({unitLabel}) and the Independent Sector
                            volunteer time valuation (${VOLUNTEER_HOURLY_RATE.toFixed(2)}/hour, 2024).
                          </Text>
                        </Stack>
                      </Box>
                    )
                  })()}

                  {isBusinessActive && (
                    <FormControl>
                      <FormLabel htmlFor="impact-financial">Financial Impact ($)</FormLabel>
                      <InputGroup>
                        <InputLeftElement pointerEvents="none">
                          <Icon as={ShieldCheck} color="text.muted" />
                        </InputLeftElement>
                        <NumberInput
                          min={0}
                          value={formValues.usdValue === 0 ? '' : formValues.usdValue}
                          onChange={(_, valueAsNumber) =>
                      setFormValues((prev) => ({
                        ...prev,
                              usdValue: Number.isNaN(valueAsNumber) ? 0 : valueAsNumber,
                            }))
                          }
                        >
                          <NumberInputField id="impact-financial" placeholder="Outcome metric (USD)" pl={10} />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </InputGroup>
                      <FormHelperText>Enter the estimated USD value of the impact.</FormHelperText>
                    </FormControl>
                  )}
                </Stack>
              )}

              {wizardStep === 'confirm' && (
                <Stack spacing={4}>
                  <Box p={4} bg="surface.default" border="1px solid" borderColor="border.subtle" rounded="lg" shadow="xs">
                    <Text fontWeight="bold" mb={3}>
                      Review Your Impact Entry
                  </Text>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      <Box>
                        <Text fontSize="sm" color="text.secondary">
                          Category & Activity
                    </Text>
                        <Text fontWeight="semibold">
                          {isEsgActive ? 'ESG' : 'Business'} ·{' '}
                          {isEsgActive ? formValues.esgCategory : formValues.businessCategory}
                        </Text>
                        <Text fontSize="sm" mt={1}>
                          {formValues.activityType || formValues.businessActivity}
                        </Text>
                </Box>
                <Box>
                        <Text fontSize="sm" color="text.secondary">
                          People & Hours
                      </Text>
                        <Text>
                          People Impacted:{' '}
                          <Text as="span" fontWeight="semibold">
                            {(formValues.peopleImpacted ?? 0).toLocaleString()}
                  </Text>
                        </Text>
                        <Text>
                          Hours Contributed:{' '}
                          <Text as="span" fontWeight="semibold">
                            {(formValues.hours ?? 0).toLocaleString()}
                          </Text>
                        </Text>
                </Box>
              </SimpleGrid>

                <Box>
                      <Text fontSize="sm" color="text.secondary">
                        Activity Details
                      </Text>
                      <Text fontWeight="semibold" mt={1}>
                        {formValues.title || 'Impact Activity'}
                  </Text>
                      <Text fontSize="sm" color="text.secondary" mt={1}>
                        Date:{' '}
                        {formValues.date
                          ? format(new Date(formValues.date), 'dd MMM yyyy')
                          : format(new Date(), 'dd MMM yyyy')}
                      </Text>
                      <Text fontSize="sm" mt={2}>
                        {formValues.description}
                      </Text>
                </Box>

                  <Box>
                      <Text fontSize="sm" color="text.secondary">
                        Total Estimated Social Value
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold">
                        {formatCurrency(
                          formValues.categoryGroup === 'esg'
                            ? esgBreakdown.totalUsd
                            : Number(formValues.usdValue) || 0,
                        )}
                      </Text>
                  </Box>
                  </Box>

                  <Box>
                    <Checkbox
                      isChecked={attestationChecked}
                      onChange={(e) => setAttestationChecked(e.target.checked)}
                      colorScheme="primary"
                    >
                      I confirm that this information is accurate to the best of my knowledge.
                    </Checkbox>
                  </Box>
                </Stack>
              )}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>

            {wizardStep !== 'category' && (
              <Button
                mr={3}
                onClick={() =>
                  setWizardStep(
                    wizardStep === 'numbers'
                      ? 'category'
                      : wizardStep === 'describe'
                      ? 'numbers'
                      : 'describe',
                  )
                }
              >
                Back
              </Button>
            )}

            {wizardStep !== 'confirm' && (
              <Button
                colorScheme="purple"
                onClick={() =>
                  setWizardStep(
                    wizardStep === 'category'
                      ? 'numbers'
                      : wizardStep === 'numbers'
                      ? 'describe'
                      : 'confirm',
                  )
                }
              >
                Next
              </Button>
            )}

            {wizardStep === 'confirm' && (
            <Button
              colorScheme="purple"
              leftIcon={<Upload size={16} />}
              onClick={handleSubmit}
              isLoading={isSubmittingImpact}
              loadingText="Submitting..."
            >
              Submit Impact
            </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Quick log modal is currently disabled */}
      {/* <Modal isOpen={isQuickOpen} onClose={onCloseQuick} size="lg">
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
                onChange={(e) => handleActivityTypeChange(e.target.value)}
                isDisabled={activityTypeOptions.length === 0}
              >
                {activityTypeOptions.map((activity) => (
                  <option key={activity}>{activity}</option>
                ))}
              </Select>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <FormControl>
                  <FormLabel htmlFor="quick-impact-hours">Hours Spent</FormLabel>
                  <NumberInput
                    min={0}
                    step={0.5}
                    value={formValues.hours === 0 ? '' : formValues.hours}
                    onChange={(_, valueAsNumber) =>
                      setFormValues((prev) => ({
                        ...prev,
                        hours: Number.isNaN(valueAsNumber) ? 0 : valueAsNumber,
                      }))
                    }
                  >
                    <NumberInputField id="quick-impact-hours" placeholder="Hours" />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
                <FormControl>
                  <FormLabel htmlFor="quick-impact-people">People Impacted</FormLabel>
                  <NumberInput
                    min={0}
                    value={formValues.peopleImpacted === 0 ? '' : formValues.peopleImpacted}
                    onChange={(_, valueAsNumber) =>
                      setFormValues((prev) => ({
                        ...prev,
                        peopleImpacted: Number.isNaN(valueAsNumber) ? 0 : valueAsNumber,
                      }))
                    }
                  >
                    <NumberInputField id="quick-impact-people" placeholder="People Impacted" />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
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
      </Modal> */}
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
