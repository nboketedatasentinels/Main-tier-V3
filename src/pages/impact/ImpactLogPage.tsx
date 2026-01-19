import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Divider,
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
import { isValidUrl } from '@/utils/validation';
import { awardBadge } from '@/services/badgeService';
import { validateOrganizationPartner } from '@/services/organizationService'
/**
 * Represents a single impact log entry.
 * The requirements for `verifierEmail` and `evidenceLink` are conditional based on the `verificationLevel`.
 */
interface ImpactLogEntry {
  id: string
  userId: string
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

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })

const formatCategoryLabel = (value?: string) => {
  if (!value) return 'the selected category'
  return value
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

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
  const verificationMultiplier = verificationMultipliers[(values.verificationLevel || 'Tier 1: Self-Reported') as VerificationTier] || 1
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
  const [partnerValidation, setPartnerValidation] = useState<{
    status: 'idle' | 'loading' | 'valid' | 'invalid' | 'error'
    partnerId?: string
    partnerName?: string
    message?: string
  }>({ status: 'idle' })
  const defaultEsgCategory = ESGCategory.ENVIRONMENTAL
  const defaultBusinessCategory = BUSINESS_PRIMARY_CATEGORIES[0]
  const [formValues, setFormValues] = useState<Partial<ImpactLogEntry>>({
    title: '',
    description: '',
    categoryGroup: 'esg',
    esgCategory: defaultEsgCategory,
    activityType: getDefaultActivityTypeForCategory('esg', defaultEsgCategory),
    businessCategory: defaultBusinessCategory,
    businessActivity: DEFAULT_BUSINESS_WASTE,
    hours: 1,
    peopleImpacted: 0,
    usdValue: 0,
    verificationLevel: 'Tier 1: Self-Reported',
    date: format(new Date(), 'yyyy-MM-dd'),
  })
  const isEsgActive = formValues.categoryGroup === 'esg'
  const isBusinessActive = formValues.categoryGroup === 'business'
  const esgActivityOptions = useMemo(
    () => getActivityTypesForEsgCategory(formValues.esgCategory),
    [formValues.esgCategory],
  )
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
        return {
          ...prev,
          categoryGroup: 'esg',
          esgCategory: nextEsgCategory,
          activityType: getDefaultActivityTypeForCategory('esg', nextEsgCategory, prev.activityType),
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
      scp: filteredEntries.reduce((sum, e) => sum + (e.scp || 0), 0),
    }
  }, [filteredEntries])

  const handleSubmit = async () => {
    if (!user?.uid) return

    const errors: string[] = []
    const { verificationLevel, verifierEmail, evidenceLink, description, date, hours, peopleImpacted } = formValues
    const requirements = verificationRequirements[(verificationLevel || 'Tier 1: Self-Reported') as VerificationTier]
    const categoryGroup = formValues.categoryGroup || 'esg'

    if (categoryGroup === 'esg') {
      if (!formValues.esgCategory) {
        errors.push('Please choose an ESG category.')
      }
      if (!isActivityTypeAllowedForCategory('esg', formValues.esgCategory, formValues.activityType)) {
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
      return
    }

    try {
      const payload = removeUndefinedFields<Omit<ImpactLogEntry, 'id'>>({
        userId: user.uid,
        ...(profile?.companyId ? { companyId: profile.companyId } : {}),
        title: formValues.title || 'Impact Activity',
        description: formValues.description || '',
        categoryGroup: formValues.categoryGroup || 'esg',
        activityType: formValues.activityType,
        ...(formValues.categoryGroup === 'esg'
          ? {
              esgCategory: formValues.esgCategory,
            }
          : {
              businessCategory: formValues.businessCategory,
              businessActivity: formValues.businessActivity,
            }),
        liftPillars: liftPillars,
        date: formValues.date || format(new Date(), 'yyyy-MM-dd'),
        hours: Number(formValues.hours) || 0,
        peopleImpacted: Number(formValues.peopleImpacted) || 0,
        usdValue: Number(formValues.usdValue) || 0,
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

      await addDoc(collection(db, 'impact_logs'), payload);

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
      label: 'Social Capital Points',
      value: stats.scp,
      help: 'Social capital earned from verified impact activities',
      icon: TrendingUp,
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
                  <Th isNumeric>SCP</Th>
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
                      <Td isNumeric>{entry.scp?.toLocaleString() || '0'}</Td>
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
                  <Text color="text.secondary">Social Capital Points</Text>
                  <Badge colorScheme="purple">{stats.scp.toLocaleString()}</Badge>
                </Flex>
                <Flex align="center" justify="space-between">
                  <Text color="text.secondary">Hours this month</Text>
                  <Badge colorScheme="blue">{stats.hours}</Badge>
                </Flex>
                <Divider />
                <Text color="text.secondary" fontWeight="medium">
                  Daily momentum based on social capital growth
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
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <FormControl>
                    <FormLabel>ESG Category</FormLabel>
                    <Select mt={1} value={formValues.esgCategory} onChange={(e) => handleEsgCategoryChange(e.target.value as ESGCategory)}>
                      <option value={ESGCategory.ENVIRONMENTAL}>Environmental</option>
                      <option value={ESGCategory.SOCIAL}>Social</option>
                      <option value={ESGCategory.GOVERNANCE}>Governance</option>
                    </Select>
                    <FormHelperText>{formValues.esgCategory ? ESG_CATEGORY_HELPER_TEXT[formValues.esgCategory] : ''}</FormHelperText>
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
              )}

              {isBusinessActive && (
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

                  {isBusinessWasteRequired ? (
                    <FormControl>
                      <FormLabel>Specific Activity (8 wastes)</FormLabel>
                      <Select
                        mt={1}
                        value={formValues.businessActivity}
                        onChange={(e) => setFormValues((prev) => ({ ...prev, businessActivity: e.target.value }))}
                      >
                        {BUSINESS_SECONDARY_WASTES.map((activity) => (
                          <option key={activity}>{activity}</option>
                        ))}
                      </Select>
                      <FormHelperText>Choose the waste category most impacted by the activity.</FormHelperText>
                    </FormControl>
                  ) : (
                    <FormControl isDisabled>
                      <FormLabel>Specific Activity (8 wastes)</FormLabel>
                      <Select mt={1} value="Not required" isDisabled>
                        <option>Not required for revenue growth</option>
                      </Select>
                      <FormHelperText>Secondary waste categories apply to cost savings and efficiency gains only.</FormHelperText>
                    </FormControl>
                  )}
                </SimpleGrid>
              )}

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
                <FormControl>
                  <FormLabel htmlFor="impact-hours">Hours Spent</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <Icon as={Clock} color="text.muted" />
                    </InputLeftElement>
                    <Input
                      id="impact-hours"
                      type="number"
                      step="0.25"
                      min={0}
                      placeholder="Hours"
                      value={formValues.hours}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, hours: Number(e.target.value) }))}
                    />
                  </InputGroup>
                </FormControl>
                <FormControl>
                  <FormLabel htmlFor="impact-people">People Impacted</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <Icon as={Users} color="text.muted" />
                    </InputLeftElement>
                    <Input
                      id="impact-people"
                      type="number"
                      min={0}
                      placeholder="People Impacted"
                      value={formValues.peopleImpacted}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, peopleImpacted: Number(e.target.value) }))}
                    />
                  </InputGroup>
                </FormControl>
                <FormControl>
                  <FormLabel htmlFor="impact-financial">Financial Impact</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <Icon as={ShieldCheck} color="text.muted" />
                    </InputLeftElement>
                    <Input
                      id="impact-financial"
                      type="number"
                      min={0}
                      placeholder="Outcome metric (USD)"
                      value={formValues.usdValue}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, usdValue: Number(e.target.value) }))}
                    />
                  </InputGroup>
                  <FormHelperText>Enter the estimated USD value of the impact.</FormHelperText>
                </FormControl>
              </SimpleGrid>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <Box>
                  <Text fontWeight="medium">
                    Verification Level
                    <Tooltip
                      label={
                        <Box p={2}>
                          <Text fontWeight="bold">About Verification Tiers</Text>
                          <Text mt={2}>
                            <Text as="span" fontWeight="semibold">
                              Tier 1 (1x Points):
                            </Text>{' '}
                            Self-reported impact.
                          </Text>
                          <Text>
                            <Text as="span" fontWeight="semibold">
                              Tier 2 (1.5x Points):
                            </Text>{' '}
                            Verified by a colleague or manager via email.
                          </Text>
                          <Text>
                            <Text as="span" fontWeight="semibold">
                              Tier 3 (2x Points):
                            </Text>{' '}
                            Validated with a link to evidence like a document or presentation.
                          </Text>
                          <Text>
                            <Text as="span" fontWeight="semibold">
                              Tier 4 (2.5x Points):
                            </Text>{' '}
                            Confirmed with both an email and an evidence link.
                          </Text>
                        </Box>
                      }
                      hasArrow
                      placement="top-start"
                      bg="surface.default"
                      color="text.primary"
                      border="1px solid"
                      borderColor="border.subtle"
                    >
                      <Icon as={InfoIcon} color="text.muted" ml={2} boxSize={4} cursor="pointer" />
                    </Tooltip>
                    {!isTier2Eligible && (
                      <Tooltip label={tier2HelperText} hasArrow placement="top-start">
                        <Badge ml={2} colorScheme="yellow" cursor="pointer">
                          Tier 2 locked
                        </Badge>
                      </Tooltip>
                    )}
                  </Text>
                  <Select
                    mt={1}
                    value={formValues.verificationLevel}
                    onChange={(e) => {
                      const newLevel = e.target.value as VerificationTier
                      const requirements = verificationRequirements[newLevel]
                      setFormValues((prev) => ({
                        ...prev,
                        verificationLevel: newLevel,
                        verifierEmail: requirements.verifierEmail ? prev.verifierEmail : '',
                        evidenceLink: requirements.evidenceLink ? prev.evidenceLink : '',
                      }))
                    }}
                  >
                    {Object.keys(verificationMultipliers).map((tier) => (
                      <option key={tier} disabled={tier === 'Tier 2: Partner Verified' && !isTier2Eligible}>
                        {tier}
                      </option>
                    ))}
                  </Select>
                  <Text fontSize="sm" color="text.muted" mt={1}>
                    {verificationRequirements[(formValues.verificationLevel || 'Tier 1: Self-Reported') as VerificationTier]?.description}
                    {formValues.verificationLevel === 'Tier 2: Partner Verified' && (
                      <Text as="span" color="purple.600">
                        {' '}
                        {tier2HelperText}
                      </Text>
                    )}
                  </Text>
                  {!isTier2Eligible && partnerValidation.status === 'loading' && (
                    <Text fontSize="sm" color="text.muted" mt={1}>
                      Checking partner enrollment...
                    </Text>
                  )}
                </Box>
                <Box>
                  <Text fontWeight="medium">
                    External Verifier Email
                    {verificationRequirements[(formValues.verificationLevel || 'Tier 1: Self-Reported') as VerificationTier]?.verifierEmail && (
                      <Text as="span" color="red.500">
                        {' '}
                        *
                      </Text>
                    )}
                  </Text>
                  <Input
                    mt={1}
                    type="email"
                    placeholder="Required for partner verification"
                    value={formValues.verifierEmail}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, verifierEmail: e.target.value }))}
                    isDisabled={!verificationRequirements[(formValues.verificationLevel || 'Tier 1: Self-Reported') as VerificationTier]?.verifierEmail}
                  />
                </Box>
              </SimpleGrid>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <Box>
                  <Text fontWeight="medium">
                    Evidence Link
                    {verificationRequirements[(formValues.verificationLevel || 'Tier 1: Self-Reported') as VerificationTier]?.evidenceLink && (
                      <Text as="span" color="red.500">
                        {' '}
                        *
                      </Text>
                    )}
                  </Text>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none">
                      <Icon as={LinkIcon} color="text.muted" />
                    </InputLeftElement>
                    <Input
                      placeholder="https://drive.google.com/file/..."
                      value={formValues.evidenceLink}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, evidenceLink: e.target.value }))}
                      isDisabled={!verificationRequirements[(formValues.verificationLevel || 'Tier 1: Self-Reported') as VerificationTier]?.evidenceLink}
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
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
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
                  <Input
                    id="quick-impact-hours"
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="Hours"
                    value={formValues.hours}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, hours: Number(e.target.value) }))}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel htmlFor="quick-impact-people">People Impacted</FormLabel>
                  <Input
                    id="quick-impact-people"
                    type="number"
                    min={0}
                    placeholder="People Impacted"
                    value={formValues.peopleImpacted}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, peopleImpacted: Number(e.target.value) }))}
                  />
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
