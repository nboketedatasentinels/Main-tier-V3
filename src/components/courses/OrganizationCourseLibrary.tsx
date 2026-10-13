import React, { useEffect, useState } from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftAddon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  Radio,
  RadioGroup,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Switch,
  Text,
  Textarea,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { BookOpen, FileText, Link2, Lock, Plus } from 'lucide-react'
import { useOrganizationCourses } from '@/hooks/useOrganizationCourses'
import {
  ORGANIZATION_COURSE_FILE_ACCEPT,
  createOrganizationCourse,
  getOrganizationCourseAccess,
  setOrganizationCourseArchived,
  updateOrganizationCourse,
  type CourseAccessType,
  type OrganizationCourse,
  type OrganizationCourseInput,
} from '@/services/organizationCourseService'
import type { CourseDifficulty } from '@/utils/courseMappings'
import { CourseAccessBadge } from '@/components/courses/CourseAccessBadge'

const DIFFICULTIES: CourseDifficulty[] = ['Beginner', 'Intermediate', 'Advanced']

const emptyDraft: OrganizationCourseInput = {
  title: '',
  description: '',
  link: '',
  accessType: 'free',
  price: null,
  estimatedMinutes: null,
  difficulty: 'Beginner',
}

const toDraft = (course: OrganizationCourse): OrganizationCourseInput => ({
  title: course.title,
  description: course.description,
  link: course.link ?? '',
  accessType: course.accessType,
  price: course.price,
  estimatedMinutes: course.estimatedMinutes,
  difficulty: course.difficulty,
})

const formatMinutes = (minutes: number | null) => {
  if (!minutes) return null
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`
}

/** Add / edit form: the one template every organisation course follows. */
const CourseTemplateModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  organizationId: string
  course: OrganizationCourse | null
  onSaved: () => void
}> = ({ isOpen, onClose, organizationId, course, onSaved }) => {
  const toast = useToast()
  const [draft, setDraft] = useState<OrganizationCourseInput>(emptyDraft)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setDraft(course ? toDraft(course) : emptyDraft)
    setFile(null)
  }, [isOpen, course])

  const update = <K extends keyof OrganizationCourseInput>(key: K, value: OrganizationCourseInput[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      if (course) {
        await updateOrganizationCourse(course, draft, file)
      } else {
        await createOrganizationCourse(organizationId, draft, file)
      }
      toast({ title: course ? 'Course updated' : 'Course added to library', status: 'success' })
      onSaved()
      onClose()
    } catch (error) {
      toast({
        title: 'Unable to save course',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{course ? 'Edit course' : 'Add a course'}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Course title</FormLabel>
              <Input
                value={draft.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="e.g. Data Protection Essentials"
                maxLength={160}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Short description</FormLabel>
              <Textarea
                value={draft.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="What learners will be able to do after this course"
                rows={3}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Course link</FormLabel>
              <Input
                value={draft.link ?? ''}
                onChange={(e) => update('link', e.target.value)}
                placeholder="https://your-lms.com/course"
              />
              <FormHelperText>Your LMS, video or webinar page. Or upload a file below.</FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel>Course file</FormLabel>
              <Input
                type="file"
                accept={ORGANIZATION_COURSE_FILE_ACCEPT}
                p={1}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <FormHelperText>
                PDF, MP4, PPTX or DOCX, up to 50 MB.
                {course?.fileName && !file ? ` Current file: ${course.fileName}.` : ''} Stored privately for this
                organization only.
              </FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel>Access</FormLabel>
              <RadioGroup
                value={draft.accessType}
                onChange={(value) => update('accessType', value as CourseAccessType)}
              >
                <HStack spacing={6}>
                  <Radio value="free">Free</Radio>
                  <Radio value="paid">Paid</Radio>
                </HStack>
              </RadioGroup>
            </FormControl>
            {draft.accessType === 'paid' && (
              <FormControl isRequired>
                <FormLabel>Price</FormLabel>
                <InputGroup>
                  <InputLeftAddon>USD</InputLeftAddon>
                  <NumberInput
                    min={0.5}
                    precision={2}
                    value={draft.price ?? ''}
                    onChange={(_, value) => update('price', Number.isFinite(value) ? value : null)}
                    w="full"
                  >
                    <NumberInputField borderLeftRadius={0} placeholder="49.00" />
                  </NumberInput>
                </InputGroup>
                <FormHelperText>
                  Shown to learners on the course card. Learners on a paid or organization-sponsored plan can open
                  it; others see “Upgrade to unlock”.
                </FormHelperText>
              </FormControl>
            )}
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
              <FormControl>
                <FormLabel>Length (minutes)</FormLabel>
                <NumberInput
                  min={1}
                  value={draft.estimatedMinutes ?? ''}
                  onChange={(_, value) => update('estimatedMinutes', Number.isFinite(value) ? value : null)}
                >
                  <NumberInputField placeholder="90" />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel>Level</FormLabel>
                <Select
                  value={draft.difficulty}
                  onChange={(e) => update('difficulty', e.target.value as CourseDifficulty)}
                >
                  {DIFFICULTIES.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </SimpleGrid>
          </Stack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button colorScheme="purple" onClick={handleSave} isLoading={saving}>
            {course ? 'Save changes' : 'Add course'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export interface OrganizationCourseLibraryProps {
  organizationId: string
  organizationName?: string | null
}

/**
 * The organisation's own course library. Courses added here appear in the
 * journey course picker (Edit organization → Custom course template) and on
 * learners' My Courses once assigned.
 */
export const OrganizationCourseLibrary: React.FC<OrganizationCourseLibraryProps> = ({
  organizationId,
  organizationName,
}) => {
  const toast = useToast()
  const editor = useDisclosure()
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<OrganizationCourse | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const { courses, loading, error, reload } = useOrganizationCourses(organizationId, {
    includeArchived: true,
  })
  const visible = showArchived ? courses : courses.filter((course) => !course.archived)
  const archivedCount = courses.filter((course) => course.archived).length

  const openEditor = (course: OrganizationCourse | null) => {
    setEditing(course)
    editor.onOpen()
  }

  const toggleArchived = async (course: OrganizationCourse) => {
    setTogglingId(course.id)
    try {
      await setOrganizationCourseArchived(course.id, !course.archived)
      toast({
        title: course.archived ? 'Course restored' : 'Course archived',
        description: course.archived
          ? undefined
          : 'Learners no longer see it. Replace it in the journey if it was assigned.',
        status: 'success',
      })
      reload()
    } catch (err) {
      toast({
        title: 'Unable to update course',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
      })
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <Stack spacing={4}>
      <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} gap={3} direction={{ base: 'column', md: 'row' }}>
        <Box>
          <Heading size="md" color="#27062e">
            Course library{organizationName ? ` · ${organizationName}` : ''}
          </Heading>
          <Text fontSize="sm" color="gray.600">
            Add your own courses with one template. Assign them to journey slots under Edit organization.
          </Text>
        </Box>
        <Button leftIcon={<Icon as={Plus} boxSize={4} />} colorScheme="purple" onClick={() => openEditor(null)}>
          Add course
        </Button>
      </Flex>

      <Alert status="info" borderRadius="md" alignItems="flex-start">
        <AlertIcon as={Lock} boxSize={4} mt={1} />
        <AlertDescription fontSize="sm">
          Private to this organization. Courses and files added here are only visible to its members, its
          partner and T4L super admins. They are never shared with other organizations or used to train AI
          models.
        </AlertDescription>
      </Alert>

      {archivedCount > 0 && (
        <HStack>
          <Switch
            id="show-archived-courses"
            isChecked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            colorScheme="purple"
          />
          <FormLabel htmlFor="show-archived-courses" mb={0} fontSize="sm" color="gray.600">
            Show archived ({archivedCount})
          </FormLabel>
        </HStack>
      )}

      {loading ? (
        <Flex justify="center" py={10}>
          <Spinner color="purple.500" />
        </Flex>
      ) : error ? (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          {error}
        </Alert>
      ) : visible.length === 0 ? (
        <Card variant="outline">
          <CardBody textAlign="center" py={10}>
            <Icon as={BookOpen} boxSize={8} color="purple.300" mb={3} />
            <Heading size="sm" color="gray.700" mb={1}>
              No courses yet
            </Heading>
            <Text fontSize="sm" color="gray.600">
              Add the first course this organization wants its learners to take.
            </Text>
          </CardBody>
        </Card>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
          {visible.map((course) => {
            const length = formatMinutes(course.estimatedMinutes)
            return (
              <Card key={course.id} variant="outline" opacity={course.archived ? 0.6 : 1}>
                <CardBody>
                  <Stack spacing={3} h="full">
                    <HStack justify="space-between" align="flex-start">
                      <CourseAccessBadge access={getOrganizationCourseAccess(course)} />
                      {course.archived && <Badge colorScheme="gray">Archived</Badge>}
                    </HStack>
                    <Box flex="1">
                      <Heading size="sm" color="#27062e" mb={1}>
                        {course.title}
                      </Heading>
                      <Text fontSize="sm" color="gray.600" noOfLines={3}>
                        {course.description || 'No description yet.'}
                      </Text>
                    </Box>
                    <HStack spacing={3} fontSize="xs" color="gray.600" flexWrap="wrap">
                      <HStack spacing={1}>
                        <Icon as={course.filePath ? FileText : Link2} boxSize={3.5} />
                        <Text noOfLines={1} maxW="180px">
                          {course.filePath ? course.fileName ?? 'Uploaded file' : 'External link'}
                        </Text>
                      </HStack>
                      {length && <Text>{length}</Text>}
                      <Text>{course.difficulty}</Text>
                    </HStack>
                    <HStack spacing={2}>
                      <Button size="sm" variant="outline" onClick={() => openEditor(course)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        colorScheme={course.archived ? 'green' : 'orange'}
                        isLoading={togglingId === course.id}
                        onClick={() => toggleArchived(course)}
                      >
                        {course.archived ? 'Restore' : 'Archive'}
                      </Button>
                    </HStack>
                  </Stack>
                </CardBody>
              </Card>
            )
          })}
        </SimpleGrid>
      )}

      <CourseTemplateModal
        isOpen={editor.isOpen}
        onClose={editor.onClose}
        organizationId={organizationId}
        course={editing}
        onSaved={reload}
      />
    </Stack>
  )
}

export default OrganizationCourseLibrary
