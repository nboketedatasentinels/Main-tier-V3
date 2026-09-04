import React, { useEffect, useMemo, useState } from 'react'
import { Box, Button, Flex, HStack, Text, Textarea, useToast } from '@chakra-ui/react'
import { ChevronLeft, ChevronRight, Save } from 'lucide-react'
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
  /** Emphasise this as the primary action on the page. */
  primary?: boolean
}

const SPLIT = '\n\n'
const cardBorder = 'rgba(53, 14, 111, 0.16)'

/** Shared “I'm trying to achieve…” editor — one prompt at a time to reduce scroll. */
export const MentorshipGoalsCard: React.FC<MentorshipGoalsCardProps> = ({
  learnerId,
  mentorId = null,
  audience = 'mentor',
  onSaved,
  primary = false,
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
  const [step, setStep] = useState(0)

  useEffect(() => {
    setReady(false)
    setStep(0)
  }, [learnerId])

  useEffect(() => {
    if (!loading && !liftLoading && !ready) {
      const parts = goals.split(SPLIT)
      setAnswers([(parts[0] || '').trim(), (parts[1] || '').trim(), (parts[2] || '').trim()])
      setReady(true)
    }
  }, [loading, liftLoading, ready, goals])

  const combined = answers.map((a) => a.trim()).filter(Boolean).join(SPLIT)
  const dirty = ready && combined !== goals.trim()
  const tooLong = combined.length > MENTORSHIP_GOALS_MAX_LENGTH
  const prompt = prompts[step] || prompts[0]
  const lastStep = step >= prompts.length - 1
  const canAdvance = Boolean((answers[step] || '').trim())

  const handleSave = async () => {
    if (!dirty || tooLong || saving) return
    try {
      await save(combined)
      onSaved?.(combined)
      toast({
        title: 'Goal saved',
        description: 'Also visible in Session Prep and Leadership Council.',
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
    <Box
      borderWidth="1px"
      borderStyle="solid"
      borderColor={primary ? 'rgba(53, 14, 111, 0.32)' : cardBorder}
      borderRadius="xl"
      bg="white"
      px={{ base: 4, md: 6 }}
      py={{ base: 4, md: 5 }}
      boxShadow={primary ? '0 8px 24px rgba(53, 14, 111, 0.1)' : '0 1px 3px rgba(0,0,0,0.03)'}
    >
      <Flex justify="space-between" align="flex-start" gap={3} mb={2}>
        <Box>
          <Text fontSize="xs" fontWeight="bold" letterSpacing="0.08em" color="gray.500" textTransform="uppercase">
            {audience === 'coach' ? 'Coaching goal' : 'Mentorship goal'}
          </Text>
          <Text mt={1} fontSize={primary ? 'lg' : 'md'} fontWeight="700" color="#27062e">
            {archetype ? `${archetype} · session prep` : "I'm trying to achieve…"}
          </Text>
        </Box>
        <HStack spacing={1.5} pt={1}>
          {prompts.map((_, i) => (
            <Box
              key={i}
              w="9px"
              h="9px"
              rounded="full"
              bg={i === step ? '#f4540c' : i < step || (answers[i] || '').trim() ? '#350e6f' : 'gray.200'}
            />
          ))}
        </HStack>
      </Flex>

      {prompt && (
        <Box>
          <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="0.06em" textTransform="uppercase">
            {step + 1}/{prompts.length} · {prompt.label}
          </Text>
          <Text fontSize={primary ? 'md' : 'sm'} color="gray.800" mt={1} mb={3} fontWeight="medium" lineHeight="1.45">
            {prompt.question}
          </Text>
          <Textarea
            value={answers[step] || ''}
            onChange={(e) => {
              const next = [...answers]
              next[step] = e.target.value
              setAnswers(next)
            }}
            minH={primary ? '120px' : '88px'}
            placeholder={prompt.placeholder}
            borderColor="gray.300"
            fontSize="md"
            isDisabled={loading || liftLoading}
            autoFocus={primary}
            _focus={{ borderColor: '#350e6f', boxShadow: '0 0 0 1px #350e6f' }}
          />
        </Box>
      )}

      <Flex mt={4} justify="space-between" align="center" gap={3} flexWrap="wrap">
        <Text fontSize="xs" color={tooLong ? 'red.500' : 'gray.500'}>
          {combined.length}/{MENTORSHIP_GOALS_MAX_LENGTH}
        </Text>
        <HStack spacing={2}>
          <Button
            size={primary ? 'md' : 'sm'}
            variant="ghost"
            leftIcon={<ChevronLeft size={14} />}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            isDisabled={step === 0}
          >
            Back
          </Button>
          {!lastStep ? (
            <Button
              size={primary ? 'md' : 'sm'}
              bg="#350e6f"
              color="white"
              rightIcon={<ChevronRight size={14} />}
              _hover={{ bg: '#27062e' }}
              onClick={() => setStep((s) => Math.min(prompts.length - 1, s + 1))}
              isDisabled={!canAdvance}
            >
              Next
            </Button>
          ) : (
            <Button
              size={primary ? 'md' : 'sm'}
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
          )}
        </HStack>
      </Flex>
    </Box>
  )
}
