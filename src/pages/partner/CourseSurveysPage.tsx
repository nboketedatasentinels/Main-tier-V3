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
            <Box
              as="button"
              textAlign="left"
              w="full"
              bg="white"
              borderWidth="1px"
              borderColor="gray.200"
              borderRadius="xl"
              px={5}
              py={5}
              transition="border-color 0.15s, box-shadow 0.15s"
              _hover={{ borderColor: 'gray.300', boxShadow: 'sm' }}
              onClick={() => selectKind('pre')}
            >
              <HStack spacing={4} align="center">
                <Flex
                  w={11}
                  h={11}
                  borderRadius="lg"
                  bg="gray.50"
                  borderWidth="1px"
                  borderColor="gray.200"
                  align="center"
                  justify="center"
                  flexShrink={0}
                >
                  <Icon as={ClipboardList} boxSize={5} color="gray.700" />
                </Flex>
                <VStack align="start" spacing={0.5} minW={0}>
                  <Text fontSize="lg" fontWeight="bold" color="gray.900">
                    Pre-course assessment
                  </Text>
                  <Text fontSize="sm" color="gray.600" fontWeight="normal">
                    {counts.pre} learner surveys
                    {counts.preExt > 0 ? ` · ${counts.preExt} external rater` : ''}
                  </Text>
                </VStack>
              </HStack>
            </Box>

            <Box
              as="button"
              textAlign="left"
              w="full"
              bg="white"
              borderWidth="1px"
              borderColor="gray.200"
              borderRadius="xl"
              px={5}
              py={5}
              transition="border-color 0.15s, box-shadow 0.15s"
              _hover={{ borderColor: 'gray.300', boxShadow: 'sm' }}
              onClick={() => selectKind('post')}
            >
              <HStack spacing={4} align="center">
                <Flex
                  w={11}
                  h={11}
                  borderRadius="lg"
                  bg="gray.50"
                  borderWidth="1px"
                  borderColor="gray.200"
                  align="center"
                  justify="center"
                  flexShrink={0}
                >
                  <Icon as={CheckCircle2} boxSize={5} color="gray.700" />
                </Flex>
                <VStack align="start" spacing={0.5} minW={0}>
                  <Text fontSize="lg" fontWeight="bold" color="gray.900">
                    Post-course assessment
                  </Text>
                  <Text fontSize="sm" color="gray.600" fontWeight="normal">
                    {counts.post} learner surveys
                    {counts.postExt > 0 ? ` · ${counts.postExt} external rater` : ''}
                  </Text>
                </VStack>
              </HStack>
            </Box>
          </SimpleGrid>
        )}

        {/* Step 2: list + detail */}
        {kind && (
          <Stack spacing={5}>
            <Flex
              justify="space-between"
              align={{ base: 'flex-start', md: 'center' }}
              gap={3}
              flexWrap="wrap"
            >
              <HStack spacing={3} flexWrap="wrap">
                <Button
                  leftIcon={<Icon as={ArrowLeft} boxSize={4} />}
                  variant="ghost"
                  onClick={backToKinds}
                  size="sm"
                  color="gray.700"
                >
                  All assessments
                </Button>
                <Badge
                  variant="outline"
                  borderColor="gray.300"
                  color="gray.800"
                  borderRadius="full"
                  px={3}
                  py={1}
                  textTransform="none"
                  fontWeight="semibold"
                >
                  {kind === 'pre' ? 'Pre-course' : 'Post-course'}
                </Badge>
                <Text fontSize="sm" color="gray.500">
                  {surveys.length} shown
                </Text>
              </HStack>
            </Flex>

            <Flex gap={3} flexWrap="wrap" align="center">
              <InputGroup maxW={{ base: 'full', md: '400px' }}>
                <InputLeftElement pointerEvents="none">
                  <Icon as={Search} color="gray.400" boxSize={4} />
                </InputLeftElement>
                <Input
                  placeholder="Search by course or survey title…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  bg="white"
                  borderColor="gray.200"
                  borderRadius="lg"
                />
              </InputGroup>
              <Button
                size="sm"
                variant={showExternalRater ? 'solid' : 'outline'}
                colorScheme="gray"
                borderRadius="lg"
                onClick={() => setShowExternalRater((v) => !v)}
              >
                {showExternalRater ? 'Hide' : 'Show'} external rater
              </Button>
            </Flex>

            {surveys.length === 0 ? (
              <Box
                p={8}
                bg="white"
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="xl"
              >
                <Text color="gray.500" fontSize="sm">
                  No surveys match this filter.
                </Text>
              </Box>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                {surveys.map((row) => {
                  const active =
                    selected?.surveyId === row.surveyId &&
                    selected?.collectorUrl === row.collectorUrl
                  return (
                    <Box
                      key={`${row.surveyId}-${row.collectorUrl}`}
                      as="button"
                      textAlign="left"
                      w="full"
                      h="full"
                      bg="white"
                      borderWidth="1px"
                      borderColor={active ? '#350e6f' : 'gray.200'}
                      borderRadius="xl"
                      px={5}
                      py={5}
                      boxShadow={active ? 'sm' : 'none'}
                      transition="border-color 0.15s, box-shadow 0.15s"
                      _hover={{
                        borderColor: active ? '#350e6f' : 'gray.300',
                        boxShadow: 'sm',
                      }}
                      onClick={() => setSelected(row)}
                    >
                      <HStack spacing={4} align="flex-start">
                        <Flex
                          w={11}
                          h={11}
                          borderRadius="lg"
                          bg="gray.50"
                          borderWidth="1px"
                          borderColor="gray.200"
                          align="center"
                          justify="center"
                          flexShrink={0}
                        >
                          <Icon
                            as={kind === 'pre' ? ClipboardList : CheckCircle2}
                            boxSize={5}
                            color="gray.700"
                          />
                        </Flex>
                        <Box minW={0} flex="1">
                          <Text
                            fontWeight="semibold"
                            fontSize="md"
                            color="gray.900"
                            lineHeight="1.45"
                            noOfLines={3}
                          >
                            {row.surveyTitle}
                          </Text>
                          {isExternalRater(row) && (
                            <Badge
                              mt={2}
                              colorScheme="orange"
                              fontSize="2xs"
                              borderRadius="md"
                              textTransform="none"
                            >
                              External rater
                            </Badge>
                          )}
                        </Box>
                      </HStack>
                    </Box>
                  )
                })}
              </SimpleGrid>
            )}

            {/* Detail panel */}
            <Box
              borderWidth="1px"
              borderColor="gray.200"
              borderRadius="xl"
              bg="white"
              p={{ base: 5, md: 6 }}
              minH="200px"
            >
              {!selected ? (
                <Flex h="full" minH="140px" align="center" justify="center" px={4}>
                  <Text color="gray.500" fontSize="sm" textAlign="center">
                    Select a survey card above to view details
                  </Text>
                </Flex>
              ) : (
                <Stack spacing={6}>
                  <Box>
                    <Text
                      fontSize="xs"
                      textTransform="uppercase"
                      letterSpacing="0.08em"
                      color="gray.500"
                      mb={2}
                    >
                      {selected.kind === 'pre' ? 'Pre-course' : 'Post-course'} assessment
                    </Text>
                    <Heading size="md" color="gray.900" lineHeight="1.35">
                      {selected.surveyTitle}
                    </Heading>
                  </Box>

                  <Stack spacing={2}>
                    <Text
                      fontSize="xs"
                      fontWeight="semibold"
                      color="gray.500"
                      textTransform="uppercase"
                      letterSpacing="0.06em"
                    >
                      Collector link
                    </Text>
                    <Link
                      href={selected.collectorUrl}
                      isExternal
                      color="#350e6f"
                      fontWeight="medium"
                      fontSize="sm"
                      wordBreak="break-all"
                      lineHeight="1.5"
                    >
                      {selected.collectorUrl}
                      <Icon as={ExternalLink} boxSize={3.5} ml={1} display="inline" />
                    </Link>
                    <HStack spacing={2} pt={2} flexWrap="wrap">
                      <Button
                        size="sm"
                        leftIcon={<Icon as={ExternalLink} boxSize={3.5} />}
                        bg="#350e6f"
                        color="white"
                        _hover={{ bg: '#27062e' }}
                        borderRadius="lg"
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
                        borderRadius="lg"
                        leftIcon={<Icon as={Copy} boxSize={3.5} />}
                        onClick={() => copyUrl(selected.collectorUrl)}
                      >
                        Copy link
                      </Button>
                    </HStack>
                  </Stack>

                  {selected.surveyId && (
                    <Stack spacing={2}>
                      <Text
                        fontSize="xs"
                        fontWeight="semibold"
                        color="gray.500"
                        textTransform="uppercase"
                        letterSpacing="0.06em"
                      >
                        SurveyMonkey ID
                      </Text>
                      <Text fontSize="sm" color="gray.800" fontFamily="mono">
                        {selected.surveyId}
                      </Text>
                    </Stack>
                  )}

                  <Stack spacing={3}>
                    <Text
                      fontSize="xs"
                      fontWeight="semibold"
                      color="gray.500"
                      textTransform="uppercase"
                      letterSpacing="0.06em"
                    >
                      Course matchers
                    </Text>
                    <Text fontSize="sm" color="gray.600" lineHeight="1.5">
                      Used to match this survey to a T4L course title when a learner opens a
                      course.
                    </Text>
                    <Flex gap={2} flexWrap="wrap">
                      {selected.courseMatchers.map((matcher) => (
                        <Badge
                          key={matcher}
                          variant="outline"
                          borderColor="gray.200"
                          color="gray.700"
                          borderRadius="md"
                          px={2.5}
                          py={1}
                          fontWeight="medium"
                          textTransform="none"
                          bg="gray.50"
                        >
                          {matcher}
                        </Badge>
                      ))}
                    </Flex>
                  </Stack>
                </Stack>
              )}
            </Box>
          </Stack>
        )}
      </Stack>
    </PartnerLayout>
  )
}

export default CourseSurveysPage
