import React, { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  Divider,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import type { PartnerUser } from '@/hooks/usePartnerDashboardData'
import type { NudgeTemplateRecord } from '@/types/nudges'
import SendNudgeModal from './SendNudgeModal'

interface NudgeControlPanelProps {
  users: PartnerUser[]
  templates: NudgeTemplateRecord[]
}

const riskColor: Record<string, string> = {
  critical: 'red',
  concern: 'orange',
  watch: 'yellow',
  at_risk: 'red',
}

export const NudgeControlPanel: React.FC<NudgeControlPanelProps> = ({ users, templates }) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [riskFilters, setRiskFilters] = useState<string[]>(['critical', 'concern', 'watch', 'at_risk'])
  const [templateId, setTemplateId] = useState('')
  const [dateRange, setDateRange] = useState('')
  const modal = useDisclosure()
  const toast = useToast()

  const filteredUsers = useMemo(() => {
    return users.filter((user) => riskFilters.includes(user.riskStatus))
  }, [riskFilters, users])

  const selectedList = useMemo(() => filteredUsers.filter((user) => selectedUsers.includes(user.id)), [filteredUsers, selectedUsers])

  const handleToggleUser = (userId: string) => {
    setSelectedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  const handleSend = async () => {
    if (!selectedUsers.length) {
      toast({ title: 'Select at least one user', status: 'warning', duration: 3000 })
      return
    }
    if (!templateId) {
      toast({ title: 'Select a template', status: 'warning', duration: 3000 })
      return
    }
    modal.onOpen()
  }

  return (
    <Stack spacing={6}>
      <HStack justify="space-between" align="center">
        <VStack align="flex-start" spacing={1}>
          <Text fontWeight="bold" color="brand.text">Nudge control panel</Text>
          <Text fontSize="sm" color="brand.subtleText">
            Select at-risk users and send targeted outreach.
          </Text>
        </VStack>
        <Badge colorScheme="purple">{filteredUsers.length} at-risk</Badge>
      </HStack>

      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
        <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
          <Stack spacing={3}>
            <Text fontWeight="semibold">Filters</Text>
            <Stack spacing={2}>
              <Text fontSize="sm" color="brand.subtleText">Risk level</Text>
              <CheckboxGroup value={riskFilters} onChange={(values) => setRiskFilters(values as string[])}>
                <Stack spacing={1}>
                  <Checkbox value="critical">Critical</Checkbox>
                  <Checkbox value="concern">High</Checkbox>
                  <Checkbox value="watch">Moderate</Checkbox>
                  <Checkbox value="at_risk">Legacy at-risk</Checkbox>
                </Stack>
              </CheckboxGroup>
            </Stack>
            <Stack spacing={2}>
              <Text fontSize="sm" color="brand.subtleText">Inactive range</Text>
              <Input
                value={dateRange}
                onChange={(event) => setDateRange(event.target.value)}
                placeholder="e.g. 7-30 days"
              />
            </Stack>
          </Stack>
        </Box>

        <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
          <Stack spacing={3}>
            <Text fontWeight="semibold">Bulk actions</Text>
            <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)} placeholder="Select template">
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </Select>
            <Button colorScheme="purple" onClick={handleSend}>
              Preview & send
            </Button>
            <Divider />
            <Stack spacing={1}>
              <Text fontSize="sm" color="brand.subtleText">Selected users</Text>
              <Text fontWeight="bold" color="brand.text">{selectedUsers.length}</Text>
              <Text fontSize="xs" color="brand.subtleText">Estimated reach based on filters</Text>
            </Stack>
          </Stack>
        </Box>

        <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
          <Stack spacing={3}>
            <Text fontWeight="semibold">Delivery summary</Text>
            <Text fontSize="sm" color="brand.subtleText">
              {templateId
                ? `Template selected: ${templates.find((template) => template.id === templateId)?.name ?? 'Unknown'}`
                : 'Choose a template to see summary'}
            </Text>
            <Text fontSize="sm" color="brand.subtleText">Filters: {riskFilters.join(', ') || 'None'}</Text>
            <Text fontSize="sm" color="brand.subtleText">Inactive range: {dateRange || 'Not set'}</Text>
            <Badge colorScheme="green">Ready to send</Badge>
          </Stack>
        </Box>
      </SimpleGrid>

      <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
        <Stack spacing={4}>
          <HStack justify="space-between" align="center">
            <Text fontWeight="semibold">At-risk roster</Text>
            <Badge colorScheme="orange">{filteredUsers.length} users</Badge>
          </HStack>
          <Box border="1px dashed" borderColor="brand.border" borderRadius="md" p={3} bg="brand.accent">
            <Text fontSize="sm" fontWeight="semibold" color="brand.text">
              Smart suggestions
            </Text>
            <Text fontSize="sm" color="brand.subtleText">
              Prioritize nudges for users with the longest inactivity streaks or critical risk status.
            </Text>
          </Box>
          <Stack spacing={3}>
            {filteredUsers.map((user) => (
              <HStack key={user.id} justify="space-between" border="1px solid" borderColor="brand.border" p={3} borderRadius="md">
                <HStack spacing={3}>
                  <Checkbox isChecked={selectedUsers.includes(user.id)} onChange={() => handleToggleUser(user.id)} />
                  <VStack align="flex-start" spacing={0}>
                    <Text fontWeight="semibold">{user.name}</Text>
                    <Text fontSize="sm" color="brand.subtleText">
                      {user.companyCode} · Last active {user.lastActive}
                    </Text>
                  </VStack>
                </HStack>
                <HStack spacing={3}>
                  <Badge colorScheme={riskColor[user.riskStatus] || 'yellow'}>{user.riskStatus}</Badge>
                  <Text fontSize="sm" color="brand.subtleText">Engagement {user.progressPercent}%</Text>
                </HStack>
              </HStack>
            ))}
          </Stack>
        </Stack>
      </Box>

      <SendNudgeModal
        isOpen={modal.isOpen}
        onClose={modal.onClose}
        users={selectedList.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          riskLevel: user.riskStatus,
          lastActive: user.lastActive,
          engagementScore: user.progressPercent,
        }))}
        templates={templates}
        onConfirm={async () => {
          toast({ title: 'Nudges queued', status: 'success', duration: 3000 })
          modal.onClose()
          return { success: selectedList.length, failed: 0 }
        }}
      />
    </Stack>
  )
}

export default NudgeControlPanel
