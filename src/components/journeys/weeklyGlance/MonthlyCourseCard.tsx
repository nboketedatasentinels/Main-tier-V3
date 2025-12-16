import { CalendarIcon, ExternalLinkIcon, InfoIcon } from '@chakra-ui/icons'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardBody,
  HStack,
  Skeleton,
  Stack,
  Text,
} from '@chakra-ui/react'
import { FREE_COURSE } from '@/constants/courseConfig'
import { MonthlyCourseData } from '@/services/monthlyCoursesService'
import { UserRole } from '@/types'

interface MonthlyCourseCardProps {
  role?: UserRole
  data: MonthlyCourseData | null
  loading: boolean
  error?: Error
}

const formatMonthLabel = (monthNumber?: number, totalMonths?: number) => {
  if (!monthNumber || !totalMonths) return undefined
  return `Month ${monthNumber} of ${totalMonths}`
}

const ExternalLinkButton = ({ href, isDisabled }: { href?: string; isDisabled?: boolean }) => (
  <Button
    as="a"
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    colorScheme="yellow"
    size="sm"
    rightIcon={<ExternalLinkIcon />}
    isDisabled={!href || isDisabled}
  >
    Open Course
  </Button>
)

export const MonthlyCourseCard = ({ role, data, loading, error }: MonthlyCourseCardProps) => {
  const isFreeUser = role === UserRole.FREE_USER
  const courseTitle = data?.course?.title || (isFreeUser ? FREE_COURSE.title : 'Course details coming soon')
  const courseUrl = data?.course?.externalUrl || (isFreeUser ? FREE_COURSE.externalUrl : undefined)
  const enrollmentCode = isFreeUser ? FREE_COURSE.enrollmentCode : data?.enrollmentCode
  const monthLabel = formatMonthLabel(data?.monthNumber, data?.totalMonths)

  const renderStatusBadge = () => {
    if (data?.status === 'completed') {
      return <Badge colorScheme="green">Program Completed</Badge>
    }
    if (data?.status === 'not_started') {
      return <Badge colorScheme="blue">Starting Soon</Badge>
    }
    return monthLabel ? <Badge colorScheme="purple">{monthLabel}</Badge> : null
  }

  const renderPaidContent = () => {
    if (error) {
      return (
        <Alert status="error" rounded="md">
          <AlertIcon />
          <Stack spacing={1}>
            <AlertTitle color="#5A6ACF">Unable to load course</AlertTitle>
            <AlertDescription color="#5A6ACF">Try refreshing the page or contact an admin.</AlertDescription>
          </Stack>
        </Alert>
      )
    }

    if (data?.status === 'no_company') {
      return (
        <Stack spacing={3}>
          <Text fontWeight="bold" color="#5A6ACF">Course of the Month</Text>
          <Text color="#5A6ACF" fontSize="sm">
            Paid members need to be assigned to a company program to see their monthly course.
          </Text>
          <Alert status="info" rounded="md" variant="subtle">
            <AlertIcon />
            <Text fontSize="sm" color="#5A6ACF">Contact your admin to get added to your company.</Text>
          </Alert>
        </Stack>
      )
    }

    if (data?.status === 'pending_assignment') {
      return (
        <Stack spacing={3}>
          <Text fontWeight="bold" color="#5A6ACF">Course of the Month</Text>
          <Text color="#5A6ACF" fontSize="sm">
            We're waiting for your admin to finalize course assignments. Check back soon.
          </Text>
          <Alert status="info" rounded="md" variant="subtle">
            <AlertIcon />
            <Stack spacing={0}>
              <AlertTitle color="#5A6ACF">Assignments pending</AlertTitle>
              <AlertDescription fontSize="sm" color="#5A6ACF">You'll see your first course once it's ready.</AlertDescription>
            </Stack>
          </Alert>
        </Stack>
      )
    }

    return (
      <Stack spacing={3}>
        <HStack justify="space-between" align="flex-start">
          <Stack spacing={1}>
            <Text fontWeight="bold" color="#5A6ACF">Course of the Month</Text>
            <Text color="#5A6ACF" fontSize="sm">
              {data?.message || 'Stay on pace with your company\'s learning plan.'}
            </Text>
          </Stack>
          {renderStatusBadge()}
        </HStack>

        <Stack spacing={1}>
          <Text fontSize="lg" fontWeight="bold" color="#5A6ACF">
            {courseTitle}
          </Text>
          {data?.course?.description && (
            <Text color="#5A6ACF" fontSize="sm">
              {data.course.description}
            </Text>
          )}
        </Stack>

        <HStack spacing={3}>
          {monthLabel && (
            <HStack spacing={1} color="brand.subtleText" fontSize="sm">
              <CalendarIcon />
              <Text color="#5A6ACF">{monthLabel}</Text>
            </HStack>
          )}
          {data?.status === 'completed' && (
            <HStack spacing={1} color="green.600" fontSize="sm">
              <InfoIcon />
              <Text color="#5A6ACF">Congratulations on completing your program!</Text>
            </HStack>
          )}
        </HStack>

        <HStack justify="flex-start">
          <ExternalLinkButton href={courseUrl} isDisabled={!courseUrl} />
        </HStack>
      </Stack>
    )
  }

  const renderFreeContent = () => (
    <Stack spacing={3}>
      <Text fontWeight="bold" color="#5A6ACF">Free Course Access</Text>
      <Text color="#5A6ACF" fontSize="sm">
        {data?.message || 'Kick off the week with quick learning. Use the code below to enroll.'}
      </Text>
      <HStack justify="space-between" align="flex-start">
        <Stack spacing={1}>
          <Text fontSize="lg" fontWeight="bold" color="#5A6ACF">
            {courseTitle}
          </Text>
          <Text color="#5A6ACF" fontSize="sm">
            {FREE_COURSE.durationLabel}
          </Text>
        </Stack>
        <ExternalLinkButton href={courseUrl} />
      </HStack>
      <HStack spacing={3}>
        <Text fontWeight="semibold" color="#5A6ACF">Enrollment Code</Text>
        <Text bg="brand.primaryMuted" px={2} py={1} rounded="md" color="#5A6ACF">
          {enrollmentCode}
        </Text>
      </HStack>
    </Stack>
  )

  return (
    <Card h="100%" variant="outline" borderColor="brand.border">
      <CardBody>
        {loading ? (
          <Stack spacing={3}>
            <Skeleton height="18px" />
            <Skeleton height="18px" />
            <Skeleton height="32px" />
            <Skeleton height="24px" />
          </Stack>
        ) : isFreeUser ? (
          renderFreeContent()
        ) : (
          renderPaidContent()
        )}
      </CardBody>
    </Card>
  )
}
