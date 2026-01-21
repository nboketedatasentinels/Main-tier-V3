# Phase 5: Quick Start Guide

## Overview
This guide helps you get started implementing Phase 5 (Status Monitoring & Automated Notifications) on the Journeys branch.

---

## 30-Second Summary

Phase 5 transforms the platform from reactive to proactive by:
- ✅ **Detecting disengagement early** - Automatic status transitions (Active → At-Risk → Inactive)
- ✅ **Notifying learners** - Real-time alerts when engagement drops
- ✅ **Alerting partners** - Daily digests showing at-risk learners & team metrics
- ✅ **Celebrating recovery** - Motivational messages when learners re-engage

---

## Project Contents

### 📋 Documentation (Start Here)

1. **`PHASE5_SUMMARY.md`** ← Read this first!
   - Overview of all deliverables
   - Architecture explanation
   - Timeline & next steps

2. **`PHASE5_IMPLEMENTATION.md`**
   - Detailed implementation guide
   - Database schema design
   - API endpoints
   - Success metrics

3. **`PHASE5_CLOUD_FUNCTIONS.md`**
   - Backend automation code
   - Firestore indexes
   - Security rules
   - Deployment instructions

4. **`PHASE5_TESTING.md`**
   - Test strategy with code examples
   - Unit, integration, performance tests
   - Manual UAT steps
   - Success criteria

### 💻 Code Files (Ready to Use)

#### Services (Backend Logic)

```typescript
import { calculateAndUpdateLearnerStatus } from '@/services/statusCalculationService'
import { createStatusChangeAlert } from '@/services/statusChangeDetectorService'
import { sendStatusChangeNotification } from '@/services/statusNotificationService'
import { generatePartnerDigest } from '@/services/partnerDigestService'
```

- **`statusCalculationService.ts`** - Engagement scoring & status determination
- **`statusChangeDetectorService.ts`** - Detects transitions & creates alerts
- **`statusNotificationService.ts`** - Sends in-app & email notifications
- **`partnerDigestService.ts`** - Generates daily partner digests

#### Types (TypeScript Definitions)

```typescript
import type {
  LearnerStatusRecord,
  EngagementMetrics,
  StatusAlertRecord,
  NotificationPreferences,
  PartnerDailyDigest,
} from '@/types/monitoring'
```

- **`src/types/monitoring.ts`** - All Phase 5 types (400+ lines)

#### Hooks (React Components)

```typescript
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences'
import { useLearnerStatusDashboard } from '@/hooks/useNotificationPreferences'
import { usePartnerDashboard } from '@/hooks/useNotificationPreferences'
```

- **`useNotificationPreferences.ts`** - Manage user notification settings

---

## Getting Started: Step-by-Step

### Step 1: Understand the Architecture (15 min)

Read these sections:
- `PHASE5_SUMMARY.md` → Architecture Overview
- `PHASE5_IMPLEMENTATION.md` → Status State Machine

Key concepts:
- **Learner Status States:** Active → At-Risk → Inactive → Recovery → Active
- **Engagement Score:** 0-100 (based on recent activity, consistency, completion)
- **Alert Types:** At-risk warnings, inactive notices, recovery celebrations

### Step 2: Review Type Definitions (10 min)

```typescript
// src/types/monitoring.ts
export type LearnerStatus = 'active' | 'at_risk' | 'inactive' | 'in_recovery'

export interface LearnerStatusRecord {
  userId: string
  currentStatus: LearnerStatus
  engagementScore: number // 0-100
  daysSinceLastActivity: number
  suggestedActions?: string[]
  // ... more fields
}
```

Key types to understand:
- `LearnerStatusRecord` - Current status & metrics
- `EngagementMetrics` - Activity tracking
- `StatusAlertRecord` - Alerts to send
- `NotificationPreferences` - User settings
- `PartnerDailyDigest` - Partner emails

### Step 3: Understand the Services (30 min)

#### Service 1: Status Calculation
```typescript
import { calculateAndUpdateLearnerStatus } from '@/services/statusCalculationService'

// Calculate status for a user
const statusRecord = await calculateAndUpdateLearnerStatus(userId, orgId)
console.log(statusRecord.currentStatus) // 'active' | 'at_risk' | 'inactive' | 'in_recovery'
console.log(statusRecord.engagementScore) // 0-100
```

#### Service 2: Status Change Detection
```typescript
import { createStatusChangeAlert } from '@/services/statusChangeDetectorService'

// When status changes, create alert
const alert = await createStatusChangeAlert(
  userId,
  orgId,
  'active',      // previous status
  'at_risk',     // new status
  metrics
)
```

#### Service 3: Send Notifications
```typescript
import { sendStatusChangeNotification } from '@/services/statusNotificationService'

// Send to learner
await sendStatusChangeNotification({
  userId,
  previousStatus: 'active',
  newStatus: 'at_risk',
  engagementScore: 35,
  daysSinceActivity: 10,
  suggestedActions: ['Schedule a check-in', 'Review materials']
})
```

#### Service 4: Partner Digests
```typescript
import { generatePartnerDigest, sendPartnerDigestEmail } from '@/services/partnerDigestService'

// Generate & send daily digest
const digest = await generatePartnerDigest(partnerId, email, orgId)
if (digest) {
  await sendPartnerDigestEmail(digest)
}
```

### Step 4: Setup Firestore Collections (20 min)

Create these collections in Firebase Console:

```
Collections to Create:
├── learner_status          (user current status)
├── learner_status_history  (audit trail)
├── engagement_metrics      (daily metrics)
├── status_alerts           (alerts to send)
├── partner_daily_digest_queue (digests to send)
├── notification_preferences (user settings)
├── digest_schedules        (partner schedules)
└── automation_rules        (trigger rules)
```

Then create these indexes (in `PHASE5_CLOUD_FUNCTIONS.md`):
```
learner_status: (orgId, currentStatus)
learner_status: (orgId, statusChangedAt DESC)
status_alerts: (userId, status, createdAt DESC)
engagement_metrics: (userId, date DESC)
...
```

### Step 5: Create Cloud Functions (1-2 hours)

Copy these functions from `PHASE5_CLOUD_FUNCTIONS.md`:

1. `calculateLearnerStatus` (hourly)
2. `sendStatusAlerts` (every 15 min)
3. `sendPartnerDigests` (daily 9 AM)
4. `onActivityApproved` (triggered)
5. `retryFailedNotifications` (4-hourly)

Deploy with:
```bash
firebase deploy --only functions
```

### Step 6: Build UI Components (2-4 hours)

Create these React components:

1. **LearnerStatusWidget** - Display current status
   ```tsx
   <LearnerStatusWidget userId={userId} />
   // Shows: Active (green) / At-Risk (yellow) / Inactive (red) / Recovery (blue)
   // With engagement score and suggested actions
   ```

2. **NotificationPreferencesPanel** - User settings
   ```tsx
   <NotificationPreferencesPanel userId={userId} />
   // Toggles: Email on/off, In-app on/off, Frequency, Do-not-disturb
   ```

3. **PartnerAtRiskPanel** - Mentor dashboard
   ```tsx
   <PartnerAtRiskPanel partnerId={partnerId} orgId={orgId} />
   // Shows at-risk learners with suggested actions
   ```

### Step 7: Test the System (2-3 hours)

```bash
# 1. Unit tests
npm test -- statusCalculationService

# 2. Manual testing
# - Create test user with activity
# - Wait 7 days (simulate or manually update DB)
# - Verify status changed to 'at_risk'
# - Check alert created
# - Verify notification sent

# 3. Partner digest
# - Wait for daily digest time (9 AM UTC)
# - Check email received
# - Verify data accuracy
```

---

## Quick API Usage Examples

### Get Learner Status
```typescript
import { getLearnerStatus } from '@/services/statusCalculationService'

const status = await getLearnerStatus(userId)
console.log(`Status: ${status.currentStatus}`)
console.log(`Engagement: ${status.engagementScore}/100`)
console.log(`Days inactive: ${status.daysSinceLastActivity}`)
```

### Get At-Risk Learners for Organization
```typescript
import { getAtRiskLearners } from '@/services/statusCalculationService'

const atRiskLearners = await getAtRiskLearners(orgId)
console.log(`At-risk: ${atRiskLearners.length}`)
atRiskLearners.forEach(learner => {
  console.log(`  ${learner.userId}: ${learner.engagementScore}/100`)
})
```

### Update Notification Preferences
```typescript
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences'

const { preferences, updateStatusAlerts } = useNotificationPreferences(userId)

// Disable at-risk warnings
await updateStatusAlerts({
  enabled: false
})

// Change frequency to daily
await updateStatusAlerts({
  frequency: 'daily'
})
```

### Send Recovery Notification
```typescript
import { sendRecoveryNotification } from '@/services/statusNotificationService'

await sendRecoveryNotification({
  userId,
  userName: 'John Doe',
  recoveryDuration: 5, // days
  activitiesCompleted: 3,
  pointsEarned: 150,
  streakDays: 5,
  encouragementMessage: 'You are crushing it! Keep going!'
})
```

---

## Database Schema Quick Reference

### learner_status collection

```typescript
{
  id: "user123",
  userId: "user123",
  orgId: "org-1",
  currentStatus: "at_risk",           // active | at_risk | inactive | in_recovery
  engagementScore: 35,                 // 0-100
  completionRate: 60,                  // 0-100
  consistencyScore: 45,                // 0-100
  daysSinceLastActivity: 10,
  pointsInCurrentWindow: 30,
  targetPointsForWindow: 100,
  windowProgressPercentage: 30,
  alertSeverity: "warning",            // info | warning | critical
  suggestedActions: [
    "Schedule a check-in with your mentor",
    "Review course materials"
  ],
  updatedAt: Timestamp,
  calculatedAt: Timestamp
}
```

### status_alerts collection

```typescript
{
  id: "alert-123",
  userId: "user123",
  orgId: "org-1",
  type: "at_risk_warning",             // at_risk_warning | inactive_notice | recovery_celebration
  status: "pending",                   // pending | sent | failed | skipped
  channels: ["in_app", "email"],
  title: "📊 Stay on Track",
  message: "Your engagement has dipped...",
  severity: "warning",
  suggestedActions: ["Schedule check-in", "Review materials"],
  attemptCount: 0,
  createdAt: Timestamp,
  sentAt: undefined
}
```

### partner_daily_digest_queue collection

```typescript
{
  id: "digest-123",
  partnerId: "mentor1",
  partnerName: "Jane Smith",
  orgId: "org-1",
  digestDate: "2024-01-15",
  status: "pending",                   // pending | sent | failed
  totalTeamMembers: 15,
  activeMembers: 12,
  atRiskCount: 2,
  inactiveCount: 1,
  recoveredCount: 1,
  atRiskLearners: [
    {
      userId: "user2",
      name: "John Doe",
      engagementScore: 35,
      daysSinceActivity: 10,
      suggestedActions: [...]
    }
  ],
  teamAverageEngagementScore: 72,
  criticalItems: ["2 learners at-risk", "1 learner inactive"],
  createdAt: Timestamp,
  sentAt: undefined
}
```

---

## Troubleshooting

### Status not changing
- [ ] Check learner_status collection exists
- [ ] Verify calculateLearnerStatus function running hourly
- [ ] Check Cloud Function logs
- [ ] Manually trigger: `calculateAndUpdateLearnerStatus(userId)`

### Alerts not being sent
- [ ] Check status_alerts collection
- [ ] Verify sendStatusAlerts function running every 15 min
- [ ] Check email service configuration
- [ ] Look for errors in Cloud Function logs

### Digests not arriving
- [ ] Check partner_daily_digest_queue collection
- [ ] Verify sendPartnerDigests function runs at 9 AM UTC
- [ ] Confirm partner email in database
- [ ] Check email service logs

### Performance issues
- [ ] Check Firestore indexes created
- [ ] Monitor function execution time
- [ ] Consider batch sizing adjustments
- [ ] Optimize query filters

---

## Common Tasks

### Manually Calculate Status for User
```typescript
import { calculateAndUpdateLearnerStatus } from '@/services/statusCalculationService'

// In your admin console or script:
await calculateAndUpdateLearnerStatus('user123', 'org-1')
console.log('Status calculated')
```

### Send Immediate Alert to User
```typescript
import { sendAtRiskWarning } from '@/services/statusNotificationService'

await sendAtRiskWarning(
  'user123',
  35,    // engagement score
  10,    // days since activity
  ['Schedule a check-in', 'Review materials']
)
```

### View Pending Alerts
```typescript
import { getUserPendingAlerts } from '@/services/statusChangeDetectorService'

const alerts = await getUserPendingAlerts('user123')
console.log(`${alerts.length} pending alerts`)
alerts.forEach(alert => {
  console.log(`  ${alert.type}: ${alert.message}`)
})
```

### Reset User Notification Preferences
```typescript
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences'

const { resetToDefaults } = useNotificationPreferences('user123')
await resetToDefaults()
console.log('Preferences reset to defaults')
```

---

## Next Steps After Implementation

1. ✅ Deploy Cloud Functions
2. ✅ Test with sample data
3. ✅ Build UI components
4. ✅ User acceptance testing
5. ✅ Performance optimization
6. ✅ Production rollout

**Estimated Total Time:** 3-4 weeks for full implementation

---

## Files Overview

| File | Purpose | Size | Complexity |
|------|---------|------|-----------|
| `src/types/monitoring.ts` | Type definitions | 400 lines | Low |
| `src/services/statusCalculationService.ts` | Calculation engine | 500 lines | Medium |
| `src/services/statusChangeDetectorService.ts` | Transition detection | 450 lines | High |
| `src/services/statusNotificationService.ts` | Notification delivery | 350 lines | Medium |
| `src/services/partnerDigestService.ts` | Partner digests | 400 lines | Medium |
| `src/hooks/useNotificationPreferences.ts` | Preferences hook | 300 lines | Low |

**Total:** 2,400+ lines of production-ready code

---

## Support

📚 **For more info:**
- Architecture: See `PHASE5_IMPLEMENTATION.md`
- Backend setup: See `PHASE5_CLOUD_FUNCTIONS.md`
- Testing: See `PHASE5_TESTING.md`
- Summary: See `PHASE5_SUMMARY.md`

💡 **Key Contacts:**
- Implementation questions → Review the docs above
- Code examples → Check service files for function signatures
- Type definitions → See `src/types/monitoring.ts`

---

**You're all set! Start with `PHASE5_SUMMARY.md` and work through the implementation step-by-step.** 🚀
