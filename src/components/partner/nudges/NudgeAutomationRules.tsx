import React, { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  HStack,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { collection, doc, onSnapshot, query, Timestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'

type RuleTrigger =
  | 'status_change'
  | 'engagement_drop'
  | 'missed_deadline'
  | 'low_score_achieved'
  | 'recovery_detected'
  | 'milestone_achieved'

interface RuleAction {
  type: string
  config?: Record<string, unknown>
}

interface AutomationRuleRow {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger: RuleTrigger | string
  actions: RuleAction[]
  partnerId?: string
  updatedAt?: Date | null
}

const parseDateValue = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'object' && value && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate()
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

const toLabel = (value: string) => value.split('_').map((item) => item.charAt(0).toUpperCase() + item.slice(1)).join(' ')

export const NudgeAutomationRules: React.FC = () => {
  const { user } = useAuth()
  const toast = useToast()
  const [rules, setRules] = useState<AutomationRuleRow[]>([])
  const [templateNameById, setTemplateNameById] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingRuleId, setUpdatingRuleId] = useState<string | null>(null)

  useEffect(() => {
    const rulesCollection = collection(db, 'automation_rules')
    const rulesQuery = user?.uid
      ? query(rulesCollection, where('partnerId', 'in', [user.uid, null]))
      : query(rulesCollection, where('partnerId', '==', null))

    const unsubscribe = onSnapshot(
      rulesQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>
          return {
            id: docSnap.id,
            name: typeof data.name === 'string' ? data.name : 'Untitled rule',
            description: typeof data.description === 'string' ? data.description : '',
            enabled: Boolean(data.enabled),
            trigger: typeof data.trigger === 'string' ? data.trigger : 'status_change',
            actions: Array.isArray(data.actions) ? (data.actions as RuleAction[]) : [],
            partnerId:
              typeof data.partnerId === 'string'
                ? data.partnerId
                : typeof data.partner_id === 'string'
                  ? data.partner_id
                  : undefined,
            updatedAt: parseDateValue(data.updatedAt ?? data.updated_at),
          } as AutomationRuleRow
        })
        const scoped = mapped.filter((rule) => rule.partnerId === undefined || rule.partnerId === user?.uid)
        setRules(scoped)
        setLoading(false)
        setError(null)
      },
      (snapshotError) => {
        setError(snapshotError.message || 'Unable to load automation rules.')
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [user?.uid])

  useEffect(() => {
    const templatesQuery = query(collection(db, 'nudge_templates'))
    const unsubscribe = onSnapshot(
      templatesQuery,
      (snapshot) => {
        const mapping = new Map<string, string>()
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as { name?: string }
          mapping.set(docSnap.id, data.name || docSnap.id)
        })
        setTemplateNameById(mapping)
      },
      () => {
        setTemplateNameById(new Map())
      },
    )

    return () => unsubscribe()
  }, [])

  const activeCount = useMemo(() => rules.filter((rule) => rule.enabled).length, [rules])

  const handleToggleRule = async (rule: AutomationRuleRow) => {
    const next = !rule.enabled
    setUpdatingRuleId(rule.id)
    try {
      await updateDoc(doc(db, 'automation_rules', rule.id), {
        enabled: next,
        updatedAt: Timestamp.now(),
      })
    } catch (toggleError) {
      console.error('Failed to update automation rule state', toggleError)
      const message = toggleError instanceof Error ? toggleError.message : 'Unable to update automation rule.'
      toast({
        title: 'Rule update failed',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setUpdatingRuleId(null)
    }
  }

  if (loading) {
    return (
      <Stack spacing={2}>
        <Text fontSize="sm" color="brand.subtleText">Loading automation rules from Firestore...</Text>
      </Stack>
    )
  }

  if (error) {
    return (
      <Box border="1px solid" borderColor="red.200" borderRadius="md" p={3} bg="red.50">
        <Text fontSize="sm" color="red.700">{error}</Text>
      </Box>
    )
  }

  return (
    <Stack spacing={4}>
      <HStack justify="space-between" align="center" wrap="wrap" spacing={3}>
        <VStack align="flex-start" spacing={0}>
          <Text fontWeight="bold" color="brand.text">Automated nudge rules</Text>
          <Text fontSize="sm" color="brand.subtleText">
            Live configuration from `automation_rules` and `nudge_templates`.
          </Text>
        </VStack>
        <HStack spacing={2}>
          <Badge colorScheme="green">Active: {activeCount}</Badge>
          <Badge colorScheme="gray">Paused: {Math.max(0, rules.length - activeCount)}</Badge>
        </HStack>
      </HStack>

      {rules.length === 0 ? (
        <Box border="1px solid" borderColor="brand.border" borderRadius="md" p={3} bg="brand.accent">
          <Text fontSize="sm" color="brand.subtleText">
            No automation rules found in the `automation_rules` collection for your scope.
          </Text>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
          {rules.map((rule) => {
            const nudgeTemplateIds = rule.actions
              .map((action) => action.config?.nudgeTemplateId)
              .filter((value): value is string => typeof value === 'string')
            const templateLabels = nudgeTemplateIds.map((templateId) => templateNameById.get(templateId) || templateId)
            const lastUpdated = rule.updatedAt ? rule.updatedAt.toLocaleString() : 'Unknown'

            return (
              <Box key={rule.id} border="1px solid" borderColor="brand.border" borderRadius="lg" p={4} bg="white">
                <Stack spacing={3}>
                  <HStack justify="space-between" align="center">
                    <VStack align="flex-start" spacing={0}>
                      <Text fontWeight="semibold" color="brand.text">{rule.name}</Text>
                      <Text fontSize="xs" color="brand.subtleText">Trigger: {toLabel(rule.trigger)}</Text>
                    </VStack>
                    <Switch
                      isChecked={rule.enabled}
                      isDisabled={updatingRuleId === rule.id}
                      onChange={() => void handleToggleRule(rule)}
                      colorScheme="purple"
                    />
                  </HStack>

                  {rule.description ? (
                    <Text fontSize="sm" color="brand.subtleText">{rule.description}</Text>
                  ) : null}

                  <HStack spacing={2} wrap="wrap">
                    <Badge colorScheme={rule.enabled ? 'green' : 'gray'}>
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <Badge colorScheme="purple">Actions: {rule.actions.length}</Badge>
                    <Badge colorScheme="blue">Updated: {lastUpdated}</Badge>
                  </HStack>

                  <Box>
                    <Text fontSize="xs" color="brand.subtleText" mb={1}>Assigned nudge templates</Text>
                    {templateLabels.length ? (
                      <HStack spacing={2} wrap="wrap">
                        {templateLabels.map((label) => (
                          <Badge key={`${rule.id}-${label}`} colorScheme="purple">{label}</Badge>
                        ))}
                      </HStack>
                    ) : (
                      <Text fontSize="xs" color="brand.subtleText">No nudge template is linked to this rule.</Text>
                    )}
                  </Box>
                </Stack>
              </Box>
            )
          })}
        </SimpleGrid>
      )}
    </Stack>
  )
}

export default NudgeAutomationRules
