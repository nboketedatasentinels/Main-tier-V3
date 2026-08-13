import { Button, type ButtonProps } from '@chakra-ui/react'
import { ClipboardList } from 'lucide-react'

const PRE_COURSE_SURVEY_SECTION_ID = 'pre-course-survey'

export const scrollToPreCourseSurvey = () => {
  document
    .getElementById(PRE_COURSE_SURVEY_SECTION_ID)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

type PreCourseSurveyButtonProps = Omit<ButtonProps, 'children' | 'leftIcon' | 'onClick'> & {
  onClick?: () => void
  label?: string
}

/**
 * Shared CTA so learner / mentor / coach / partner dashboards all surface the
 * same obvious "Pre-course survey" action.
 */
export function PreCourseSurveyButton({
  onClick = scrollToPreCourseSurvey,
  label = 'Pre-course survey',
  ...buttonProps
}: PreCourseSurveyButtonProps) {
  return (
    <Button
      leftIcon={<ClipboardList size={16} />}
      bg="#350e6f"
      color="white"
      _hover={{ bg: '#27062e' }}
      borderRadius="md"
      onClick={onClick}
      {...buttonProps}
    >
      {label}
    </Button>
  )
}

export { PRE_COURSE_SURVEY_SECTION_ID }
