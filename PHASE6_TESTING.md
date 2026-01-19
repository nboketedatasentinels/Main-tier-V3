# Phase 6: Testing Strategy & Test Cases

## Testing Overview

Phase 6 requires comprehensive testing across:
1. **Unit Tests** (30+ cases) - Individual functions
2. **Integration Tests** (20+ cases) - Service interactions
3. **Admin Workflow Tests** (10+ cases) - UI functionality
4. **End-to-End Tests** (10+ cases) - Real learner scenarios

**Estimated Coverage:** 85%+

---

## Unit Tests (30+ cases)

### Organization Configuration Service (8 tests)

```typescript
describe('orgConfigurationService', () => {
  describe('getOrgConfiguration', () => {
    it('should return org configuration', async () => {
      const config = await getOrgConfiguration('org-123')
      expect(config).toBeDefined()
      expect(config?.orgId).toBe('org-123')
    })

    it('should return default config if not found', async () => {
      const config = await getOrgConfiguration('nonexistent')
      expect(config?.passMark.basePassMark).toBe(70)
    })
  })

  describe('updateOrgLeadership', () => {
    it('should update leadership', async () => {
      await updateOrgLeadership('org-123', {
        hasMentor: true,
        mentorCapacity: 10,
      }, 'user-1')

      const config = await getOrgConfiguration('org-123')
      expect(config?.leadership.hasMentor).toBe(true)
      expect(config?.leadership.mentorCapacity).toBe(10)
    })

    it('should record configuration change', async () => {
      await updateOrgLeadership('org-123', {
        hasMentor: true,
      }, 'user-1')

      const history = await getConfigurationChangeHistory('org-123', 1)
      expect(history.length).toBeGreaterThan(0)
    })
  })

  describe('getPassMarkAdjustments', () => {
    it('should return pass mark adjustments', async () => {
      const adjustments = await getPassMarkAdjustments('org-123')
      expect(adjustments.base).toBe(70)
      expect(adjustments.adjustments.noMentorAvailable).toBe(-10)
    })
  })

  describe('validateOrgConfiguration', () => {
    it('should validate configuration', async () => {
      const result = await validateOrgConfiguration('org-123')
      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should catch invalid pass marks', async () => {
      // Setup invalid config
      const result = await validateOrgConfiguration('invalid-org')
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
```

### Leadership Service (6 tests)

```typescript
describe('leadershipService', () => {
  describe('getLeadershipRoster', () => {
    it('should return leadership roster', async () => {
      const roster = await getLeadershipRoster('org-123')
      expect(Array.isArray(roster)).toBe(true)
    })

    it('should include mentor, ambassador, partner roles', async () => {
      const roster = await getLeadershipRoster('org-123')
      const roles = roster.map(l => l.role)
      expect(roles).toContain('mentor')
    })
  })

  describe('isLeadershipAvailable', () => {
    it('should return true if mentor available', async () => {
      // Setup
      await updateOrgLeadership('org-123', { hasMentor: true }, 'user-1')

      const available = await isLeadershipAvailable('org-123', 'mentor')
      expect(available).toBe(true)
    })

    it('should return false if mentor unavailable', async () => {
      // Setup
      await updateOrgLeadership('org-123', { hasMentor: false }, 'user-1')

      const available = await isLeadershipAvailable('org-123', 'mentor')
      expect(available).toBe(false)
    })
  })

  describe('leadershipHasCapacity', () => {
    it('should check mentor capacity', async () => {
      const hasCapacity = await leadershipHasCapacity('org-123', 'mentor')
      expect(typeof hasCapacity).toBe('boolean')
    })
  })

  describe('updateLeadershipUtilization', () => {
    it('should update utilization', async () => {
      await updateLeadershipUtilization('org-123', 'mentor', 75, 'user-1')

      const stats = await getLeadershipStats('org-123')
      expect(stats.mentorUtilization).toBe(75)
    })

    it('should reject invalid utilization', async () => {
      await expect(
        updateLeadershipUtilization('org-123', 'mentor', 150, 'user-1')
      ).rejects.toThrow()
    })
  })

  describe('getLeadershipStats', () => {
    it('should return leadership statistics', async () => {
      const stats = await getLeadershipStats('org-123')
      expect(stats.activeLeaders).toBeGreaterThanOrEqual(0)
      expect(stats.mentorUtilization).toBeDefined()
    })
  })
})
```

### Activity Visibility Service (6 tests)

```typescript
describe('activityVisibilityService', () => {
  describe('isActivityVisible', () => {
    it('should return visible for available activities', async () => {
      const result = await isActivityVisible('org-123', 'activity-1')
      expect(result.visible).toBe(true)
      expect(result.reason).toBe('available')
    })

    it('should return hidden if mentor unavailable', async () => {
      // Setup activity that requires mentor
      // Setup org without mentor
      const result = await isActivityVisible('org-123', 'activity-mentor')
      expect(result.visible).toBe(false)
      expect(result.reason).toBe('leadership_unavailable')
    })
  })

  describe('hideActivity', () => {
    it('should hide activity with reason', async () => {
      await hideActivity('org-123', 'activity-1', 'Maintenance', undefined, 'user-1')

      const result = await isActivityVisible('org-123', 'activity-1')
      expect(result.visible).toBe(false)
    })
  })

  describe('showActivity', () => {
    it('should make activity visible', async () => {
      await hideActivity('org-123', 'activity-1', 'Test', undefined, 'user-1')
      await showActivity('org-123', 'activity-1', 'user-1')

      const result = await isActivityVisible('org-123', 'activity-1')
      expect(result.visible).toBe(true)
    })
  })

  describe('getActivityVisibilitySummary', () => {
    it('should return visibility summary', async () => {
      const summary = await getActivityVisibilitySummary('org-123')
      expect(summary.total).toBeGreaterThanOrEqual(0)
      expect(summary.visible).toBeGreaterThanOrEqual(0)
      expect(summary.hidden).toBeGreaterThanOrEqual(0)
    })
  })

  describe('canLearnerCompleteActivity', () => {
    it('should allow completion for visible activities', async () => {
      const result = await canLearnerCompleteActivity(
        'org-123',
        'learner-1',
        'activity-1',
        'window-1'
      )
      expect(result.canComplete).toBe(true)
    })

    it('should prevent completion for hidden activities', async () => {
      await hideActivity('org-123', 'activity-1', 'Test', undefined, 'user-1')

      const result = await canLearnerCompleteActivity(
        'org-123',
        'learner-1',
        'activity-1',
        'window-1'
      )
      expect(result.canComplete).toBe(false)
    })
  })
})
```

### Dynamic Pass Mark Service (6 tests)

```typescript
describe('dynamicPassMarkService', () => {
  describe('calculateLearnerPassMark', () => {
    it('should return base pass mark by default', async () => {
      const result = await calculateLearnerPassMark('org-123', 'learner-1', 'window-1')
      expect(result.passmark).toBe(70)
      expect(result.adjustments.length).toBe(0)
    })

    it('should reduce pass mark if no mentor', async () => {
      // Setup org without mentor
      await updateOrgLeadership('org-123', { hasMentor: false }, 'user-1')

      const result = await calculateLearnerPassMark('org-123', 'learner-1', 'window-1')
      expect(result.passmark).toBe(60) // 70 - 10
      expect(result.adjustments[0].reason).toBe('no_mentor')
    })

    it('should not reduce below minimum', async () => {
      // Setup org without mentor and ambassador
      const result = await calculateLearnerPassMark('org-123', 'learner-1', 'window-1')
      expect(result.passmark).toBeGreaterThanOrEqual(50) // minimum
    })
  })

  describe('generatePassMarkExplanation', () => {
    it('should generate clear explanation', () => {
      const explanation = generatePassMarkExplanation(
        70,
        60,
        [{ reason: 'no_mentor', amount: -10 }]
      )
      expect(explanation).toContain('60%')
      expect(explanation).toContain('mentorship')
    })
  })

  describe('getLearnerPassMarkInfo', () => {
    it('should return learner pass mark info', async () => {
      const info = await getLearnerPassMarkInfo('org-123', 'learner-1', 'window-1')
      expect(info.passmark).toBeDefined()
      expect(info.basePassmark).toBe(70)
      expect(Array.isArray(info.visibleActivities)).toBe(true)
    })
  })

  describe('getPassMarkStatistics', () => {
    it('should return org pass mark statistics', async () => {
      const stats = await getPassMarkStatistics('org-123')
      expect(stats.avgBasePassmark).toBe(70)
      expect(stats.learnersAffected).toBeGreaterThanOrEqual(0)
    })
  })

  describe('recalculateWindowPassMarks', () => {
    it('should recalculate pass marks for learners', async () => {
      const updated = await recalculateWindowPassMarks(
        'org-123',
        'window-1',
        ['learner-1', 'learner-2'],
        'user-1'
      )
      expect(updated).toBe(2)
    })
  })
})
```

### Dynamic Journey Rules Service (4 tests)

```typescript
describe('dynamicJourneyRulesService', () => {
  describe('evaluateConditions', () => {
    it('should evaluate AND conditions', () => {
      const conditions = [
        { field: 'org.leadership.hasMentor', operator: 'equals' as const, value: true },
        { field: 'org.leadership.hasAmbassador', operator: 'equals' as const, value: false, logicOp: 'and' as const },
      ]
      const context = { org: { leadership: { hasMentor: true, hasAmbassador: false } } }

      const result = evaluateConditions(conditions, context)
      expect(result).toBe(true)
    })

    it('should evaluate OR conditions', () => {
      const conditions = [
        { field: 'org.status', operator: 'equals' as const, value: 'inactive' },
        { field: 'org.leadership.hasMentor', operator: 'equals' as const, value: false, logicOp: 'or' as const },
      ]
      const context = { org: { status: 'active', leadership: { hasMentor: false } } }

      const result = evaluateConditions(conditions, context)
      expect(result).toBe(true)
    })
  })

  describe('evaluateCondition', () => {
    it('should evaluate equals operator', () => {
      const condition = { field: 'name', operator: 'equals' as const, value: 'test' }
      expect(evaluateCondition(condition, { name: 'test' })).toBe(true)
      expect(evaluateCondition(condition, { name: 'other' })).toBe(false)
    })

    it('should evaluate gte operator', () => {
      const condition = { field: 'count', operator: 'gte' as const, value: 5 }
      expect(evaluateCondition(condition, { count: 5 })).toBe(true)
      expect(evaluateCondition(condition, { count: 4 })).toBe(false)
    })
  })

  describe('testRuleConditions', () => {
    it('should test rule conditions', async () => {
      const rule = {
        id: 'rule-1',
        name: 'Test Rule',
        conditions: [{ field: 'org.leadership.hasMentor', operator: 'equals' as const, value: true }],
        actions: [],
        trigger: 'org_status_change' as const,
        enabled: true,
        priority: 1,
      } as any

      const result = await testRuleConditions(rule, {
        org: { leadership: { hasMentor: true } },
      })
      expect(result.conditionsMet).toBe(true)
    })
  })

  describe('dryRunRule', () => {
    it('should preview rule execution', async () => {
      // Setup test rule
      const result = await dryRunRule('org-123', 'rule-1', {
        org: { leadership: { hasMentor: true } },
      })
      expect(result.wouldExecute).toBe(true)
      expect(result.actions).toBeDefined()
    })
  })
})
```

---

## Integration Tests (20+ cases)

### Leadership Impact on Activities (5 tests)

```typescript
describe('Leadership Impact Integration', () => {
  beforeEach(async () => {
    // Setup test org
    await setupTestOrg('org-test')
  })

  it('should hide mentor-dependent activities when mentor unavailable', async () => {
    // Setup
    await updateOrgLeadership('org-test', { hasMentor: true }, 'user-1')
    expect(await isActivityVisible('org-test', 'mentor-activity')).toEqual(
      expect.objectContaining({ visible: true })
    )

    // Act
    await updateOrgLeadership('org-test', { hasMentor: false }, 'user-1')

    // Assert
    expect(await isActivityVisible('org-test', 'mentor-activity')).toEqual(
      expect.objectContaining({ visible: false })
    )
  })

  it('should update all learner pass marks when mentor unavailable', async () => {
    // Setup 3 learners
    const learnerIds = ['learner-1', 'learner-2', 'learner-3']
    for (const id of learnerIds) {
      await createTestLearner('org-test', id)
    }

    // Act
    await updateOrgLeadership('org-test', { hasMentor: false }, 'user-1')

    // Assert - all learners' pass marks reduced
    for (const id of learnerIds) {
      const info = await getLearnerPassMarkInfo('org-test', id, 'window-1')
      expect(info.passmark).toBeLessThan(info.basePassmark)
    }
  })

  it('should provide alternative activities when primary unavailable', async () => {
    // Setup
    const override = {
      mentor_activity: {
        alternateActivityId: 'alternative_activity',
        leadershipDependency: 'mentor' as const,
      },
    }
    // Configure org with alternative

    // Act
    await updateOrgLeadership('org-test', { hasMentor: false }, 'user-1')

    // Assert
    const result = await isActivityVisible('org-test', 'mentor_activity')
    expect(result.visible).toBe(false)
    // Alternative should be visible
  })

  it('should notify admin of leadership changes', async () => {
    // This would test notification service integration
    // Setup listener for notifications
    // Act
    await updateOrgLeadership('org-test', { hasMentor: false }, 'user-1')
    // Assert - verify notification sent
  })

  it('should track leadership utilization', async () => {
    // Setup mentor with capacity 10
    await updateLeadershipCapacity('org-test', 'mentor', 10, 'user-1')

    // Simulate assignments
    await updateLeadershipUtilization('org-test', 'mentor', 50, 'user-1')

    // Assert
    const stats = await getLeadershipStats('org-test')
    expect(stats.mentorUtilization).toBe(50)
    expect(stats.capacityRemaining.mentor).toBe(5)
  })
})
```

### Pass Mark Adjustment Workflow (5 tests)

```typescript
describe('Pass Mark Adjustment Integration', () => {
  it('should apply all applicable adjustments', async () => {
    // Setup: no mentor, no ambassador
    await updateOrgLeadership('org-test', {
      hasMentor: false,
      hasAmbassador: false,
    }, 'user-1')

    // Calculate
    const result = await calculateLearnerPassMark('org-test', 'learner-1', 'window-1')

    // Assert: base(70) - mentor(10) - ambassador(5) = 55
    expect(result.passmark).toBe(55)
    expect(result.adjustments.length).toBe(2)
  })

  it('should respect minimum pass mark floor', async () => {
    // Setup: multiple constraints
    await updateOrgPassMarkConfig(
      'org-test',
      {
        minimumPassMark: 50,
        basePassMark: 70,
        adjustments: {
          noMentorAvailable: -30, // Would go below minimum
          noAmbassadorAvailable: -20,
        },
      },
      'user-1'
    )

    // Act
    await updateOrgLeadership('org-test', {
      hasMentor: false,
      hasAmbassador: false,
    }, 'user-1')

    // Calculate
    const result = await calculateLearnerPassMark('org-test', 'learner-1', 'window-1')

    // Assert: should respect minimum
    expect(result.passmark).toBeGreaterThanOrEqual(50)
  })

  it('should store learner-specific adjustments', async () => {
    // Calculate
    const calc = await calculateLearnerPassMark('org-test', 'learner-1', 'window-1')

    // Store
    await storeLearnerPassMarkAdjustment(
      'org-test',
      'learner-1',
      'window-1',
      {
        id: 'adj-1',
        userId: 'learner-1',
        orgId: 'org-test',
        windowId: 'window-1',
        basePassMark: calc.basePassmark,
        adjustments: calc.adjustments as any,
        finalPassMark: calc.passmark,
        transparency: {
          visibleToLearner: true,
          explanation: calc.explanation,
        },
        createdAt: Timestamp.now(),
        createdBy: 'system',
        updatedAt: Timestamp.now(),
      },
      'system'
    )

    // Retrieve
    const stored = await getLearnerPassMarkAdjustment(
      'org-test',
      'learner-1',
      'window-1'
    )

    expect(stored?.finalPassMark).toBe(calc.passmark)
  })

  it('should batch recalculate pass marks', async () => {
    const learnerIds = ['learner-1', 'learner-2', 'learner-3']

    const updated = await recalculateWindowPassMarks(
      'org-test',
      'window-1',
      learnerIds,
      'user-1'
    )

    expect(updated).toBe(3)

    // Verify all stored
    for (const id of learnerIds) {
      const stored = await getLearnerPassMarkAdjustment(
        'org-test',
        id,
        'window-1'
      )
      expect(stored).toBeDefined()
    }
  })

  it('should explain adjustments to learners', async () => {
    // Setup: no mentor
    await updateOrgLeadership('org-test', { hasMentor: false }, 'user-1')

    // Calculate
    const info = await getLearnerPassMarkInfo('org-test', 'learner-1', 'window-1')

    // Assert: explanation should be clear
    expect(info.explanation).toContain('60%')
    expect(info.explanation).toContain('mentorship')
    expect(info.explanation).toLowerCase().toContain('not')
  })
})
```

### Activity Visibility Rules (5 tests)

```typescript
describe('Activity Visibility Rules Integration', () => {
  it('should apply pass mark overrides to activity', async () => {
    // Setup: activity requires mentor approval
    await updateOrgPassMarkConfig(
      'org-test',
      {
        basePassMark: 70,
        activityOverrides: {
          'mentor-approval': {
            required: true,
            leadershipDependency: 'mentor' as const,
            visibleWhen: 'leadership_available',
          },
        },
      },
      'user-1'
    )

    // Check visibility: no mentor
    let visibility = await isActivityVisible('org-test', 'mentor-approval')
    expect(visibility.visible).toBe(false)

    // Add mentor
    await updateOrgLeadership('org-test', { hasMentor: true }, 'user-1')

    // Check visibility: mentor available
    visibility = await isActivityVisible('org-test', 'mentor-approval')
    expect(visibility.visible).toBe(true)
  })

  it('should refresh all activities when org config changes', async () => {
    // Initial state: all activities visible
    let summary = await getActivityVisibilitySummary('org-test')
    const initialVisible = summary.visible

    // Change leadership
    await updateOrgLeadership('org-test', { hasMentor: false }, 'user-1')

    // Refresh
    const activityIds = ['activity-1', 'activity-2', 'mentor-activity']
    await refreshOrgActivityVisibility('org-test', activityIds, 'user-1')

    // Check: some activities hidden
    summary = await getActivityVisibilitySummary('org-test')
    expect(summary.hidden).toBeGreaterThan(0)
  })

  it('should handle activity alternatives', async () => {
    // Setup: primary activity requires mentor
    await updateOrgPassMarkConfig(
      'org-test',
      {
        activityOverrides: {
          'primary-activity': {
            leadershipDependency: 'mentor' as const,
            alternateActivityId: 'alternative-activity',
            visibleWhen: 'leadership_available',
          },
        },
      },
      'user-1'
    )

    // No mentor: primary hidden
    await updateOrgLeadership('org-test', { hasMentor: false }, 'user-1')
    let result = await isActivityVisible('org-test', 'primary-activity')
    expect(result.visible).toBe(false)
    expect(result.details).toContain('mentor')

    // Learner can do alternative instead
    const altResult = await isActivityVisible('org-test', 'alternative-activity')
    expect(altResult.visible).toBe(true)
  })

  it('should report activity visibility statistics', async () => {
    // Setup multiple activities
    const activities = ['act-1', 'act-2', 'act-3', 'mentor-act']
    for (const act of activities) {
      await updateActivityVisibility(
        'org-test',
        act,
        true,
        'available',
        'Available',
        undefined,
        'user-1'
      )
    }

    // Hide some
    await hideActivity('org-test', 'mentor-act', 'Test', undefined, 'user-1')

    // Get summary
    const summary = await getActivityVisibilitySummary('org-test')
    expect(summary.total).toBeGreaterThanOrEqual(4)
    expect(summary.hidden).toBeGreaterThanOrEqual(1)
    expect(summary.visible).toBeGreaterThanOrEqual(3)
  })
})
```

### Dynamic Rules Engine (5 tests)

```typescript
describe('Dynamic Rules Engine Integration', () => {
  it('should execute rule when conditions met', async () => {
    // Setup rule: if no mentor, adjust pass mark
    const rule = {
      name: 'Adjust for no mentor',
      trigger: 'org_status_change' as const,
      conditions: [
        {
          field: 'org.leadership.hasMentor',
          operator: 'equals' as const,
          value: false,
        },
      ],
      actions: [
        {
          type: 'adjust_pass_mark' as const,
          priority: 1,
          config: {
            amount: -10,
            reason: 'no_mentor' as const,
          },
        },
      ],
      enabled: true,
      priority: 1,
    } as any

    // Add rule
    const ruleId = await addOrgRule('org-test', rule, 'user-1')

    // Trigger condition
    await updateOrgLeadership('org-test', { hasMentor: false }, 'user-1')

    // Check: rule should have executed
    // (Would verify via execution history or side effects)
  })

  it('should test rule dry run', async () => {
    // Create rule
    const ruleId = await addOrgRule(
      'org-test',
      {
        name: 'Test Rule',
        trigger: 'org_status_change' as const,
        conditions: [
          {
            field: 'org.leadership.hasMentor',
            operator: 'equals' as const,
            value: false,
          },
        ],
        actions: [
          {
            type: 'notify_admin' as const,
            priority: 1,
            config: {
              target: 'admin',
              title: 'No mentor',
              message: 'Mentor is unavailable',
            },
          },
        ],
        enabled: true,
        priority: 1,
      },
      'user-1'
    )

    // Dry run
    const result = await dryRunRule('org-test', ruleId, {
      org: { leadership: { hasMentor: false } },
    })

    expect(result.wouldExecute).toBe(true)
    expect(result.actions.length).toBe(1)
  })

  it('should handle complex multi-condition rules', async () => {
    // Rule: if no mentor AND mentorship is required
    const rule = {
      name: 'Complex Rule',
      trigger: 'org_status_change' as const,
      conditions: [
        {
          field: 'org.leadership.hasMentor',
          operator: 'equals' as const,
          value: false,
        },
        {
          field: 'org.features.mentorshipRequired',
          operator: 'equals' as const,
          value: true,
          logicOp: 'and' as const,
        },
      ],
      actions: [],
      enabled: true,
      priority: 1,
    } as any

    // Test evaluation
    const testResult = await testRuleConditions(rule, {
      org: {
        leadership: { hasMentor: false },
        features: { mentorshipRequired: true },
      },
    })

    expect(testResult.conditionsMet).toBe(true)
    expect(testResult.evaluations.length).toBe(2)
  })

  it('should execute rules in priority order', async () => {
    // Create 3 rules with different priorities
    const rules = [
      { name: 'Low priority', priority: 1 },
      { name: 'High priority', priority: 3 },
      { name: 'Medium priority', priority: 2 },
    ]

    // Execute all
    // Verify: high priority executes first

    // This would be verified through execution logs/order
  })

  it('should handle runOnce rules', async () => {
    // Create rule with runOnce
    const rule = {
      name: 'Run once',
      runOnce: true,
      trigger: 'org_status_change' as const,
      conditions: [],
      actions: [],
      enabled: true,
      priority: 1,
    } as any

    await addOrgRule('org-test', rule, 'user-1')

    // First execution: should run
    // Second execution: should skip (runOnce = disabled after first run)
  })
})
```

---

## Admin Workflow Tests (10+ cases)

### Configuration Panel Tests (5 tests)

```typescript
describe('Admin Configuration Workflows', () => {
  it('should update org features', async () => {
    // Admin updates features
    await updateFeatures({
      mentorshipRequired: true,
      peerMatchingEnabled: false,
    })

    // Verify change
    const config = await getOrgConfiguration('org-test')
    expect(config?.features.mentorshipRequired).toBe(true)
    expect(config?.features.peerMatchingEnabled).toBe(false)
  })

  it('should assign mentor to org', async () => {
    // Admin assigns mentor
    await assignLeader('mentor', 'mentor-1', 'John Doe', 'john@example.com', 10, ['coaching'])

    // Verify
    const roster = await getLeadershipRoster('org-test')
    const mentor = roster.find(l => l.userId === 'mentor-1')
    expect(mentor).toBeDefined()
    expect(mentor?.role).toBe('mentor')
  })

  it('should update pass mark rules', async () => {
    // Admin adjusts pass marks
    await updatePassMarks({
      basePassMark: 75,
      adjustments: {
        noMentorAvailable: -15,
      },
    })

    // Verify
    const config = await getOrgConfiguration('org-test')
    expect(config?.passMark.basePassMark).toBe(75)
  })

  it('should create activity rule', async () => {
    // Admin creates rule
    const ruleId = await addRule({
      name: 'Hide mentor activities',
      trigger: 'org_status_change' as const,
      conditions: [
        {
          field: 'org.leadership.hasMentor',
          operator: 'equals' as const,
          value: false,
        },
      ],
      actions: [
        {
          type: 'hide_activity' as const,
          priority: 1,
          config: {
            activityId: 'mentor-activity',
            reason: 'Mentor unavailable',
          },
        },
      ],
      enabled: true,
      priority: 1,
    })

    // Verify rule added
    const rules = await getRules()
    expect(rules.find(r => r.id === ruleId)).toBeDefined()
  })

  it('should validate configuration before save', async () => {
    // Admin tries invalid config
    // Should prevent save
    // Show error message

    // This would be tested in UI tests
  })
})

### Dashboard Tests (5 tests)

describe('Admin Dashboard', () => {
  it('should display org statistics', async () => {
    // Load dashboard
    // Verify stats displayed:
    // - Team health
    // - Leadership utilization
    // - Pass mark adjustments
    // - Activity visibility
  })

  it('should show alerts for critical issues', async () => {
    // Setup critical condition (e.g., 100% mentor utilization)
    // Load dashboard
    // Verify alert displayed
  })

  it('should enable quick actions', async () => {
    // Admin can:
    // - Toggle mentor availability
    // - Adjust pass marks
    // - Hide/show activities
    // - Create rules
  })

  it('should display change history', async () => {
    // Verify admin can see:
    // - Who changed what
    // - When changes were made
    // - What changed (before/after)
  })

  it('should export dashboard data', async () => {
    // Admin can download:
    // - CSV of pass mark adjustments
    // - JSON of configuration
    // - PDF report
  })
})
```

---

## End-to-End Scenarios (10+ cases)

### Learner Journey with Constraints (3 tests)

```typescript
describe('Learner Scenarios', () => {
  it('Scenario 1: Mentor becomes unavailable mid-journey', async () => {
    // Setup: org with mentor, learner doing mentor-dependent activity
    // Day 1: Mentor available
    //   - Learner sees all activities
    //   - Learner attempts mentor-activity
    //   - Pass mark: 70%

    // Day 2: Mentor becomes unavailable
    //   - Learner receives notification
    //   - Pass mark adjusted to 60%
    //   - Mentor-dependent activities grayed out
    //   - Alternative activities suggested

    // Day 3: Mentor becomes available again
    //   - Learner notified
    //   - Pass mark restored to 70%
    //   - All activities available

    // Verify: Learner experience is fair and transparent
  })

  it('Scenario 2: Multiple constraints applied together', async () => {
    // Setup: org loses mentor + ambassador
    // Learner's pass mark reduced from 70 → 55 (two constraints)
    // Multiple activities hidden
    // Learner sees clear explanation

    // Verify: Pass mark changes are cumulative and explained
  })

  it('Scenario 3: Learner attempts non-visible activity', async () => {
    // Setup: mentor-dependent activity, no mentor
    // Learner tries to access activity
    // Result: Cannot submit, shown reason and ETA for availability

    // Verify: Clear messaging prevents confusion
  })
})
```

---

## Testing Infrastructure

### Test Fixtures

```typescript
// Setup test org
async function setupTestOrg(orgId: string) {
  const config = getDefaultOrgConfiguration(orgId)
  await setDoc(doc(db, 'organization_configuration', orgId), config)
}

// Setup test learner
async function createTestLearner(orgId: string, learnerId: string) {
  await setDoc(doc(db, `organizations/${orgId}/learners`, learnerId), {
    userId: learnerId,
    orgId,
    status: 'active',
    enrolledAt: Timestamp.now(),
  })
}

// Cleanup
async function cleanupTestData(orgId: string) {
  // Delete test org and all subcollections
}
```

### Test Utilities

```typescript
// Wait for async operations
async function waitForUpdate(checkFn: () => Promise<boolean>, timeout = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await checkFn()) return true
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error('Timeout waiting for update')
}

// Spy on notifications
function spyOnNotifications() {
  const notifications: Array<{ to: string; title: string }> = []
  // Mock notification service
  return { notifications, reset: () => notifications.splice(0) }
}
```

---

## Success Criteria

✅ **70%+ Code Coverage** - Minimum coverage requirement
✅ **No Critical Bugs** - All phase-blocking issues resolved
✅ **Performance** - Pass mark calculations < 100ms
✅ **Accessibility** - Admin UI keyboard navigable
✅ **Error Handling** - Graceful degradation if services unavailable
✅ **Data Consistency** - No orphaned configurations or inconsistencies

---

## Test Execution

```bash
# Run all tests
npm test -- Phase6

# Run specific suite
npm test -- Phase6 -- orgConfigurationService

# Run with coverage
npm test -- Phase6 -- --coverage

# Watch mode for development
npm test -- Phase6 -- --watch
```
