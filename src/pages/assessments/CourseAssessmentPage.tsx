import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Select,
  Spinner,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CourseAssessmentForm } from '@/components/assessments/CourseAssessmentForm'
import {
  findNativeCourseAssessment,
  listNativeCourseAssessments,
  type CourseAssessmentDefinition,
  type CourseAssessmentKind,
} from '@/config/nativeCourseAssessments'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizationProgramCourses } from '@/hooks/useOrganizationProgramCourses'
import { useOrgProgrammeCourseTitles } from '@/hooks/useOrgProgrammeCourseTitles'
import { hasCompletedSelfCourseAssessment } from '@/services/courseAssessmentService'

const parseKind = (raw: string | null): CourseAssessmentKind =>
  raw === 'post' ? 'post' : 'pre'

/**
 * Full-page learner Pre/Post course assessment (replaces the modal flow).
 *
 * Query params:
 * - kind=pre|post
 * - course= catalogue title or courseKey
 * - unlockUrl= optional URL to open after Pre submit (course access)
 * - returnTo= optional path to return to after submit
 */
export default function CourseAssessmentPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const kind = parseKind(params.get('kind'))
  const courseParam = params.get('course')?.trim() || ''
  const unlockUrl = params.get('unlockUrl')?.trim() || ''
  const returnTo = params.get('returnTo')?.trim() || '/app/weekly-glance'

  const orgId = (profile?.organizationId || profile?.companyId || null) as string | null
  const { program: orgProgram } = useOrganizationProgramCourses(orgId)
  const orgCourseTitles = useOrgProgrammeCourseTitles(orgProgram)

  const [selectedCourseKey, setSelectedCourseKey] = useState('')
  const [liveDefinition, setLiveDefinition] = useState<CourseAssessmentDefinition | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const courseOptions = useMemo(() => {
    const titles = (orgCourseTitles ?? []).map((t) => t.trim()).filter(Boolean)
    if (titles.length > 0) {
      const seen = new Set<string>()
      return titles
        .map((title) => findNativeCourseAssessment(title, kind, 'self'))
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .filter((row) => {
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
  }, [kind, orgCourseTitles])

  const resolvedFromParam = useMemo(() => {
    if (!courseParam) return null
    return (
      findNativeCourseAssessment(courseParam, kind, 'self') ||
      courseOptions.find(
        (c) =>
          c.courseKey === courseParam ||
          c.title.toLowerCase() === courseParam.toLowerCase(),
      ) ||
      null
    )
  }, [courseParam, kind, courseOptions])

  const activeCatalog =
    resolvedFromParam ||
    courseOptions.find((c) => c.courseKey === selectedCourseKey) ||
    courseOptions[0] ||
    null

  useEffect(() => {
    if (resolvedFromParam?.courseKey) {
      setSelectedCourseKey(resolvedFromParam.courseKey)
    } else if (!selectedCourseKey && courseOptions[0]) {
      setSelectedCourseKey(courseOptions[0].courseKey)
    }
  }, [resolvedFromParam?.courseKey, courseOptions, selectedCourseKey])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!profile?.id) {
        setLoading(false)
        return
      }
      if (!activeCatalog) {
        setLiveDefinition(null)
        setLoadError(
          orgCourseTitles.length === 0
            ? 'Your organisation has no programme courses assigned yet.'
            : `No ${kind === 'pre' ? 'pre' : 'post'}-course assessment is available for your courses yet.`,
        )
        setLoading(false)
        return
      }

      setLoading(true)
      setLoadError(null)
      try {
        const existing = await hasCompletedSelfCourseAssessment({
          userId: profile.id,
          courseKey: activeCatalog.courseKey,
          kind,
        })
        if (existing && !cancelled) {
          toast({
            status: 'info',
            title: 'Already submitted',
            description: 'Submitting again will replace your previous answers.',
            duration: 3500,
          })
        }
        if (!cancelled) {
          setLiveDefinition(activeCatalog)
        }
      } catch (err) {
        console.error('[CourseAssessmentPage] load failed', err)
        if (!cancelled) {
          setLoadError('Could not load assessment questions. Please try again.')
          setLiveDefinition(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast is stable enough; avoid re-fetch loops
  }, [profile?.id, activeCatalog?.surveyMonkeyId, kind])

  const handleCompleted = async () => {
    toast({ status: 'success', title: 'Assessment saved', duration: 2500 })
    if (unlockUrl) {
      window.open(unlockUrl, '_blank', 'noopener,noreferrer')
    }
    navigate(returnTo.startsWith('/') ? returnTo : '/app/weekly-glance', { replace: true })
  }

  const kindLabel = kind === 'pre' ? 'Pre-course' : 'Post-course'
  const showCoursePicker = !courseParam && courseOptions.length > 1

  return (
    <Box minH="100%" bg="linear-gradient(180deg, #f4f1f6 0%, #faf9f7 42%, #ffffff 100%)">
      <Box
        bg="#27062e"
        color="white"
        position="relative"
        overflow="hidden"
        borderBottomWidth="1px"
        borderColor="blackAlpha.200"
      >
        <Box
          position="absolute"
          inset={0}
          opacity={0.35}
          backgroundImage="radial-gradient(circle at 12% 20%, rgba(234,177,48,0.35), transparent 42%), radial-gradient(circle at 88% 0%, rgba(244,84,12,0.22), transparent 38%)"
          pointerEvents="none"
        />
        <Container maxW="3xl" py={{ base: 6, md: 8 }} position="relative">
          <Button
            variant="ghost"
            size="sm"
            color="white"
            leftIcon={<ArrowLeft size={16} color="currentColor" />}
            mb={4}
            _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
            onClick={() => navigate(returnTo.startsWith('/') ? returnTo : '/app/weekly-glance')}
          >
            Back
          </Button>
          <HStack spacing={4} align="flex-start">
            <Flex
              w={12}
              h={12}
              borderRadius="xl"
              bg="whiteAlpha.150"
              align="center"
              justify="center"
              flexShrink={0}
              color="white"
            >
              <Icon as={ClipboardList} boxSize={6} color="white" />
            </Flex>
            <Box color="white">
              <Text
                fontSize="xs"
                fontWeight="semibold"
                letterSpacing="0.14em"
                textTransform="uppercase"
                color="text.accentGold"
                mb={1}
              >
                {kindLabel} assessment
              </Text>
              <Heading
                as="h1"
                size={{ base: 'md', md: 'lg' }}
                letterSpacing="-0.02em"
                lineHeight="1.2"
                // Global theme forces h1 - h6 to text.primary (dark); beat it for this plum header.
                sx={{ color: '#ffffff !important' }}
              >
                {liveDefinition?.title ||
                  activeCatalog?.title ||
                  (kind === 'pre' ? 'Before you begin' : 'After the course')}
              </Heading>
              <Text mt={2} fontSize="sm" color="whiteAlpha.900" maxW="540px" lineHeight="1.6">
                {kind === 'pre'
                  ? 'A short baseline on how you currently show up. Honest answers help you and your support team.'
                  : 'Reflect on how you show up now - the same questions as Pre, so growth is visible.'}
              </Text>
            </Box>
          </HStack>
        </Container>
      </Box>

      <Container maxW="3xl" py={{ base: 6, md: 8 }} px={{ base: 4, md: 6 }}>
        {showCoursePicker && (
          <FormControl mb={6} maxW="md">
            <FormLabel fontSize="sm" color="gray.700">
              Course
            </FormLabel>
            <Select
              value={selectedCourseKey || activeCatalog?.courseKey || ''}
              onChange={(e) => {
                setSelectedCourseKey(e.target.value)
                setLiveDefinition(null)
              }}
              bg="white"
              borderRadius="lg"
              borderColor="gray.200"
            >
              {courseOptions.map((c) => (
                <option key={c.surveyMonkeyId} value={c.courseKey}>
                  {c.title}
                </option>
              ))}
            </Select>
          </FormControl>
        )}

        {loading ? (
          <Flex align="center" justify="center" py={20} gap={3}>
            <Spinner color="#350e6f" />
            <Text color="gray.600">Loading assessment…</Text>
          </Flex>
        ) : loadError ? (
          <Stack
            spacing={4}
            bg="white"
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="2xl"
            p={8}
            textAlign="center"
          >
            <Text color="gray.700">{loadError}</Text>
            <Button
              alignSelf="center"
              variant="outline"
              onClick={() => navigate(returnTo.startsWith('/') ? returnTo : '/app/weekly-glance')}
            >
              Return to dashboard
            </Button>
          </Stack>
        ) : liveDefinition && profile?.id ? (
          <Box
            bg="white"
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="2xl"
            boxShadow="0 18px 50px rgba(39,6,46,0.08)"
            px={{ base: 4, md: 6 }}
            py={{ base: 5, md: 6 }}
          >
            <CourseAssessmentForm
              definition={liveDefinition}
              courseTitle={liveDefinition.title || activeCatalog?.title}
              respondentId={profile.id}
              subjectUserId={profile.id}
              raterRole="learner"
              onCompleted={handleCompleted}
            />
          </Box>
        ) : null}
      </Container>
    </Box>
  )
}
