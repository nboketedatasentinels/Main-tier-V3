import { Button, HStack, Icon, Text } from '@chakra-ui/react'
import { Bell } from 'lucide-react'

interface RoleDashboardHeaderProps {
  unreadCount?: number
  onOpenNotifications?: () => void
}

export const RoleDashboardHeader = ({ unreadCount = 0, onOpenNotifications }: RoleDashboardHeaderProps) => {
  const hasNotifications = unreadCount > 0

  return (
    <HStack spacing={3} justify="flex-end">
      <Button
        leftIcon={<Icon as={Bell} />}
        colorScheme={hasNotifications ? 'purple' : 'gray'}
        variant={hasNotifications ? 'solid' : 'outline'}
        onClick={onOpenNotifications}
      >
        <Text>{hasNotifications ? `${unreadCount} alerts` : 'Notifications'}</Text>
      </Button>
    </HStack>
  )
}

export default RoleDashboardHeader
