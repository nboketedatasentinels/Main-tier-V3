import {
  Box,
  Flex,
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
} from '@chakra-ui/react'
import { ClipboardList } from 'lucide-react'
import type { CourseAssessmentDefinition } from '@/config/nativeCourseAssessments'
import type { CourseAssessmentRaterRole } from '@/config/courseAssessmentRoles'
import { CourseAssessmentForm } from '@/components/assessments/CourseAssessmentForm'

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

/** Kept for external raters; learners use the full-page CourseAssessmentPage. */
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
  if (!definition) return null

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

        <ModalBody p={0} bg="white">
          <Box px={6} py={5}>
            <CourseAssessmentForm
              definition={definition}
              courseTitle={courseTitle}
              respondentId={respondentId}
              subjectUserId={subjectUserId}
              raterRole={raterRole}
              isSubmitting={isSubmitting}
              onCompleted={onCompleted}
            />
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default NativeCourseAssessmentModal
