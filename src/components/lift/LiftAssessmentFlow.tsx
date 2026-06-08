import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Heading,
  HStack,
  Progress,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ITEMS, SCALE, INTAKE_FIELDS } from '@/config/liftAssessment'
import { computeLiftResult, type ItemScores, type IntakeAnswers, type LiftResult } from '@/utils/liftScoring'

interface LiftAssessmentFlowProps {
  onComplete: (intake: IntakeAnswers, itemScores: ItemScores, result: LiftResult) => void
  submitting?: boolean
}

// Fisher-Yates shuffle (runtime randomization of item order; mapping preserved by id).
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const LiftAssessmentFlow: React.FC<LiftAssessmentFlowProps> = ({ onComplete, submitting }) => {
  const [step, setStep] = useState<'intake' | 'questions'>('intake')
  const [intake, setIntake] = useState<IntakeAnswers>({})
  const [scores, setScores] = useState<ItemScores>({})

  // Randomize once per mount. NOTE (PLACEHOLDER): currently shuffles all 20 together.
  const orderedItems = useMemo(() => shuffle(ITEMS), [])

  const intakeComplete = INTAKE_FIELDS.every((f) => Boolean(intake[f.id]))
  const answeredCount = ITEMS.filter((i) => typeof scores[i.id] === 'number').length
  const questionsComplete = answeredCount === ITEMS.length

  const handleSubmit = () => {
    if (!intakeComplete || !questionsComplete) return
    const result = computeLiftResult(scores, intake)
    onComplete(intake, scores, result)
  }

  if (step === 'intake') {
    return (
      <VStack align="stretch" spacing={6}>
        <Box>
          <Heading size="md" color="brand.deepPlum">
            First, a little about you
          </Heading>
          <Text fontSize="sm" color="gray.500" mt={1}>
            This tailors your results and recommendations.
          </Text>
        </Box>
        {INTAKE_FIELDS.map((field) => (
          <Box key={field.id}>
            <Text fontWeight="medium" mb={2} fontSize="sm">
              {field.label}
            </Text>
            <Select
              placeholder="Select..."
              value={intake[field.id] ?? ''}
              onChange={(e) => setIntake((prev) => ({ ...prev, [field.id]: e.target.value }))}
            >
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Box>
        ))}
        <Button
          alignSelf="flex-end"
          colorScheme="purple"
          isDisabled={!intakeComplete}
          onClick={() => setStep('questions')}
        >
          Start the assessment
        </Button>
      </VStack>
    )
  }

  return (
    <VStack align="stretch" spacing={5}>
      <Box position="sticky" top={0} bg="white" pb={2} zIndex={1}>
        <HStack justify="space-between" mb={1}>
          <Heading size="md" color="brand.deepPlum">
            LIFT Assessment
          </Heading>
          <Text fontSize="sm" color="gray.500">
            {answeredCount} / {ITEMS.length}
          </Text>
        </HStack>
        <Progress value={(answeredCount / ITEMS.length) * 100} size="sm" colorScheme="purple" borderRadius="full" />
      </Box>

      {orderedItems.map((item, idx) => (
        <Box key={item.id} borderWidth="1px" borderRadius="xl" p={4}>
          <Text fontWeight="medium" mb={3}>
            {idx + 1}. {item.text}
          </Text>
          <RadioGroup
            value={scores[item.id] !== undefined ? String(scores[item.id]) : ''}
            onChange={(val) => setScores((prev) => ({ ...prev, [item.id]: Number(val) }))}
          >
            <Stack direction={{ base: 'column', sm: 'row' }} spacing={{ base: 2, sm: 4 }} flexWrap="wrap">
              {SCALE.labels.map((label, value) => (
                <Radio key={value} value={String(value)} colorScheme="purple">
                  <Text fontSize="sm">{label}</Text>
                </Radio>
              ))}
            </Stack>
          </RadioGroup>
        </Box>
      ))}

      <HStack justify="space-between">
        <Button variant="ghost" onClick={() => setStep('intake')}>
          Back
        </Button>
        <Button
          colorScheme="purple"
          isDisabled={!questionsComplete}
          isLoading={submitting}
          loadingText="Scoring..."
          onClick={handleSubmit}
        >
          See my results
        </Button>
      </HStack>
    </VStack>
  )
}
