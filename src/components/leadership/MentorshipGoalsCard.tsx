import React, { useEffect, useMemo, useState } from 'react'
import { Box, Button, Flex, Stack, Text, Textarea, useToast } from '@chakra-ui/react'
import { Save } from 'lucide-react'
import {
  MENTORSHIP_GOALS_MAX_LENGTH,
  useMentorshipGoals,
} from '@/hooks/useMentorshipGoals'
import { useSessionPrepLift } from '@/hooks/useSessionPrepLift'
import { getArchetypeSessionPrompts } from '@/config/archetypeSessionPrompts'
import type { Archetype } from '@/config/liftAssessment'

type MentorshipGoalsCardProps = {
  learnerId: string
  mentorId?: string | null
  /** Label variant */
  audience?: 'mentor' | 'coach'
  /** Fired after a successful save so parent Session Prep can refresh. */
  onSaved?: (goals: string) => void
}

const SPLIT = '\n\n'

/** Shared “I'm trying to achieve…” editor — prompts vary by LIFT archetype. */
export const MentorshipGoalsCard: React.FC<MentorshipGoalsCardProps> = ({
  learnerId,
  mentorId = null,
  audience = 'mentor',
  onSaved,
}) => {
  const toast = useToast()
  const { goals, loading, saving, save } = useMentorshipGoals(learnerId, mentorId)
  const { archetype, loading: liftLoading } = useSessionPrepLift(learnerId)
  const prompts = useMemo(
    () => getArchetypeSessionPrompts(archetype as Archetype | null),
    [archetype],
  )

  const [answers, setAnswers] = useState<string[]>(['', '', ''])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
  }, [learnerId])

  useEffect(() => {
    if (!loading && !liftLoading && !ready) {
      const parts = goals.split(SPLIT)
      setAnswers([
        (parts[0] || '').trim(),
        (parts[1] || '').trim(),
        (parts[2] || '').trim(),
      ])
      setReady(true)
    }
  }, [loading, liftLoading, ready, goals])

  const combined = answers.map((a) => a.trim()).filter(Boolean).join(SPLIT)
  const dirty = ready && combined !== goals.trim()
  const tooLong = combined.length > MENTORSHIP_GOALS_MAX_LENGTH

  const handleSave = async () => {
    if (!dirty || tooLong || saving) return
    try {
      await save(combined)
      onSaved?.(combined)
      toast({
        title: 'Goal saved',
        description:
          audience === 'coach'
            ? 'Learner notified. Also visible in Session Prep and Leadership Council.'
            : 'Learner notified. Also visible in Session Prep and Leadership Council.',
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

  return (
    <Box border="1px solid" borderColor="gray.200" borderRadius="xl" bg="white" px={5} py={4}>
      <Text fontSize="xs" fontWeight="bold" letterSpacing="0.08em" color="gray.500">
        {audience === 'coach' ? 'COACHING GOAL' : 'MENTORSHIP GOAL'}
      </Text>
      <Text mt={1} fontSize="md" fontWeight="700" color="#27062e">
        {archetype ? `${archetype} · session prep answers` : "I'm trying to achieve…"}
      </Text>
      <Text mt={1} fontSize="sm" color="gray.600" mb={3}>
        Answer the three prompts below. Your {audience === 'coach' ? 'coach' : 'mentor'} sees this in
        Session Prep.
      </Text>
      <Stack spacing={4}>
        {prompts.map((prompt, index) => (
          <Box key={prompt.label}>
            <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="0.06em" textTransform="uppercase">
              {prompt.label}
            </Text>
            <Text fontSize="sm" color="gray.700" mt={1} mb={2}>
              {prompt.question}
            </Text>
            <Textarea
              value={answers[index] || ''}
              onChange={(e) => {
                const next = [...answers]
                next[index] = e.target.value
                setAnswers(next)
              }}
              minH="72px"
              placeholder={prompt.placeholder}
              borderColor="gray.300"
              isDisabled={loading || liftLoading}
              _focus={{ borderColor: '#350e6f', boxShadow: '0 0 0 1px #350e6f' }}
            />
          </Box>
        ))}
      </Stack>
      <Flex mt={3} justify="space-between" align="center" gap={3} flexWrap="wrap">
        <Text fontSize="xs" color={tooLong ? 'red.500' : 'gray.500'}>
          {combined.length}/{MENTORSHIP_GOALS_MAX_LENGTH}
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
          Save answers
        </Button>
      </Flex>
    </Box>
  )
}
