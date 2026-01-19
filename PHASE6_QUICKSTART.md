# Phase 6: Quick Start Guide

## Project Overview

**Phase 6: Organization & Leadership Configuration**

Align learning journeys with organizational reality by managing leadership dependencies, dynamic pass marks, and conditional activity visibility.

**Key Insight:** Fairness first - learners aren't penalized when mentors or ambassadors are unavailable.

---

## What Gets Built

### Services (5 new files)

```
src/services/
├── orgConfigurationService.ts        # Org settings management
├── leadershipService.ts              # Mentor/ambassador roster
├── activityVisibilityService.ts       # Activity availability logic
├── dynamicPassMarkService.ts          # Personalized pass marks
└── dynamicJourneyRulesService.ts      # Conditional rule execution
```

### Types (1 new file)

```
src/types/
└── organization.ts                   # 20+ type definitions
```

### Hooks (1 new file)

```
src/hooks/
└── useOrgDashboard.ts               # React admin dashboard hook
```

### Cloud Functions (6 new)

- `onOrgConfigUpdate` - Apply config changes
- `evaluateActivityVisibility` - Hourly refresh
- `recalculatePassMarks` - Daily recalc
- `syncOrgDashboard` - Dashboard snapshot
- `enforceOrgRules` - Rule engine
- `processRuleTriggers` - Rule execution

---

## Key Concepts

### 1. Leadership Dependencies

Activities can require specific roles:
- **Mentor-dependent:** Need mentor approval
- **Ambassador-dependent:** Need ambassador verification
- **Partner-dependent:** Need transformation partner sign-off

When leader unavailable → activity hidden (not blocked)

### 2. Dynamic Pass Marks

**Base:** 70% (configurable)

**Adjustments:**
- No Mentor: -10% → 60%
- No Ambassador: -5% → 65%
- Limited Capacity: -5% → 65%

**Fair:** Never penalizes learner for missing resources

### 3. Activity Visibility

Activities shown/hidden based on:
- Leadership availability
- Feature flags
- Custom rules
- Pass mark configuration

Learner always knows WHY

### 4. Rules Engine

Conditional logic: IF X → THEN Y

Example:
```
IF mentor unavailable
  THEN hide mentor_activity
  AND adjust pass mark by -10%
  AND notify learner
```

---

## Quick Start: 5 Steps

### Step 1: Initialize Org Configuration

```typescript
import { initializeOrgConfiguration } from '@/services/orgConfigurationService'

// In admin dashboard
await initializeOrgConfiguration('org-123', userId)
```

### Step 2: Assign Leadership

```typescript
import { assignLeadershipToOrg } from '@/services/leadershipService'

// Admin assigns mentor
await assignLeadershipToOrg(
  'org-123',
  'mentor',
  'mentor-user-id',
  {
    name: 'Sarah Johnson',
    email: 'sarah@example.com',
    capacity: 15,
    skills: ['technical', 'soft-skills'],
  },
  adminUserId
)
```

### Step 3: Configure Pass Marks

```typescript
import { updateOrgPassMarkConfig } from '@/services/orgConfigurationService'

// Admin sets rules
await updateOrgPassMarkConfig('org-123', {
  basePassMark: 70,
  minimumPassMark: 50,
  adjustments: {
    noMentorAvailable: -10,
    noAmbassadorAvailable: -5,
    limitedCapacity: -5,
  },
}, userId)
```

### Step 4: Set Activity Rules

```typescript
import { updateOrgPassMarkConfig } from '@/services/orgConfigurationService'

// Mark activities as mentor-dependent
await updateOrgPassMarkConfig('org-123', {
  activityOverrides: {
    'one-on-one-mentoring': {
      required: true,
      leadershipDependency: 'mentor',
      visibleWhen: 'leadership_available',
      alternateActivityId: 'peer-feedback',
    },
  },
}, userId)
```

### Step 5: Admin Dashboard

```typescript
import { useOrgDashboard } from '@/hooks/useOrgDashboard'

// In admin component
const {
  orgConfig,
  leadership,
  passMarkStats,
  activityStats,
  rules,
  updateFeatures,
  assignLeader,
} = useOrgDashboard('org-123')

// Display stats, manage config
```

---

## Common Workflows

### Mentor Becomes Unavailable

```typescript
// Step 1: Update org config
await updateOrgLeadership('org-123', {
  hasMentor: false,
  assignedMentorId: null,
}, userId)

// Step 2: Automatic updates
// ✅ Activity visibility refreshed
// ✅ Pass marks recalculated for all learners
// ✅ Notifications sent to affected learners
// ✅ Dashboard alerts triggered
```

### Admin Adds Alternative Activity

```typescript
// If mentor unavailable, suggest peer feedback instead
await updateOrgPassMarkConfig('org-123', {
  activityOverrides: {
    'one-on-one-mentoring': {
      alternateActivityId: 'peer-feedback',
      leadershipDependency: 'mentor',
    },
  },
}, userId)

// When mentor unavailable:
// ✅ "one-on-one-mentoring" hidden with reason
// ✅ "peer-feedback" suggested as alternative
// ✅ Both count equally toward completion
```

### Admin Creates a Rule

```typescript
import { addOrgRule } from '@/services/orgConfigurationService'

await addOrgRule('org-123', {
  name: 'Auto-hide mentor activities',
  trigger: 'org_status_change',
  conditions: [
    {
      field: 'org.leadership.hasMentor',
      operator: 'equals',
      value: false,
    },
  ],
  actions: [
    {
      type: 'hide_activity',
      priority: 1,
      config: {
        activityId: 'one-on-one-mentoring',
        reason: 'Mentor currently unavailable',
      },
    },
    {
      type: 'adjust_pass_mark',
      priority: 2,
      config: {
        reason: 'no_mentor',
        amount: -10,
      },
    },
  ],
  enabled: true,
  priority: 1,
}, userId)
```

---

## API Examples

### Get Organization Configuration

```typescript
GET /api/org/org-123/config

Response:
{
  "id": "org-123",
  "leadership": {
    "hasMentor": true,
    "hasAmbassador": false,
    "mentorCapacity": 15,
    "mentorUtilization": 60
  },
  "features": {
    "mentorshipRequired": true,
    "peerMatchingEnabled": true
  },
  "passMark": {
    "basePassMark": 70,
    "adjustments": {
      "noMentorAvailable": -10
    }
  }
}
```

### Get Learner Pass Mark Info

```typescript
GET /api/learner/user-123/passmark?orgId=org-123&windowId=window-1

Response:
{
  "passmark": 60,
  "basePassmark": 70,
  "adjustments": [
    {
      "reason": "no_mentor",
      "amount": -10
    }
  ],
  "explanation": "Your pass mark is 60% because mentorship is not currently available"
}
```

### Check Activity Visibility

```typescript
GET /api/org/org-123/activities/activity-1/visibility

Response:
{
  "visible": false,
  "reason": "leadership_unavailable",
  "detailedReason": "This activity requires a mentor who is not currently available",
  "alternativeActivityId": "peer-feedback"
}
```

### Get Leadership Roster

```typescript
GET /api/org/org-123/leadership

Response: [
  {
    "userId": "mentor-1",
    "name": "Sarah Johnson",
    "email": "sarah@example.com",
    "role": "mentor",
    "available": true,
    "capacity": 15,
    "utilized": 9,
    "skills": ["technical", "soft-skills"]
  },
  ...
]
```

---

## Testing

### Test Installation

```bash
npm install --save-dev @testing-library/react vitest @vitest/ui
```

### Run Tests

```bash
# All Phase 6 tests
npm test -- Phase6

# Specific service
npm test -- orgConfigurationService

# With coverage
npm test -- Phase6 -- --coverage

# Watch mode
npm test -- Phase6 -- --watch
```

### Example Test

```typescript
import { calculateLearnerPassMark } from '@/services/dynamicPassMarkService'

describe('Pass Mark Calculation', () => {
  it('should adjust pass mark when mentor unavailable', async () => {
    // Setup org without mentor
    await updateOrgLeadership('org-test', { hasMentor: false }, 'user-1')

    // Calculate
    const result = await calculateLearnerPassMark('org-test', 'learner-1', 'window-1')

    // Assert
    expect(result.passmark).toBe(60) // 70 - 10
    expect(result.adjustments[0].reason).toBe('no_mentor')
    expect(result.explanation).toContain('mentorship')
  })
})
```

---

## Deployment Checklist

- [ ] Cloud Functions deployed
- [ ] Firestore indexes created
- [ ] Security rules updated
- [ ] Admin dashboard UI built
- [ ] Notifications tested
- [ ] Documentation reviewed
- [ ] Data migration plan (if needed)
- [ ] Stakeholder training scheduled

---

## File Locations

```
.
├── src/
│   ├── types/organization.ts                    # Type definitions
│   ├── services/
│   │   ├── orgConfigurationService.ts           # Service 1
│   │   ├── leadershipService.ts                 # Service 2
│   │   ├── activityVisibilityService.ts         # Service 3
│   │   ├── dynamicPassMarkService.ts            # Service 4
│   │   └── dynamicJourneyRulesService.ts        # Service 5
│   └── hooks/
│       └── useOrgDashboard.ts                   # React hook
├── PHASE6_IMPLEMENTATION.md                     # Full spec
├── PHASE6_CLOUD_FUNCTIONS.md                    # Cloud Functions
├── PHASE6_TESTING.md                            # Testing strategy
└── PHASE6_QUICKSTART.md                         # This file
```

---

## Common Issues

### Pass marks not updating

**Problem:** Changed leadership but pass marks didn't recalculate

**Solution:**
```typescript
// Manually trigger recalculation
await recalculateWindowPassMarks('org-123', 'window-1', [learnerIds], userId)
```

### Activities still showing when hidden

**Problem:** Activity visibility cache stale

**Solution:**
```typescript
// Refresh visibility
await refreshOrgActivityVisibility('org-123', ['activity-1', 'activity-2'], userId)
```

### Rules not executing

**Problem:** Rule conditions not matching

**Solution:**
```typescript
// Test rule conditions
const result = await testRuleConditions(rule, {
  org: { leadership: { hasMentor: false } },
})
console.log('Would execute:', result.conditionsMet)
```

---

## Support & Resources

- **Documentation:** [PHASE6_IMPLEMENTATION.md](./PHASE6_IMPLEMENTATION.md)
- **Cloud Functions:** [PHASE6_CLOUD_FUNCTIONS.md](./PHASE6_CLOUD_FUNCTIONS.md)
- **Testing:** [PHASE6_TESTING.md](./PHASE6_TESTING.md)
- **Type Definitions:** [src/types/organization.ts](./src/types/organization.ts)

---

## Next Steps

1. **Review** the complete specification in PHASE6_IMPLEMENTATION.md
2. **Setup** Cloud Functions using PHASE6_CLOUD_FUNCTIONS.md
3. **Build** Admin UI using useOrgDashboard hook
4. **Test** using test cases in PHASE6_TESTING.md
5. **Deploy** and train admins

**Estimated Timeline:** 2-3 weeks
**Complexity:** Medium
**Priority:** High

Good luck! 🚀
