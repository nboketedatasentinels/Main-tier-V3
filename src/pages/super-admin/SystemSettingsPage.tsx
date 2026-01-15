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
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
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
  const [passMarkSettings, setPassMarkSettings] = useState({
    baseMark: 72,
    adjustment: 4,
    autoAdjust: true,
    recentAverage: 76,
    floor: 60,
    ceiling: 95,
  })

  const resolvedAdjustment = passMarkSettings.autoAdjust
    ? Math.round((passMarkSettings.recentAverage - passMarkSettings.baseMark) / 4)
    : passMarkSettings.adjustment

  const effectivePassMark = Math.min(
    passMarkSettings.ceiling,
    Math.max(passMarkSettings.floor, passMarkSettings.baseMark + resolvedAdjustment),
  )

  const handleSave = () => {
    toast({ title: 'Settings saved', status: 'success' })
  }

  const handleReset = () => {
    setEmailSettings({ fromName: 'Super Admin', fromEmail: 'no-reply@example.com' })
    setNotifications({ audits: true, engagement: true, outages: false })
    setFeatureFlags({ betaTools: true, sandboxMode: false, scoringV2: true })
    setPassMarkSettings({
      baseMark: 72,
      adjustment: 4,
      autoAdjust: true,
      recentAverage: 76,
      floor: 60,
      ceiling: 95,
    })
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

            <Card bg="gray.50" border="1px solid" borderColor="brand.border">
              <CardBody>
                <Stack spacing={4}>
                  <HStack justify="space-between">
                    <Heading size="sm">Dynamic pass mark adjustment</Heading>
                    <Badge colorScheme="purple">Learning</Badge>
                  </HStack>
                  <Text color="brand.subtleText">
                    Adjust assessment pass marks automatically based on recent cohort performance. Manual overrides are used when auto-adjust is off.
                  </Text>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel>Base pass mark (%)</FormLabel>
                      <NumberInput
                        value={passMarkSettings.baseMark}
                        min={50}
                        max={100}
                        onChange={(_, value) => setPassMarkSettings((prev) => ({ ...prev, baseMark: value }))}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Recent cohort average (%)</FormLabel>
                      <NumberInput
                        value={passMarkSettings.recentAverage}
                        min={50}
                        max={100}
                        onChange={(_, value) => setPassMarkSettings((prev) => ({ ...prev, recentAverage: value }))}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Manual adjustment (%)</FormLabel>
                      <NumberInput
                        value={passMarkSettings.adjustment}
                        min={-10}
                        max={10}
                        onChange={(_, value) => setPassMarkSettings((prev) => ({ ...prev, adjustment: value }))}
                        isDisabled={passMarkSettings.autoAdjust}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Auto-adjust</FormLabel>
                      <Switch
                        isChecked={passMarkSettings.autoAdjust}
                        onChange={(e) => setPassMarkSettings((prev) => ({ ...prev, autoAdjust: e.target.checked }))}
                      />
                    </FormControl>
                  </SimpleGrid>

                  <Card bg="white" border="1px solid" borderColor="brand.border">
                    <CardBody>
                      <Stack spacing={2}>
                        <Text fontWeight="semibold" color="brand.text">
                          Current pass mark
                        </Text>
                        <HStack spacing={3}>
                          <Heading size="md">{effectivePassMark}%</Heading>
                          <Badge colorScheme={effectivePassMark >= passMarkSettings.baseMark ? 'green' : 'yellow'}>
                            {resolvedAdjustment >= 0 ? '+' : ''}
                            {resolvedAdjustment}% adjustment
                          </Badge>
                        </HStack>
                        <Text fontSize="sm" color="brand.subtleText">
                          {passMarkSettings.autoAdjust
                            ? `Auto-adjusted using a recent cohort average of ${passMarkSettings.recentAverage}%.`
                            : 'Manual override applied. Turn on auto-adjust to follow cohort trends.'}
                        </Text>
                      </Stack>
                    </CardBody>
                  </Card>
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
