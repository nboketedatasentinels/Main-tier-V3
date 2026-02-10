import React, { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Select,
  Stack,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react'
import type { NudgeChannel, NudgeTemplateRecord } from '@/types/nudges'

interface SelectedUser {
  id: string
  name: string
  email: string
  riskLevel: string
  lastActive: string
  engagementScore: number
}

interface SendNudgeModalProps {
  isOpen: boolean
  onClose: () => void
  users: SelectedUser[]
  templates: NudgeTemplateRecord[]
  onConfirm: (
    payload: { templateId: string; channel: NudgeChannel; message: string; scheduleAt?: string }
  ) => Promise<{ success: number; failed: number } | void>
}

const steps = ['Review users', 'Select template', 'Delivery', 'Schedule']

export const SendNudgeModal: React.FC<SendNudgeModalProps> = ({ isOpen, onClose, users, templates, onConfirm }) => {
  const [step, setStep] = useState(0)
  const [templateId, setTemplateId] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [channel, setChannel] = useState<NudgeChannel>('email')
  const [scheduleAt, setScheduleAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null)

  const activeTemplate = useMemo(() => templates.find((template) => template.id === templateId), [templates, templateId])

  const previewMessage = useMemo(() => {
    const base = customMessage || activeTemplate?.message_body || ''
    const sample = users[0]
    if (!sample) return base

    return base
      .replace(/{{\s*userName\s*}}/g, sample.name)
      .replace(/{{\s*organizationName\s*}}/g, 'Summit Labs')
      .replace(/{{\s*daysInactive\s*}}/g, '7')
      .replace(/{{\s*engagementScore\s*}}/g, `${sample.engagementScore}`)
  }, [activeTemplate?.message_body, customMessage, users])

  const goNext = () => setStep((prev) => Math.min(prev + 1, steps.length - 1))
  const goBack = () => setStep((prev) => Math.max(prev - 1, 0))

  const handleConfirm = async () => {
    if (!templateId) {
      setError('Select a template before sending.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const summary = await onConfirm({
        templateId,
        channel,
        message: customMessage || activeTemplate?.message_body || '',
        scheduleAt: scheduleAt || undefined,
      })
      setResult(summary ?? { success: users.length, failed: 0 })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send nudges'
      setResult({ success: 0, failed: users.length })
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const renderStep = () => {
    if (step === 0) {
      return (
        <Stack spacing={3}>
          <Text fontWeight="semibold">Selected users</Text>
          {users.map((user) => (
            <HStack key={user.id} justify="space-between" border="1px solid" borderColor="brand.border" p={3} borderRadius="md">
              <VStack align="flex-start" spacing={0}>
                <Text fontWeight="medium">{user.name}</Text>
                <Text fontSize="sm" color="brand.subtleText">{user.email}</Text>
              </VStack>
              <Badge colorScheme={user.riskLevel === 'critical' ? 'red' : user.riskLevel === 'concern' ? 'orange' : 'yellow'}>
                {user.riskLevel}
              </Badge>
            </HStack>
          ))}
        </Stack>
      )
    }

    if (step === 1) {
      return (
        <Stack spacing={4}>
          <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)} placeholder="Select template">
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.template_type})
              </option>
            ))}
          </Select>
          <Textarea
            rows={6}
            value={customMessage}
            onChange={(event) => setCustomMessage(event.target.value)}
            placeholder="Customize message (optional)"
          />
          <Box border="1px solid" borderColor="brand.border" p={3} borderRadius="md" bg="brand.accent">
            <Text fontWeight="semibold" mb={2}>
              Preview
            </Text>
            <Text fontSize="sm" color="brand.subtleText" whiteSpace="pre-wrap">
              {previewMessage || 'Select a template to preview the message.'}
            </Text>
          </Box>
        </Stack>
      )
    }

    if (step === 2) {
      return (
        <Stack spacing={4}>
          <Text fontWeight="semibold">Delivery channel</Text>
          <Select value={channel} onChange={(event) => setChannel(event.target.value as NudgeChannel)}>
            <option value="email">Email</option>
            <option value="in_app">In-app notification</option>
            <option value="both">Email + In-app</option>
          </Select>
          <Text fontSize="sm" color="brand.subtleText">
            Choose how recipients should receive the nudge. Email + in-app is recommended for critical risk.
          </Text>
        </Stack>
      )
    }

    return (
      <Stack spacing={4}>
        <Text fontWeight="semibold">Schedule send</Text>
        <Textarea
          rows={2}
          value={scheduleAt}
          onChange={(event) => setScheduleAt(event.target.value)}
          placeholder="Optional: e.g. 2024-05-12 09:00"
        />
        <Text fontSize="sm" color="brand.subtleText">
          Leave blank to send immediately. Scheduled sends will queue in the automated job runner.
        </Text>
      </Stack>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Send nudge</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <HStack justify="space-between">
              <Text fontSize="sm" color="brand.subtleText">Step {step + 1} of {steps.length}</Text>
              <Badge colorScheme="purple">{users.length} users</Badge>
            </HStack>
            <Progress value={((step + 1) / steps.length) * 100} colorScheme="purple" />
            {renderStep()}
            {error ? <Text color="red.500" fontSize="sm">{error}</Text> : null}
            {result ? (
              <Box border="1px solid" borderColor="brand.border" p={3} borderRadius="md" bg="green.50">
                <Text fontWeight="semibold">Send summary</Text>
                <Text fontSize="sm" color="brand.subtleText">
                  Success: {result.success} · Failed: {result.failed}
                </Text>
              </Box>
            ) : null}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button variant="outline" onClick={goBack} isDisabled={step === 0}>
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button colorScheme="purple" onClick={goNext}>
                Next
              </Button>
            ) : (
              <Button colorScheme="purple" onClick={handleConfirm} isLoading={loading}>
                Send nudges
              </Button>
            )}
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default SendNudgeModal
