import React, { useEffect, useMemo, useState } from 'react'
import { Box, Button, Flex, HStack, Stack, Text, Textarea, useToast } from '@chakra-ui/react'
import { ChevronLeft, ChevronRight, Pencil, Save } from 'lucide-react'
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
  /** When parent reopens the form to edit existing answers. */
  startInEditMode?: boolean
  /** Fired when user cancels editing existing answers (parent can hide the form). */
  onCancelEdit?: () => void
  /** Emphasise this as the primary action on the page. */
  primary?: boolean
}

const SPLIT = '\n\n'
const cardBorder = 'rgba(53, 14, 111, 0.16)'

const splitAnswers = (goals: string): string[] => {
  const parts = goals.split(SPLIT)
  return [(parts[0] || '').trim(), (parts[1] || '').trim(), (parts[2] || '').trim()]
}

/** Keep three slots so answers stay aligned with prompts after reload. */
const joinAnswers = (answers: string[]): string =>
  [0, 1, 2].map((i) => (answers[i] || '').trim()).join(SPLIT)

/** Shared “I'm trying to achieve…” editor — one prompt at a time to reduce scroll. */
export const MentorshipGoalsCard: React.FC<MentorshipGoalsCardProps> = ({
  learnerId,
  mentorId = null,
  audience = 'mentor',
  onSaved,
  startInEditMode = false,
  onCancelEdit,
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
  const [editing, setEditing] = useState(Boolean(startInEditMode))

  useEffect(() => {
    setReady(false)
    setStep(0)
    setEditing(Boolean(startInEditMode))
  }, [learnerId, startInEditMode])

  useEffect(() => {
    if (!loading && !liftLoading && !ready) {
      setAnswers(splitAnswers(goals))
      setReady(true)
      setEditing(startInEditMode || !goals.trim())
    }
  }, [loading, liftLoading, ready, goals, startInEditMode])

  const combined = joinAnswers(answers)
  const dirty = ready && combined !== goals.trim()
  const tooLong = combined.length > MENTORSHIP_GOALS_MAX_LENGTH
  const prompt = prompts[step] || prompts[0]
  const lastStep = step >= prompts.length - 1
  const canAdvance = Boolean((answers[step] || '').trim())
  const hasSavedAnswers = Boolean(goals.trim()) && !editing

  const handleSave = async () => {
    if (!dirty || tooLong || saving) return
    try {
      await save(combined)
      onSaved?.(combined)
      setEditing(false)
      toast({
        title: 'Answers saved',
        description: 'Your session prep is ready below.',
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
        {!hasSavedAnswers ? (
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
        ) : null}
      </Flex>

      {hasSavedAnswers ? (
        <Stack spacing={0}>
          {prompts.map((p, i) => {
            const text = (answers[i] || '').trim()
            if (!text) return null
            return (
              <Box key={p.label} borderTop="1px solid" borderColor="rgba(53, 14, 111, 0.12)" py={3}>
                <Text fontSize="10px" fontWeight="bold" letterSpacing="0.08em" textTransform="uppercase" color="gray.500">
                  {p.label}
                </Text>
                <Text fontSize="sm" color="#27062e" mt={1} whiteSpace="pre-wrap" lineHeight="1.55">
                  {text}
                </Text>
              </Box>
            )
          })}
          <Flex mt={3} justify="flex-end">
            <Button
              size="sm"
              variant="outline"
              borderColor="rgba(53, 14, 111, 0.28)"
              color="#350e6f"
              leftIcon={<Pencil size={14} />}
              onClick={() => {
                setEditing(true)
                setStep(0)
              }}
            >
              Edit answers
            </Button>
          </Flex>
        </Stack>
      ) : (
        <>
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
              {combined.replace(/\n\n/g, '\n').trim().length}/{MENTORSHIP_GOALS_MAX_LENGTH}
            </Text>
            <HStack spacing={2}>
              {hasSavedAnswers === false && goals.trim() ? (
                <Button
                  size={primary ? 'md' : 'sm'}
                  variant="ghost"
                  onClick={() => {
                    setAnswers(splitAnswers(goals))
                    setEditing(false)
                    setStep(0)
                    onCancelEdit?.()
                  }}
                >
                  Cancel
                </Button>
              ) : null}
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
        </>
      )}
    </Box>
  )
}
