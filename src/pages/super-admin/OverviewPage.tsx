import React from 'react'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  SimpleGrid,
  Skeleton,
  Spinner,
  Stack,
  useDisclosure,
} from '@chakra-ui/react'
import { AdminNotificationsList } from '@/components/admin/AdminNotificationsList'
import { AdminHealthItem } from '@/components/admin/AdminDataHealthPanel'
import type { RiskLevel, RiskReason } from '@/components/admin/RiskAnalysisCard'
import {
  JourneyProgressAggregate,
  RegistrationRecord,
  SuperAdminDashboardMetrics,
  SystemAlertRecord,
  TaskNotificationRecord,
  VerificationRequest,
} from '@/types/admin'

// Command Center Components
import { CommandCenterHeader } from './components/CommandCenterHeader'
import { LearnerJourneyHealth } from './components/LearnerJourneyHealth'

type TrendPoint = { label: string; value: number }

type OverviewPageProps = {
  adminName: string
  metrics: SuperAdminDashboardMetrics
  registrationTrend: TrendPoint[]
  userGrowthTrend: TrendPoint[]
  riskLevels?: RiskLevel[]
  riskReasons?: RiskReason[]
  systemAlerts: SystemAlertRecord[]
  registrations: RegistrationRecord[]
  verificationRequests: VerificationRequest[]
  taskNotifications: TaskNotificationRecord[]
  loading: boolean
  error: string | null
  streamsLoading: boolean
  onNavigate: (key: string) => void
  healthItems: AdminHealthItem[]
  journeyProgress: JourneyProgressAggregate
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  adminName,
  systemAlerts,
  loading,
  error,
  onNavigate,
  journeyProgress,
}) => {
  const notificationsDrawer = useDisclosure()

  return (
    <Stack spacing={8}>
      <CommandCenterHeader
        adminName={adminName}
        criticalAlertCount={systemAlerts.filter((a) => a.level === 'critical').length}
        lastSystemCheck={new Date()}
        onOpenNotifications={notificationsDrawer.onOpen}
      />

      {error && (
        <Alert status="error" borderRadius="xl">
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Stack spacing={6}>
          <Skeleton height="100px" borderRadius="xl" />
          <Skeleton height="200px" borderRadius="xl" />
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <Skeleton height="150px" borderRadius="xl" />
            <Skeleton height="150px" borderRadius="xl" />
            <Skeleton height="150px" borderRadius="xl" />
          </SimpleGrid>
          <Flex justify="center" align="center" py={6}>
            <Spinner size="lg" />
          </Flex>
        </Stack>
      ) : (
        <>
          {/* ZONE 1 - LEARNER JOURNEY HEALTH */}
          <LearnerJourneyHealth aggregate={journeyProgress} onReviewUsers={() => onNavigate('users')} />
        </>
      )}

      <DrawerNotifications isOpen={notificationsDrawer.isOpen} onClose={notificationsDrawer.onClose} />
    </Stack>
  )
}

const DrawerNotifications = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="md">
    <DrawerOverlay />
    <DrawerContent>
      <DrawerCloseButton />
      <DrawerHeader>Admin notifications</DrawerHeader>
      <DrawerBody>
        <AdminNotificationsList />
      </DrawerBody>
    </DrawerContent>
  </Drawer>
)
