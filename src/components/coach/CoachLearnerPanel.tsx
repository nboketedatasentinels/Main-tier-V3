import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { Save, Sparkles } from 'lucide-react'
import {
  MENTORSHIP_GOALS_MAX_LENGTH,
  useMentorshipGoals,
} from '@/hooks/useMentorshipGoals'
import {
  buildAiInference,
  buildCoachingSessionPlan,
  buildStrengthsWeaknessesWriteUp,
} from '@/services/mentorCoachingInsights'
import { useAuth } from '@/hooks/useAuth'
import { getDisplayName } from '@/utils/displayName'
import {
  MAX_PURCHASED_COACH_SESSIONS,
  MIN_PURCHASED_COACH_SESSIONS,
  resolvePurchasedCoachSessions,
} from '@/utils/purchasedCoachSessions'
import { PERSONALITY_TYPES } from '@/config/personality-data'
import type { UserProfile } from '@/types'

const PLUM = '#27062e'
const GOLD = '#eab130'

const personalityLabel = (type?: string | null): string | null => {
  if (!type) return null
  const hit = PERSONALITY_TYPES.find((p) => p.type === type)
  return hit ? `${hit.type} · ${hit.name}` : type
}

export type CoachLearningPlanSession = {
  index: number
  title: string
  focus: string
  notes: string
}

type CoachLearnerPanelProps = {
  learner: UserProfile
  orgPurchasedCoachSessions?: number | null
  /** Show mentor-style goal prompt (optional). Default true for coach. */
  allowGoalEdit?: boolean
  /** Programme course titles for AI suggestions. */
  courseTitles?: string[] | null
  /** Attended coach sessions for this learner (quota progress). */
  attendedSessionCount?: number
}

export const CoachLearnerPanel: React.FC<CoachLearnerPanelProps> = ({
  learner,
  orgPurchasedCoachSessions,
  allowGoalEdit = true,
  courseTitles,
  attendedSessionCount = 0,
}) => {
  const { profile, updateProfile } = useAuth()
  const toast = useToast()
  const coachId = profile?.id ?? null
  const learnerId = learner.id ?? null

  const storedPlans = profile?.coachingPlans ?? {}
  const stored = learnerId ? storedPlans[learnerId] : undefined

  const purchasedSessions = resolvePurchasedCoachSessions({
    learnerPurchased:
      stored?.purchasedSessions ??
      (learner as { purchasedCoachSessions?: unknown }).purchasedCoachSessions,
    orgPurchased: orgPurchasedCoachSessions,
  })

  const {
    goals,
    loading: goalsLoading,
    saving: goalsSaving,
    save: saveGoals,
  } = useMentorshipGoals(learnerId, coachId)

  const [goalsDraft, setGoalsDraft] = useState('')
  const [goalsReady, setGoalsReady] = useState(false)

  useEffect(() => {
    if (!goalsLoading && !goalsReady) {
      setGoalsDraft(goals)
      setGoalsReady(true)
    }
  }, [goals, goalsLoading, goalsReady])

  useEffect(() => {
    setGoalsReady(false)
  }, [learnerId])

  const insightInput = useMemo(
    () => ({
      name: getDisplayName(learner),
      personalityType: learner.personalityType,
      coreValues: learner.coreValues,
      ageRange: (learner as { ageRange?: string | null }).ageRange ?? null,
      journeyType: typeof learner.journeyType === 'string' ? learner.journeyType : null,
      currentWeek: learner.currentWeek ?? null,
      courseTitles: (courseTitles ?? []).filter(Boolean),
      purchasedSessions,
    }),
    [learner, purchasedSessions, courseTitles],
  )

  const aiNotes = useMemo(() => buildAiInference(insightInput), [insightInput])
  const strengths = useMemo(() => buildStrengthsWeaknessesWriteUp(insightInput), [insightInput])
  const defaultPlan = useMemo(
    () => buildCoachingSessionPlan(insightInput),
    [insightInput],
  )

  const [planSessions, setPlanSessions] = useState<CoachLearningPlanSession[]>([])
  const [planSaving, setPlanSaving] = useState(false)
  const [quotaDraft, setQuotaDraft] = useState(purchasedSessions)

  useEffect(() => {
    setQuotaDraft(purchasedSessions)
  }, [purchasedSessions, learnerId])

  useEffect(() => {
    if (stored?.sessions?.length && stored.purchasedSessions === purchasedSessions) {
      setPlanSessions(stored.sessions)
      return
    }
    setPlanSessions(
      defaultPlan.sessions.map((s) => ({
        index: s.index,
        title: s.title,
        focus: s.focus,
        notes: '',
      })),
    )
  }, [learnerId, purchasedSessions, stored, defaultPlan])

  const applyQuota = async (next: number) => {
    if (!coachId || !learnerId) return
    setQuotaDraft(next)
    setPlanSaving(true)
    try {
      const nextPlan = buildCoachingSessionPlan({
        ...insightInput,
        purchasedSessions: next,
      })
      const sessions = nextPlan.sessions.map((s) => {
        const existing = planSessions.find((p) => p.index === s.index)
        return {
          index: s.index,
          title: existing?.title || s.title,
          focus: existing?.focus || s.focus,
          notes: existing?.notes || '',
        }
      })
      const { error } = await updateProfile({
        coachingPlans: {
          ...storedPlans,
          [learnerId]: {
            purchasedSessions: next,
            sessions,
            updatedAt: new Date().toISOString(),
          },
        },
      })
      if (error) throw error
      setPlanSessions(sessions)
      toast({
        title: 'Session quota updated',
        description: `${next} purchased session${next === 1 ? '' : 's'} for this leader.`,
        status: 'success',
        duration: 2500,
      })
    } catch (err) {
      setQuotaDraft(purchasedSessions)
      toast({
        title: 'Could not update quota',
        description: err instanceof Error ? err.message : 'Try again.',
        status: 'error',
      })
    } finally {
      setPlanSaving(false)
    }
  }

  const goalsDirty = goalsReady && goalsDraft.trim() !== goals.trim()
  const goalsTooLong = goalsDraft.length > MENTORSHIP_GOALS_MAX_LENGTH

  const handleSaveGoals = async () => {
    if (!goalsDirty || goalsTooLong || goalsSaving) return
    try {
      await saveGoals(goalsDraft)
      toast({
        title: 'Goal saved',
        description: 'Learner notified. Also visible in Session Prep and Leadership Council.',
        status: 'success',
        duration: 3200,
      })
    } catch (err) {
      toast({
        title: 'Could not save goal',
        description: err instanceof Error ? err.message : 'Try again.',
        status: 'error',
      })
    }
  }

  const handleSavePlan = async () => {
    if (!coachId || !learnerId) return
    setPlanSaving(true)
    try {
      const { error } = await updateProfile({
        coachingPlans: {
          ...storedPlans,
          [learnerId]: {
            purchasedSessions,
            sessions: planSessions,
            updatedAt: new Date().toISOString(),
          },
        },
      })
      if (error) throw error
      toast({ title: 'Learning plan saved', status: 'success', duration: 2500 })
    } catch (err) {
      toast({
        title: 'Could not save plan',
        description: err instanceof Error ? err.message : 'Try again.',
        status: 'error',
      })
    } finally {
      setPlanSaving(false)
    }
  }

  const resetPlanToArc = () => {
    setPlanSessions(
      defaultPlan.sessions.map((s) => ({
        index: s.index,
        title: s.title,
        focus: s.focus,
        notes: '',
      })),
    )
  }

  const values = (learner.coreValues || []).filter(Boolean)
  const ageRange = (learner as { ageRange?: string | null }).ageRange

  return (
    <Stack spacing={5}>
      {/* Profile strip */}
      <Box
        border="1px solid"
        borderColor="gray.200"
        borderRadius="xl"
        bg="white"
        overflow="hidden"
      >
        <Box px={5} py={4} borderBottom="1px solid" borderColor="gray.100" bg="gray.50">
          <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.1em" color="gray.500">
            COACHEE PROFILE
          </Text>
          <Text mt={1} fontSize="lg" fontWeight="700" color={PLUM}>
            {getDisplayName(learner)}
          </Text>
          <Text fontSize="sm" color="gray.600">
            {[learner.companyName, learner.email].filter(Boolean).join(' · ')}
          </Text>
        </Box>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={0} borderTop="1px solid" borderColor="gray.100">
          <Box px={5} py={4} borderBottom={{ base: '1px solid', md: 'none' }} borderColor="gray.100">
            <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="0.08em">
              PERSONALITY
            </Text>
            <Text mt={1} fontSize="sm" fontWeight="600" color={PLUM}>
              {personalityLabel(learner.personalityType) || 'Pending'}
            </Text>
          </Box>
          <Box
            px={5}
            py={4}
            borderBottom={{ base: '1px solid', md: 'none' }}
            borderLeft={{ md: '1px solid' }}
            borderColor="gray.100"
          >
            <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="0.08em">
              VALUES
            </Text>
            <Text mt={1} fontSize="sm" color="gray.700">
              {values.length ? values.join(' · ') : 'Not set yet'}
            </Text>
          </Box>
          <Box
            px={5}
            py={4}
            borderBottom={{ base: '1px solid', lg: 'none' }}
            borderLeft={{ md: '1px solid' }}
            borderColor="gray.100"
          >
            <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="0.08em">
              AGE BAND
            </Text>
            <Text mt={1} fontSize="sm" color="gray.700">
              {ageRange || 'Not set'}
            </Text>
          </Box>
          <Box px={5} py={4} borderLeft={{ md: '1px solid' }} borderColor="gray.100">
            <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="0.08em">
              SESSIONS
            </Text>
            <Text mt={1} fontSize="sm" fontWeight="700" color={PLUM}>
              {Math.min(attendedSessionCount, purchasedSessions)} of {purchasedSessions} used
            </Text>
            <Select
              mt={2}
              size="sm"
              bg="white"
              borderColor="gray.300"
              value={quotaDraft}
              isDisabled={planSaving}
              onChange={(e) => void applyQuota(Number(e.target.value) || purchasedSessions)}
            >
              {Array.from(
                { length: MAX_PURCHASED_COACH_SESSIONS - MIN_PURCHASED_COACH_SESSIONS + 1 },
                (_, i) => i + MIN_PURCHASED_COACH_SESSIONS,
              ).map((n) => (
                <option key={n} value={n}>
                  {n} purchased
                </option>
              ))}
            </Select>
            <Text mt={1} fontSize="xs" color="gray.500">
              Org default or override for this leader
            </Text>
          </Box>
        </SimpleGrid>
      </Box>

      {/* AI notes */}
      <Box
        border="1px solid"
        borderColor="gray.200"
        borderLeftWidth="3px"
        borderLeftColor={GOLD}
        borderRadius="xl"
        bg="white"
        px={5}
        py={4}
      >
        <HStack spacing={2} mb={2}>
          <Icon as={Sparkles} color="gray.600" boxSize={4} />
          <Text fontSize="xs" fontWeight="bold" letterSpacing="0.08em" color="gray.500">
            {aiNotes.label.toUpperCase()} NOTES
          </Text>
        </HStack>
        <VStack align="stretch" spacing={2}>
          {aiNotes.lines.map((line) => (
            <Text key={line.slice(0, 40)} fontSize="sm" color="gray.700" lineHeight="1.65">
              {line}
            </Text>
          ))}
        </VStack>
        <Text mt={3} fontSize="xs" color="gray.500" fontStyle="italic">
          {aiNotes.disclaimer}
        </Text>
        {strengths.summary ? (
          <Text mt={3} fontSize="sm" color="gray.600" lineHeight="1.6">
            {strengths.summary}
          </Text>
        ) : null}
      </Box>

      {/* Goals */}
      {allowGoalEdit ? (
        <Box border="1px solid" borderColor="gray.200" borderRadius="xl" bg="white" px={5} py={4}>
          <Text fontSize="xs" fontWeight="bold" letterSpacing="0.08em" color="gray.500">
            COACHING GOAL
          </Text>
          <Text mt={1} fontSize="md" fontWeight="700" color={PLUM}>
            I&apos;m trying to achieve…
          </Text>
          <Text mt={1} fontSize="sm" color="gray.600" mb={3}>
            Capture the outcome in their words. Re-contract when it moves.
          </Text>
          <Textarea
            value={goalsDraft}
            onChange={(e) => setGoalsDraft(e.target.value)}
            minH="100px"
            placeholder="e.g. Hold a direct conversation with my head of data without backing down."
            borderColor="gray.300"
            isDisabled={goalsLoading}
            _focus={{ borderColor: '#350e6f', boxShadow: '0 0 0 1px #350e6f' }}
          />
          <Flex mt={3} justify="space-between" align="center" gap={3} flexWrap="wrap">
            <Text fontSize="xs" color={goalsTooLong ? 'red.500' : 'gray.500'}>
              {goalsDraft.length}/{MENTORSHIP_GOALS_MAX_LENGTH}
            </Text>
            <Button
              size="sm"
              leftIcon={<Save size={14} />}
              bg="#350e6f"
              color="white"
              _hover={{ bg: '#27062e' }}
              onClick={() => void handleSaveGoals()}
              isDisabled={!goalsDirty || goalsTooLong}
              isLoading={goalsSaving}
            >
              Save goal
            </Button>
          </Flex>
        </Box>
      ) : null}

      {/* Learning plan */}
      <Box border="1px solid" borderColor="gray.200" borderRadius="xl" bg="white" px={5} py={4}>
        <Flex justify="space-between" align="flex-start" gap={3} flexWrap="wrap" mb={4}>
          <Box>
            <Text fontSize="xs" fontWeight="bold" letterSpacing="0.08em" color="gray.500">
              YOUR LEARNING PLAN
            </Text>
            <Text mt={1} fontSize="md" fontWeight="700" color={PLUM}>
              {defaultPlan.journeyLabel}
            </Text>
            <Text fontSize="sm" color="gray.600">
              Build the arc for this engagement. Session count matches what the company purchased.
            </Text>
          </Box>
          <HStack>
            <Button size="sm" variant="outline" borderColor="gray.300" onClick={resetPlanToArc}>
              Reset to arc
            </Button>
            <Button
              size="sm"
              leftIcon={<Save size={14} />}
              bg="#350e6f"
              color="white"
              _hover={{ bg: '#27062e' }}
              onClick={() => void handleSavePlan()}
              isLoading={planSaving}
            >
              Save plan
            </Button>
          </HStack>
        </Flex>

        <Stack spacing={3}>
          {planSessions.map((session, idx) => (
            <Box
              key={session.index}
              p={4}
              border="1px solid"
              borderColor="gray.200"
              borderLeftWidth="3px"
              borderLeftColor={GOLD}
              borderRadius="md"
              bg="gray.50"
            >
              <Text fontSize="xs" fontWeight="bold" color="gray.500" mb={2}>
                SESSION {session.index}
              </Text>
              <Input
                value={session.title}
                onChange={(e) => {
                  const next = [...planSessions]
                  next[idx] = { ...session, title: e.target.value }
                  setPlanSessions(next)
                }}
                mb={2}
                bg="white"
                fontWeight="600"
                borderColor="gray.300"
              />
              <Textarea
                value={session.focus}
                onChange={(e) => {
                  const next = [...planSessions]
                  next[idx] = { ...session, focus: e.target.value }
                  setPlanSessions(next)
                }}
                mb={2}
                bg="white"
                minH="60px"
                borderColor="gray.300"
                placeholder="Focus for this session"
              />
              <Textarea
                value={session.notes}
                onChange={(e) => {
                  const next = [...planSessions]
                  next[idx] = { ...session, notes: e.target.value }
                  setPlanSessions(next)
                }}
                bg="white"
                minH="56px"
                borderColor="gray.300"
                placeholder="Your private prep notes (not shared with the learner)"
              />
            </Box>
          ))}
        </Stack>
      </Box>
    </Stack>
  )
}

export default CoachLearnerPanel
