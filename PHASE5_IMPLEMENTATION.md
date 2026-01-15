# Phase 5: Status Monitoring & Automated Notifications Implementation Guide

## Overview
Phase 5 implements a proactive monitoring system that detects learner status changes and triggers automated, contextual notifications to learners and partners. The system consists of:

1. **Status Calculation Engine** - Computes learner status based on engagement, progress, and completion metrics
2. **Status Change Detector** - Detects transitions (active → at-risk → inactive → recovery) and triggers workflows
3. **Real-Time In-App Notifications** - Instant notifications for status changes and important events
4. **Email Alerts** - Timely email notifications for critical status changes
5. **Recovery Celebrations** - Motivational notifications when learners recover from at-risk status
6. **Partner Daily Digests** - Daily email summaries for mentors/partners showing at-risk learners
7. **Notification Preferences** - User control over notification frequency and types

## Architecture

### Status States
```
ACTIVE → AT_RISK → INACTIVE → RECOVERY → ACTIVE
         ↓                        ↑
      [Alert] ←─────────────────[Celebrate]
```

**Definitions:**
- **ACTIVE**: Regular engagement (activity in last 7 days)
- **AT_RISK**: Declining engagement (no activity for 7-14 days, but program ongoing)
- **INACTIVE**: Long-term disengagement (no activity for 14+ days)
- **RECOVERY**: Returning to activity after at-risk/inactive status

### Key Metrics
- **Engagement Score**: 0-100 based on activities in last 7, 14, 30 days
- **Completion Rate**: Percentage of assigned activities completed
- **Consistency Score**: Regularity of weekly point claims
- **Last Activity Date**: Timestamp of most recent activity claim
- **Days Since Last Activity**: Calculated field for quick queries

## Database Schema

### learner_status
Tracks current status of each learner
```typescript
{
  id: string                    // user_id
  userId: string
  orgId?: string
  currentStatus: 'active' | 'at_risk' | 'inactive' | 'in_recovery'
  previousStatus?: 'active' | 'at_risk' | 'inactive' | 'in_recovery'
  statusChangedAt: Timestamp
  
  // Metrics
  engagementScore: number       // 0-100
  completionRate: number        // 0-100
  consistencyScore: number      // 0-100
  lastActivityDate?: Timestamp
  daysSinceLastActivity: number
  
  // Window Progress
  currentWindowNumber: number
  pointsInCurrentWindow: number
  targetPointsForWindow: number
  
  // Recovery Tracking
  recoveryStartedAt?: Timestamp
  recoveryNotificationSent?: boolean
  
  // Alerts
  alertSeverity?: 'info' | 'warning' | 'critical'
  alertReason?: string
  alertsSentToday: number
  lastAlertSentAt?: Timestamp
  
  updatedAt: Timestamp
  calculatedAt: Timestamp
}
```

### learner_status_history
Historical record of all status transitions
```typescript
{
  id: string
  userId: string
  orgId?: string
  previousStatus: 'active' | 'at_risk' | 'inactive' | 'in_recovery'
  newStatus: 'active' | 'at_risk' | 'inactive' | 'in_recovery'
  reason: string
  engagementScore: number
  daysSinceActivity: number
  triggeredAutomationRules: string[]
  createdAt: Timestamp
}
```

### engagement_metrics
Detailed engagement analytics for trending
```typescript
{
  id: string
  userId: string
  orgId?: string
  date: string                  // YYYY-MM-DD
  pointsEarned: number
  activitiesCompleted: number
  dailyActiveStreakDays: number
  
  // Rolling metrics
  last7DaysPoints: number
  last14DaysPoints: number
  last30DaysPoints: number
  
  createdAt: Timestamp
}
```

### notification_preferences
User notification settings
```typescript
{
  id: string
  userId: string
  
  // Global toggles
  emailNotificationsEnabled: boolean
  inAppNotificationsEnabled: boolean
  
  // Notification types
  statusAlerts: {
    enabled: boolean
    frequency: 'instant' | 'daily'
    includeAtRiskWarnings: boolean
  }
  recoveryNotifications: {
    enabled: boolean
  }
  weeklyDigests: {
    enabled: boolean
    frequency: 'weekly' | 'biweekly'
  }
  
  // For partners/mentors
  teamAlertsEnabled?: boolean
  dailyDigestEnabled?: boolean
  digestTime?: string            // HH:MM UTC
  
  updatedAt: Timestamp
}
```

### status_alerts
Queue of alerts to be sent
```typescript
{
  id: string
  userId: string
  orgId?: string
  type: 'at_risk_warning' | 'inactive_notice' | 'recovery_celebration' | 'milestone_achieved'
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  channels: ('email' | 'in_app')[]
  
  // Alert payload
  message: string
  title: string
  actionRequired: boolean
  actionUrl?: string
  
  severity: 'info' | 'warning' | 'critical'
  reasonCode: string
  
  // Retry tracking
  attemptCount: number
  lastAttemptAt?: Timestamp
  nextRetryAt?: Timestamp
  
  createdAt: Timestamp
  sentAt?: Timestamp
}
```

### partner_daily_digest_queue
Partner/mentor digest emails
```typescript
{
  id: string
  partnerId: string            // mentor/ambassador user_id
  orgId: string
  digestDate: string           // YYYY-MM-DD
  status: 'pending' | 'sent' | 'failed'
  
  // Summary stats
  totalTeamMembers: number
  activeMembers: number
  atRiskCount: number
  inactiveCount: number
  recoveredCount: number
  
  // Learner details to include
  atRiskLearners: Array<{
    userId: string
    name: string
    engagementScore: number
    daysSinceActivity: number
    suggestedActions: string[]
  }>
  
  createdAt: Timestamp
  sentAt?: Timestamp
}
```

## Implementation Steps

### Step 1: Create Type Definitions
See `PHASE5_TYPES.ts`

### Step 2: Create Status Calculation Service
See `statusCalculationService.ts`

### Step 3: Create Status Change Detector
See `statusChangeDetectorService.ts`

### Step 4: Create Notification Services
- `statusNotificationService.ts` - In-app and email for status changes
- `recoveryNotificationService.ts` - Recovery celebration logic
- `partnerDigestService.ts` - Partner daily digest emails

### Step 5: Create Frontend Components
- Status indicators in learner dashboard
- Partner at-risk learner panel
- Notification preference settings

### Step 6: Setup Automated Workflows
- Cloud Functions to calculate status hourly
- Cloud Functions to send digests daily
- Real-time Firestore listeners for UI updates

## Success Metrics

✅ **Real-time Updates**
- Status calculated within 1 hour of activity
- Notifications delivered within 5 minutes
- Dashboard reflects status within 30 seconds

✅ **Reduced Silent Failures**
- Partners alerted within 24 hours of at-risk detection
- At-risk learners see intervention suggestions
- Recovery notifications drive re-engagement

✅ **Motivational Reinforcement**
- Recovery notifications send within 1 hour
- Celebration messages personalized with recovery data
- Weekly digest shows improvement trends

## Migration Path

### Phase 5a: Foundation
1. Create Firestore collections and indexes
2. Implement status calculation and detection
3. Create notification services

### Phase 5b: Partner Integration
4. Build partner daily digest workflow
5. Create at-risk learner panel in mentor dashboard
6. Implement notification preferences UI

### Phase 5c: Enhancement
7. Add predictive alerts (ML-based at-risk prediction)
8. Implement intervention recommendation engine
9. Add coaching nudges for specific competencies

## API Endpoints Needed

```
POST /api/status/calculate - Trigger status recalculation
GET  /api/status/:userId - Get learner status
POST /api/status/notify - Send manual status notification
GET  /api/partner/digest - Get digest data for partner
POST /api/notifications/preferences - Update user preferences
GET  /api/notifications/preferences/:userId - Get user preferences
```

## Cloud Functions to Create

1. `calculateLearnerStatus` (Scheduled: hourly)
   - Iterates all learners
   - Calculates engagement metrics
   - Detects status changes
   - Triggers alert workflows

2. `sendStatusAlerts` (Scheduled: every 15 mins)
   - Dequeue pending alerts
   - Send via email/in-app
   - Update delivery status

3. `sendPartnerDigests` (Scheduled: daily @ 9 AM UTC)
   - Group learners by partner
   - Compile digest data
   - Send emails
   - Log engagement metrics

4. `handleRecoveryNotification` (Triggered: on status change to recovery)
   - Create celebration notification
   - Send email
   - Update notification preferences

5. `updateEngagementMetrics` (Triggered: on activityClaim approval)
   - Calculate daily metrics
   - Update rolling stats
   - Trigger status recalculation if needed

## Testing Strategy

1. **Unit Tests**
   - Status calculation logic
   - Metric calculations
   - Notification template rendering

2. **Integration Tests**
   - End-to-end status change workflow
   - Notification delivery chain
   - Database transactions

3. **Performance Tests**
   - Bulk status calculation (1000+ users)
   - Notification queue processing
   - Digest generation

4. **User Testing**
   - Alert relevance and timing
   - Digest comprehensiveness
   - Notification preferences UX
