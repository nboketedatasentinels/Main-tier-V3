import React, { useEffect, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  HStack,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import {
  coursePodcastComponentId,
  disputeAiGrade,
  getSubmissionByComponentId,
  type ProgrammeComponentSubmission,
} from '@/services/programmeComponentSubmissionService'

type LearnerAiExplainPanelProps = {
  uid: string
  /** When set, loads that submission (programme artefact id). */
  componentId?: string | null
  /** Course podcast helpers — builds component id from pack+slot. */
  packId?: string | null
  slot?: string | null
  pollMs?: number
}

/**
 * Learner-facing AI explainability when no partner has reviewed yet.
 * Shows why the AI scored what it did, and lets the learner dispute → human review.
 */
export const LearnerAiExplainPanel: React.FC<LearnerAiExplainPanelProps> = ({
  uid,
  componentId,
  packId,
  slot,
  pollMs = 4000,
}) => {
  const toast = useToast()
  const [row, setRow] = useState<ProgrammeComponentSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [disputeNote, setDisputeNote] = useState('')
  const [disputing, setDisputing] = useState(false)

  const resolvedId =
    (componentId && componentId.trim()) ||
    (packId && slot ? coursePodcastComponentId(packId, slot) : null)

  useEffect(() => {
    if (!uid || !resolvedId) {
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const next = await getSubmissionByComponentId({ uid, componentId: resolvedId })
        if (!cancelled) setRow(next)
      } catch {
        if (!cancelled) setRow(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const t = window.setInterval(() => void load(), pollMs)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [uid, resolvedId, pollMs])

  if (!resolvedId) return null
  if (loading && !row) {
    return (
      <Text fontSize="sm" color="gray.500">
        Waiting for AI estimate…
      </Text>
    )
  }
  if (!row) return null

  const ai = row.aiGrade
  const feedback = (ai?.feedbackForPartner || ai?.feedback || '').trim()
  const score =
    ai?.score != null && Number.isFinite(ai.score) ? Math.round(ai.score) : null
  const partnerDecided = Boolean(row.aiDecision)
  const disputed = Boolean(row.learnerDisputedAt)

  if (ai?.status === 'pending' || ai?.status === 'grading') {
    return (
      <Alert status="info" rounded="md" py={2}>
        <AlertIcon />
        <AlertDescription fontSize="sm">
          AI is reviewing your answers against the standard. This estimate is advisory — a partner
          may still accept, edit, or reject it.
        </AlertDescription>
      </Alert>
    )
  }

  if (ai?.status === 'error') {
    return (
      <Alert status="warning" rounded="md" py={2}>
        <AlertIcon />
        <AlertDescription fontSize="sm">
          AI could not grade this yet. A partner can still review your answers manually.
        </AlertDescription>
      </Alert>
    )
  }

  if (ai?.status !== 'completed') return null

  return (
    <Box
      p={4}
      border="1px solid"
      borderColor="gray.200"
      rounded="lg"
      bg="gray.50"
      textAlign="left"
    >
      <HStack justify="space-between" mb={2} flexWrap="wrap" gap={2}>
        <Text fontSize="xs" fontWeight="bold" letterSpacing="0.06em" color="gray.500">
          AI ESTIMATE (EXPLAIN ITSELF)
        </Text>
        <HStack spacing={2}>
          {score != null ? (
            <Badge colorScheme="purple" textTransform="none">
              {score}/100
            </Badge>
          ) : null}
          {ai.pass != null ? (
            <Badge colorScheme={ai.pass ? 'green' : 'orange'} textTransform="none">
              {ai.pass ? 'Pass' : 'Fail'}
            </Badge>
          ) : null}
          {partnerDecided ? (
            <Badge colorScheme="blue" textTransform="none">
              Partner: {row.aiDecision}
            </Badge>
          ) : (
            <Badge colorScheme="orange" textTransform="none">
              Awaiting partner
            </Badge>
          )}
        </HStack>
      </HStack>
      <Text fontSize="sm" color="gray.800" whiteSpace="pre-wrap" lineHeight="1.55">
        {feedback || 'No written explanation returned.'}
      </Text>
      <Text mt={2} fontSize="xs" color="gray.500">
        AI never awards final points alone. If no partner has reviewed yet and you disagree, request
        a human review below.
      </Text>

      {!partnerDecided && !disputed ? (
        <Stack spacing={2} mt={3}>
          <Textarea
            size="sm"
            bg="white"
            placeholder="Optional: why do you disagree with this estimate?"
            value={disputeNote}
            onChange={(e) => setDisputeNote(e.target.value)}
            minH="72px"
          />
          <Button
            size="sm"
            alignSelf="flex-start"
            variant="outline"
            borderColor="gray.300"
            isLoading={disputing}
            onClick={async () => {
              setDisputing(true)
              try {
                await disputeAiGrade({ submissionId: row.id, note: disputeNote })
                setRow({
                  ...row,
                  learnerDisputedAt: new Date(),
                  learnerDisputeNote: disputeNote.trim() || null,
                  status: 'needs_revision',
                })
                toast({
                  title: 'Human review requested',
                  description: 'Your partner will see this as needs revision.',
                  status: 'success',
                  duration: 4000,
                })
              } catch (err) {
                toast({
                  title: 'Could not send dispute',
                  description: err instanceof Error ? err.message : 'Try again.',
                  status: 'error',
                })
              } finally {
                setDisputing(false)
              }
            }}
          >
            I disagree — request human review
          </Button>
        </Stack>
      ) : null}

      {disputed ? (
        <Text mt={3} fontSize="sm" color="orange.700" fontWeight="medium">
          You requested a human review
          {row.learnerDisputeNote ? `: “${row.learnerDisputeNote}”` : '.'}
        </Text>
      ) : null}
    </Box>
  )
}

export default LearnerAiExplainPanel
