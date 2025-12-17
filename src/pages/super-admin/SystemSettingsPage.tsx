import React, { useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react'
import { Mail, Settings, Sparkles, ToggleLeft } from 'lucide-react'

export const SystemSettingsPage: React.FC = () => {
  const toast = useToast()
  const [emailSettings, setEmailSettings] = useState({ fromName: 'Super Admin', fromEmail: 'no-reply@example.com' })
  const [notifications, setNotifications] = useState({ audits: true, engagement: true, outages: false })
  const [featureFlags, setFeatureFlags] = useState({ betaTools: true, sandboxMode: false, scoringV2: true })

  const handleSave = () => {
    toast({ title: 'Settings saved', status: 'success' })
  }

  const handleReset = () => {
    setEmailSettings({ fromName: 'Super Admin', fromEmail: 'no-reply@example.com' })
    setNotifications({ audits: true, engagement: true, outages: false })
    setFeatureFlags({ betaTools: true, sandboxMode: false, scoringV2: true })
    toast({ title: 'Settings reset', status: 'info' })
  }

  return (
    <Stack spacing={6}>
      <Card bg="white" border="1px solid" borderColor="brand.border">
        <CardBody>
          <Stack spacing={6}>
            <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3} direction={{ base: 'column', md: 'row' }}>
              <Stack spacing={1}>
                <Heading size="md">System settings</Heading>
                <Text color="brand.subtleText">Platform-wide defaults, notifications, and feature toggles.</Text>
              </Stack>
              <HStack>
                <Button leftIcon={<Sparkles size={16} />} colorScheme="purple" onClick={handleSave}>
                  Save changes
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              </HStack>
            </Flex>

            <Card bg="gray.50" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={4}>
                  <HStack justify="space-between">
                    <Heading size="sm">Email settings</Heading>
                    <Badge colorScheme="purple">Delivery</Badge>
                  </HStack>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel>From name</FormLabel>
                      <Input value={emailSettings.fromName} onChange={(e) => setEmailSettings((prev) => ({ ...prev, fromName: e.target.value }))} />
                    </FormControl>
                    <FormControl>
                      <FormLabel>From email</FormLabel>
                      <Input value={emailSettings.fromEmail} onChange={(e) => setEmailSettings((prev) => ({ ...prev, fromEmail: e.target.value }))} />
                    </FormControl>
                  </SimpleGrid>
                  <Textarea placeholder="Notification footer or template" />
                </Stack>
              </CardBody>
            </Card>

            <Card bg="gray.50" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={4}>
                  <HStack justify="space-between">
                    <Heading size="sm">Notification preferences</Heading>
                    <Badge colorScheme="blue">Signals</Badge>
                  </HStack>
                  <Stack spacing={3}>
                    <ToggleRow
                      label="Audit events"
                      description="Receive alerts for high-risk admin activity."
                      isChecked={notifications.audits}
                      onChange={(checked) => setNotifications((prev) => ({ ...prev, audits: checked }))}
                    />
                    <ToggleRow
                      label="Engagement reports"
                      description="Weekly engagement score digests."
                      isChecked={notifications.engagement}
                      onChange={(checked) => setNotifications((prev) => ({ ...prev, engagement: checked }))}
                    />
                    <ToggleRow
                      label="System outages"
                      description="Realtime disruption alerts."
                      isChecked={notifications.outages}
                      onChange={(checked) => setNotifications((prev) => ({ ...prev, outages: checked }))}
                    />
                  </Stack>
                </Stack>
              </CardBody>
            </Card>

            <Card bg="gray.50" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={4}>
                  <HStack justify="space-between">
                    <Heading size="sm">Feature flags</Heading>
                    <Badge colorScheme="green">Experiments</Badge>
                  </HStack>
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                    <ToggleCard
                      title="Beta tools"
                      description="Enable new analytics widgets for admins."
                      icon={<Settings size={16} />}
                      isChecked={featureFlags.betaTools}
                      onChange={(checked) => setFeatureFlags((prev) => ({ ...prev, betaTools: checked }))}
                    />
                    <ToggleCard
                      title="Sandbox mode"
                      description="Route outbound email to QA inboxes."
                      icon={<Mail size={16} />}
                      isChecked={featureFlags.sandboxMode}
                      onChange={(checked) => setFeatureFlags((prev) => ({ ...prev, sandboxMode: checked }))}
                    />
                    <ToggleCard
                      title="Scoring rules v2"
                      description="Use updated engagement scoring engine."
                      icon={<ToggleLeft size={16} />}
                      isChecked={featureFlags.scoringV2}
                      onChange={(checked) => setFeatureFlags((prev) => ({ ...prev, scoringV2: checked }))}
                    />
                  </SimpleGrid>
                </Stack>
              </CardBody>
            </Card>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  )
}

type ToggleRowProps = {
  label: string
  description: string
  isChecked: boolean
  onChange: (checked: boolean) => void
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, isChecked, onChange }) => (
  <Flex justify="space-between" align="center" border="1px solid" borderColor="brand.border" p={3} borderRadius="md" bg="white">
    <Box>
      <Text fontWeight="semibold" color="brand.text">
        {label}
      </Text>
      <Text fontSize="sm" color="brand.subtleText">
        {description}
      </Text>
    </Box>
    <Switch isChecked={isChecked} onChange={(e) => onChange(e.target.checked)} />
  </Flex>
)

type ToggleCardProps = {
  title: string
  description: string
  icon: React.ReactNode
  isChecked: boolean
  onChange: (checked: boolean) => void
}

const ToggleCard: React.FC<ToggleCardProps> = ({ title, description, icon, isChecked, onChange }) => (
  <Box p={4} border="1px solid" borderColor="brand.border" borderRadius="md" bg="white">
    <HStack spacing={3} mb={3}>
      {icon}
      <Heading size="sm">{title}</Heading>
    </HStack>
    <Text fontSize="sm" color="brand.subtleText" mb={3}>
      {description}
    </Text>
    <Switch isChecked={isChecked} onChange={(e) => onChange(e.target.checked)} />
  </Box>
)
