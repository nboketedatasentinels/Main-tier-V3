import { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Select,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { ClipboardList } from 'lucide-react'
import { NativeCourseAssessmentModal } from '@/components/modals/NativeCourseAssessmentModal'
import {
  canRoleSubmitKind,
  COURSE_ASSESSMENT_ROLE_MATRIX,
  isPartnerPostWindowSuggested,
  type CourseAssessmentRaterRole,
} from '@/config/courseAssessmentRoles'
import {
  findNativeCourseAssessment,
  listNativeCourseAssessments,
  type CourseAssessmentKind,
} from '@/config/nativeCourseAssessments'
import { hasCompletedSelfCourseAssessment, getCourseAssessmentResponse } from '@/services/courseAssessmentService'

export interface RateLearnerOption {
  id: string
  name: string
  /** Used for partner soft Post window hint */
  currentWeek?: number | null
  journeyType?: string | null
  journeyStatus?: string | null
}

interface RateLearnerCourseAssessmentProps {
  respondentId: string
  raterRole: Exclude<CourseAssessmentRaterRole, 'learner'>
  learners: RateLearnerOption[]
  /** Optional fixed course title (skips course picker) */
  courseTitle?: string | null
  /** When set, only allow this kind */
  forcedKind?: CourseAssessmentKind
  onSubmitted?: () => void
}

/**
 * Shared entry point for line manager / mentor / coach / partner to rate a
 * learner on a course (Pre/Post per role matrix).
 */
export function RateLearnerCourseAssessment({
  respondentId,
  raterRole,
  learners,
  courseTitle,
  forcedKind,
  onSubmitted,
}: RateLearnerCourseAssessmentProps) {
  const toast = useToast()
  const matrix = COURSE_ASSESSMENT_ROLE_MATRIX[raterRole]
  const allowedKinds = (['pre', 'post'] as CourseAssessmentKind[]).filter(
    (k) => canRoleSubmitKind(raterRole, k) && (!forcedKind || forcedKind === k),
  )

  const [subjectId, setSubjectId] = useState(learners[0]?.id ?? '')
  const [kind, setKind] = useState<CourseAssessmentKind>(allowedKinds[0] ?? 'post')
  const [selectedCourseKey, setSelectedCourseKey] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [checking, setChecking] = useState(false)

  const courseOptions = useMemo(() => {
    const rows = listNativeCourseAssessments(kind, 'external_rater')
    const seen = new Set<string>()
    return rows.filter((r) => {
      if (seen.has(r.courseKey)) return false
      seen.add(r.courseKey)
      return true
    })
  }, [kind])

  const selectedLearner = learners.find((l) => l.id === subjectId) ?? null

  const definition = useMemo(() => {
    if (courseTitle) {
      return findNativeCourseAssessment(courseTitle, kind, 'external_rater')
    }
    return (
      courseOptions.find((c) => c.courseKey === selectedCourseKey) ??
      courseOptions[0] ??
      null
    )
  }, [courseTitle, kind, selectedCourseKey, courseOptions])

  const partnerHint =
    raterRole === 'partner' &&
    selectedLearner &&
    !isPartnerPostWindowSuggested({
      journeyStatus: selectedLearner.journeyStatus,
      currentWeek: selectedLearner.currentWeek,
      totalWeeks: null,
    })

  const start = async () => {
    if (!subjectId || !definition) {
      toast({ status: 'warning', title: 'Select a learner and course', duration: 2500 })
      return
    }
    if (!canRoleSubmitKind(raterRole, kind)) {
      toast({
        status: 'error',
        title: `${matrix.label} cannot submit ${kind}-course assessments`,
      })
      return
    }

    setChecking(true)
    try {
      const existing = await getCourseAssessmentResponse({
        respondentId,
        subjectUserId: subjectId,
        courseKey: definition.courseKey,
        kind,
        audience: 'external_rater',
      })
      if (existing) {
        toast({
          status: 'info',
          title: 'Already submitted',
          description: 'You can update by submitting again — your previous answers will be replaced.',
          duration: 3500,
        })
      }
      setModalOpen(true)
    } catch (err) {
      console.error('[RateLearnerCourseAssessment]', err)
      toast({ status: 'error', title: 'Could not check existing response' })
    } finally {
      setChecking(false)
    }
  }

  if (!allowedKinds.length) {
    return (
      <Text fontSize="sm" color="gray.500">
        {matrix.label} assessments are not available for this role.
      </Text>
    )
  }

  return (
    <Box borderWidth="1px" borderColor="gray.200" borderRadius="xl" bg="white" p={{ base: 4, md: 5 }}>
      <HStack spacing={3} mb={4}>
        <Flex
          w={10}
          h={10}
          borderRadius="lg"
          bg="gray.50"
          borderWidth="1px"
          borderColor="gray.200"
          align="center"
          justify="center"
        >
          <Icon as={ClipboardList} boxSize={5} color="gray.700" />
        </Flex>
        <Box>
          <Heading size="sm" color="gray.900">
            Rate a learner
          </Heading>
          <Text fontSize="sm" color="gray.600">
            {matrix.label}: {matrix.pre ? 'Pre + Post' : 'Post only'} · per learner × course
          </Text>
        </Box>
      </HStack>

      <Stack spacing={4}>
        <FormControl>
          <FormLabel fontSize="sm">Learner</FormLabel>
          <Select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            borderRadius="lg"
            bg="white"
          >
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </FormControl>

        {allowedKinds.length > 1 && (
          <FormControl>
            <FormLabel fontSize="sm">Assessment</FormLabel>
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value as CourseAssessmentKind)}
              borderRadius="lg"
            >
              {allowedKinds.map((k) => (
                <option key={k} value={k}>
                  {k === 'pre' ? 'Pre-course' : 'Post-course'}
                </option>
              ))}
            </Select>
          </FormControl>
        )}

        {!courseTitle && (
          <FormControl>
            <FormLabel fontSize="sm">Course</FormLabel>
            <Select
              value={selectedCourseKey || definition?.courseKey || ''}
              onChange={(e) => setSelectedCourseKey(e.target.value)}
              borderRadius="lg"
            >
              {courseOptions.map((c) => (
                <option key={c.surveyMonkeyId} value={c.courseKey}>
                  {c.title}
                </option>
              ))}
            </Select>
          </FormControl>
        )}

        {partnerHint && kind === 'post' && (
          <Badge colorScheme="orange" borderRadius="md" px={2} py={1} textTransform="none" w="fit-content">
            Suggested near end of journey — you can still submit now
          </Badge>
        )}

        <Button
          bg="#350e6f"
          color="white"
          borderRadius="lg"
          _hover={{ bg: '#27062e' }}
          isLoading={checking}
          onClick={() => void start()}
          isDisabled={!learners.length || !definition}
        >
          Start {kind === 'pre' ? 'pre' : 'post'}-course assessment
        </Button>
      </Stack>

      <NativeCourseAssessmentModal
        isOpen={modalOpen}
        definition={definition}
        courseTitle={courseTitle || definition?.courseKey}
        respondentId={respondentId}
        subjectUserId={subjectId}
        raterRole={raterRole}
        onClose={() => setModalOpen(false)}
        onCompleted={() => {
          setModalOpen(false)
          toast({ status: 'success', title: 'Assessment saved', duration: 2500 })
          onSubmitted?.()
        }}
      />
    </Box>
  )
}

/** Convenience: check whether the signed-in learner still needs self Post. */
export async function learnerNeedsPost(userId: string, courseTitle: string): Promise<boolean> {
  const def = findNativeCourseAssessment(courseTitle, 'post', 'self')
  if (!def) return false
  const done = await hasCompletedSelfCourseAssessment({
    userId,
    courseKey: def.courseKey,
    kind: 'post',
  })
  return !done
}

export default RateLearnerCourseAssessment
