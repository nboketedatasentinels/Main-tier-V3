import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Spinner,
  Stack,
  Tag,
  Text,
  Tooltip,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { CheckCircle, Plus } from 'lucide-react'
import { getIsoWeekNumber } from '@/utils/date'
import { useAuth } from '@/hooks/useAuth'
import { CALENDAR_SYNC_TUTORIAL } from '@/types'
import { checkTutorialCompletion, markTutorialComplete } from '@/services/tutorialService'
import { IoradTutorialModal } from '@/components/modals/IoradTutorialModal'

const rhythmItems = [
  'Sync T4L Calendar to Google/Outlook',
  'Add weekly time block for watching videos',
  'Add weekly time block for completing missions',
  'Add weekly time block for point tracking',
  'Accept first live session invite',
]

const CALENDAR_SYNC_ITEM = 'Sync T4L Calendar to Google/Outlook'

const useRhythmState = () => {
  const today = new Date()
  const calendarWeek = getIsoWeekNumber(today)
  const storageKey = `rhythm-${today.getFullYear()}-W${calendarWeek}`
  const [completed, setCompleted] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try {
        setCompleted(JSON.parse(stored))
      } catch (error) {
        console.error('Failed to parse rhythm state from localStorage', error)
        localStorage.removeItem(storageKey) // Clear corrupted data
      }
    }
  }, [storageKey])

  const toggleItem = (item: string) => {
    setCompleted((prev) => {
      const next = { ...prev, [item]: !prev[item] }
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  const setItemCompletion = (item: string, value: boolean) => {
    setCompleted((prev) => {
      const next = { ...prev, [item]: value }
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  const totalPoints = useMemo(() => Object.values(completed).filter(Boolean).length * 50, [completed])

  return { completed, toggleItem, setItemCompletion, totalPoints, calendarWeek }
}

export const ParticipationRhythm = () => {
  const { user } = useAuth()
  const toast = useToast()
  const {
    completed: rhythmCompleted,
    toggleItem,
    setItemCompletion,
    totalPoints: rhythmPoints,
    calendarWeek,
  } = useRhythmState()

  const {
    isOpen: isTutorialModalOpen,
    onOpen: openTutorialModal,
    onClose: closeTutorialModal,
  } = useDisclosure()

  const [tutorialCompleted, setTutorialCompleted] = useState(false)
  const [tutorialLoading, setTutorialLoading] = useState(false)
  const [tutorialError, setTutorialError] = useState<string | null>(null)
  const [tutorialSaving, setTutorialSaving] = useState(false)
  const [tutorialSaveError, setTutorialSaveError] = useState<string | null>(null)

  const checkCalendarSyncTutorial = useCallback(async () => {
    if (!user) return
    setTutorialLoading(true)
    setTutorialError(null)
    try {
      const completion = await checkTutorialCompletion(user.uid, CALENDAR_SYNC_TUTORIAL.id)
      setTutorialCompleted(Boolean(completion))
      if (completion) {
          // If tutorial is completed, make sure the item is also marked (optional, but good for UX)
      }
    } catch (err) {
      console.error(err)
      setTutorialError('Unable to load tutorial status.')
    } finally {
      setTutorialLoading(false)
    }
  }, [user])

  useEffect(() => {
    checkCalendarSyncTutorial()
  }, [checkCalendarSyncTutorial])

  const handleTutorialComplete = async () => {
    if (!user) return
    setTutorialSaving(true)
    setTutorialSaveError(null)
    try {
      await markTutorialComplete(user.uid, CALENDAR_SYNC_TUTORIAL.id)
      setTutorialCompleted(true)
      setItemCompletion(CALENDAR_SYNC_ITEM, true)
      toast({
        title: 'Tutorial complete',
        description: 'You can now mark the calendar sync item as done.',
        status: 'success',
      })
      closeTutorialModal()
    } catch (err) {
      console.error(err)
      setTutorialSaveError('Unable to save tutorial completion.')
    } finally {
      setTutorialSaving(false)
    }
  }

  return (
    <Box borderWidth="1px" borderColor="border.card" p={4} borderRadius="lg" bg="surface.default">
      <HStack justify="space-between" mb={2}>
        <Heading size="sm" color="text.primary">
          Participation Rhythm
        </Heading>
        <Tag colorScheme="primary">+{rhythmPoints} pts</Tag>
      </HStack>
      {tutorialError && (
        <Alert status="warning" borderRadius="md" mb={3}>
          <AlertIcon />
          <AlertDescription>{tutorialError}</AlertDescription>
          <IconButton
            aria-label="Retry"
            size="sm"
            ml="auto"
            onClick={checkCalendarSyncTutorial}
            icon={tutorialLoading ? <Spinner size="xs" /> : <Icon as={Plus} />}
            isDisabled={tutorialLoading}
            variant="outline"
          />
        </Alert>
      )}
      <Stack spacing={2}>
        {rhythmItems.map((item) => (
          <Flex key={item} align="center" justify="space-between" p={2} borderRadius="md" bg="surface.subtle">
            <HStack spacing={2}>
              <Text color="text.secondary">{item}</Text>
              {item === CALENDAR_SYNC_ITEM && !tutorialCompleted && (
                <Badge colorScheme="orange" variant="subtle">
                  Tutorial Required
                </Badge>
              )}
            </HStack>
            <Tooltip
              label={
                item === CALENDAR_SYNC_ITEM && !tutorialCompleted
                  ? 'Complete the calendar sync tutorial before marking this as done.'
                  : ''
              }
              isDisabled={item !== CALENDAR_SYNC_ITEM || tutorialCompleted}
            >
              <Button
                size="sm"
                leftIcon={
                  rhythmCompleted[item] ? (
                    <Icon as={CheckCircle} />
                  ) : tutorialLoading && item === CALENDAR_SYNC_ITEM ? (
                    <Spinner size="xs" />
                  ) : (
                    <Icon as={Plus} />
                  )
                }
                colorScheme={rhythmCompleted[item] ? 'primary' : undefined}
                variant={rhythmCompleted[item] ? 'solid' : 'outline'}
                onClick={() => {
                  if (item === CALENDAR_SYNC_ITEM && !tutorialCompleted) {
                    openTutorialModal()
                    return
                  }
                  toggleItem(item)
                }}
                isDisabled={tutorialLoading && item === CALENDAR_SYNC_ITEM}
              >
                {rhythmCompleted[item] ? 'Completed' : 'Mark done'}
              </Button>
            </Tooltip>
          </Flex>
        ))}
      </Stack>
      <Text color="text.muted" fontSize="sm" mt={2}>
        Saved locally for calendar week {calendarWeek}.
      </Text>

      <IoradTutorialModal
        isOpen={isTutorialModalOpen}
        onClose={closeTutorialModal}
        onComplete={handleTutorialComplete}
        tutorialUrl={CALENDAR_SYNC_TUTORIAL.url}
        isSubmitting={tutorialSaving}
        error={tutorialSaveError}
        onRetry={tutorialSaveError ? handleTutorialComplete : undefined}
      />
    </Box>
  )
}
