import { Button, Card, CardBody, HStack, Stack, Text } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'

interface FreeCourseAccessCardProps {
  courseTitle?: string
  enrollmentCode?: string
}

export const FreeCourseAccessCard = ({ courseTitle = 'Leadership Foundations', enrollmentCode = 'TRUST' }: FreeCourseAccessCardProps) => {
  const navigate = useNavigate()

  const handleStart = () => {
    navigate(`/app/courses?code=${enrollmentCode}`)
  }

  return (
    <Card h="100%" variant="outline" borderColor="border.subtle">
      <CardBody>
        <Stack spacing={3}>
          <Text fontWeight="bold">Free Course Access</Text>
          <Text color="text.secondary" fontSize="sm">
            Kick off the week with quick learning. Use the code below to enroll.
          </Text>
          <HStack justify="space-between">
            <Text fontSize="2xl" fontWeight="bold">
              {courseTitle}
            </Text>
            <Button variant="outline" size="sm" onClick={handleStart}>
              Start Course
            </Button>
          </HStack>
          <HStack spacing={3}>
            <Text fontWeight="semibold">Enrollment Code</Text>
            <Text bg="tint.brandPrimary" px={2} py={1} rounded="md">
              {enrollmentCode}
            </Text>
          </HStack>
          <Text fontSize="sm" color="text.secondary">
            Duration: 4 modules • Beginner friendly
          </Text>
        </Stack>
      </CardBody>
    </Card>
  )
}
