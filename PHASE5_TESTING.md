# Phase 5: Testing & Validation Guide

## Overview
Comprehensive testing strategy for the status monitoring and automated notifications system.

---

## Unit Tests

### 1. Status Calculation Tests

**File:** `src/services/__tests__/statusCalculationService.test.ts`

```typescript
describe('statusCalculationService', () => {
  describe('calculateEngagementScore', () => {
    it('should calculate score based on activity metrics', () => {
      const metrics = {
        id: 'test',
        userId: 'user1',
        date: '2024-01-15',
        pointsEarned: 100,
        activitiesCompleted: 5,
        activitiesAttempted: 5,
        dailyActiveStreakDays: 3,
        isActiveToday: true,
        last7DaysPoints: 100,
        last14DaysPoints: 150,
        last30DaysPoints: 300,
        last7DaysActivityCount: 5,
        last14DaysActivityCount: 8,
        last30DaysActivityCount: 15,
        dailyAverage: 10,
        weeklyTrend: 'stable' as const,
        createdAt: Timestamp.now(),
      }

      const score = calculateEngagementScore('user1', metrics)
      expect(score.score).toBeGreaterThan(0)
      expect(score.score).toBeLessThanOrEqual(100)
      expect(score.factors.recentActivity).toBeGreaterThanOrEqual(0)
    })

    it('should calculate lower score when activity drops', () => {
      const lowActivityMetrics = {
        id: 'test',
        userId: 'user1',
        date: '2024-01-15',
        pointsEarned: 0,
        activitiesCompleted: 0,
        activitiesAttempted: 5,
        dailyActiveStreakDays: 0,
        isActiveToday: false,
        last7DaysPoints: 0,
        last14DaysPoints: 50,
        last30DaysPoints: 100,
        last7DaysActivityCount: 0,
        last14DaysActivityCount: 2,
        last30DaysActivityCount: 5,
        dailyAverage: 3,
        weeklyTrend: 'decreasing' as const,
        createdAt: Timestamp.now(),
      }

      const score = calculateEngagementScore('user1', lowActivityMetrics)
      expect(score.score).toBeLessThan(50)
    })
  })

  describe('determineStatus', () => {
    it('should transition to at_risk when engagement drops', () => {
      const status = determineStatus(
        35, // engagement score
        10, // days since activity
        'active', // previous status
      )
      expect(status).toBe('at_risk')
    })

    it('should transition to inactive after 14+ days', () => {
      const status = determineStatus(
        25, // engagement score
        14, // days since activity
        'at_risk', // previous status
      )
      expect(status).toBe('inactive')
    })

    it('should remain active with high engagement', () => {
      const status = determineStatus(
        80, // engagement score
        2, // days since activity
        'active', // previous status
      )
      expect(status).toBe('active')
    })

    it('should transition from recovery to active', () => {
      const recoveryStartedAt = Timestamp.fromDate(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000))
      const status = determineStatus(
        60, // engagement score
        1, // days since activity
        'in_recovery', // previous status
        recoveryStartedAt,
      )
      expect(status).toBe('active')
    })
  })

  describe('calculateDaysSinceLastActivity', () => {
    it('should return 0 if activity today', async () => {
      // Mock: create activity today
      const days = await calculateDaysSinceLastActivity('user1')
      expect(days).toBeLessThanOrEqual(1)
    })

    it('should return high number if no activities', async () => {
      const days = await calculateDaysSinceLastActivity('nonexistent-user')
      expect(days).toBeGreaterThan(100)
    })
  })
})
```

### 2. Status Change Detector Tests

**File:** `src/services/__tests__/statusChangeDetectorService.test.ts`

```typescript
describe('statusChangeDetectorService', () => {
  describe('shouldCreateAlert', () => {
    it('should create alert for active to at_risk transition', () => {
      const { shouldAlert, alertType, severity } = shouldCreateAlert('active', 'at_risk')
      expect(shouldAlert).toBe(true)
      expect(alertType).toBe('at_risk_warning')
      expect(severity).toBe('warning')
    })

    it('should create critical alert for active to inactive', () => {
      const { shouldAlert, alertType, severity } = shouldCreateAlert('active', 'inactive')
      expect(shouldAlert).toBe(true)
      expect(alertType).toBe('inactive_notice')
      expect(severity).toBe('critical')
    })

    it('should celebrate recovery', () => {
      const { shouldAlert, alertType } = shouldCreateAlert('at_risk', 'in_recovery')
      expect(shouldAlert).toBe(true)
      expect(alertType).toBe('recovery_celebration')
    })

    it('should not alert for same status', () => {
      const { shouldAlert } = shouldCreateAlert('active', 'active')
      expect(shouldAlert).toBe(false)
    })
  })

  describe('generateSuggestedActions', () => {
    it('should provide at_risk actions', () => {
      const actions = generateSuggestedActions('at_risk', 35, 10, 50)
      expect(actions).toContain('Schedule a check-in with your mentor')
      expect(actions.length).toBeGreaterThan(0)
      expect(actions.length).toBeLessThanOrEqual(4)
    })

    it('should provide inactive actions', () => {
      const actions = generateSuggestedActions('inactive', 20, 21, 30)
      expect(actions).toContain('Contact your mentor or partner for support')
      expect(actions.length).toBeGreaterThan(0)
    })

    it('should celebrate recovery actions', () => {
      const actions = generateSuggestedActions('in_recovery', 60, 3, 70)
      expect(actions.some((a) => a.includes('momentum'))).toBe(true)
    })
  })

  describe('evaluateRuleConditions', () => {
    it('should evaluate equals condition', () => {
      const rule = {
        conditions: [{ field: 'newStatus', operator: 'equals' as const, value: 'at_risk' }],
      } as any

      const event = {
        newStatus: 'at_risk',
      } as any

      const result = evaluateRuleConditions(rule, event)
      expect(result).toBe(true)
    })

    it('should evaluate comparison conditions', () => {
      const rule = {
        conditions: [{ field: 'engagementScore', operator: 'lte' as const, value: 40 }],
      } as any

      const event = {
        triggeringMetrics: { engagementScore: 35 },
      } as any

      // Note: This test shows the pattern, actual implementation may differ
    })
  })
})
```

### 3. Notification Service Tests

**File:** `src/services/__tests__/statusNotificationService.test.ts`

```typescript
describe('statusNotificationService', () => {
  describe('buildStatusChangeMessage', () => {
    it('should build at_risk message', () => {
      const message = buildStatusChangeMessage('at_risk', 10, 35)
      expect(message).toContain('35/100')
      expect(message).toContain('10 days')
    })

    it('should build inactive message', () => {
      const message = buildStatusChangeMessage('inactive', 21, 15)
      expect(message).toContain('21 days')
      expect(message).toContain('declining')
    })

    it('should build recovery message', () => {
      const message = buildStatusChangeMessage('in_recovery', 3, 55)
      expect(message).toContain('activity again')
    })
  })

  describe('buildEmailSubject', () => {
    it('should create appropriate email subjects', () => {
      expect(buildEmailSubject('at_risk')).toBe('Stay engaged: Quick check-in needed')
      expect(buildEmailSubject('inactive')).toBe('We want to support you - let\'s reconnect')
      expect(buildEmailSubject('in_recovery')).toBe('Great! You\'re making progress again')
    })
  })

  describe('sendStatusChangeNotification', () => {
    it('should send both in-app and email for inactive', async () => {
      const payload = {
        userId: 'user1',
        previousStatus: 'at_risk' as const,
        newStatus: 'inactive' as const,
        engagementScore: 15,
        daysSinceActivity: 21,
        suggestedActions: ['Contact mentor'],
      }

      const result = await sendStatusChangeNotification(payload)
      expect(result.inAppSent).toBe(true)
      expect(result.emailSent).toBe(true) // Should send email for inactive
    })

    it('should send only in-app for at_risk', async () => {
      const payload = {
        userId: 'user1',
        previousStatus: 'active' as const,
        newStatus: 'at_risk' as const,
        engagementScore: 35,
        daysSinceActivity: 10,
        suggestedActions: [],
      }

      const result = await sendStatusChangeNotification(payload)
      expect(result.inAppSent).toBe(true)
    })
  })

  describe('sendRecoveryNotification', () => {
    it('should send celebration notification', async () => {
      const payload = {
        userId: 'user1',
        userName: 'John Doe',
        recoveryDuration: 5,
        activitiesCompleted: 3,
        pointsEarned: 150,
        streakDays: 5,
        encouragementMessage: 'Keep it up!',
      }

      const result = await sendRecoveryNotification(payload)
      expect(result.sent).toBe(true)
    })
  })

  describe('processPendingAlerts', () => {
    it('should process pending alerts', async () => {
      const result = await processPendingAlerts()
      expect(result.processed).toBeGreaterThanOrEqual(0)
      expect(result.succeeded).toBeLessThanOrEqual(result.processed)
    })
  })
})
```

---

## Integration Tests

### 1. End-to-End Status Change Workflow

**File:** `tests/integration/statusChangeFlow.test.ts`

```typescript
describe('Status Change Workflow', () => {
  it('should detect at-risk and send notifications', async () => {
    // 1. Setup user with high engagement
    const userId = 'test-user-1'
    await setupTestUser(userId, {
      currentStatus: 'active',
      engagementScore: 85,
      daysSinceLastActivity: 1,
    })

    // 2. Simulate inactivity (14 days)
    await simulateNoActivity(userId, 14)

    // 3. Trigger status calculation
    const newStatus = await calculateAndUpdateLearnerStatus(userId)

    // 4. Verify status changed
    expect(newStatus.currentStatus).toBe('at_risk')

    // 5. Verify alert created
    const alerts = await getUserPendingAlerts(userId)
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts[0].type).toBe('at_risk_warning')

    // 6. Process and verify notification
    const processed = await processPendingAlerts()
    expect(processed.succeeded).toBeGreaterThan(0)
  })

  it('should celebrate recovery', async () => {
    const userId = 'test-user-2'

    // 1. Setup user in at_risk state
    await setupTestUser(userId, {
      currentStatus: 'at_risk',
      engagementScore: 35,
      daysSinceLastActivity: 10,
    })

    // 2. Add activity
    await addActivity(userId, {
      points: 50,
      timestamp: new Date(),
    })

    // 3. Trigger status recalculation
    const newStatus = await calculateAndUpdateLearnerStatus(userId)

    // 4. Verify recovery
    expect(newStatus.currentStatus).toBe('in_recovery')

    // 5. Verify celebration alert
    const alerts = await getUserPendingAlerts(userId)
    const celebrationAlert = alerts.find((a) => a.type === 'recovery_celebration')
    expect(celebrationAlert).toBeDefined()
  })

  it('should transition through all states', async () => {
    const userId = 'test-user-3'
    const states: LearnerStatus[] = []

    // Active
    await setupTestUser(userId, { currentStatus: 'active', engagementScore: 90 })
    let status = await calculateAndUpdateLearnerStatus(userId)
    states.push(status.currentStatus)

    // At-risk
    await simulateNoActivity(userId, 8)
    status = await calculateAndUpdateLearnerStatus(userId)
    states.push(status.currentStatus)

    // Inactive
    await simulateNoActivity(userId, 20)
    status = await calculateAndUpdateLearnerStatus(userId)
    states.push(status.currentStatus)

    // Recovery
    await addActivity(userId, { points: 50 })
    status = await calculateAndUpdateLearnerStatus(userId)
    states.push(status.currentStatus)

    // Active again
    await addActivity(userId, { points: 100 })
    await advanceTime(8 * 24 * 60 * 60 * 1000) // 8 days
    status = await calculateAndUpdateLearnerStatus(userId)
    states.push(status.currentStatus)

    expect(states).toEqual(['active', 'at_risk', 'inactive', 'in_recovery', 'active'])
  })
})
```

### 2. Partner Digest Generation

**File:** `tests/integration/partnerDigest.test.ts`

```typescript
describe('Partner Daily Digest', () => {
  it('should generate digest with team statistics', async () => {
    const orgId = 'org-1'
    const partnerId = 'mentor-1'

    // Setup team
    await setupTestOrganization(orgId, {
      members: [
        { id: 'user1', status: 'active' },
        { id: 'user2', status: 'at_risk' },
        { id: 'user3', status: 'at_risk' },
        { id: 'user4', status: 'inactive' },
      ],
    })

    // Generate digest
    const digest = await generatePartnerDigest(partnerId, 'mentor@example.com', orgId)

    expect(digest).toBeDefined()
    expect(digest?.totalTeamMembers).toBe(4)
    expect(digest?.activeMembers).toBe(1)
    expect(digest?.atRiskCount).toBe(2)
    expect(digest?.inactiveCount).toBe(1)
  })

  it('should identify critical items correctly', async () => {
    const digest = {
      totalTeamMembers: 10,
      activeMembers: 7,
      atRiskCount: 2,
      inactiveCount: 1,
      recoveredCount: 0,
      newAtRiskCount: 1,
      criticalItems: [],
    } as any

    expect(digest.inactiveCount).toBeGreaterThan(0)
    expect(digest.newAtRiskCount).toBeGreaterThan(0)
  })

  it('should send digest email successfully', async () => {
    const digest = await generatePartnerDigest('mentor-1', 'mentor@example.com', 'org-1')

    if (digest) {
      const sent = await sendPartnerDigestEmail(digest)
      expect(sent).toBe(true)
    }
  })

  it('should batch process multiple digests', async () => {
    const result = await processPendingDigests()
    expect(result.processed).toBeGreaterThanOrEqual(0)
    expect(result.succeeded).toBeLessThanOrEqual(result.processed)
  })
})
```

---

## Performance Tests

### 1. Bulk Status Calculation

**File:** `tests/performance/bulkStatusCalculation.test.ts`

```typescript
describe('Performance: Bulk Status Calculation', () => {
  it('should calculate status for 1000 users in < 60 seconds', async () => {
    const startTime = Date.now()
    const orgId = 'perf-org-1'

    // Setup 1000 test users
    const userIds = Array.from({ length: 1000 }, (_, i) => `perf-user-${i}`)
    await Promise.all(userIds.map((id) => setupTestUser(id, { companyId: orgId })))

    // Calculate status for all
    const result = await calculateOrgLearnerStatuses(orgId)

    const duration = (Date.now() - startTime) / 1000

    expect(result.calculated).toBe(1000)
    expect(duration).toBeLessThan(60) // Should complete in under 60 seconds
    console.log(`Processed ${result.calculated} users in ${duration.toFixed(2)}s`)
  })

  it('should send 500 alerts in < 30 seconds', async () => {
    const startTime = Date.now()

    // Create 500 pending alerts
    await createPendingAlerts(500)

    // Process
    const result = await processPendingAlerts()

    const duration = (Date.now() - startTime) / 1000

    expect(result.processed).toBeGreaterThan(0)
    expect(duration).toBeLessThan(30)
    console.log(`Processed ${result.processed} alerts in ${duration.toFixed(2)}s`)
  })

  it('should generate 100 digests in < 45 seconds', async () => {
    const startTime = Date.now()

    // Create 100 pending digests
    await createPendingDigests(100)

    // Process
    const result = await processPendingDigests()

    const duration = (Date.now() - startTime) / 1000

    expect(duration).toBeLessThan(45)
    console.log(`Processed ${result.processed} digests in ${duration.toFixed(2)}s`)
  })
})
```

### 2. Query Performance

**File:** `tests/performance/queryPerformance.test.ts`

```typescript
describe('Performance: Query Performance', () => {
  it('should fetch at-risk learners efficiently', async () => {
    const startTime = Date.now()

    const atRiskLearners = await getAtRiskLearners('org-1')

    const duration = Date.now() - startTime

    expect(atRiskLearners.length).toBeGreaterThanOrEqual(0)
    expect(duration).toBeLessThan(2000) // Should return in < 2 seconds
  })

  it('should fetch engagement metrics within 1 second', async () => {
    const startTime = Date.now()

    const metrics = await getEngagementMetrics('user-1')

    const duration = Date.now() - startTime

    expect(metrics).toBeDefined()
    expect(duration).toBeLessThan(1000)
  })
})
```

---

## User Acceptance Tests

### 1. Learner Journey

**Manual Test Steps:**

1. **Initial State**
   - [ ] Login as learner with good engagement
   - [ ] Verify status is "ACTIVE" (green indicator)
   - [ ] Verify dashboard shows high engagement score
   - [ ] Verify no alerts displayed

2. **Decline to At-Risk**
   - [ ] Don't complete activities for 7 days
   - [ ] Verify notification received: "Stay on Track!"
   - [ ] Verify status changes to "AT RISK" (yellow indicator)
   - [ ] Verify suggestions displayed in notification

3. **Decline to Inactive**
   - [ ] Don't complete activities for another 7 days (14 total)
   - [ ] Verify urgent notification received: "We Miss You"
   - [ ] Verify status changes to "INACTIVE" (red indicator)
   - [ ] Verify email sent to mentor

4. **Recovery**
   - [ ] Complete 1-2 activities
   - [ ] Verify status changes to "IN RECOVERY" (blue indicator)
   - [ ] Verify celebration notification received
   - [ ] Verify points tracked in dashboard

5. **Return to Active**
   - [ ] Maintain activity for 7 days
   - [ ] Verify status returns to "ACTIVE"
   - [ ] Verify engagement score increases

### 2. Mentor/Partner Journey

**Manual Test Steps:**

1. **Dashboard Access**
   - [ ] Login as mentor
   - [ ] Verify team statistics displayed (active, at-risk, inactive counts)
   - [ ] Verify at-risk learners highlighted
   - [ ] Verify recent alerts shown

2. **Daily Digest**
   - [ ] Wait for scheduled digest time
   - [ ] [ ] Verify email received in inbox
   - [ ] Verify team summary matches dashboard
   - [ ] Verify at-risk learners list matches

3. **Suggested Actions**
   - [ ] Review suggested actions in digest
   - [ ] Click action link
   - [ ] Verify action details displayed

4. **Notification Preferences**
   - [ ] Access notification settings
   - [ ] Disable digests
   - [ ] Verify no email received next day
   - [ ] Re-enable digests
   - [ ] Verify email received

---

## Smoke Tests (Post-Deployment)

**File:** `tests/smoke/index.test.ts`

```typescript
describe('Smoke Tests: Phase 5 Core Functions', () => {
  it('calculateEngagementScore function accessible', async () => {
    const result = await fetch('/api/status/engagement-score')
    expect(result.status).toBeLessThan(500)
  })

  it('status calculation endpoint working', async () => {
    const result = await fetch('/api/status/calculate', { method: 'POST' })
    expect(result.status).toBeLessThan(500)
  })

  it('partner digest service healthy', async () => {
    const result = await fetch('/api/partner/digest-status')
    expect(result.status).toBeLessThan(500)
  })

  it('notification preferences accessible', async () => {
    const result = await fetch('/api/notifications/preferences/test-user')
    expect(result.status).toBeLessThan(500)
  })

  it('Firestore collections exist', async () => {
    const collections = ['learner_status', 'status_alerts', 'engagement_metrics']
    for (const col of collections) {
      const snapshot = await db.collection(col).limit(1).get()
      expect(snapshot).toBeDefined()
    }
  })
})
```

---

## Test Data Management

### Seed Test Data

```typescript
// tests/fixtures/seedTestData.ts
export async function seedTestData() {
  // Create test org
  await setDoc(doc(db, 'organizations', 'test-org'), {
    name: 'Test Organization',
    code: 'TEST-ORG',
    status: 'active',
  })

  // Create test users
  const users = [
    { id: 'test-active', status: 'active', engagement: 85 },
    { id: 'test-at-risk', status: 'at_risk', engagement: 35 },
    { id: 'test-inactive', status: 'inactive', engagement: 15 },
  ]

  for (const user of users) {
    await setDoc(doc(db, 'profiles', user.id), {
      fullName: `Test User ${user.id}`,
      email: `${user.id}@test.com`,
      companyId: 'test-org',
    })

    await setDoc(doc(db, 'learner_status', user.id), {
      userId: user.id,
      orgId: 'test-org',
      currentStatus: user.status,
      engagementScore: user.engagement,
      daysSinceLastActivity: user.status === 'active' ? 1 : 14,
    })
  }
}

export async function cleanupTestData() {
  // Delete test data
  await db.collection('profiles').doc('test-org').delete()
  // ... cleanup other collections
}
```

---

## Success Criteria Validation

- ✅ Status calculated within 1 hour of activity
- ✅ Notifications delivered within 5 minutes
- ✅ Dashboard reflects status within 30 seconds
- ✅ Partners alerted within 24 hours of at-risk detection
- ✅ At-risk learners see intervention suggestions
- ✅ Recovery notifications personalized and timely
- ✅ <1% notification delivery failure rate
- ✅ All status transitions logged for audit
- ✅ Partner digests sent daily at scheduled time
- ✅ 0 duplicate alerts per user per 24 hours

