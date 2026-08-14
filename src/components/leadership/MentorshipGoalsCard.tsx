import React, { useEffect, useState } from 'react'
import { Box, Button, Flex, Text, Textarea, useToast } from '@chakra-ui/react'
import { Save } from 'lucide-react'
import {
  MENTORSHIP_GOALS_MAX_LENGTH,
  useMentorshipGoals,
} from '@/hooks/useMentorshipGoals'

type MentorshipGoalsCardProps = {
  learnerId: string
  mentorId?: string | null
  /** Label variant */
  audience?: 'mentor' | 'coach'
}

/** Shared “I'm trying to achieve…” editor for mentor and coach surfaces. */
export const MentorshipGoalsCard: React.FC<MentorshipGoalsCardProps> = ({
  learnerId,
  mentorId = null,
  audience = 'mentor',
}) => {
  const toast = useToast()
  const { goals, loading, saving, save } = useMentorshipGoals(learnerId, mentorId)
  const [draft, setDraft] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
  }, [learnerId])

  useEffect(() => {
    if (!loading && !ready) {
      setDraft(goals)
      setReady(true)
    }
  }, [loading, ready, goals])

  const dirty = ready && draft.trim() !== goals.trim()
  const tooLong = draft.length > MENTORSHIP_GOALS_MAX_LENGTH

  const handleSave = async () => {
    if (!dirty || tooLong || saving) return
    try {
      await save(draft)
      toast({
        title: 'Goal saved',
        description:
          audience === 'coach'
            ? 'Visible in coaching Session Prep.'
            : 'Visible in mentoring Session Prep.',
        status: 'success',
        duration: 2800,
      })
    } catch (err) {
      toast({
        title: 'Could not save goal',
        description: err instanceof Error ? err.message : 'Try again.',
        status: 'error',
      })
    }
  }

  return (
    <Box border="1px solid" borderColor="gray.200" borderRadius="xl" bg="white" px={5} py={4}>
      <Text fontSize="xs" fontWeight="bold" letterSpacing="0.08em" color="gray.500">
        {audience === 'coach' ? 'COACHING GOAL' : 'MENTORSHIP GOAL'}
      </Text>
      <Text mt={1} fontSize="md" fontWeight="700" color="#27062e">
        I&apos;m trying to achieve…
      </Text>
      <Text mt={1} fontSize="sm" color="gray.600" mb={3}>
        Capture the outcome in their words
        {audience === 'mentor' ? ' (optional for mentors — same prompt as coaching).' : '.'}
      </Text>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        minH="96px"
        placeholder="e.g. Hold a direct conversation with my head of data without backing down."
        borderColor="gray.300"
        isDisabled={loading}
        _focus={{ borderColor: '#350e6f', boxShadow: '0 0 0 1px #350e6f' }}
      />
      <Flex mt={3} justify="space-between" align="center" gap={3} flexWrap="wrap">
        <Text fontSize="xs" color={tooLong ? 'red.500' : 'gray.500'}>
          {draft.length}/{MENTORSHIP_GOALS_MAX_LENGTH}
        </Text>
        <Button
          size="sm"
          leftIcon={<Save size={14} />}
          bg="#350e6f"
          color="white"
          _hover={{ bg: '#27062e' }}
          onClick={() => void handleSave()}
          isDisabled={!dirty || tooLong}
          isLoading={saving}
        >
          Save goal
        </Button>
      </Flex>
    </Box>
  )
}
