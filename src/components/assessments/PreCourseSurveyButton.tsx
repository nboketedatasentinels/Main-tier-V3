import { Button, type ButtonProps } from '@chakra-ui/react'
import { ClipboardCheck, ClipboardList } from 'lucide-react'
import type { CourseAssessmentKind } from '@/config/nativeCourseAssessments'
import { courseSurveyButtonLabel } from '@/utils/courseSurveyWindow'

const COURSE_SURVEY_SECTION_ID = 'pre-course-survey'

export const scrollToCourseSurvey = () => {
  document
    .getElementById(COURSE_SURVEY_SECTION_ID)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

type CourseSurveyButtonProps = Omit<ButtonProps, 'children' | 'leftIcon' | 'onClick'> & {
  onClick?: () => void
  /** Defaults to pre. Pass post in the final 3 weeks of the journey. */
  kind?: CourseAssessmentKind
  label?: string
}

/**
 * Shared CTA: Pre-course survey for most of the journey, Post-course survey
 * in the final 3 weeks.
 */
export function PreCourseSurveyButton({
  onClick = scrollToCourseSurvey,
  kind = 'pre',
  label,
  ...buttonProps
}: CourseSurveyButtonProps) {
  const resolvedLabel = label ?? courseSurveyButtonLabel(kind)
  const Icon = kind === 'post' ? ClipboardCheck : ClipboardList

  return (
    <Button
      leftIcon={<Icon size={16} />}
      bg="#350e6f"
      color="white"
      _hover={{ bg: '#27062e' }}
      borderRadius="md"
      onClick={onClick}
      {...buttonProps}
    >
      {resolvedLabel}
    </Button>
  )
}

/** @deprecated Use COURSE_SURVEY_SECTION_ID — kept for existing section anchors. */
export const PRE_COURSE_SURVEY_SECTION_ID = COURSE_SURVEY_SECTION_ID
export { COURSE_SURVEY_SECTION_ID }
export const scrollToPreCourseSurvey = scrollToCourseSurvey
