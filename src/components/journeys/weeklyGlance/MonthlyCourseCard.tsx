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
import { UserProfile, UserRole } from '@/types'
import { isFreeUser } from '@/utils/membership'

interface MonthlyCourseCardProps {
  role?: UserRole
  membershipStatus?: UserProfile['membershipStatus']
  transformationTier?: UserProfile['transformationTier']
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

export const MonthlyCourseCard = ({ role, membershipStatus, transformationTier, data, loading, error }: MonthlyCourseCardProps) => {
  const resolvedRole = role ?? UserRole.USER
  const isFreeTierUser = isFreeUser({ role: resolvedRole, membershipStatus, transformationTier })
  const courseTitle = data?.course?.title || (isFreeTierUser ? FREE_COURSE.title : 'Course details coming soon')
  const courseUrl = data?.course?.externalUrl || (isFreeTierUser ? FREE_COURSE.externalUrl : undefined)
  const enrollmentCode = isFreeTierUser ? FREE_COURSE.enrollmentCode : data?.enrollmentCode
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
            <AlertTitle>Unable to load course</AlertTitle>
            <AlertDescription>Try refreshing the page or contact an admin.</AlertDescription>
          </Stack>
        </Alert>
      )
    }

    if (data?.status === 'no_company') {
      return (
        <Stack spacing={3}>
          <Text fontWeight="bold" color="#273240">Course of the Month</Text>
          <Text color="#273240" fontSize="sm">
            Paid members need to be assigned to a company program to see their monthly course.
          </Text>
          <Alert status="info" rounded="md" variant="subtle">
            <AlertIcon />
            <Text fontSize="sm">Contact your admin to get added to your company.</Text>
          </Alert>
        </Stack>
      )
    }

    if (data?.status === 'pending_assignment') {
      return (
        <Stack spacing={3}>
          <Text fontWeight="bold" color="#273240">Course of the Month</Text>
          <Text color="#273240" fontSize="sm">
            We're waiting for your admin to finalize course assignments. Check back soon.
          </Text>
          <Alert status="info" rounded="md" variant="subtle">
            <AlertIcon />
            <Stack spacing={0}>
              <AlertTitle>Assignments pending</AlertTitle>
              <AlertDescription fontSize="sm">You'll see your first course once it's ready.</AlertDescription>
            </Stack>
          </Alert>
        </Stack>
      )
    }

    return (
      <Stack spacing={3}>
        <HStack justify="space-between" align="flex-start">
          <Stack spacing={1}>
            <Text fontWeight="bold" color="#273240">Course of the Month</Text>
            <Text color="#273240" fontSize="sm">
              {data?.message || 'Stay on pace with your company\'s learning plan.'}
            </Text>
          </Stack>
          {renderStatusBadge()}
        </HStack>

        <Stack spacing={1}>
          <Text fontSize="lg" fontWeight="bold" color="#273240">
            {courseTitle}
          </Text>
          {data?.course?.description && (
            <Text color="#273240" fontSize="sm">
              {data.course.description}
            </Text>
          )}
        </Stack>

        <HStack spacing={3}>
          {monthLabel && (
            <HStack spacing={1} color="#273240" fontSize="sm">
              <CalendarIcon />
              <Text>{monthLabel}</Text>
            </HStack>
          )}
          {data?.status === 'completed' && (
            <HStack spacing={1} color="#273240" fontSize="sm">
              <InfoIcon />
              <Text>Congratulations on completing your program!</Text>
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
      <Text fontWeight="bold" color="#273240">Free Course Access</Text>
      <Text color="#273240" fontSize="sm">
        {data?.message || 'Kick off the week with quick learning. Use the code below to enroll.'}
      </Text>
      <HStack justify="space-between" align="flex-start">
        <Stack spacing={1}>
          <Text fontSize="lg" fontWeight="bold" color="#273240">
            {courseTitle}
          </Text>
          <Text color="#273240" fontSize="sm">
            {FREE_COURSE.durationLabel}
          </Text>
        </Stack>
        <ExternalLinkButton href={courseUrl} />
      </HStack>
      <HStack spacing={3}>
        <Text fontWeight="semibold" color="#273240">Enrollment Code</Text>
        <Text bg="brand.primaryMuted" px={2} py={1} rounded="md" color="#273240">
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
        ) : isFreeTierUser ? (
          renderFreeContent()
        ) : (
          renderPaidContent()
        )}
      </CardBody>
    </Card>
  )
}
