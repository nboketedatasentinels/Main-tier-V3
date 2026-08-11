import React, { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Link,
  SimpleGrid,
  Stack,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react'
import {
  ClipboardList,
  Copy,
  ExternalLink,
  Search,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react'
import PartnerLayout from '@/layouts/PartnerLayout'
import { usePartnerOrganizations } from '@/hooks/partner/usePartnerOrganizations'
import { usePartnerSelectedOrg } from '@/hooks/partner/usePartnerSelectedOrg'
import {
  COURSE_SURVEY_LINKS,
  type CourseSurveyKind,
  type CourseSurveyLink,
} from '@/config/courseSurveys'
import { handlePartnerSidebarNavigate } from '@/utils/partnerSidebarNavigation'

const isExternalRater = (row: CourseSurveyLink): boolean =>
  /external\s*rater/i.test(row.surveyTitle)

const CourseSurveysPage: React.FC = () => {
  const toast = useToast()
  const navigate = useNavigate()
  const { organizations } = usePartnerOrganizations()
  const { selectedOrg: selectedOrgId, setSelectedOrg: setSelectedOrgId } = usePartnerSelectedOrg()

  const [kind, setKind] = useState<CourseSurveyKind | null>(null)
  const [selected, setSelected] = useState<CourseSurveyLink | null>(null)
  const [search, setSearch] = useState('')
  const [showExternalRater, setShowExternalRater] = useState(false)

  const handleNavigate = useCallback(
    (key: string) => handlePartnerSidebarNavigate(navigate, key, 'course-surveys'),
    [navigate],
  )

  const layoutOrgs = useMemo(
    () =>
      organizations
        .filter((o) => Boolean(o.id))
        .map((o) => ({ id: o.id!, code: o.code, name: o.name })),
    [organizations],
  )

  const counts = useMemo(() => {
    const pre = COURSE_SURVEY_LINKS.filter((r) => r.kind === 'pre' && !isExternalRater(r)).length
    const post = COURSE_SURVEY_LINKS.filter((r) => r.kind === 'post' && !isExternalRater(r)).length
    const preExt = COURSE_SURVEY_LINKS.filter((r) => r.kind === 'pre' && isExternalRater(r)).length
    const postExt = COURSE_SURVEY_LINKS.filter((r) => r.kind === 'post' && isExternalRater(r)).length
    return { pre, post, preExt, postExt }
  }, [])

  const surveys = useMemo(() => {
    if (!kind) return []
    const q = search.trim().toLowerCase()
    return COURSE_SURVEY_LINKS.filter((row) => {
      if (row.kind !== kind) return false
      if (!showExternalRater && isExternalRater(row)) return false
      if (!q) return true
      return (
        row.surveyTitle.toLowerCase().includes(q) ||
        row.collectorUrl.toLowerCase().includes(q) ||
        row.courseMatchers.some((m) => m.toLowerCase().includes(q)) ||
        (row.surveyId || '').includes(q)
      )
    }).sort((a, b) => a.surveyTitle.localeCompare(b.surveyTitle))
  }, [kind, search, showExternalRater])

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast({ status: 'success', title: 'Link copied', duration: 2000 })
    } catch {
      toast({ status: 'error', title: 'Could not copy link', duration: 2500 })
    }
  }

  const selectKind = (next: CourseSurveyKind) => {
    setKind(next)
    setSelected(null)
    setSearch('')
  }

  const backToKinds = () => {
    setKind(null)
    setSelected(null)
    setSearch('')
  }

  return (
    <PartnerLayout
      activeItem="course-surveys"
      organizations={layoutOrgs}
      selectedOrg={selectedOrgId || 'all'}
      onSelectOrg={(orgValue) => {
        if (orgValue === 'all') {
          setSelectedOrgId('')
          return
        }
        setSelectedOrgId(orgValue)
      }}
      onNavigate={handleNavigate}
    >
      <Stack spacing={6}>
        <Flex
          justify="space-between"
          align={{ base: 'flex-start', md: 'center' }}
          gap={4}
          flexWrap="wrap"
        >
          <Box>
            <Heading size="lg" color="gray.900">
              Course survey assessments
            </Heading>
            <Text color="gray.600" mt={1} maxW="3xl">
              Browse Pre and Post course SurveyMonkey assessments synced from your SurveyMonkey
              account. Open a survey to view its collector link and course matching details.
            </Text>
          </Box>
          <Badge colorScheme="purple" borderRadius="full" px={3} py={1} fontSize="sm">
            {COURSE_SURVEY_LINKS.length} surveys
          </Badge>
        </Flex>

        {/* Step 1: Pre / Post chooser */}
        {!kind && (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <Button
              h="auto"
              py={8}
              px={6}
              bg="#350e6f"
              color="white"
              _hover={{ bg: '#27062e' }}
              borderRadius="xl"
              onClick={() => selectKind('pre')}
              justifyContent="flex-start"
            >
              <VStack align="start" spacing={2} w="full">
                <HStack spacing={3}>
                  <Icon as={ClipboardList} boxSize={6} />
                  <Text fontSize="xl" fontWeight="bold">
                    Pre-course assessment
                  </Text>
                </HStack>
                <Text fontSize="sm" opacity={0.85} fontWeight="normal" textAlign="left">
                  {counts.pre} learner surveys
                  {counts.preExt > 0 ? ` · ${counts.preExt} external rater` : ''}
                </Text>
              </VStack>
            </Button>

            <Button
              h="auto"
              py={8}
              px={6}
              bg="#f4540c"
              color="white"
              _hover={{ bg: '#d9480a' }}
              borderRadius="xl"
              onClick={() => selectKind('post')}
              justifyContent="flex-start"
            >
              <VStack align="start" spacing={2} w="full">
                <HStack spacing={3}>
                  <Icon as={CheckCircle2} boxSize={6} />
                  <Text fontSize="xl" fontWeight="bold">
                    Post-course assessment
                  </Text>
                </HStack>
                <Text fontSize="sm" opacity={0.85} fontWeight="normal" textAlign="left">
                  {counts.post} learner surveys
                  {counts.postExt > 0 ? ` · ${counts.postExt} external rater` : ''}
                </Text>
              </VStack>
            </Button>
          </SimpleGrid>
        )}

        {/* Step 2: list + detail */}
        {kind && (
          <Stack spacing={4}>
            <HStack spacing={3} flexWrap="wrap">
              <Button
                leftIcon={<Icon as={ArrowLeft} boxSize={4} />}
                variant="ghost"
                onClick={backToKinds}
                size="sm"
              >
                All assessments
              </Button>
              <Badge
                bg={kind === 'pre' ? '#350e6f' : '#f4540c'}
                color="white"
                borderRadius="full"
                px={3}
                py={1}
              >
                {kind === 'pre' ? 'Pre-course' : 'Post-course'}
              </Badge>
              <Text fontSize="sm" color="gray.600">
                {surveys.length} shown
              </Text>
            </HStack>

            <Flex gap={3} flexWrap="wrap" align="center">
              <InputGroup maxW={{ base: 'full', md: '360px' }}>
                <InputLeftElement pointerEvents="none">
                  <Icon as={Search} color="gray.400" boxSize={4} />
                </InputLeftElement>
                <Input
                  placeholder="Search by course or survey title…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  bg="white"
                />
              </InputGroup>
              <Button
                size="sm"
                variant={showExternalRater ? 'solid' : 'outline'}
                colorScheme="gray"
                onClick={() => setShowExternalRater((v) => !v)}
              >
                {showExternalRater ? 'Hide' : 'Show'} external rater
              </Button>
            </Flex>

            <Flex
              direction={{ base: 'column', lg: 'row' }}
              gap={4}
              align="stretch"
              minH={{ lg: '420px' }}
            >
              {/* List */}
              <Box
                flex="1"
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="xl"
                bg="white"
                overflow="hidden"
              >
                <Box px={4} py={3} borderBottomWidth="1px" borderColor="gray.100">
                  <Text fontWeight="semibold" fontSize="sm" color="gray.800">
                    Surveys
                  </Text>
                </Box>
                <Stack spacing={0} maxH={{ base: '360px', lg: '560px' }} overflowY="auto">
                  {surveys.length === 0 && (
                    <Box p={6}>
                      <Text color="gray.500" fontSize="sm">
                        No surveys match this filter.
                      </Text>
                    </Box>
                  )}
                  {surveys.map((row) => {
                    const active = selected?.surveyId === row.surveyId && selected?.collectorUrl === row.collectorUrl
                    return (
                      <Box
                        key={`${row.surveyId}-${row.collectorUrl}`}
                        as="button"
                        textAlign="left"
                        w="full"
                        px={4}
                        py={3}
                        borderBottomWidth="1px"
                        borderColor="gray.100"
                        bg={active ? 'purple.50' : 'white'}
                        borderLeftWidth="3px"
                        borderLeftColor={active ? '#350e6f' : 'transparent'}
                        _hover={{ bg: active ? 'purple.50' : 'gray.50' }}
                        onClick={() => setSelected(row)}
                      >
                        <Text fontWeight="semibold" fontSize="sm" color="gray.900" noOfLines={2}>
                          {row.surveyTitle}
                        </Text>
                        {isExternalRater(row) && (
                          <Badge mt={1} colorScheme="orange" fontSize="2xs">
                            External rater
                          </Badge>
                        )}
                      </Box>
                    )
                  })}
                </Stack>
              </Box>

              {/* Detail */}
              <Box
                flex="1.1"
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="xl"
                bg="white"
                p={5}
              >
                {!selected ? (
                  <Flex h="full" minH="200px" align="center" justify="center">
                    <Text color="gray.500" fontSize="sm">
                      Select a survey to view details
                    </Text>
                  </Flex>
                ) : (
                  <Stack spacing={5}>
                    <Box>
                      <Text
                        fontSize="xs"
                        textTransform="uppercase"
                        letterSpacing="0.08em"
                        color="gray.500"
                        mb={1}
                      >
                        {selected.kind === 'pre' ? 'Pre-course' : 'Post-course'} assessment
                      </Text>
                      <Heading size="md" color="gray.900" lineHeight="1.3">
                        {selected.surveyTitle}
                      </Heading>
                    </Box>

                    <Stack spacing={1}>
                      <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase">
                        Collector link
                      </Text>
                      <HStack spacing={2} flexWrap="wrap">
                        <Link
                          href={selected.collectorUrl}
                          isExternal
                          color="#350e6f"
                          fontWeight="medium"
                          fontSize="sm"
                          wordBreak="break-all"
                        >
                          {selected.collectorUrl}
                          <Icon as={ExternalLink} boxSize={3.5} ml={1} display="inline" />
                        </Link>
                      </HStack>
                      <HStack spacing={2} pt={1}>
                        <Button
                          size="sm"
                          leftIcon={<Icon as={ExternalLink} boxSize={3.5} />}
                          bg="#350e6f"
                          color="white"
                          _hover={{ bg: '#27062e' }}
                          as="a"
                          href={selected.collectorUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open survey
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<Icon as={Copy} boxSize={3.5} />}
                          onClick={() => copyUrl(selected.collectorUrl)}
                        >
                          Copy link
                        </Button>
                      </HStack>
                    </Stack>

                    {selected.surveyId && (
                      <Stack spacing={1}>
                        <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase">
                          SurveyMonkey ID
                        </Text>
                        <Text fontSize="sm" color="gray.800" fontFamily="mono">
                          {selected.surveyId}
                        </Text>
                      </Stack>
                    )}

                    <Stack spacing={2}>
                      <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase">
                        Course matchers
                      </Text>
                      <Text fontSize="xs" color="gray.600">
                        Used to match this survey to a T4L course title when a learner opens a course.
                      </Text>
                      <Flex gap={2} flexWrap="wrap">
                        {selected.courseMatchers.map((matcher) => (
                          <Badge
                            key={matcher}
                            variant="subtle"
                            colorScheme="purple"
                            borderRadius="md"
                            px={2}
                            py={1}
                            fontWeight="medium"
                            textTransform="none"
                          >
                            {matcher}
                          </Badge>
                        ))}
                      </Flex>
                    </Stack>
                  </Stack>
                )}
              </Box>
            </Flex>
          </Stack>
        )}
      </Stack>
    </PartnerLayout>
  )
}

export default CourseSurveysPage
