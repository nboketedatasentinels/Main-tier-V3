import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Progress,
  Stack,
  Text,
} from '@chakra-ui/react'
import { CheckCircle2, XCircle } from 'lucide-react'
import type { Podcast } from '@/config/podcasts'

interface PodcastAssessmentModalProps {
  isOpen: boolean
  podcast: Podcast | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (params: { score: number; passed: boolean }) => Promise<void> | void
}

export function PodcastAssessmentModal({
  isOpen,
  podcast,
  isSubmitting,
  onClose,
  onSubmit,
}: PodcastAssessmentModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [phase, setPhase] = useState<'quiz' | 'result'>('quiz')
  const [score, setScore] = useState(0)

  // Reset state every time the modal opens for a new podcast
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0)
      setAnswers({})
      setPhase('quiz')
      setScore(0)
    }
  }, [isOpen, podcast?.id])

  if (!podcast) return null

  const questions = podcast.assessment.questions
  const passingScore = podcast.assessment.passingScore
  const totalQuestions = questions.length
  const currentQuestion = questions[currentIndex]
  const selectedOption = currentQuestion ? answers[currentQuestion.id] : undefined
  const allAnswered =
    Object.keys(answers).length === totalQuestions
  const isLast = currentIndex === totalQuestions - 1

  const handleSelect = (optionIndex: number) => {
    if (!currentQuestion) return
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionIndex }))
  }

  const handleNext = () => {
    if (isLast) return
    setCurrentIndex((i) => Math.min(i + 1, totalQuestions - 1))
  }

  const handleBack = () => {
    setCurrentIndex((i) => Math.max(i - 1, 0))
  }

  const handleSubmit = async () => {
    let correct = 0
    questions.forEach((q) => {
      if (answers[q.id] === q.correctIndex) correct += 1
    })
    const passed = correct >= passingScore
    setScore(correct)
    setPhase('result')
    await onSubmit({ score: correct, passed })
  }

  const handleRetry = () => {
    setCurrentIndex(0)
    setAnswers({})
    setPhase('quiz')
    setScore(0)
  }

  const passed = score >= passingScore
  const progressPct = ((currentIndex + 1) / totalQuestions) * 100

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" closeOnOverlayClick={false} isCentered>
      <ModalOverlay bg="blackAlpha.600" />
      <ModalContent borderRadius="xl" overflow="hidden">
        <ModalHeader bg="#27062e" color="white" pr={12}>
          <Stack spacing={1}>
            <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.1em" opacity={0.7}>
              {podcast.episodeCode} · Quick check
            </Text>
            <Text fontSize="md" fontWeight="semibold" noOfLines={2}>
              {podcast.title}
            </Text>
          </Stack>
        </ModalHeader>
        <ModalCloseButton color="white" />

        <ModalBody p={6} bg="white">
          {phase === 'quiz' && currentQuestion && (
            <Stack spacing={5}>
              <Stack spacing={2}>
                <Flex justify="space-between" align="center">
                  <Text fontSize="sm" color="gray.500" fontWeight="medium">
                    Question {currentIndex + 1} of {totalQuestions}
                  </Text>
                  <Text fontSize="xs" color="gray.400">
                    Pass with {passingScore} out of {totalQuestions} correct
                  </Text>
                </Flex>
                <Progress
                  value={progressPct}
                  size="xs"
                  rounded="full"
                  colorScheme="purple"
                  bg="gray.100"
                />
              </Stack>

              <Heading size="md" color="gray.900" lineHeight="1.4">
                {currentQuestion.prompt}
              </Heading>

              <Stack spacing={2}>
                {currentQuestion.options.map((option, idx) => {
                  const isSelected = selectedOption === idx
                  return (
                    <Button
                      key={idx}
                      onClick={() => handleSelect(idx)}
                      variant="outline"
                      justifyContent="flex-start"
                      whiteSpace="normal"
                      height="auto"
                      py={3}
                      px={4}
                      textAlign="left"
                      fontWeight="medium"
                      borderWidth="2px"
                      borderColor={isSelected ? '#350e6f' : 'gray.200'}
                      bg={isSelected ? 'purple.50' : 'white'}
                      color={isSelected ? '#27062e' : 'gray.800'}
                      _hover={{
                        bg: isSelected ? 'purple.50' : 'gray.50',
                        borderColor: isSelected ? '#350e6f' : 'gray.300',
                      }}
                    >
                      <HStack spacing={3} align="flex-start" w="100%">
                        <Flex
                          w={6}
                          h={6}
                          borderRadius="full"
                          border="2px solid"
                          borderColor={isSelected ? '#350e6f' : 'gray.300'}
                          bg={isSelected ? '#350e6f' : 'white'}
                          color="white"
                          align="center"
                          justify="center"
                          fontSize="xs"
                          fontWeight="bold"
                          flexShrink={0}
                          mt={0.5}
                        >
                          {isSelected ? '✓' : String.fromCharCode(65 + idx)}
                        </Flex>
                        <Text flex={1} whiteSpace="normal">
                          {option}
                        </Text>
                      </HStack>
                    </Button>
                  )
                })}
              </Stack>

              <Flex justify="space-between" pt={2}>
                <Button variant="ghost" onClick={handleBack} isDisabled={currentIndex === 0}>
                  Back
                </Button>
                {isLast ? (
                  <Button
                    bg="#350e6f"
                    color="white"
                    _hover={{ bg: '#27062e' }}
                    isDisabled={!allAnswered}
                    isLoading={isSubmitting}
                    onClick={handleSubmit}
                  >
                    Submit answers
                  </Button>
                ) : (
                  <Button
                    bg="#350e6f"
                    color="white"
                    _hover={{ bg: '#27062e' }}
                    isDisabled={selectedOption === undefined}
                    onClick={handleNext}
                  >
                    Next
                  </Button>
                )}
              </Flex>
            </Stack>
          )}

          {phase === 'result' && (
            <Stack spacing={5} align="center" textAlign="center" py={4}>
              <Flex
                w={16}
                h={16}
                borderRadius="full"
                bg={passed ? 'yellow.500' : 'red.500'}
                color="white"
                align="center"
                justify="center"
                boxShadow={
                  passed
                    ? '0 4px 16px rgba(180, 83, 9, 0.4)'
                    : '0 4px 16px rgba(220, 38, 38, 0.4)'
                }
              >
                <Icon as={passed ? CheckCircle2 : XCircle} boxSize={9} />
              </Flex>
              <Stack spacing={1}>
                <Heading size="lg" color="gray.900">
                  {passed ? 'Nice work!' : 'Not quite'}
                </Heading>
                <Text fontSize="md" color="gray.600">
                  You got <Text as="span" fontWeight="bold" color="gray.900">{score}</Text> of{' '}
                  <Text as="span" fontWeight="bold" color="gray.900">{totalQuestions}</Text> correct.
                </Text>
              </Stack>
              <Box
                p={3}
                bg={passed ? 'yellow.50' : 'gray.50'}
                border="1px solid"
                borderColor={passed ? 'yellow.200' : 'gray.200'}
                rounded="md"
                fontSize="sm"
                color={passed ? '#b45309' : 'gray.600'}
                fontWeight="medium"
              >
                {passed
                  ? 'Your points have been added to your total.'
                  : `You need ${passingScore} correct to pass. Take a minute, watch the podcast again, and try once more when you're ready.`}
              </Box>
              {passed ? (
                <Button
                  bg="#350e6f"
                  color="white"
                  _hover={{ bg: '#27062e' }}
                  size="lg"
                  onClick={onClose}
                  w="full"
                >
                  Done
                </Button>
              ) : (
                <HStack w="full" spacing={3}>
                  <Button variant="outline" onClick={onClose} flex={1}>
                    Close
                  </Button>
                  <Button
                    bg="#350e6f"
                    color="white"
                    _hover={{ bg: '#27062e' }}
                    onClick={handleRetry}
                    flex={1}
                  >
                    Try again
                  </Button>
                </HStack>
              )}
            </Stack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default PodcastAssessmentModal
