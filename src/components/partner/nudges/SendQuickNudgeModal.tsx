import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Divider,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react'
import { AlertTriangle, Mail, Send, TrendingDown, Target } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/services/firebase'
import { createInAppNotification } from '@/services/notificationService'
import { logNudgeSent } from '@/services/firebaseNudgeService'
import type { PartnerUser } from '@/hooks/usePartnerDashboardData'
import { getDisplayName } from '@/utils/displayName'

/**
 * Journey pass marks from the points system documentation.
 * Maps journey type identifiers to their total pass mark.
 */
const JOURNEY_PASS_MARKS: Record<string, { label: string; passMark: number; windows: number; totalWeeks: number }> = {
  '4w': { label: '4-Week Intro', passMark: 9_000, windows: 2, totalWeeks: 4 },
  '4-week': { label: '4-Week Intro', passMark: 9_000, windows: 2, totalWeeks: 4 },
  '4_week': { label: '4-Week Intro', passMark: 9_000, windows: 2, totalWeeks: 4 },
  '4week': { label: '4-Week Intro', passMark: 9_000, windows: 2, totalWeeks: 4 },
  'intro': { label: '4-Week Intro', passMark: 9_000, windows: 2, totalWeeks: 4 },
  '6w': { label: '6-Week Power', passMark: 40_000, windows: 3, totalWeeks: 6 },
  '6-week': { label: '6-Week Power', passMark: 40_000, windows: 3, totalWeeks: 6 },
  '6_week': { label: '6-Week Power', passMark: 40_000, windows: 3, totalWeeks: 6 },
  '6week': { label: '6-Week Power', passMark: 40_000, windows: 3, totalWeeks: 6 },
  'power': { label: '6-Week Power', passMark: 40_000, windows: 3, totalWeeks: 6 },
  '3m': { label: '3-Month', passMark: 75_000, windows: 6, totalWeeks: 12 },
  '3-month': { label: '3-Month', passMark: 75_000, windows: 6, totalWeeks: 12 },
  '3_month': { label: '3-Month', passMark: 75_000, windows: 6, totalWeeks: 12 },
  '3month': { label: '3-Month', passMark: 75_000, windows: 6, totalWeeks: 12 },
  '6m': { label: '6-Month', passMark: 150_000, windows: 12, totalWeeks: 24 },
  '6-month': { label: '6-Month', passMark: 150_000, windows: 12, totalWeeks: 24 },
  '6_month': { label: '6-Month', passMark: 150_000, windows: 12, totalWeeks: 24 },
  '6month': { label: '6-Month', passMark: 150_000, windows: 12, totalWeeks: 24 },
  '9m': { label: '9-Month', passMark: 227_000, windows: 18, totalWeeks: 36 },
  '9-month': { label: '9-Month', passMark: 227_000, windows: 18, totalWeeks: 36 },
  '9_month': { label: '9-Month', passMark: 227_000, windows: 18, totalWeeks: 36 },
  '9month': { label: '9-Month', passMark: 227_000, windows: 18, totalWeeks: 36 },
}

/** Default fallback: 6-Week Power journey (most common) */
const DEFAULT_JOURNEY = { label: '6-Week Power', passMark: 40_000, windows: 3, totalWeeks: 6 }

function getJourneyInfo(journeyType?: string) {
  if (!journeyType) return DEFAULT_JOURNEY
  const key = journeyType.toLowerCase().trim()
  return JOURNEY_PASS_MARKS[key] ?? DEFAULT_JOURNEY
}

interface SendQuickNudgeModalProps {
  isOpen: boolean
  onClose: () => void
  user: PartnerUser
  adminId: string
}

export const SendQuickNudgeModal: React.FC<SendQuickNudgeModalProps> = ({
  isOpen,
  onClose,
  user,
  adminId,
}) => {
  const toast = useToast()
  const [sending, setSending] = useState(false)

  const displayName = getDisplayName(user, 'Learner')
  const journey = useMemo(() => getJourneyInfo(user.journeyType), [user.journeyType])
  const totalPoints = user.totalPoints ?? 0
  const pointsBehind = Math.max(0, journey.passMark - totalPoints)
  const progressPercent = journey.passMark > 0
    ? Math.min(100, Math.round((totalPoints / journey.passMark) * 100))
    : 0
  const weeklyTarget = journey.passMark / journey.totalWeeks

  // Calculate expected points by current week
  const expectedByNow = Math.round(weeklyTarget * Math.max(1, user.currentWeek))
  const expectedGap = Math.max(0, expectedByNow - totalPoints)

  // Build the professional nudge message
  const nudgeTitle = 'Journey Progress Reminder'
  const nudgeMessage = useMemo(() => {
    const parts: string[] = []

    parts.push(`Hi ${displayName},`)
    parts.push('')

    if (totalPoints === 0) {
      parts.push(
        `We noticed you haven't earned any points yet on your ${journey.label} journey. ` +
        `The pass mark for this journey is ${journey.passMark.toLocaleString()} points, ` +
        `and you're currently at Week ${user.currentWeek || 1}.`
      )
    } else {
      parts.push(
        `You've earned ${totalPoints.toLocaleString()} points so far on your ${journey.label} journey — ` +
        `that's ${progressPercent}% of the ${journey.passMark.toLocaleString()}-point pass mark.`
      )
    }

    parts.push('')

    if (expectedGap > 0) {
      parts.push(
        `Based on your current week (Week ${user.currentWeek || 1}), ` +
        `you should ideally be at around ${expectedByNow.toLocaleString()} points by now. ` +
        `You're ${expectedGap.toLocaleString()} points behind the expected pace.`
      )
    }

    if (pointsBehind > 0) {
      parts.push(
        `You still need ${pointsBehind.toLocaleString()} more points to pass your journey.`
      )
    }

    parts.push('')
    parts.push(
      'Every activity you complete brings you closer to your goal. ' +
      'Log in today, check your weekly checklist, and keep building momentum. You\'ve got this!'
    )

    return parts.join('\n')
  }, [displayName, totalPoints, journey, progressPercent, expectedByNow, expectedGap, pointsBehind, user.currentWeek])

  const handleSend = async () => {
    setSending(true)
    try {
      // 1. Send in-app notification to the learner
      await createInAppNotification({
        userId: user.id,
        type: 'engagement_alert',
        title: nudgeTitle,
        message: nudgeMessage,
        metadata: {
          nudgeType: 'at_risk_reminder',
          sentBy: adminId,
          journeyType: user.journeyType || 'unknown',
          passMark: journey.passMark,
          totalPoints,
          pointsBehind,
          expectedByNow,
          currentWeek: user.currentWeek,
          progressPercent,
        },
      })

      // 2. Send email via Cloud Function
      let emailSent = false
      if (user.email) {
        try {
          const sendNudgeEmailFn = httpsCallable<
            {
              to: string
              recipientName: string
              subject: string
              journeyLabel: string
              totalPoints: number
              passMark: number
              progressPercent: number
              pointsBehind: number
              expectedByNow: number
              expectedGap: number
              currentWeek: number
            },
            { success: boolean }
          >(functions, 'sendNudgeEmail')

          await sendNudgeEmailFn({
            to: user.email,
            recipientName: displayName,
            subject: `Journey Progress Reminder — ${journey.label}`,
            journeyLabel: journey.label,
            totalPoints,
            passMark: journey.passMark,
            progressPercent,
            pointsBehind,
            expectedByNow,
            expectedGap,
            currentWeek: user.currentWeek || 1,
          })
          emailSent = true
        } catch (emailError) {
          console.warn('Email delivery failed, in-app notification still sent:', emailError)
        }
      }

      // 3. Log the nudge for tracking
      await logNudgeSent({
        user_id: user.id,
        template_id: null,
        sent_by_admin_id: adminId,
        delivery_status: 'sent',
        channel: emailSent ? 'both' : 'in_app',
        metadata: {
          quickNudge: true,
          journeyType: user.journeyType || 'unknown',
          passMark: journey.passMark,
          totalPoints,
          pointsBehind,
          emailSent,
        },
      })

      toast({
        title: 'Nudge sent',
        description: emailSent
          ? `Reminder sent to ${displayName} via notification and email.`
          : `Reminder sent to ${displayName}. They'll see it in their notification bell.`,
        status: 'success',
        duration: 4000,
      })

      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong.'
      toast({
        title: 'Failed to send nudge',
        description: message,
        status: 'error',
        duration: 5000,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay bg="blackAlpha.500" />
      <ModalContent borderRadius="xl" mx={4}>
        <ModalHeader pb={2}>
          <HStack spacing={3}>
            <Box
              p={2}
              borderRadius="lg"
              bg="orange.50"
              color="orange.500"
            >
              <AlertTriangle size={20} />
            </Box>
            <VStack align="start" spacing={0}>
              <Text fontSize="lg" fontWeight="bold" color="gray.800">
                Send Journey Reminder
              </Text>
              <Text fontSize="sm" fontWeight="normal" color="gray.500">
                Notify {displayName} about their progress
              </Text>
            </VStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <VStack spacing={5} align="stretch">
            {/* Learner Summary Card */}
            <Box
              p={4}
              borderRadius="lg"
              bg="gray.50"
              border="1px solid"
              borderColor="gray.200"
            >
              <VStack spacing={3} align="stretch">
                <HStack justify="space-between">
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="semibold" color="gray.800">
                      {displayName}
                    </Text>
                    <Text fontSize="sm" color="gray.500">{user.email}</Text>
                  </VStack>
                  <Box
                    px={3}
                    py={1}
                    borderRadius="full"
                    bg={progressPercent < 25 ? 'red.100' : progressPercent < 50 ? 'orange.100' : 'yellow.100'}
                    color={progressPercent < 25 ? 'red.700' : progressPercent < 50 ? 'orange.700' : 'yellow.700'}
                  >
                    <Text fontSize="sm" fontWeight="semibold">
                      {progressPercent}% complete
                    </Text>
                  </Box>
                </HStack>

                {/* Progress Bar */}
                <Box>
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="xs" color="gray.500">Journey progress</Text>
                    <Text fontSize="xs" fontWeight="medium" color="gray.600">
                      {totalPoints.toLocaleString()} / {journey.passMark.toLocaleString()} pts
                    </Text>
                  </HStack>
                  <Progress
                    value={progressPercent}
                    size="sm"
                    borderRadius="full"
                    colorScheme={progressPercent < 25 ? 'red' : progressPercent < 50 ? 'orange' : 'yellow'}
                    bg="gray.200"
                  />
                </Box>

                {/* Key Stats */}
                <HStack spacing={4} pt={1}>
                  <HStack spacing={1.5}>
                    <Target size={14} color="#718096" />
                    <Text fontSize="xs" color="gray.600">
                      Journey: {journey.label}
                    </Text>
                  </HStack>
                  <HStack spacing={1.5}>
                    <TrendingDown size={14} color="#E53E3E" />
                    <Text fontSize="xs" color="red.600" fontWeight="medium">
                      {pointsBehind > 0
                        ? `${pointsBehind.toLocaleString()} pts to pass`
                        : 'On track to pass'}
                    </Text>
                  </HStack>
                </HStack>

                {expectedGap > 0 && (
                  <Box
                    p={2.5}
                    borderRadius="md"
                    bg="red.50"
                    border="1px solid"
                    borderColor="red.100"
                  >
                    <Text fontSize="xs" color="red.700">
                      At Week {user.currentWeek || 1}, expected pace is ~{expectedByNow.toLocaleString()} pts.
                      Currently {expectedGap.toLocaleString()} points behind schedule.
                    </Text>
                  </Box>
                )}
              </VStack>
            </Box>

            <Divider />

            {/* Delivery channels */}
            <HStack spacing={3}>
              <HStack
                spacing={2}
                px={3}
                py={2}
                borderRadius="md"
                bg="blue.50"
                border="1px solid"
                borderColor="blue.200"
                flex={1}
              >
                <Send size={14} color="#3182CE" />
                <Text fontSize="xs" fontWeight="medium" color="blue.700">
                  In-app notification
                </Text>
              </HStack>
              <HStack
                spacing={2}
                px={3}
                py={2}
                borderRadius="md"
                bg={user.email ? 'green.50' : 'gray.50'}
                border="1px solid"
                borderColor={user.email ? 'green.200' : 'gray.200'}
                flex={1}
              >
                <Mail size={14} color={user.email ? '#38A169' : '#A0AEC0'} />
                <Text fontSize="xs" fontWeight="medium" color={user.email ? 'green.700' : 'gray.400'}>
                  {user.email ? 'Email' : 'No email on file'}
                </Text>
              </HStack>
            </HStack>

            {/* Message Preview */}
            <Box>
              <Text fontSize="sm" fontWeight="semibold" color="gray.700" mb={2}>
                Message preview
              </Text>
              <Box
                p={4}
                borderRadius="lg"
                bg="purple.50"
                border="1px solid"
                borderColor="purple.200"
              >
                <HStack align="start" spacing={3}>
                  <Box
                    p={1.5}
                    borderRadius="md"
                    bg="purple.100"
                    color="purple.600"
                    flexShrink={0}
                    mt={0.5}
                  >
                    <Send size={14} />
                  </Box>
                  <VStack align="start" spacing={1}>
                    <Text fontSize="sm" fontWeight="semibold" color="purple.800">
                      {nudgeTitle}
                    </Text>
                    <Text fontSize="xs" color="purple.700" whiteSpace="pre-line" lineHeight="1.6">
                      {nudgeMessage}
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter pt={4}>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={onClose} isDisabled={sending}>
              Cancel
            </Button>
            <Button
              colorScheme="purple"
              leftIcon={<Send size={16} />}
              onClick={() => void handleSend()}
              isLoading={sending}
              loadingText="Sending..."
            >
              Send Nudge
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default SendQuickNudgeModal
