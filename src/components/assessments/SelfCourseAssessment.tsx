import { useMemo, useState } from 'react'
import {
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
  findNativeCourseAssessment,
  listNativeCourseAssessments,
  type CourseAssessmentKind,
} from '@/config/nativeCourseAssessments'
import { hasCompletedSelfCourseAssessment } from '@/services/courseAssessmentService'

interface SelfCourseAssessmentProps {
  userId: string
  /** When set, course picker is limited to these catalogue titles (org programme). */
  allowedCourseTitles?: string[] | null
  /** When set, only allow this kind */
  forcedKind?: CourseAssessmentKind
  onSubmitted?: () => void
}

/**
 * Learner entry point to submit self Pre/Post for programme courses.
 */
export function SelfCourseAssessment({
  userId,
  allowedCourseTitles,
  forcedKind,
  onSubmitted,
}: SelfCourseAssessmentProps) {
  const toast = useToast()
  const allowedKinds = (['pre', 'post'] as CourseAssessmentKind[]).filter(
    (k) => !forcedKind || forcedKind === k,
  )

  const [kind, setKind] = useState<CourseAssessmentKind>(allowedKinds[0] ?? 'pre')
  const [selectedCourseKey, setSelectedCourseKey] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [checking, setChecking] = useState(false)

  const courseOptions = useMemo(() => {
    const titles = (allowedCourseTitles ?? []).map((t) => t.trim()).filter(Boolean)
    if (titles.length > 0 || allowedCourseTitles != null) {
      const seen = new Set<string>()
      const matched = titles
        .map((title) => findNativeCourseAssessment(title, kind, 'self'))
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
      return matched.filter((row) => {
        if (seen.has(row.courseKey)) return false
        seen.add(row.courseKey)
        return true
      })
    }

    const rows = listNativeCourseAssessments(kind, 'self')
    const seen = new Set<string>()
    return rows.filter((r) => {
      if (seen.has(r.courseKey)) return false
      seen.add(r.courseKey)
      return true
    })
  }, [kind, allowedCourseTitles])

  const definition = useMemo(
    () =>
      courseOptions.find((c) => c.courseKey === selectedCourseKey) ?? courseOptions[0] ?? null,
    [courseOptions, selectedCourseKey],
  )

  const kindLabel = forcedKind === 'pre' ? 'Pre-course' : forcedKind === 'post' ? 'Post-course' : null
  const isOrgScoped = allowedCourseTitles != null
  const scopedToOrgCourses = isOrgScoped && allowedCourseTitles.length > 0

  const start = async () => {
    if (!definition) {
      toast({ status: 'warning', title: 'Select a course', duration: 2500 })
      return
    }

    setChecking(true)
    try {
      const existing = await hasCompletedSelfCourseAssessment({
        userId,
        courseKey: definition.courseKey,
        kind,
      })
      if (existing) {
        toast({
          status: 'info',
          title: 'Already submitted',
          description: 'You can update by submitting again. Your previous answers will be replaced.',
          duration: 3500,
        })
      }
      setModalOpen(true)
    } catch (err) {
      console.error('[SelfCourseAssessment]', err)
      toast({ status: 'error', title: 'Could not check existing response' })
    } finally {
      setChecking(false)
    }
  }

  if (isOrgScoped && courseOptions.length === 0) {
    return (
      <Text fontSize="sm" color="gray.500">
        {allowedCourseTitles.length === 0
          ? 'Your organisation has no programme courses assigned yet.'
          : `No native ${kind === 'pre' ? 'pre' : 'post'}-course assessments match your organisation's assigned courses yet.`}
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
            {kindLabel ? `Your ${kindLabel.toLowerCase()} assessment` : 'Your course assessments'}
          </Heading>
          <Text fontSize="sm" color="gray.600">
            Learner self
            {kindLabel ? ` · ${kindLabel}` : ' · Pre + Post'}
            {scopedToOrgCourses ? ' · org programme courses' : ' · per course'}
          </Text>
        </Box>
      </HStack>

      <Stack spacing={4}>
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

        <FormControl>
          <FormLabel fontSize="sm">Course</FormLabel>
          <Select
            value={selectedCourseKey || definition?.courseKey || ''}
            onChange={(e) => setSelectedCourseKey(e.target.value)}
            borderRadius="lg"
            bg="white"
          >
            {courseOptions.map((c) => (
              <option key={c.surveyMonkeyId} value={c.courseKey}>
                {c.title}
              </option>
            ))}
          </Select>
        </FormControl>

        <Button
          bg="#350e6f"
          color="white"
          borderRadius="lg"
          _hover={{ bg: '#27062e' }}
          isLoading={checking}
          onClick={() => void start()}
          isDisabled={!definition}
        >
          Start {kind === 'pre' ? 'pre' : 'post'}-course assessment
        </Button>
      </Stack>

      <NativeCourseAssessmentModal
        isOpen={modalOpen}
        definition={definition}
        courseTitle={definition?.courseKey}
        respondentId={userId}
        subjectUserId={userId}
        raterRole="learner"
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

export default SelfCourseAssessment
