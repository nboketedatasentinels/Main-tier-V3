# Phase 6: Organization & Leadership Configuration Implementation Guide

## Overview

Phase 6 aligns learning journeys with organizational reality by:
- Managing mentor/ambassador dependencies
- Implementing dynamic journey rules
- Enabling conditional activity visibility
- Adjusting pass marks based on available resources
- Providing admin control without engineering support

**Core Principle:** Fairness - learners aren't penalized for unavailable mentors or resources.

---

## Objectives & Scope

### Problems Solved

1. **Unfair Scoring:** Pass marks shouldn't include mentor-dependent activities if no mentor
2. **Activity Confusion:** Why are certain activities disabled? Make it transparent
3. **Resource Constraints:** Journeys must adapt when leadership is unavailable
4. **Admin Friction:** Non-technical admins should configure settings without code
5. **Expectation Mismatch:** Learners don't know what's required vs optional

### Key Features

| Feature | Benefit | Users |
|---------|---------|-------|
| Leadership Roster | Know who's assigned | Learners, Admins |
| Org Flags | Enable/disable features | Admins |
| Activity Visibility | Transparent constraints | Learners |
| Dynamic Pass Marks | Fair scoring | All |
| Journey Rules | Conditional logic | Admins |
| Dashboard Config | Visual management | Admins |

---

## Architecture

### Data Model

```
Organization
├── Leadership
│   ├── Mentor
│   │   ├── Available? (true/false)
│   │   ├── Capacity (number)
│   │   └── Skills (tags)
│   ├── Ambassador
│   │   ├── Available? (true/false)
│   │   ├── Capacity
│   │   └── Focus Areas
│   └── Transformation Partner
│       ├── Available? (true/false)
│       └── Program Focus
├── Configuration
│   ├── Features Enabled
│   │   ├── Mentoring Required?
│   │   ├── Peer Matching Enabled?
│   │   └── Points Verification Required?
│   ├── Pass Marks
│   │   ├── Base Mark (e.g., 70%)
│   │   ├── Adjustments by leadership availability
│   │   └── Activity-level overrides
│   └── Rules Engine
│       ├── Activity visibility rules
│       ├── Dynamic pass mark rules
│       └── Completion requirements
└── Dashboard Settings
    ├── Displayed Metrics
    ├── Report Schedule
    └── Admin Notifications
```

### State Flow

```
Org Setup (Admin)
    ↓
Define Leadership (Assign mentors/ambassadors)
    ↓
Configure Features (Enable/disable)
    ↓
Set Pass Marks & Rules (Base + adjustments)
    ↓
Create Journey (Uses org config)
    ↓
Learner Progress (Rules evaluated in real-time)
    ↓
Scorecard (Adjusted for org context)
```

---

## Database Schema

### organizations (Enhanced)

```typescript
{
  id: string
  name: string
  code: string
  status: 'active' | 'inactive' | 'suspended'
  
  // PHASE 6: Leadership Configuration
  leadership: {
    // Individual assignments
    assignedMentorId?: string | null
    assignedAmbassadorId?: string | null
    transformationPartnerId?: string | null
    
    // Availability flags
    hasMentor?: boolean                    // NEW
    hasAmbassador?: boolean                // NEW
    hasPartner?: boolean                   // NEW
    
    // Capacity tracking
    mentorCapacity?: number                // NEW
    ambassadorCapacity?: number            // NEW
    mentorUtilization?: number             // NEW (0-100)
    
    // Skills/Focus areas
    mentorSkills?: string[]                // NEW
    ambassadorFocusAreas?: string[]        // NEW
    partnerProgramFocus?: string[]         // NEW
    
    updatedAt: Timestamp
  }
  
  // PHASE 6: Feature Configuration
  features: {                              // NEW
    mentorshipRequired?: boolean           // Activities need mentor approval
    peerMatchingEnabled?: boolean
    pointsVerificationRequired?: boolean
    cohortsEnabled?: boolean
    communityEnabled?: boolean
    leaderboardEnabled?: boolean
    customReportsEnabled?: boolean
    automatedNudgesEnabled?: boolean
  }
  
  // PHASE 6: Pass Mark Configuration
  passMarkConfiguration: {                 // NEW
    basePassMark: number                   // e.g., 70 (%)
    
    // Adjustments based on constraints
    adjustments: {
      noMentorAvailable?: number           // e.g., -10 (70% becomes 60%)
      noAmbassadorAvailable?: number
      noPartnerAvailable?: number
      limitedCapacity?: number
    }
    
    // Activity-level overrides
    activityOverrides?: Record<string, {
      required?: boolean
      passMark?: number
      leadership?: 'none' | 'mentor' | 'ambassador' | 'partner'
    }>
    
    updatedAt: Timestamp
  }
  
  // PHASE 6: Dashboard Configuration
  dashboardConfig: {                       // NEW
    displayedMetrics: string[]
    enabledReports: string[]
    reportSchedule?: 'daily' | 'weekly'
    reportTime?: string                    // HH:MM UTC
    adminNotificationsEnabled?: boolean
    
    updatedAt: Timestamp
  }
  
  // PHASE 6: Rules Engine
  journeyRules?: {                         // NEW
    id: string
    name: string
    trigger: 'org_status_change' | 'leadership_change' | 'capacity_reached'
    conditions: Array<{
      field: string
      operator: 'equals' | 'gte' | 'lte' | 'contains'
      value: unknown
    }>
    actions: Array<{
      type: 'adjust_pass_mark' | 'hide_activity' | 'notify_admin' | 'adjust_deadline'
      config: Record<string, unknown>
    }>
    enabled: boolean
    priority: number
    createdAt: Timestamp
    updatedAt: Timestamp
  }[]
  
  teamSize?: number
  cohortStartDate?: Timestamp
  programDuration?: number
  journeyType?: '4W' | '6W' | '3M' | '6M' | '9M' | '12M'
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### organization_configuration (New)

Stores detailed org settings and rules

```typescript
{
  id: string                               // orgId
  orgId: string
  
  // Leadership roles & assignments
  leadership: {
    roles: Array<{
      role: 'mentor' | 'ambassador' | 'partner'
      userId: string
      name: string
      email: string
      available: boolean
      capacity: number
      utilized: number
      skills?: string[]
      focusAreas?: string[]
      assignedSince: Timestamp
      notes?: string
    }>
  }
  
  // Feature flags
  features: Record<string, boolean>
  
  // Pass mark rules
  passMark: {
    base: number
    rules: Array<{
      condition: string
      adjustment: number
      reason: string
    }>
  }
  
  // Activity rules
  activityRules: Array<{
    activityId: string
    activityName: string
    visible: boolean
    leadershipRequired?: 'mentor' | 'ambassador' | 'partner' | 'any'
    alternateActivityId?: string           // If primary not available
    reason?: string
  }>
  
  // Custom settings
  customSettings?: Record<string, unknown>
  
  updatedAt: Timestamp
  lastConfiguredBy: string
  configurationHistory: Array<{
    change: string
    changedAt: Timestamp
    changedBy: string
  }>
}
```

### activity_visibility (New)

Stores real-time visibility status for each activity

```typescript
{
  id: string                               // activityId-orgId
  activityId: string
  orgId: string
  
  visible: boolean
  reason: 'available' | 'leadership_unavailable' | 'capacity_exceeded' | 'feature_disabled' | 'custom_rule'
  detailedReason: string
  
  alternativeActivityId?: string
  
  // When will it become visible again?
  visibleAgainAt?: Timestamp
  
  updatedAt: Timestamp
}
```

### learner_pass_mark_adjustment (New)

Stores personalized pass mark adjustments

```typescript
{
  id: string
  userId: string
  orgId: string
  
  windowId: string
  basePassMark: number
  
  // What adjustments apply?
  adjustments: Array<{
    reason: 'no_mentor' | 'no_ambassador' | 'capacity_limited' | 'custom'
    adjustment: number
    appliedAt: Timestamp
  }>
  
  finalPassMark: number
  
  transparency: {
    visibleToLearner: boolean
    explanation?: string
  }
  
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### organization_dashboard_snapshot (New)

Daily snapshot for org dashboard analytics

```typescript
{
  id: string
  orgId: string
  date: string                             // YYYY-MM-DD
  
  // Team health
  teamStats: {
    totalMembers: number
    activeMembers: number
    avgEngagementScore: number
    avgCompletionRate: number
  }
  
  // Leadership utilization
  leadershipStats: {
    mentorUtilization: number              // 0-100%
    ambassadorUtilization: number
    partnerUtilization: number
  }
  
  // Pass mark adjustments
  adjustmentStats: {
    learnersWithAdjustments: number
    avgAdjustmentAmount: number
    reasonBreakdown: Record<string, number>
  }
  
  // Activity visibility
  activityStats: {
    totalActivities: number
    visibleActivities: number
    hiddenActivities: number
    reasonBreakdown: Record<string, number>
  }
  
  // Issues & alerts
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical'
    message: string
    action?: string
  }>
  
  createdAt: Timestamp
}
```

---

## Key Concepts

### 1. Leadership Dependencies

**Mentor-Dependent Activities**
- Require mentor approval before counting toward completion
- If no mentor available:
  - Activity marked as "awaiting leadership"
  - Learner can still attempt but won't get points until mentor available
  - Pass mark reduced to be fair

**Ambassador-Dependent Activities**
- Require ambassador input/verification
- Similar logic to mentor

**Partner-Dependent Activities**
- Require transformation partner sign-off
- Critical for program alignment

### 2. Dynamic Pass Marks

**Base:** 70% (configurable)

**Adjustments:**
- No Mentor: -10% (→ 60%)
- No Ambassador: -5% (→ 65%)
- Limited Capacity: -5% (→ 65%)
- Disabled Features: Activity hidden (not counted)

**Transparency:** Learners see:
- "Your pass mark is 60% (normally 70%) because mentorship isn't currently available"

### 3. Activity Visibility Rules

**Visible:**
- Leadership available (or not required)
- Feature enabled
- Learner meets prerequisites

**Hidden:**
- Required leadership unavailable
- Feature disabled
- Alternative activity available

**Explanation:**
- ❌ NOT hidden (confuses learners)
- ✅ Shown but grayed out with reason
- ✅ Alternative suggested if available

### 4. Conditional Logic Engine

```typescript
Rule Example:
{
  trigger: 'leadership_change',
  condition: {
    field: 'hasMentor',
    operator: 'equals',
    value: false
  },
  actions: [
    { type: 'adjust_pass_mark', adjustment: -10, reason: 'no_mentor' },
    { type: 'hide_activity', activityId: 'mentor_1on1', visible: true, reason: 'awaiting_leadership' },
    { type: 'notify_admin', message: 'Mentor unavailable - pass marks adjusted' }
  ]
}
```

---

## API Endpoints

### Organization Configuration

```
GET    /api/org/:orgId/config              - Get org configuration
PUT    /api/org/:orgId/config              - Update org configuration
GET    /api/org/:orgId/dashboard           - Get org dashboard data
```

### Leadership Management

```
GET    /api/org/:orgId/leadership          - Get leadership roster
POST   /api/org/:orgId/leadership/:role    - Assign leader
DELETE /api/org/:orgId/leadership/:userId  - Remove leader
PUT    /api/org/:orgId/leadership/:userId  - Update leader info
PATCH  /api/org/:orgId/leadership/:userId/availability - Toggle availability
```

### Activity Visibility

```
GET    /api/org/:orgId/activities/visibility - Get activity visibility status
POST   /api/org/:orgId/activities/:activityId/hide - Hide activity with reason
DELETE /api/org/:orgId/activities/:activityId/hide - Make activity visible
```

### Pass Mark Adjustment

```
GET    /api/learner/:userId/passmark       - Get personalized pass mark
GET    /api/org/:orgId/passmark/rules      - Get pass mark rules
PUT    /api/org/:orgId/passmark/rules      - Update pass mark rules
```

### Rules Management

```
GET    /api/org/:orgId/rules               - Get all org rules
POST   /api/org/:orgId/rules               - Create new rule
PUT    /api/org/:orgId/rules/:ruleId       - Update rule
DELETE /api/org/:orgId/rules/:ruleId       - Delete rule
POST   /api/org/:orgId/rules/:ruleId/trigger - Manually trigger rule
```

---

## Cloud Functions

### 1. onLeadershipChange (Triggered)
**Trigger:** Firestore update on organization.leadership  
**Purpose:** Apply org rules when leadership changes

```
Event: mentor assigned/removed
→ Evaluate all rules
→ Adjust pass marks for affected learners
→ Update activity visibility
→ Notify affected learners
→ Log to dashboard
```

### 2. evaluateActivityVisibility (Scheduled)
**Trigger:** Hourly or on-demand  
**Purpose:** Update activity visibility based on current org state

```
For each org:
  Get current leadership status
  Get enabled features
  For each activity:
    Evaluate visibility rules
    Update activity_visibility collection
    Cache results
```

### 3. recalculatePassMarks (Scheduled)
**Trigger:** Daily or on leadership change  
**Purpose:** Update pass marks for all learners

```
For each org:
  Get current pass mark rules
  For each learner:
    Calculate base pass mark
    Apply adjustments based on org state
    Create learner_pass_mark_adjustment record
    Notify learner of change
```

### 4. syncOrgDashboard (Scheduled)
**Trigger:** Daily at 6 AM UTC  
**Purpose:** Generate org dashboard snapshot

```
For each org:
  Calculate team statistics
  Calculate leadership utilization
  Calculate adjustment statistics
  Identify alerts & issues
  Create organization_dashboard_snapshot
  Notify admins of critical alerts
```

### 5. enforceOrgRules (Triggered)
**Trigger:** Activity claim submitted  
**Purpose:** Enforce org-specific rules on activity completion

```
When activity claimed:
  Check if activity is visible
  Check if leadership requirement met
  Check if pass mark applies
  Accept or reject claim with reason
```

---

## Success Criteria

✅ **Fair Scoring**
- Pass marks adjust when leadership unavailable
- Learners see the adjustment & reason
- No learner penalized for resource constraints

✅ **Transparency**
- Activities shown with "why" if disabled
- Clear explanation of constraints
- Learners understand pass mark adjustments

✅ **Admin Control**
- Non-technical admins configure org
- No code changes needed
- Changes apply immediately

✅ **No Unfair Blocking**
- Learners not prevented from attempting activities
- Can complete even if approval pending
- Clear next steps provided

✅ **Org Alignment**
- Journeys respect org structure
- Leadership dependencies honored
- Feature flags enable/disable as needed

---

## Implementation Phases

### Phase 6a: Foundation (Weeks 1-2)
1. Create Firestore collections
2. Implement org configuration service
3. Build leadership management
4. Test with seed data

### Phase 6b: Integration (Weeks 2-3)
1. Build activity visibility logic
2. Implement dynamic pass marks
3. Create org dashboard
4. Integration testing

### Phase 6c: Admin UI (Week 3)
1. Build configuration panel
2. Leadership roster UI
3. Rules editor
4. Admin testing

---

## Testing Strategy

### Unit Tests (40+ cases)
- Pass mark calculation
- Rule evaluation
- Activity visibility logic
- Leadership validation

### Integration Tests (15+ cases)
- Org setup to learner impact
- Pass mark adjustment workflow
- Activity visibility updates
- Rule triggering

### Admin Tests (10+ cases)
- Configuration changes
- Leadership assignments
- Rule creation/updates
- Dashboard functionality

### User Tests (5+ scenarios)
- Learner sees pass marks
- Learner sees disabled activities
- Learner attempts activities
- Mentor/ambassador workflow

---

## Migration Path

### From Current State
1. Create org_configuration collection
2. Migrate existing org settings
3. Create default pass mark rules
4. Create default feature flags

### Backward Compatibility
- Existing orgs get default configuration
- No pass mark adjustments initially
- All features enabled by default
- Admins opt-in to new features

---

## Success Metrics

- ✅ Admins configure org without support tickets
- ✅ <2% learner support issues about unfair pass marks
- ✅ <5% of learners confused about activity visibility
- ✅ 95% of pass mark adjustments correctly applied
- ✅ 100% of rule triggers executed correctly
