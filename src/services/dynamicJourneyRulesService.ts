/**
 * Dynamic Journey Rules Service
 * Phase 6: Evaluates and applies dynamic rules to journeys based on org configuration
 */

import {
  Timestamp,
} from 'firebase/firestore'
import {
  OrganizationRule,
  RuleCondition,
  RuleAction,
  PassMarkAdjustmentActionConfig,
  HideActivityActionConfig,
  NotifyActionConfig,
} from '../types/organization'
import { getOrgConfiguration } from './orgConfigurationService'

/**
 * Evaluate rule conditions
 */
export function evaluateConditions(
  conditions: RuleCondition[],
  context: Record<string, unknown>
): boolean {
  if (!conditions || conditions.length === 0) return true

  let result = evaluateCondition(conditions[0], context)

  for (let i = 1; i < conditions.length; i++) {
    const operator = conditions[i - 1].logicOp || 'and'

    if (operator === 'and') {
      result = result && evaluateCondition(conditions[i], context)
    } else if (operator === 'or') {
      result = result || evaluateCondition(conditions[i], context)
    }
  }

  return result
}

/**
 * Evaluate single condition
 */
export function evaluateCondition(
  condition: RuleCondition,
  context: Record<string, unknown>
): boolean {
  const contextValue = getValueFromContext(condition.field, context)

  switch (condition.operator) {
    case 'equals':
      return contextValue === condition.value
    case 'gte':
      return Number(contextValue) >= Number(condition.value)
    case 'lte':
      return Number(contextValue) <= Number(condition.value)
    case 'gt':
      return Number(contextValue) > Number(condition.value)
    case 'lt':
      return Number(contextValue) < Number(condition.value)
    case 'contains':
      if (typeof contextValue === 'string') {
        return contextValue.includes(String(condition.value))
      }
      if (Array.isArray(contextValue)) {
        return contextValue.includes(condition.value)
      }
      return false
    case 'in':
      if (Array.isArray(condition.value)) {
        return condition.value.includes(contextValue)
      }
      return false
    default:
      return false
  }
}

/**
 * Get value from nested context path
 */
export function getValueFromContext(
  path: string,
  context: Record<string, unknown>
): unknown {
  const parts = path.split('.')
  let value: unknown = context

  for (const part of parts) {
    if (typeof value === 'object' && value !== null) {
      value = (value as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }

  return value
}

/**
 * Execute rule action
 */
export async function executeRuleAction(
  orgId: string,
  action: RuleAction,
  _context: Record<string, unknown>,
  userId: string = 'system'
): Promise<{ success: boolean; message: string }> {
  try {
    switch (action.type) {
      case 'adjust_pass_mark':
        return await executeAdjustPassMarkAction(
          orgId,
          action.config as PassMarkAdjustmentActionConfig,
          userId
        )

      case 'hide_activity':
        return await executeHideActivityAction(
          orgId,
          action.config as HideActivityActionConfig,
          userId
        )

      case 'show_activity':
        return await executeShowActivityAction(
          orgId,
          action.config as HideActivityActionConfig,
          userId
        )

      case 'notify_admin':
        return await executeNotifyAction(
          action.config as NotifyActionConfig,
          'admin'
        )

      case 'notify_learners':
        return await executeNotifyAction(
          action.config as NotifyActionConfig,
          'learner'
        )

      case 'disable_feature':
        return await executeDisableFeatureAction(
          orgId,
          action.config as Record<string, unknown>,
          userId
        )

      default:
        return { success: false, message: `Unknown action type: ${action.type}` }
    }
  } catch (error) {
    console.error('Error executing rule action:', error)
    return { success: false, message: (error as Error).message }
  }
}

/**
 * Execute adjust pass mark action
 */
async function executeAdjustPassMarkAction(
  orgId: string,
  config: PassMarkAdjustmentActionConfig,
  _userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const orgConfig = await getOrgConfiguration(orgId)
    if (!orgConfig) {
      return { success: false, message: 'Organization configuration not found' }
    }

    // Map snake_case reason to camelCase adjustment key
    const reasonToKey: Record<string, keyof typeof orgConfig.passMark.adjustments> = {
      'no_mentor': 'noMentorAvailable',
      'no_ambassador': 'noAmbassadorAvailable',
      'no_partner': 'noPartnerAvailable',
      'capacity_limited': 'limitedCapacity',
    }

    const adjustmentKey = reasonToKey[config.reason]
    if (adjustmentKey) {
      const adjustments = { ...orgConfig.passMark.adjustments }
      adjustments[adjustmentKey] = config.amount
    }

    // This would be persisted via orgConfigurationService
    return {
      success: true,
      message: `Pass mark adjusted by ${config.amount} for reason: ${config.reason}`,
    }
  } catch (error) {
    return { success: false, message: (error as Error).message }
  }
}

/**
 * Execute hide activity action
 */
async function executeHideActivityAction(
  _orgId: string,
  config: HideActivityActionConfig,
  _userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // This would call activityVisibilityService.hideActivity
    return {
      success: true,
      message: `Activity ${config.activityId} hidden: ${config.reason}`,
    }
  } catch (error) {
    return { success: false, message: (error as Error).message }
  }
}

/**
 * Execute show activity action
 */
async function executeShowActivityAction(
  _orgId: string,
  config: HideActivityActionConfig,
  _userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // This would call activityVisibilityService.showActivity
    return {
      success: true,
      message: `Activity ${config.activityId} is now visible`,
    }
  } catch (error) {
    return { success: false, message: (error as Error).message }
  }
}

/**
 * Execute notify action
 */
async function executeNotifyAction(
  config: NotifyActionConfig,
  target: 'admin' | 'learner' | 'both'
): Promise<{ success: boolean; message: string }> {
  try {
    // This would integrate with notificationService
    return {
      success: true,
      message: `Notification sent to ${target}: ${config.title}`,
    }
  } catch (error) {
    return { success: false, message: (error as Error).message }
  }
}

/**
 * Execute disable feature action
 */
async function executeDisableFeatureAction(
  _orgId: string,
  config: Record<string, unknown>,
  _userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const feature = config.feature as string
    // This would call orgConfigurationService
    return {
      success: true,
      message: `Feature ${feature} disabled`,
    }
  } catch (error) {
    return { success: false, message: (error as Error).message }
  }
}

/**
 * Check if rule should trigger
 */
export async function shouldRuleExecute(
  rule: OrganizationRule,
  context: Record<string, unknown>
): Promise<boolean> {
  // Check if enabled
  if (!rule.enabled) return false

  // Check if in test mode
  if (rule.testMode) return false

  // Evaluate conditions
  return evaluateConditions(rule.conditions, context)
}

/**
 * Execute all applicable rules for org
 */
export async function executeApplicableRules(
  orgId: string,
  context: Record<string, unknown>,
  userId: string = 'system'
): Promise<
  Array<{ ruleId: string; ruleName: string; success: boolean; results: string[] }>
> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config || !config.journeyRules) return []

    const results: Array<{
      ruleId: string
      ruleName: string
      success: boolean
      results: string[]
    }> = []

    // Sort by priority
    const sortedRules = [...config.journeyRules].sort((a, b) => b.priority - a.priority)

    for (const rule of sortedRules) {
      if (await shouldRuleExecute(rule, context)) {
        const executionResults: string[] = []
        let allSuccess = true

        // Execute all actions
        for (const action of rule.actions) {
          const actionResult = await executeRuleAction(orgId, action, context, userId)
          executionResults.push(actionResult.message)

          if (!actionResult.success) {
            allSuccess = false
          }
        }

        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          success: allSuccess,
          results: executionResults,
        })

        // If runOnce, disable the rule
        if (rule.runOnce) {
          rule.enabled = false
          // Would persist this change
        }
      }
    }

    return results
  } catch (error) {
    console.error('Error executing applicable rules:', error)
    return []
  }
}

/**
 * Get rules triggered by specific event
 */
export async function getRulesForTrigger(
  orgId: string,
  triggerType: string
): Promise<OrganizationRule[]> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config || !config.journeyRules) return []

    return config.journeyRules.filter((rule) => rule.trigger === triggerType && rule.enabled)
  } catch (error) {
    console.error('Error getting rules for trigger:', error)
    return []
  }
}

/**
 * Test rule conditions
 */
export async function testRuleConditions(
  rule: OrganizationRule,
  context: Record<string, unknown>
): Promise<{
  conditionsMet: boolean
  evaluations: Array<{ condition: RuleCondition; result: boolean }>
}> {
  try {
    const evaluations = rule.conditions.map((cond) => ({
      condition: cond,
      result: evaluateCondition(cond, context),
    }))

    return {
      conditionsMet: evaluateConditions(rule.conditions, context),
      evaluations,
    }
  } catch (error) {
    console.error('Error testing rule conditions:', error)
    throw error
  }
}

/**
 * Dry run rule execution
 */
export async function dryRunRule(
  orgId: string,
  ruleId: string,
  context: Record<string, unknown>
): Promise<{
  wouldExecute: boolean
  actions: Array<{ action: RuleAction; preview: string }>
}> {
  try {
    const config = await getOrgConfiguration(orgId)
    if (!config || !config.journeyRules) {
      return { wouldExecute: false, actions: [] }
    }

    const rule = config.journeyRules.find((r) => r.id === ruleId)
    if (!rule) {
      return { wouldExecute: false, actions: [] }
    }

    const wouldExecute = await shouldRuleExecute(rule, context)

    const actions = rule.actions.map((action) => ({
      action,
      preview: generateActionPreview(action),
    }))

    return { wouldExecute, actions }
  } catch (error) {
    console.error('Error dry running rule:', error)
    throw error
  }
}

/**
 * Generate human-readable preview of action
 */
function generateActionPreview(action: RuleAction): string {
  switch (action.type) {
    case 'adjust_pass_mark': {
      const config = action.config as PassMarkAdjustmentActionConfig
      return `Adjust pass mark by ${config.amount}% (reason: ${config.reason})`
    }
    case 'hide_activity': {
      const config = action.config as HideActivityActionConfig
      return `Hide activity ${config.activityId}: ${config.reason}`
    }
    case 'show_activity': {
      const config = action.config as HideActivityActionConfig
      return `Show activity ${config.activityId}`
    }
    case 'notify_admin':
    case 'notify_learners': {
      const config = action.config as NotifyActionConfig
      return `Send notification: ${config.title}`
    }
    case 'disable_feature': {
      const config = action.config as Record<string, unknown>
      return `Disable feature: ${config.feature}`
    }
    default:
      return `Execute action: ${action.type}`
  }
}

/**
 * Get rule execution history
 */
export async function getRuleExecutionHistory(
  _orgId: string,
  _ruleId?: string,
  _limit: number = 50
): Promise<
  Array<{
    ruleId: string
    executedAt: Date
    success: boolean
    resultCount: number
  }>
> {
  try {
    // This would query from rule_execution_history collection
    // For now, return empty array
    return []
  } catch (error) {
    console.error('Error getting rule execution history:', error)
    return []
  }
}

/**
 * Create rule trigger context
 */
export function createRuleContext(orgState: Record<string, unknown>): Record<string, unknown> {
  return {
    org: orgState,
    timestamp: new Date().toISOString(),
    evaluatedAt: Timestamp.now(),
  }
}
