import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { NotificationsList } from './NotificationsList'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/services/firebase'
import { NotificationSettingsPreferences } from '@/types/notifications'

const defaultPreferences: NotificationSettingsPreferences = {
  emailNotificationsEnabled: true,
  inAppNotificationsEnabled: true,
  emailNotificationPreferences: {
    action_required: true,
    important_updates: true,
    mentions: true,
    system_alerts: true,
    other: true,
  },
  inAppNotificationPreferences: {
    action_required: true,
    important_updates: true,
    mentions: true,
    system_alerts: true,
    other: true,
  },
  emailNotificationFrequency: 'instant',
  inAppNotificationFrequency: 'instant',
  notificationDigestMode: 'instant',
}

export const NotificationSettings = () => {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<NotificationSettingsPreferences>(
    defaultPreferences,
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchPreferences = async () => {
      if (!user) return
      const ref = doc(db, 'notification_settings', user.uid)
      const snapshot = await getDoc(ref)
      if (snapshot.exists()) {
        setPreferences({ ...defaultPreferences, ...(snapshot.data() as NotificationSettingsPreferences) })
      }
    }

    fetchPreferences()
  }, [user])

  const toggleCategory = (
    channel: 'emailNotificationPreferences' | 'inAppNotificationPreferences',
    key: string,
  ) => {
    setPreferences((prev) => {
      const channelPrefs = prev[channel] as Record<string, boolean>
      return {
        ...prev,
        [channel]: {
          ...channelPrefs,
          [key]: !channelPrefs[key],
        },
      }
    })
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    const ref = doc(db, 'notification_settings', user.uid)
    await setDoc(ref, preferences, { merge: true })
    setSaving(false)
  }

  return (
    <Stack spacing={8}>
      <Box p={6} borderWidth="1px" rounded="md" bg="white">
        <Flex justify="space-between" align="center" mb={4}>
          <Heading size="md">Notification Settings</Heading>
          <Button colorScheme="purple" onClick={handleSave} isLoading={saving}>
            Save preferences
          </Button>
        </Flex>

        <Text mb={4} color="gray.600">
          Configure how you want to receive notifications. Settings are stored in Firebase so they
          can be reused across sessions.
        </Text>

        <VStack align="start" spacing={6}>
          <FormControl display="flex" alignItems="center">
            <FormLabel htmlFor="emailNotifications" mb="0">
              Email notifications
            </FormLabel>
            <Switch
              id="emailNotifications"
              isChecked={preferences.emailNotificationsEnabled}
              onChange={(e) =>
                setPreferences((prev) => ({ ...prev, emailNotificationsEnabled: e.target.checked }))
              }
            />
          </FormControl>

          <FormControl display="flex" alignItems="center">
            <FormLabel htmlFor="inAppNotifications" mb="0">
              In-app notifications
            </FormLabel>
            <Switch
              id="inAppNotifications"
              isChecked={preferences.inAppNotificationsEnabled}
              onChange={(e) =>
                setPreferences((prev) => ({ ...prev, inAppNotificationsEnabled: e.target.checked }))
              }
            />
          </FormControl>

          <Divider />

          <Box w="full">
            <Text fontWeight="bold" mb={2}>
              Email frequency
            </Text>
          <RadioGroup
            value={preferences.emailNotificationFrequency}
            onChange={(value: NotificationSettingsPreferences['emailNotificationFrequency']) =>
              setPreferences((prev) => ({ ...prev, emailNotificationFrequency: value }))
            }
          >
              <HStack spacing={4}>
                <Radio value="instant">Instant</Radio>
                <Radio value="hourly">Hourly digest</Radio>
                <Radio value="daily">Daily digest</Radio>
              </HStack>
            </RadioGroup>
          </Box>

          <Box w="full">
            <Text fontWeight="bold" mb={2}>
              In-app frequency
            </Text>
          <RadioGroup
            value={preferences.inAppNotificationFrequency}
            onChange={(value: NotificationSettingsPreferences['inAppNotificationFrequency']) =>
              setPreferences((prev) => ({ ...prev, inAppNotificationFrequency: value }))
            }
          >
              <HStack spacing={4}>
                <Radio value="instant">Instant</Radio>
                <Radio value="hourly">Hourly digest</Radio>
                <Radio value="daily">Daily digest</Radio>
              </HStack>
            </RadioGroup>
          </Box>

          <Box w="full">
            <Text fontWeight="bold" mb={2}>
              Digest mode
            </Text>
          <RadioGroup
            value={preferences.notificationDigestMode}
            onChange={(value: NotificationSettingsPreferences['notificationDigestMode']) =>
              setPreferences((prev) => ({ ...prev, notificationDigestMode: value }))
            }
          >
              <HStack spacing={4}>
                <Radio value="instant">Instant</Radio>
                <Radio value="daily">Daily summary</Radio>
                <Radio value="weekly">Weekly summary</Radio>
              </HStack>
            </RadioGroup>
          </Box>

          <Box w="full">
            <Text fontWeight="bold" mb={2}>
              Category preferences
            </Text>
            <Stack spacing={2}>
              {Object.keys(defaultPreferences.emailNotificationPreferences).map((key) => (
                <Flex key={key} justify="space-between" align="center">
                  <HStack>
                    <Badge colorScheme="purple">{key.replace('_', ' ')}</Badge>
                    <Text color="gray.600">Enable email</Text>
                  </HStack>
                  <HStack>
                    <Switch
                      isChecked={preferences.emailNotificationPreferences[key as keyof typeof defaultPreferences.emailNotificationPreferences]}
                      onChange={() =>
                        toggleCategory('emailNotificationPreferences', key)
                      }
                    />
                    <Text color="gray.600">In-app</Text>
                    <Switch
                      isChecked={preferences.inAppNotificationPreferences[key as keyof typeof defaultPreferences.emailNotificationPreferences]}
                      onChange={() => toggleCategory('inAppNotificationPreferences', key)}
                    />
                  </HStack>
                </Flex>
              ))}
            </Stack>
          </Box>

          <Box w="full" bg="purple.50" p={4} rounded="md" borderColor="purple.100" borderWidth="1px">
            <Text fontWeight="bold">Smart notification timing</Text>
            <Text color="gray.600">
              We adapt delivery based on your activity patterns to avoid interruption. Notifications
              may be delayed until you are active again.
            </Text>
          </Box>
        </VStack>
      </Box>

      <Box>
        <Heading size="md" mb={4}>
          Recent notifications
        </Heading>
        <NotificationsList />
      </Box>
    </Stack>
  )
}

export default NotificationSettings
