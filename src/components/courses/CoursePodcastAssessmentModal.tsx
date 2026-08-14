import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react'
import type { CoursePodcastEpisodeFilled } from '@/types/coursePodcast'

const MIN_ANSWER_CHARS = 30

interface CoursePodcastAssessmentModalProps {
  isOpen: boolean
  episode: CoursePodcastEpisodeFilled | null
  isSubmitting: boolean
  saveSucceeded?: boolean
  onClose: () => void
  onSubmit: (params: {
    answers: string[]
    score: number
    passed: boolean
  }) => Promise<boolean> | boolean | void
}

export function CoursePodcastAssessmentModal({
  isOpen,
  episode,
  isSubmitting,
  saveSucceeded = false,
  onClose,
  onSubmit,
}: CoursePodcastAssessmentModalProps) {
  const questions = episode?.questions ?? []
  const [answers, setAnswers] = useState<string[]>([])
  const [phase, setPhase] = useState<'quiz' | 'result'>('quiz')
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    if (!isOpen || !episode) return
    setAnswers(questions.map(() => ''))
    setPhase('quiz')
    setSaveFailed(false)
  }, [isOpen, episode?.slot, questions.length])

  const allValid = useMemo(
    () => answers.length === questions.length && answers.every((a) => a.trim().length >= MIN_ANSWER_CHARS),
    [answers, questions.length],
  )

  if (!episode) return null

  const handleSubmit = async () => {
    if (!allValid) return
    const score = answers.filter((a) => a.trim().length >= MIN_ANSWER_CHARS).length
    const passed = score === questions.length
    setPhase('result')
    setSaveFailed(false)
    const ok = await onSubmit({ answers: answers.map((a) => a.trim()), score, passed })
    if (ok === false) setSaveFailed(true)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader pr={12}>
          <Text fontSize="sm" color="gray.500" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.08em">
            {episode.slot} · assessment
          </Text>
          <Text mt={1} fontSize="lg" fontWeight="700" color="#27062e">
            {episode.episode_title}
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={4}>
          {phase === 'quiz' ? (
            <Stack spacing={5}>
              <Box
                p={4}
                bg="#f7f3fb"
                border="1px solid"
                borderColor="#e4d9f2"
                borderLeftWidth="3px"
                borderLeftColor="#350e6f"
                rounded="md"
              >
                <Text fontSize="xs" fontWeight="bold" color="#350e6f" letterSpacing="0.08em" textTransform="uppercase">
                  What will be assessed
                </Text>
                <Text mt={2} fontSize="sm" color="gray.700" lineHeight="1.6">
                  {episode.what_will_be_assessed}
                </Text>
              </Box>

              {questions.map((q, index) => (
                <FormControl key={`${episode.slot}-q${index}`} isRequired>
                  <FormLabel fontSize="sm" color="#27062e" fontWeight="600">
                    <Text as="span" color="#350e6f" mr={2} textTransform="capitalize">
                      {q.type}.
                    </Text>
                    {q.question}
                  </FormLabel>
                  <Textarea
                    value={answers[index] ?? ''}
                    onChange={(e) => {
                      const next = [...answers]
                      next[index] = e.target.value
                      setAnswers(next)
                    }}
                    minH="96px"
                    placeholder={`Write your answer (at least ${MIN_ANSWER_CHARS} characters)…`}
                    borderColor="gray.300"
                    _focus={{ borderColor: '#350e6f', boxShadow: '0 0 0 1px #350e6f' }}
                  />
                  <Text mt={1} fontSize="xs" color="gray.500">
                    {(answers[index] ?? '').trim().length}/{MIN_ANSWER_CHARS} minimum
                  </Text>
                </FormControl>
              ))}
            </Stack>
          ) : (
            <Stack spacing={3}>
              {saveFailed ? (
                <Text color="red.600" fontSize="sm">
                  Could not save your answers. Close and try again.
                </Text>
              ) : saveSucceeded ? (
                <Text color="green.700" fontSize="sm" fontWeight="600">
                  Answers saved. This episode counts toward your podcast activity.
                </Text>
              ) : (
                <Text color="gray.600" fontSize="sm">
                  Saving…
                </Text>
              )}
            </Stack>
          )}
        </ModalBody>
        <ModalFooter gap={2}>
          {phase === 'quiz' ? (
            <>
              <Button variant="ghost" onClick={onClose} isDisabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                bg="#f4540c"
                color="white"
                _hover={{ bg: '#d8430a' }}
                onClick={() => void handleSubmit()}
                isDisabled={!allValid}
                isLoading={isSubmitting}
              >
                Submit answers
              </Button>
            </>
          ) : (
            <Button
              bg="#350e6f"
              color="white"
              _hover={{ bg: '#27062e' }}
              onClick={onClose}
              isDisabled={isSubmitting}
            >
              Done
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
