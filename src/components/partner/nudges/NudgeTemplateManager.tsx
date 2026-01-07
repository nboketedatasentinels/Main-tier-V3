import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react'
import { createNudgeTemplate } from '@/services/boltClient'
import { getAllNudgeTemplates, toggleTemplateStatus } from '@/services/nudgeService'
import type { NudgeTemplateCategory, NudgeTemplateRecord } from '@/types/nudges'

const categories: NudgeTemplateCategory[] = [
  'Initial Outreach',
  'Follow-up',
  'Critical Alert',
  'Encouragement',
  'Resource Sharing',
]

const placeholderVariables = ['{{userName}}', '{{organizationName}}', '{{daysInactive}}', '{{engagementScore}}']

const defaultTemplate: Omit<NudgeTemplateRecord, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  subject: '',
  message_body: '',
  template_type: 'Initial Outreach',
  target_audience: 'At-risk learners',
  is_active: true,
}

export const NudgeTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<NudgeTemplateRecord[]>([])
  const [draft, setDraft] = useState(defaultTemplate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadTemplates = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getAllNudgeTemplates()
        setTemplates(data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load templates'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void loadTemplates()
  }, [])

  const preview = useMemo(() => {
    return draft.message_body
      .replace(/{{\s*userName\s*}}/g, 'Jordan')
      .replace(/{{\s*organizationName\s*}}/g, 'Summit Labs')
      .replace(/{{\s*daysInactive\s*}}/g, '12')
      .replace(/{{\s*engagementScore\s*}}/g, '42')
  }, [draft.message_body])

  const handleCreate = async () => {
    setLoading(true)
    setError(null)
    try {
      const created = await createNudgeTemplate(draft)
      setTemplates((prev) => [created, ...prev])
      setDraft(defaultTemplate)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save template'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (template: NudgeTemplateRecord) => {
    const nextStatus = !template.is_active
    setTemplates((prev) => prev.map((item) => (item.id === template.id ? { ...item, is_active: nextStatus } : item)))
    try {
      await toggleTemplateStatus(template.id, nextStatus)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update status'
      setError(message)
      setTemplates((prev) => prev.map((item) => (item.id === template.id ? template : item)))
    }
  }

  return (
    <Stack spacing={6}>
      <HStack justify="space-between" align="center">
        <VStack align="flex-start" spacing={1}>
          <Text fontWeight="bold" color="brand.text">Nudge templates</Text>
          <Text fontSize="sm" color="brand.subtleText">
            Build reusable nudges with placeholders for personalization.
          </Text>
        </VStack>
        <Badge colorScheme="purple">{templates.length} templates</Badge>
      </HStack>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
          <Stack spacing={4}>
            <Text fontWeight="semibold" color="brand.text">Create new template</Text>
            <FormControl>
              <FormLabel>Name</FormLabel>
              <Input
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Initial outreach reminder"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Category</FormLabel>
              <Select
                value={draft.template_type}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, template_type: event.target.value as NudgeTemplateCategory }))
                }
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Subject</FormLabel>
              <Input
                value={draft.subject}
                onChange={(event) => setDraft((prev) => ({ ...prev, subject: event.target.value }))}
                placeholder="We miss you at {{organizationName}}"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Message body (rich text supported)</FormLabel>
              <Textarea
                rows={6}
                value={draft.message_body}
                onChange={(event) => setDraft((prev) => ({ ...prev, message_body: event.target.value }))}
                placeholder="Hi {{userName}}, you've been inactive for {{daysInactive}} days..."
              />
              <Text fontSize="xs" color="brand.subtleText" mt={2}>
                Available variables: {placeholderVariables.join(', ')}
              </Text>
            </FormControl>
            <FormControl>
              <FormLabel>Target audience</FormLabel>
              <Input
                value={draft.target_audience ?? ''}
                onChange={(event) => setDraft((prev) => ({ ...prev, target_audience: event.target.value }))}
                placeholder="At-risk learners"
              />
            </FormControl>
            <Button colorScheme="purple" onClick={handleCreate} isLoading={loading}>
              Save template
            </Button>
            {error ? <Text color="red.500" fontSize="sm">{error}</Text> : null}
          </Stack>
        </Box>

        <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
          <Stack spacing={4}>
            <Text fontWeight="semibold" color="brand.text">Template preview</Text>
            <Box border="1px solid" borderColor="brand.border" borderRadius="md" p={4} bg="brand.accent">
              <Text fontWeight="semibold" color="brand.text">{draft.subject || 'Subject preview'}</Text>
              <Divider my={3} />
              <Text color="brand.subtleText" whiteSpace="pre-wrap">
                {preview || 'Compose a message to preview personalization.'}
              </Text>
            </Box>
            <Text fontSize="sm" color="brand.subtleText">
              Preview replaces placeholders with sample values for easy review.
            </Text>
          </Stack>
        </Box>
      </SimpleGrid>

      <Box border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
        <Stack spacing={4}>
          <HStack justify="space-between" align="center">
            <Text fontWeight="semibold" color="brand.text">Existing templates</Text>
            <Text fontSize="sm" color="brand.subtleText">{loading ? 'Loading…' : 'Manage activation status'}</Text>
          </HStack>
          <Stack spacing={3}>
            {templates.map((template) => (
              <Box key={template.id} p={3} borderRadius="md" border="1px solid" borderColor="brand.border">
                <HStack justify="space-between" align={{ base: 'flex-start', md: 'center' }} spacing={4}>
                  <VStack align="flex-start" spacing={0}>
                    <Text fontWeight="semibold" color="brand.text">{template.name}</Text>
                    <Text fontSize="sm" color="brand.subtleText">{template.template_type}</Text>
                    <Text fontSize="xs" color="brand.subtleText">Target: {template.target_audience || 'All'}</Text>
                  </VStack>
                  <HStack spacing={3}>
                    <Badge colorScheme={template.is_active ? 'green' : 'gray'}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Switch
                      isChecked={template.is_active}
                      onChange={() => handleToggle(template)}
                      colorScheme="purple"
                    />
                  </HStack>
                </HStack>
              </Box>
            ))}
            {!templates.length && !loading ? (
              <Text fontSize="sm" color="brand.subtleText">No templates yet. Create your first nudge template.</Text>
            ) : null}
          </Stack>
        </Stack>
      </Box>
    </Stack>
  )
}

export default NudgeTemplateManager
