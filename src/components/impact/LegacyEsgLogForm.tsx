/**
 * Legacy ESG impact form - restored for Log ESG only.
 * Same behaviour as ImpactLogPageLegacy ESG path: categories, activity types,
 * hours/people, auto USD, verifier email, verification tiers, checklist award.
 */
import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Input,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { Leaf, ShieldCheck, Users } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { ESGCategory } from '@/types'
import { JOURNEY_META, getActivitiesForJourney, type ActivityDef, type JourneyType } from '@/config/pointsConfig'
import {
  ESG_CATEGORY_HELPER_TEXT,
  getActivityTypesForEsgCategory,
  getDefaultActivityTypeForCategory,
  getLiftPillarsForSelection,
  isActivityTypeAllowedForCategory,
  toCanonicalActivityType,
} from '@/config/impactLogMappings'
import { computeEsgUsdValue, resolveEsgRate, VOLUNTEER_HOURLY_RATE } from '@/config/esgImpactRates'
import { countMyImpactLogs, createImpactLog, getMyImpactLogLifetimeCount } from '@/services/impactLogService'
import {
  createImpactVerification,
  markImpactLogChecklistAwarded,
  sendImpactVerificationEmail,
} from '@/services/impactVerificationService'
import { validateOrganizationPartner } from '@/services/organizationService'
import { removeUndefinedFields } from '@/utils/firestore'
import { isValidUrl } from '@/utils/validation'
import { FREE_IMPACT_LOG_LIFETIME_LIMIT, isFreeImpactLogLimitReached, isFreeUser } from '@/utils/membership'
import { awardBadge } from '@/services/badgeService'

type VerificationTier =
  | 'Tier 1: Self-Reported'
  | 'Tier 2: Partner Verified'
  | 'Tier 3: Evidence Uploaded'
  | 'Tier 4: Third-Party Verified'

const VERIFICATION_MULTIPLIERS: Record<VerificationTier, number> = {
  'Tier 1: Self-Reported': 1,
  'Tier 2: Partner Verified': 1.5,
  'Tier 3: Evidence Uploaded': 2,
  'Tier 4: Third-Party Verified': 2.5,
}

const VERIFICATION_REQUIREMENTS: Record<
  VerificationTier,
  { evidenceLink: boolean; description: string }
> = {
  'Tier 1: Self-Reported': {
    evidenceLink: false,
    description: 'Self-reported. Verifier still receives an email for the audit trail.',
  },
  'Tier 2: Partner Verified': {
    evidenceLink: false,
    description: 'Requires partner program enrollment for your organisation.',
  },
  'Tier 3: Evidence Uploaded': {
    evidenceLink: true,
    description: 'Requires a link to supporting evidence.',
  },
  'Tier 4: Third-Party Verified': {
    evidenceLink: true,
    description: 'Requires an evidence link plus external verifier approval.',
  },
}

const ENVIRONMENTAL_ACTIVITY_OPTIONS = [
  'Tree Planting',
  'Clean-up Drive',
  'Carbon Reduction',
  'Water Conservation',
  'Renewable Energy',
  'Other',
] as const

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

type LegacyEsgLogFormProps = {
  onCancel: () => void
  onSaved: () => void | Promise<void>
  /** Open upgrade modal when free lifetime cap is hit. */
  onFreeLimitReached?: () => void
}

export const LegacyEsgLogForm: React.FC<LegacyEsgLogFormProps> = ({
  onCancel,
  onSaved,
  onFreeLimitReached,
}) => {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [attestationChecked, setAttestationChecked] = useState(false)
  const [partnerValidation, setPartnerValidation] = useState<{
    status: 'loading' | 'valid' | 'invalid' | 'error'
    partnerId?: string
    partnerName?: string
    message?: string
  }>({ status: 'loading' })

  const [esgCategory, setEsgCategory] = useState<ESGCategory>(ESGCategory.ENVIRONMENTAL)
  const [activityType, setActivityType] = useState<string>('Tree Planting')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [hours, setHours] = useState(0)
  const [peopleImpacted, setPeopleImpacted] = useState(0)
  const [evidenceLink, setEvidenceLink] = useState('')
  const [verificationLevel, setVerificationLevel] = useState<VerificationTier>('Tier 1: Self-Reported')
  const [verifierName, setVerifierName] = useState('')
  const [verifierEmail, setVerifierEmail] = useState('')

  const activityOptions = useMemo(() => {
    if (esgCategory === ESGCategory.ENVIRONMENTAL) return [...ENVIRONMENTAL_ACTIVITY_OPTIONS]
    return getActivityTypesForEsgCategory(esgCategory)
  }, [esgCategory])

  const rateInfo = useMemo(
    () => resolveEsgRate({ esgCategory, metricLabel: activityType }),
    [esgCategory, activityType],
  )

  const usdBreakdown = useMemo(() => {
    const impactUnits = Number(peopleImpacted) || 0
    const hoursVal = Number(hours) || 0
    const impactUsd = impactUnits * rateInfo.unitRate
    const hoursUsd = hoursVal * VOLUNTEER_HOURLY_RATE
    return { impactUsd, hoursUsd, totalUsd: impactUsd + hoursUsd }
  }, [peopleImpacted, hours, rateInfo.unitRate])

  const preview = useMemo(() => {
    const multiplier = VERIFICATION_MULTIPLIERS[verificationLevel] || 1
    const hourPoints = (Number(hours) || 0) * 25
    const baseImpactRate =
      esgCategory === ESGCategory.GOVERNANCE ? 1.1 : esgCategory === ESGCategory.SOCIAL ? 0.9 : 1
    const impactValue =
      ((Number(hours) || 0) * 75 * baseImpactRate + (Number(peopleImpacted) || 0) * 10) * multiplier
    const scp = ((Number(hours) || 0) * 5 + (Number(peopleImpacted) || 0) * 2.5) * multiplier
    return {
      points: Math.round(hourPoints * multiplier),
      impactValue: Math.round(impactValue),
      scp: Math.round(scp * 10) / 10,
      verificationMultiplier: multiplier,
    }
  }, [hours, peopleImpacted, esgCategory, verificationLevel])

  const liftPillars = useMemo(
    () =>
      getLiftPillarsForSelection({
        categoryGroup: 'esg',
        esgCategory,
        activityType,
      }),
    [esgCategory, activityType],
  )

  const isTier2Eligible = partnerValidation.status === 'valid'
  const tier2HelperText = isTier2Eligible
    ? partnerValidation.partnerName
      ? `Partner verified with ${partnerValidation.partnerName}.`
      : 'Partner verification is available for your organization.'
    : partnerValidation.message || 'Tier 2 verification requires partner program enrollment.'

  useEffect(() => {
    let mounted = true
    if (!profile?.companyId) {
      setPartnerValidation({
        status: 'invalid',
        message: 'Tier 2 verification is available only for organizations enrolled in the partner program.',
      })
      return () => {
        mounted = false
      }
    }
    setPartnerValidation({ status: 'loading' })
    void validateOrganizationPartner(profile.companyId)
      .then((result) => {
        if (!mounted) return
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
        if (!mounted) return
        setPartnerValidation({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to verify partner enrollment.',
        })
      })
    return () => {
      mounted = false
    }
  }, [profile?.companyId])

  useEffect(() => {
    if (!isTier2Eligible && verificationLevel === 'Tier 2: Partner Verified') {
      setVerificationLevel('Tier 1: Self-Reported')
    }
  }, [isTier2Eligible, verificationLevel])

  const handleEsgCategoryChange = (category: ESGCategory) => {
    setEsgCategory(category)
    const next =
      category === ESGCategory.ENVIRONMENTAL
        ? 'Tree Planting'
        : getDefaultActivityTypeForCategory('esg', category, activityType) || 'Other'
    setActivityType(next)
  }

  const resolveJourneyType = (): JourneyType => {
    if (profile?.journeyType) return profile.journeyType
    return isFreeUser(profile) ? '4W' : '6W'
  }

  const resolveImpactActivity = (journeyType: JourneyType): ActivityDef | undefined =>
    getActivitiesForJourney(journeyType).find((activity) => activity.id === 'impact_log')

  const resolveWeekNumberForDate = (dateString: string, journeyType: JourneyType): number => {
    const meta = JOURNEY_META[journeyType]
    if (!profile?.journeyStartDate) {
      const fallbackWeek = profile?.currentWeek ?? 1
      return Math.min(Math.max(1, fallbackWeek), meta.weeks)
    }
    const startDate = new Date(profile.journeyStartDate)
    const impactDate = new Date(dateString)
    const diffDays = Math.floor((impactDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const weekNumber = Math.floor(diffDays / 7) + 1
    return Math.min(Math.max(1, weekNumber), meta.weeks)
  }

  const handleSubmit = async () => {
    if (!user?.uid) return
    setSubmitting(true)

    let lifetime = 0
    try {
      lifetime = await getMyImpactLogLifetimeCount(user.uid)
    } catch (err) {
      console.warn('[LegacyEsgLogForm] lifetime count check failed', err)
      toast({
        title: 'Could not verify your free Impact Log allowance',
        description: 'Please refresh and try again.',
        status: 'error',
        duration: 6000,
        isClosable: true,
      })
      setSubmitting(false)
      return
    }

    if (isFreeImpactLogLimitReached(profile, lifetime)) {
      onFreeLimitReached?.()
      toast({
        title: 'Your free Impact Log is full',
        description: `You've used both free entries. Upgrade to Impact Log Pro (~$5/mo) to keep your story going.`,
        status: 'warning',
        duration: 8000,
        isClosable: true,
      })
      setSubmitting(false)
      return
    }

    const errors: string[] = []

    let effectiveActivityType = activityType
    if (!effectiveActivityType || !isActivityTypeAllowedForCategory('esg', esgCategory, effectiveActivityType)) {
      // Environmental custom list is allowed even when not in canonical map.
      if (esgCategory === ESGCategory.ENVIRONMENTAL) {
        if (!ENVIRONMENTAL_ACTIVITY_OPTIONS.includes(effectiveActivityType as (typeof ENVIRONMENTAL_ACTIVITY_OPTIONS)[number])) {
          effectiveActivityType = 'Tree Planting'
          setActivityType(effectiveActivityType)
        }
      } else {
        effectiveActivityType =
          getDefaultActivityTypeForCategory('esg', esgCategory, effectiveActivityType) || 'Other'
        setActivityType(effectiveActivityType)
        if (!isActivityTypeAllowedForCategory('esg', esgCategory, effectiveActivityType)) {
          errors.push('Please choose a valid activity type for the selected ESG category.')
        }
      }
    }

    if (!description.trim() || !date || (!hours && !peopleImpacted)) {
      errors.push('Please complete Description, Date, and either Hours or People Impacted.')
    }

    const trimmedVerifierName = verifierName.trim()
    const trimmedVerifierEmail = verifierEmail.trim()
    if (!trimmedVerifierName) {
      errors.push('Verifier name is required. Points are awarded only after they approve.')
    }
    if (!trimmedVerifierEmail) {
      errors.push('Verifier email is required so we can send them this impact log.')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedVerifierEmail)) {
      errors.push('Please enter a valid verifier email address.')
    }

    if (!evidenceLink.trim()) {
      errors.push('Evidence link is required for ESG submissions.')
    } else {
      const urlValidation = isValidUrl(evidenceLink.trim())
      if (!urlValidation.isValid) {
        errors.push(urlValidation.message || 'The evidence link is not a valid URL.')
      }
    }

    if (verificationLevel === 'Tier 2: Partner Verified' && !isTier2Eligible) {
      errors.push(tier2HelperText)
    }

    if (!attestationChecked) {
      errors.push('Please confirm that this information is accurate to the best of your knowledge.')
    }

    if (errors.length > 0) {
      errors.forEach((error) => {
        toast({ title: 'Validation Error', description: error, status: 'error', duration: 5000, isClosable: true })
      })
      setSubmitting(false)
      return
    }

    try {
      const rawUsd = computeEsgUsdValue({
        esgCategory,
        metricLabel: effectiveActivityType,
        quantity: Number(peopleImpacted) || 0,
        hours: Number(hours) || 0,
      })
      const usdValue = Math.round(rawUsd * 100) / 100
      const activityTitle = title.trim() || 'Impact Activity'

      const payload = removeUndefinedFields({
        userId: user.uid,
        sourcePlatform: 'transformation_tier' as const,
        ...(profile?.companyId ? { companyId: profile.companyId } : {}),
        title: activityTitle,
        description: description.trim(),
        categoryGroup: 'esg' as const,
        entryKind: 'esg' as const,
        activityType: toCanonicalActivityType(effectiveActivityType) || effectiveActivityType,
        esgCategory,
        esgMetric: effectiveActivityType,
        esgQty: Number(peopleImpacted) || 0,
        liftPillars,
        date,
        hours: Number(hours) || 0,
        peopleImpacted: Number(peopleImpacted) || 0,
        usdValue,
        unitRateApplied: rateInfo.unitRate,
        volHourRateApplied: VOLUNTEER_HOURLY_RATE,
        sasbTopic: rateInfo.sasbTopic,
        usdValueSource: 'auto' as const,
        verificationLevel,
        verificationStatus: 'pending' as const,
        claimStatus: 'Sent to ESG team',
        verifierName: trimmedVerifierName,
        verifierEmail: trimmedVerifierEmail,
        verifierRole: 'verifier' as const,
        ...(evidenceLink.trim() ? { evidenceLink: evidenceLink.trim() } : {}),
        ...(verificationLevel === 'Tier 2: Partner Verified'
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

      const created = await createImpactLog(payload as Parameters<typeof createImpactLog>[0])

      const journeyType = resolveJourneyType()
      const activity = resolveImpactActivity(journeyType)
      const weekNumber = resolveWeekNumberForDate(date, journeyType)
      const learnerName =
        [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() ||
        profile?.fullName ||
        profile?.email ||
        'A learner'
      const learnerEmail = profile?.email || user.email || null
      const pointsToAward = activity?.points ?? (journeyType === '6W' ? 2000 : 1000)

      let pointsAwarded = false
      let awardMessage: string | undefined
      if (activity) {
        try {
          const award = await markImpactLogChecklistAwarded({
            userId: user.uid,
            weekNumber,
            journeyType,
            activity,
            impactLogId: created.id,
          })
          pointsAwarded = award.awarded
          awardMessage = award.message
        } catch (err) {
          console.warn('[LegacyEsgLogForm] Failed to award checklist points', err)
          awardMessage = err instanceof Error ? err.message : undefined
        }
      }

      let emailSent = false
      let emailError: string | undefined
      try {
        const formatMoney = (value: unknown) => {
          const n = Number(value)
          if (!Number.isFinite(n)) return '-'
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
        }
        const formatNumber = (value: unknown) => {
          const n = Number(value)
          if (!Number.isFinite(n)) return '-'
          return n.toLocaleString()
        }
        const detail = (label: string, value: unknown) => {
          if (value == null) return null
          if (Array.isArray(value) && value.length === 0) return null
          const text = Array.isArray(value)
            ? value.map((v) => String(v).trim()).filter(Boolean).join(', ')
            : String(value).trim()
          if (!text) return null
          return { label, value: text }
        }

        const emailSections = [
          {
            title: 'Activity details',
            rows: [
              detail('Activity title', activityTitle),
              detail('Description', description.trim()),
              detail('Activity date', date),
              detail('Impact type', 'ESG'),
              detail('Category', esgCategory),
              detail('Activity type', effectiveActivityType),
              detail('LIFT pillars', liftPillars),
            ].filter(Boolean) as Array<{ label: string; value: string }>,
          },
          {
            title: 'Impact metrics',
            rows: [
              detail('People impacted', formatNumber(peopleImpacted)),
              detail('Hours contributed', formatNumber(hours)),
              detail('Estimated USD value', formatMoney(usdValue)),
              detail('Unit rate applied', formatMoney(rateInfo.unitRate)),
              detail('Volunteer hourly rate applied', formatMoney(VOLUNTEER_HOURLY_RATE)),
              detail('SASB topic', rateInfo.sasbTopic),
              detail('Impact score (SCP)', formatNumber(preview.scp)),
              detail('Impact value', formatNumber(preview.impactValue)),
              detail('Verification multiplier', formatNumber(preview.verificationMultiplier)),
            ].filter(Boolean) as Array<{ label: string; value: string }>,
          },
          {
            title: 'Verification',
            rows: [
              detail('Verification tier', verificationLevel),
              detail('Verification status', 'Pending verifier approval'),
              detail('Verifier name', trimmedVerifierName),
              detail('Verifier email', trimmedVerifierEmail),
              detail('Evidence link', evidenceLink.trim() || null),
            ].filter(Boolean) as Array<{ label: string; value: string }>,
          },
          {
            title: 'Submission record',
            rows: [
              detail('Learner name', learnerName),
              detail('Learner email', learnerEmail),
              detail('Organisation', profile?.companyName),
              detail('Journey type', journeyType),
              detail('Checklist week', weekNumber),
              detail('Points pending approval', formatNumber(pointsToAward)),
            ].filter(Boolean) as Array<{ label: string; value: string }>,
          },
        ].filter((section) => section.rows.length > 0)

        const impactSummary = Object.fromEntries(
          emailSections.flatMap((section) => section.rows.map((row) => [row.label, row.value])),
        )

        const verification = await createImpactVerification({
          impactLogId: created.id,
          verifierName: trimmedVerifierName,
          verifierEmail: trimmedVerifierEmail,
          weekNumber,
          journeyType,
          activityTitle,
          pointsToAward,
          learnerName,
          learnerEmail,
          impactSummary,
        })
        const sendResult = await sendImpactVerificationEmail({
          to: trimmedVerifierEmail,
          verifierName: trimmedVerifierName,
          learnerName,
          learnerEmail,
          token: verification.token,
          activityTitle,
          submittedAt: payload.createdAt as string,
          organizationName: profile?.companyName || null,
          sections: emailSections,
        })
        emailSent = sendResult.success
        if (!sendResult.success) {
          emailError = sendResult.error || 'Verifier email could not be sent'
          console.error('[LegacyEsgLogForm] Verifier email failed', sendResult.error)
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : 'Failed to create/send verifier request'
        console.error('[LegacyEsgLogForm] Failed to create/send verifier request', err)
      }

      try {
        const logCount = await countMyImpactLogs(user.uid)
        if (logCount >= 10) await awardBadge(user.uid, 'impact-master')
      } catch (badgeError) {
        console.warn('[LegacyEsgLogForm] Badge award skipped', badgeError)
      }

      if (!emailSent) {
        toast({
          title: 'ESG saved, but verifier was not emailed',
          description: `${trimmedVerifierName} (${trimmedVerifierEmail}) did not get the approval email.${
            emailError ? ` ${emailError}` : ''
          } Please try again or ask support to check SMTP / send-impact-verification-email.`,
          status: 'error',
          duration: 12000,
          isClosable: true,
        })
      } else {
        toast({
          title: pointsAwarded
            ? `ESG logged · +${pointsToAward.toLocaleString()} pts`
            : 'ESG logged',
          description: pointsAwarded
            ? `Checklist updated. We emailed ${trimmedVerifierName} (${trimmedVerifierEmail}).`
            : awardMessage ||
              `Saved and emailed ${trimmedVerifierName}. Refresh Weekly Checklist if points are not visible yet.`,
          status: pointsAwarded ? 'success' : 'warning',
          duration: 8000,
          isClosable: true,
        })
      }

      await onSaved()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      if (message.includes('impact_log_free_limit_reached')) {
        onFreeLimitReached?.()
        toast({
          title: 'Your free Impact Log is full',
          description:
            "Two entries is your free chapter. Upgrade to Impact Log Pro (~$5/mo) so the story doesn't stop here.",
          status: 'warning',
          duration: 9000,
          isClosable: true,
        })
      } else {
        toast({
          title: 'Unable to log ESG impact',
          description: message,
          status: 'error',
          duration: 8000,
          isClosable: true,
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box p={{ base: 4, md: 5 }} border="1px solid" borderColor="border.subtle" rounded="xl" bg="surface.default">
      <Heading size="md" mb={1}>
        Log ESG
      </Heading>
      <Text fontSize="sm" color="text.secondary" mb={4}>
        Environmental, social, or governance impact with auto USD estimate, verifier email, and
        verification tiers - same as the previous Impact Log ESG flow.
      </Text>

      <Stack spacing={5}>
        <Box>
          <Text fontWeight="semibold" mb={2}>
            Choose ESG Category
          </Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
            {(
              [
                { cat: ESGCategory.ENVIRONMENTAL, icon: Leaf, color: 'green' },
                { cat: ESGCategory.SOCIAL, icon: Users, color: 'purple' },
                { cat: ESGCategory.GOVERNANCE, icon: ShieldCheck, color: 'blue' },
              ] as const
            ).map(({ cat, icon, color }) => {
              const selected = esgCategory === cat
              return (
                <Box
                  key={cat}
                  as="button"
                  type="button"
                  textAlign="left"
                  p={4}
                  minH="140px"
                  rounded="xl"
                  borderWidth="2px"
                  borderColor={selected ? `${color}.400` : 'gray.200'}
                  bg={selected ? `${color}.50` : 'surface.default'}
                  boxShadow={selected ? 'md' : 'sm'}
                  onClick={() => handleEsgCategoryChange(cat)}
                >
                  <HStack spacing={2} mb={1}>
                    <Icon as={icon} color={`${color}.500`} />
                    <Text fontWeight="bold">{cat}</Text>
                  </HStack>
                  <Text fontSize="sm" color="text.secondary">
                    {ESG_CATEGORY_HELPER_TEXT[cat]}
                  </Text>
                </Box>
              )
            })}
          </SimpleGrid>
        </Box>

        <Box>
          <Text fontWeight="semibold" mb={2}>
            Activity Type
          </Text>
          <HStack spacing={2} wrap="wrap">
            {activityOptions.map((activity) => (
              <Button
                key={activity}
                size="sm"
                variant={activityType === activity ? 'solid' : 'outline'}
                colorScheme={activityType === activity ? 'primary' : 'gray'}
                onClick={() => setActivityType(toCanonicalActivityType(activity) || activity)}
              >
                {activity}
              </Button>
            ))}
          </HStack>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
          <FormControl isRequired>
            <FormLabel>Activity Title</FormLabel>
            <Input
              value={title}
              maxLength={100}
              placeholder="e.g., Digital skills workshop for youth"
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Date</FormLabel>
            <Input
              type="date"
              max={format(new Date(), 'yyyy-MM-dd')}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </FormControl>
        </SimpleGrid>

        <FormControl isRequired>
          <FormLabel>Description</FormLabel>
          <Textarea
            rows={4}
            maxLength={500}
            placeholder="Briefly describe what you did and the result..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Evidence</FormLabel>
          <Input
            placeholder="URL to supporting evidence (photo, document, etc.)"
            value={evidenceLink}
            onChange={(e) => setEvidenceLink(e.target.value)}
          />
          <FormHelperText>
            A supporting evidence link is required for every ESG submission.
          </FormHelperText>
        </FormControl>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
          <FormControl>
            <FormLabel>People Impacted</FormLabel>
            <NumberInput
              min={0}
              value={peopleImpacted === 0 ? '' : peopleImpacted}
              onChange={(_, n) => setPeopleImpacted(Number.isNaN(n) ? 0 : n)}
            >
              <NumberInputField placeholder="People Impacted" />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>
          <FormControl>
            <FormLabel>Hours Contributed</FormLabel>
            <NumberInput
              min={0}
              step={0.25}
              value={hours === 0 ? '' : hours}
              onChange={(_, n) => setHours(Number.isNaN(n) ? 0 : n)}
            >
              <NumberInputField placeholder="Hours" />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>
        </SimpleGrid>

        <Box p={4} bg="blue.50" border="1px solid" borderColor="blue.100" rounded="lg">
          <Text fontWeight="semibold" mb={2}>
            Estimated Social Value (auto-calculated)
          </Text>
          <Stack spacing={1} fontSize="sm" color="text.secondary">
            <Text>
              Impact:{' '}
              <Text as="span" fontWeight="semibold" color="text.primary">
                {(Number(peopleImpacted) || 0).toLocaleString()} × {formatCurrency(rateInfo.unitRate)} ={' '}
                {formatCurrency(usdBreakdown.impactUsd)}
              </Text>
            </Text>
            <Text>
              Hours:{' '}
              <Text as="span" fontWeight="semibold" color="text.primary">
                {(Number(hours) || 0).toLocaleString()} × {formatCurrency(VOLUNTEER_HOURLY_RATE)} ={' '}
                {formatCurrency(usdBreakdown.hoursUsd)}
              </Text>
            </Text>
            <Text mt={1}>
              Total:{' '}
              <Text as="span" fontWeight="bold" color="text.primary" fontSize="lg">
                {formatCurrency(usdBreakdown.totalUsd)}
              </Text>
            </Text>
          </Stack>
        </Box>

        <FormControl>
          <FormLabel>Verification tier</FormLabel>
          <Select
            value={verificationLevel}
            onChange={(e) => setVerificationLevel(e.target.value as VerificationTier)}
          >
            {(Object.keys(VERIFICATION_REQUIREMENTS) as VerificationTier[]).map((tier) => (
              <option
                key={tier}
                value={tier}
                disabled={tier === 'Tier 2: Partner Verified' && !isTier2Eligible}
              >
                {tier}
              </option>
            ))}
          </Select>
          <FormHelperText>
            {VERIFICATION_REQUIREMENTS[verificationLevel].description}
            {verificationLevel === 'Tier 2: Partner Verified' ? ` ${tier2HelperText}` : ''}
          </FormHelperText>
        </FormControl>

        <Box p={4} bg="purple.50" border="1px solid" borderColor="purple.100" rounded="lg">
          <Text fontWeight="semibold" mb={1}>
            Verifier
          </Text>
          <Text fontSize="sm" color="text.muted" mb={3}>
            Someone in or outside your organization. We email them this impact log. Role is Verifier -
            they must approve before you earn points. Until then it stays pending.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            <FormControl isRequired>
              <FormLabel>Verifier name</FormLabel>
              <Input
                value={verifierName}
                onChange={(e) => setVerifierName(e.target.value)}
                placeholder="Full name"
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Verifier email</FormLabel>
              <Input
                type="email"
                value={verifierEmail}
                onChange={(e) => setVerifierEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </FormControl>
          </SimpleGrid>
          <Text mt={3} fontSize="sm">
            Role: <Text as="span" fontWeight="semibold">Verifier</Text>
          </Text>
        </Box>

        <Checkbox
          isChecked={attestationChecked}
          onChange={(e) => setAttestationChecked(e.target.checked)}
          colorScheme="primary"
        >
          I confirm that this information is accurate to the best of my knowledge.
        </Checkbox>

        <Flex gap={3} justify="flex-end" pt={1}>
          <Button variant="ghost" onClick={onCancel} isDisabled={submitting}>
            Cancel
          </Button>
          <Button colorScheme="primary" onClick={() => void handleSubmit()} isLoading={submitting}>
            Log ESG
          </Button>
        </Flex>
      </Stack>
    </Box>
  )
}
