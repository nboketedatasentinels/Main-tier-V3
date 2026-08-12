import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { ClipboardList } from 'lucide-react'
import type {
  CourseAssessmentDefinition,
  CourseAssessmentQuestion,
} from '@/config/nativeCourseAssessments'
import type { CourseAssessmentRaterRole } from '@/config/courseAssessmentRoles'
import {
  submitCourseAssessmentResponse,
  type CourseAssessmentAnswers,
} from '@/services/courseAssessmentService'

interface NativeCourseAssessmentModalProps {
  isOpen: boolean
  definition: CourseAssessmentDefinition | null
  courseTitle?: string | null
  respondentId: string
  subjectUserId: string
  /** Defaults to learner (self). External raters pass mentor/coach/partner/line_manager. */
  raterRole?: CourseAssessmentRaterRole
  isSubmitting?: boolean
  onClose: () => void
  onCompleted: () => Promise<void> | void
}

const isAnswered = (question: CourseAssessmentQuestion, value: number | string | undefined) => {
  if (question.type === 'info') return true
  if (question.type === 'rating') return typeof value === 'number'
  if (typeof value === 'string') return value.trim().length > 0
  return false
}

export function NativeCourseAssessmentModal({
  isOpen,
  definition,
  courseTitle,
  respondentId,
  subjectUserId,
  raterRole = 'learner',
  isSubmitting = false,
  onClose,
  onCompleted,
}: NativeCourseAssessmentModalProps) {
  const toast = useToast()
  const [answers, setAnswers] = useState<CourseAssessmentAnswers>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setAnswers({})
      setErrors({})
    }
  }, [isOpen, definition?.surveyMonkeyId])

  const answerable = useMemo(
    () => (definition?.questions ?? []).map((q, index) => ({ q, index })).filter(({ q }) => q.type !== 'info'),
    [definition],
  )

  if (!definition) return null

  const setAnswer = (index: number, value: number | string) => {
    setAnswers((prev) => ({ ...prev, [String(index)]: value }))
    setErrors((prev) => {
      if (!prev[String(index)]) return prev
      const next = { ...prev }
      delete next[String(index)]
      return next
    })
  }

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {}
    for (const { q, index } of answerable) {
      if (!isAnswered(q, answers[String(index)])) {
        nextErrors[String(index)] = 'Required'
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast({
        status: 'warning',
        title: 'Please complete all questions',
        duration: 2500,
      })
      return
    }

    setSaving(true)
    try {
      await submitCourseAssessmentResponse({
        respondentId,
        subjectUserId,
        definition,
        raterRole,
        courseTitle,
        answers,
      })
      await onCompleted()
    } catch (err) {
      console.error('[NativeCourseAssessmentModal] submit failed', err)
      toast({
        status: 'error',
        title: 'Could not save your assessment',
        description: 'Please try again in a moment.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      isCentered
      scrollBehavior="inside"
      closeOnOverlayClick={false}
    >
      <ModalOverlay bg="blackAlpha.600" />
      <ModalContent borderRadius="xl" overflow="hidden" maxH="90vh">
        <Box bg="#27062e" color="white" px={6} pt={6} pb={5} position="relative">
          <ModalCloseButton color="white" top={3} right={3} />
          <HStack spacing={3} align="center">
            <Flex
              w={11}
              h={11}
              bg="rgba(255,255,255,0.12)"
              borderRadius="lg"
              align="center"
              justify="center"
              flexShrink={0}
            >
              <Icon as={ClipboardList} boxSize={5} color="white" />
            </Flex>
            <Stack spacing={0}>
              <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.1em" opacity={0.7}>
                {definition.kind === 'pre' ? 'Pre-course' : 'Post-course'} assessment
                {raterRole !== 'learner' ? ` · ${raterRole.replace('_', ' ')}` : ''}
              </Text>
              <Heading size="md" lineHeight="1.2">
                {courseTitle || definition.courseKey}
              </Heading>
            </Stack>
          </HStack>
        </Box>

        <ModalBody p={6} bg="white">
          <Stack spacing={5}>
            <Text color="gray.600" fontSize="sm" lineHeight="1.6">
              {definition.audience === 'external_rater'
                ? 'Rate this learner on a scale of 1–10 based on how they currently behave. 1 = Rarely or never · 5–6 = Sometimes · 9–10 = Almost always.'
                : 'Rate yourself on a scale of 1–10 based on how you currently behave. 1 = Rarely or never · 5–6 = Sometimes · 9–10 = Almost always.'}
            </Text>

            {definition.questions.map((question, index) => {
              if (question.type === 'info') {
                if (/end message|thank you/i.test(question.text)) return null
                return (
                  <Box
                    key={`info-${index}`}
                    px={4}
                    py={3}
                    borderRadius="lg"
                    bg="gray.50"
                    borderWidth="1px"
                    borderColor="gray.200"
                  >
                    <Text fontSize="sm" color="gray.700" lineHeight="1.5">
                      {question.text}
                    </Text>
                  </Box>
                )
              }

              if (question.type === 'rating') {
                const value = answers[String(index)]
                return (
                  <FormControl key={`q-${index}`} isInvalid={Boolean(errors[String(index)])} isRequired>
                    <FormLabel fontSize="sm" fontWeight="semibold" color="gray.900" mb={3}>
                      {question.text}
                    </FormLabel>
                    <Flex gap={1.5} flexWrap="wrap">
                      {Array.from({ length: question.max - question.min + 1 }, (_, i) => {
                        const n = question.min + i
                        const active = value === n
                        return (
                          <Button
                            key={n}
                            size="sm"
                            minW="36px"
                            variant={active ? 'solid' : 'outline'}
                            bg={active ? '#350e6f' : 'white'}
                            color={active ? 'white' : 'gray.700'}
                            borderColor={active ? '#350e6f' : 'gray.200'}
                            _hover={{ bg: active ? '#27062e' : 'gray.50' }}
                            onClick={() => setAnswer(index, n)}
                          >
                            {n}
                          </Button>
                        )
                      })}
                    </Flex>
                    <FormErrorMessage>{errors[String(index)]}</FormErrorMessage>
                  </FormControl>
                )
              }

              if (question.type === 'single_choice') {
                const value = answers[String(index)]
                return (
                  <FormControl key={`q-${index}`} isInvalid={Boolean(errors[String(index)])} isRequired>
                    <FormLabel fontSize="sm" fontWeight="semibold" color="gray.900" mb={3}>
                      {question.text}
                    </FormLabel>
                    <Stack spacing={2}>
                      {question.choices.map((choice) => {
                        const active = value === choice
                        return (
                          <Button
                            key={choice}
                            justifyContent="flex-start"
                            variant="outline"
                            borderColor={active ? '#350e6f' : 'gray.200'}
                            bg={active ? 'purple.50' : 'white'}
                            color="gray.800"
                            fontWeight={active ? 'semibold' : 'medium'}
                            onClick={() => setAnswer(index, choice)}
                          >
                            {choice}
                          </Button>
                        )
                      })}
                    </Stack>
                    <FormErrorMessage>{errors[String(index)]}</FormErrorMessage>
                  </FormControl>
                )
              }

              const value = typeof answers[String(index)] === 'string' ? String(answers[String(index)]) : ''
              return (
                <FormControl key={`q-${index}`} isInvalid={Boolean(errors[String(index)])} isRequired>
                  <FormLabel fontSize="sm" fontWeight="semibold" color="gray.900" mb={2}>
                    {question.text}
                  </FormLabel>
                  <Textarea
                    value={value}
                    onChange={(e) => setAnswer(index, e.target.value)}
                    rows={question.type === 'long_text' ? 4 : 2}
                    borderRadius="lg"
                    borderColor="gray.200"
                  />
                  <FormErrorMessage>{errors[String(index)]}</FormErrorMessage>
                </FormControl>
              )
            })}

            <Button
              bg="#350e6f"
              color="white"
              size="lg"
              borderRadius="lg"
              _hover={{ bg: '#27062e' }}
              isLoading={saving || isSubmitting}
              onClick={() => void handleSubmit()}
            >
              Submit {definition.kind === 'pre' ? 'pre-course' : 'post-course'} assessment
            </Button>
          </Stack>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default NativeCourseAssessmentModal
