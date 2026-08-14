import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Progress,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import type {
  CourseAssessmentDefinition,
  CourseAssessmentQuestion,
} from '@/config/nativeCourseAssessments'
import type { CourseAssessmentRaterRole } from '@/config/courseAssessmentRoles'
import {
  submitCourseAssessmentResponse,
  type CourseAssessmentAnswers,
} from '@/services/courseAssessmentService'

export interface CourseAssessmentFormProps {
  definition: CourseAssessmentDefinition
  courseTitle?: string | null
  respondentId: string
  subjectUserId: string
  raterRole?: CourseAssessmentRaterRole
  isSubmitting?: boolean
  submitLabel?: string
  onCompleted: () => Promise<void> | void
}

const isAnswered = (question: CourseAssessmentQuestion, value: number | string | undefined) => {
  if (question.type === 'info') return true
  if (question.type === 'rating') return typeof value === 'number'
  if (typeof value === 'string') return value.trim().length > 0
  return false
}

export function CourseAssessmentForm({
  definition,
  courseTitle,
  respondentId,
  subjectUserId,
  raterRole = 'learner',
  isSubmitting = false,
  submitLabel,
  onCompleted,
}: CourseAssessmentFormProps) {
  const toast = useToast()
  const [answers, setAnswers] = useState<CourseAssessmentAnswers>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const answerable = useMemo(
    () =>
      (definition.questions ?? [])
        .map((q, index) => ({ q, index }))
        .filter(({ q }) => q.type !== 'info'),
    [definition],
  )

  const answeredCount = answerable.filter(({ q, index }) =>
    isAnswered(q, answers[String(index)]),
  ).length
  const progress = answerable.length
    ? Math.round((answeredCount / answerable.length) * 100)
    : 0

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
      const first = Object.keys(nextErrors)[0]
      document.getElementById(`assessment-q-${first}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
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
      console.error('[CourseAssessmentForm] submit failed', err)
      toast({
        status: 'error',
        title: 'Could not save your assessment',
        description: 'Please try again in a moment.',
      })
    } finally {
      setSaving(false)
    }
  }

  const defaultSubmit =
    submitLabel ??
    `Submit ${definition.kind === 'pre' ? 'pre-course' : 'post-course'} assessment`

  return (
    <Stack spacing={6}>
      <Box
        position="sticky"
        top={0}
        zIndex={2}
        bg="rgba(255,255,255,0.92)"
        backdropFilter="blur(8px)"
        borderBottomWidth="1px"
        borderColor="gray.100"
        mx={{ base: -4, md: -6 }}
        px={{ base: 4, md: 6 }}
        py={3}
      >
        <Flex justify="space-between" align="center" mb={2} gap={3}>
          <Text fontSize="sm" fontWeight="semibold" color="gray.700">
            {answeredCount} of {answerable.length} answered
          </Text>
          <Text fontSize="sm" color="gray.500">
            {progress}%
          </Text>
        </Flex>
        <Progress
          value={progress}
          size="sm"
          borderRadius="full"
          bg="gray.100"
          sx={{ '& > div': { background: '#350e6f' } }}
        />
      </Box>

      <Box
        px={4}
        py={3}
        borderRadius="xl"
        bg="#f8f6f3"
        borderWidth="1px"
        borderColor="blackAlpha.100"
      >
        <Text fontSize="sm" color="gray.700" lineHeight="1.65">
          {definition.audience === 'external_rater'
            ? 'Rate this learner on a scale of 1–10 based on how they currently behave.'
            : 'Rate yourself on a scale of 1–10 based on how you currently behave.'}{' '}
          <Text as="span" color="gray.500">
            1 = Rarely or never · 5–6 = Sometimes · 9–10 = Almost always.
          </Text>
        </Text>
      </Box>

      <Stack spacing={5}>
        {definition.questions.map((question, index) => {
          if (question.type === 'info') {
            if (/end message|thank you/i.test(question.text)) return null
            return (
              <Box
                key={`info-${index}`}
                px={5}
                py={4}
                borderRadius="xl"
                bg="white"
                borderWidth="1px"
                borderColor="gray.200"
              >
                <Text fontSize="sm" color="gray.700" lineHeight="1.6">
                  {question.text}
                </Text>
              </Box>
            )
          }

          const questionNumber =
            answerable.findIndex((row) => row.index === index) + 1

          if (question.type === 'rating') {
            const value = answers[String(index)]
            return (
              <Box
                id={`assessment-q-${index}`}
                key={`q-${index}`}
                px={{ base: 4, md: 5 }}
                py={{ base: 4, md: 5 }}
                borderRadius="xl"
                bg="white"
                borderWidth="1px"
                borderColor={errors[String(index)] ? 'red.300' : 'gray.200'}
                boxShadow="0 1px 2px rgba(39,6,46,0.04)"
              >
                <FormControl isInvalid={Boolean(errors[String(index)])} isRequired>
                  <HStack align="flex-start" spacing={3} mb={4}>
                    <Flex
                      w={8}
                      h={8}
                      flexShrink={0}
                      borderRadius="full"
                      bg="#350e6f"
                      color="white"
                      align="center"
                      justify="center"
                      fontSize="sm"
                      fontWeight="bold"
                    >
                      {questionNumber}
                    </Flex>
                    <FormLabel
                      fontSize="md"
                      fontWeight="semibold"
                      color="gray.900"
                      lineHeight="1.45"
                      m={0}
                      pt={1}
                    >
                      {question.text}
                    </FormLabel>
                  </HStack>
                  <Flex justify="space-between" mb={2} px={1}>
                    <Text fontSize="xs" color="gray.500">
                      Rarely
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Almost always
                    </Text>
                  </Flex>
                  <Flex gap={1.5} flexWrap="wrap">
                    {Array.from({ length: question.max - question.min + 1 }, (_, i) => {
                      const n = question.min + i
                      const active = value === n
                      return (
                        <Button
                          key={n}
                          size="md"
                          minW={{ base: '40px', md: '44px' }}
                          h={{ base: '40px', md: '44px' }}
                          variant={active ? 'solid' : 'outline'}
                          bg={active ? '#350e6f' : 'white'}
                          color={active ? 'white' : 'gray.700'}
                          borderColor={active ? '#350e6f' : 'gray.200'}
                          fontWeight={active ? 'bold' : 'medium'}
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
              </Box>
            )
          }

          if (question.type === 'single_choice') {
            const value = answers[String(index)]
            return (
              <Box
                id={`assessment-q-${index}`}
                key={`q-${index}`}
                px={{ base: 4, md: 5 }}
                py={{ base: 4, md: 5 }}
                borderRadius="xl"
                bg="white"
                borderWidth="1px"
                borderColor={errors[String(index)] ? 'red.300' : 'gray.200'}
              >
                <FormControl isInvalid={Boolean(errors[String(index)])} isRequired>
                  <HStack align="flex-start" spacing={3} mb={4}>
                    <Flex
                      w={8}
                      h={8}
                      flexShrink={0}
                      borderRadius="full"
                      bg="#350e6f"
                      color="white"
                      align="center"
                      justify="center"
                      fontSize="sm"
                      fontWeight="bold"
                    >
                      {questionNumber}
                    </Flex>
                    <FormLabel fontSize="md" fontWeight="semibold" color="gray.900" m={0} pt={1}>
                      {question.text}
                    </FormLabel>
                  </HStack>
                  <Stack spacing={2}>
                    {question.choices.map((choice) => {
                      const active = value === choice
                      return (
                        <Button
                          key={choice}
                          justifyContent="flex-start"
                          variant="outline"
                          h="auto"
                          py={3}
                          px={4}
                          whiteSpace="normal"
                          textAlign="left"
                          borderRadius="lg"
                          borderColor={active ? '#350e6f' : 'gray.200'}
                          bg={active ? 'rgba(53,14,111,0.06)' : 'white'}
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
              </Box>
            )
          }

          const value =
            typeof answers[String(index)] === 'string' ? String(answers[String(index)]) : ''
          return (
            <Box
              id={`assessment-q-${index}`}
              key={`q-${index}`}
              px={{ base: 4, md: 5 }}
              py={{ base: 4, md: 5 }}
              borderRadius="xl"
              bg="white"
              borderWidth="1px"
              borderColor={errors[String(index)] ? 'red.300' : 'gray.200'}
            >
              <FormControl isInvalid={Boolean(errors[String(index)])} isRequired>
                <HStack align="flex-start" spacing={3} mb={3}>
                  <Flex
                    w={8}
                    h={8}
                    flexShrink={0}
                    borderRadius="full"
                    bg="#350e6f"
                    color="white"
                    align="center"
                    justify="center"
                    fontSize="sm"
                    fontWeight="bold"
                  >
                    {questionNumber}
                  </Flex>
                  <FormLabel fontSize="md" fontWeight="semibold" color="gray.900" m={0} pt={1}>
                    {question.text}
                  </FormLabel>
                </HStack>
                <Textarea
                  value={value}
                  onChange={(e) => setAnswer(index, e.target.value)}
                  rows={question.type === 'long_text' ? 5 : 3}
                  borderRadius="lg"
                  borderColor="gray.200"
                  bg="gray.50"
                  _focus={{ bg: 'white', borderColor: '#350e6f', boxShadow: '0 0 0 1px #350e6f' }}
                />
                <FormErrorMessage>{errors[String(index)]}</FormErrorMessage>
              </FormControl>
            </Box>
          )
        })}
      </Stack>

      <Box
        position="sticky"
        bottom={0}
        zIndex={2}
        bg="rgba(255,255,255,0.96)"
        backdropFilter="blur(8px)"
        borderTopWidth="1px"
        borderColor="gray.100"
        mx={{ base: -4, md: -6 }}
        px={{ base: 4, md: 6 }}
        py={4}
      >
        <Button
          w="full"
          bg="#350e6f"
          color="white"
          size="lg"
          h="52px"
          borderRadius="xl"
          fontWeight="bold"
          _hover={{ bg: '#27062e' }}
          isLoading={saving || isSubmitting}
          onClick={() => void handleSubmit()}
        >
          {defaultSubmit}
        </Button>
      </Box>
    </Stack>
  )
}

export default CourseAssessmentForm
