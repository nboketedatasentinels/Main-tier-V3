# 6-Week Power Journey "Learners at Risk" Logic

## Status: FULLY IMPLEMENTED

This document describes the **"Learners at Risk"** feature specifically for the **6-Week Power Journey**.

## Implementation Summary

### Files Created/Modified

| File | Type | Purpose |
|------|------|---------|
| `src/utils/journeyDetection.ts` | Created | Journey detection utilities and at-risk threshold constants |
| `src/services/sixWeekRiskService.ts` | Created | 6W-specific risk evaluation, clear-if-passed, notifications |
| `src/services/statusCalculationService.ts` | Modified | Added journey-aware status determination |
| `src/types/monitoring.ts` | Modified | Added journey-specific fields to LearnerStatusRecord |
| `functions/src/at-risk-cron.ts` | Created | Daily CRON job (00:05 AM) for at-risk evaluation |
| `functions/src/at-risk-api.ts` | Created | Admin API endpoint for at-risk learners |
| `functions/src/index.ts` | Modified | Exports new Cloud Functions |
| `scripts/migrations/backfill-journey-type.mjs` | Created | Migration to backfill journeyType on organizations |

### Key Features Implemented

1. **Daily CRON Job** (`dailyAtRiskEvaluation`)
   - Runs at 00:05 AM Africa/Johannesburg timezone
   - Evaluates all active 6-week journey organizations
   - Flags learners as at-risk after week 5 if < 40,000 points
   - Sends notifications only for NEW at-risk flags
   - Logs results to `cron_logs` collection

2. **Clear At-Risk If Passed** (`clearAtRiskIfPassed`)
   - Checks if learner was at-risk but now has >= 40,000 points
   - Clears at-risk flag and sends recovery notification
   - Called during evaluation before flagging

3. **Notification System**
   - At-risk notification when newly flagged
   - Recovery notification when passing after being at-risk
   - Uses existing status notification service

4. **Admin API Endpoint** (`getAtRiskLearners`)
   - GET `/admin/cohorts/:cohortId/at-risk-learners`
   - Returns 400 if not a 6W journey organization
   - Returns learner list with points, deficit, weeks remaining

5. **Journey Type Persistence**
   - journeyType field already exists on OrganizationRecord
   - Calculated from programDurationWeeks or programDuration
   - Migration script available for backfilling

## The Logic:

1. Only flag learners as "at risk" **AFTER week 5** (not before)
2. Only flag if the learner has **NOT reached 40,000 points** (the pass mark)
3. Calculate the journey type from organization-registered weeks automatically

---

## Part 1: Journey Type Detection from Organization Weeks

### Background

When an admin registers an organization, they input:
- `cohortStartDate`: When the journey begins
- `programDuration`: Duration in months (e.g., 1.5 = 6 weeks)
- `programDurationWeeks`: Duration in weeks (e.g., 6)
- `journeyType`: Explicit journey type ('4W', '6W', '3M', '6M', '9M')

### Step 1.1: Create Journey Detection Utility

**File:** `src/utils/journeyDetection.ts`

```typescript
import { JourneyType, JOURNEY_META } from '@/config/pointsConfig';
import { resolveJourneyType } from '@/utils/journeyType';

/**
 * Journey detection result with confidence level
 */
export interface JourneyDetectionResult {
  journeyType: JourneyType;
  detectedFrom: 'explicit' | 'weeks' | 'months' | 'fallback';
  durationWeeks: number;
  passMarkPoints: number;
  atRiskWeekThreshold: number; // Week after which "at risk" applies
}

/**
 * Journey-specific "at risk" week thresholds
 *
 * RULE: For 6W journey, learner is only flagged "at risk" AFTER week 5
 * This means evaluation happens at week 6 (final week)
 */
export const JOURNEY_AT_RISK_WEEK_THRESHOLDS: Record<JourneyType, number> = {
  '4W': 3,   // After week 3 (evaluation at week 4)
  '6W': 5,   // CRITICAL: After week 5 (evaluation at week 6) - 40,000 pass mark
  '3M': 10,  // After week 10 (evaluation at weeks 11-12)
  '6M': 22,  // After week 22 (evaluation at weeks 23-24)
  '9M': 34,  // After week 34 (evaluation at weeks 35-36)
};

/**
 * Detect journey type from organization data
 *
 * Priority order:
 * 1. Explicit journeyType field
 * 2. programDurationWeeks
 * 3. programDuration (months)
 * 4. Fallback to 3M
 */
export function detectJourneyFromOrganization(org: {
  journeyType?: string | null;
  programDurationWeeks?: number | null;
  programDuration?: number | null;
}): JourneyDetectionResult {
  // Use existing resolver
  const journeyType = resolveJourneyType({
    journeyType: org.journeyType,
    programDurationWeeks: org.programDurationWeeks,
    programDuration: org.programDuration,
  }) ?? '3M'; // Fallback

  const meta = JOURNEY_META[journeyType];

  // Determine detection source
  let detectedFrom: JourneyDetectionResult['detectedFrom'] = 'fallback';
  if (org.journeyType) {
    detectedFrom = 'explicit';
  } else if (org.programDurationWeeks) {
    detectedFrom = 'weeks';
  } else if (org.programDuration) {
    detectedFrom = 'months';
  }

  return {
    journeyType,
    detectedFrom,
    durationWeeks: meta.weeks,
    passMarkPoints: meta.passMarkPoints,
    atRiskWeekThreshold: JOURNEY_AT_RISK_WEEK_THRESHOLDS[journeyType],
  };
}

/**
 * Check if current week is past the at-risk threshold for a journey
 */
export function isPastAtRiskThreshold(
  currentWeek: number,
  journeyType: JourneyType
): boolean {
  const threshold = JOURNEY_AT_RISK_WEEK_THRESHOLDS[journeyType];
  return currentWeek > threshold;
}

/**
 * Check if a 6-week journey learner qualifies as "at risk"
 *
 * CONDITIONS (ALL must be true):
 * 1. Journey type is '6W'
 * 2. Current week > 5 (i.e., week 6)
 * 3. Total points < 40,000
 */
export function is6WeekJourneyAtRisk(params: {
  journeyType: JourneyType;
  currentWeek: number;
  totalPoints: number;
}): { isAtRisk: boolean; reason: string | null } {
  const { journeyType, currentWeek, totalPoints } = params;
  const PASS_MARK = 40000; // 6W pass mark
  const AT_RISK_THRESHOLD_WEEK = 5;

  // Only applies to 6-week journey
  if (journeyType !== '6W') {
    return { isAtRisk: false, reason: null };
  }

  // Not at risk if still in weeks 1-5
  if (currentWeek <= AT_RISK_THRESHOLD_WEEK) {
    return {
      isAtRisk: false,
      reason: `Still in week ${currentWeek} (at-risk evaluation starts after week ${AT_RISK_THRESHOLD_WEEK})`
    };
  }

  // At risk if below pass mark after week 5
  if (totalPoints < PASS_MARK) {
    return {
      isAtRisk: true,
      reason: `Week ${currentWeek}: ${totalPoints.toLocaleString()} points < ${PASS_MARK.toLocaleString()} pass mark`,
    };
  }

  // Passed - not at risk
  return {
    isAtRisk: false,
    reason: `Passed: ${totalPoints.toLocaleString()} >= ${PASS_MARK.toLocaleString()} points`,
  };
}
```

---

## Part 2: Enhanced Status Calculation Service

### Step 2.1: Create 6-Week Specific Risk Service

**File:** `src/services/sixWeekRiskService.ts`

```typescript
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { JourneyType, JOURNEY_META } from '@/config/pointsConfig';
import {
  detectJourneyFromOrganization,
  is6WeekJourneyAtRisk,
  isPastAtRiskThreshold,
} from '@/utils/journeyDetection';

/**
 * 6-Week journey specific "at risk" evaluation result
 */
export interface SixWeekRiskEvaluation {
  userId: string;
  journeyType: JourneyType;
  currentWeek: number;
  totalPoints: number;
  passMarkPoints: number;
  pointsDeficit: number;
  isAtRisk: boolean;
  reason: string;
  evaluatedAt: Timestamp;
  // Projection data
  requiredWeeklyAverage: number; // Points needed per remaining week to pass
  weeksRemaining: number;
  canStillPass: boolean;
}

/**
 * Calculate the current week of a learner's journey
 */
export function calculateCurrentWeek(
  journeyStartDate: Date | Timestamp | string,
  referenceDate: Date = new Date()
): number {
  const startDate = journeyStartDate instanceof Timestamp
    ? journeyStartDate.toDate()
    : new Date(journeyStartDate);

  const diffMs = referenceDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const currentWeek = Math.floor(diffDays / 7) + 1;

  return Math.max(1, currentWeek);
}

/**
 * Evaluate if a specific user in the 6-week journey is "at risk"
 *
 * This is the PRIMARY function to call for 6-week at-risk evaluation
 */
export async function evaluateSixWeekLearnerRisk(
  userId: string
): Promise<SixWeekRiskEvaluation | null> {
  try {
    // 1. Get user profile
    const profileRef = doc(db, 'profiles', userId);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      console.error(`[6W Risk] Profile not found for user: ${userId}`);
      return null;
    }

    const profile = profileSnap.data();
    const totalPoints = profile.totalPoints ?? 0;
    const journeyStartDate = profile.journeyStartDate;
    const orgId = profile.companyId ?? profile.organizationId;

    // 2. Determine journey type
    let journeyType: JourneyType = profile.journeyType ?? '3M';

    // If no explicit journey type on profile, check organization
    if (!profile.journeyType && orgId) {
      const orgRef = doc(db, 'organizations', orgId);
      const orgSnap = await getDoc(orgRef);

      if (orgSnap.exists()) {
        const orgData = orgSnap.data();
        const detection = detectJourneyFromOrganization({
          journeyType: orgData.journeyType,
          programDurationWeeks: orgData.programDurationWeeks,
          programDuration: orgData.programDuration,
        });
        journeyType = detection.journeyType;
      }
    }

    // 3. Only proceed for 6-week journeys
    if (journeyType !== '6W') {
      return null; // Not a 6-week journey - no evaluation needed
    }

    // 4. Calculate current week
    const currentWeek = journeyStartDate
      ? calculateCurrentWeek(journeyStartDate)
      : (profile.currentWeek ?? 1);

    // 5. Get 6W metadata
    const meta = JOURNEY_META['6W'];
    const passMarkPoints = meta.passMarkPoints; // 40,000
    const totalWeeks = meta.weeks; // 6

    // 6. Evaluate at-risk status
    const riskResult = is6WeekJourneyAtRisk({
      journeyType,
      currentWeek,
      totalPoints,
    });

    // 7. Calculate projections
    const weeksRemaining = Math.max(0, totalWeeks - currentWeek + 1);
    const pointsDeficit = Math.max(0, passMarkPoints - totalPoints);
    const requiredWeeklyAverage = weeksRemaining > 0
      ? Math.ceil(pointsDeficit / weeksRemaining)
      : pointsDeficit;

    // Can still pass if required weekly average is achievable
    // Weekly target for 6W is 7,000, max possible per week ~10,000
    const canStillPass = requiredWeeklyAverage <= 10000;

    return {
      userId,
      journeyType,
      currentWeek,
      totalPoints,
      passMarkPoints,
      pointsDeficit,
      isAtRisk: riskResult.isAtRisk,
      reason: riskResult.reason ?? 'No evaluation',
      evaluatedAt: Timestamp.now(),
      requiredWeeklyAverage,
      weeksRemaining,
      canStillPass,
    };
  } catch (error) {
    console.error('[6W Risk] Error evaluating learner risk:', error);
    return null;
  }
}

/**
 * Batch evaluate all 6-week journey learners in an organization
 */
export async function evaluateOrganizationSixWeekRisk(
  orgId: string
): Promise<{
  evaluated: number;
  atRisk: SixWeekRiskEvaluation[];
  passed: number;
  notYetEvaluable: number; // Still in weeks 1-5
  errors: number;
}> {
  const { collection, query, where, getDocs } = await import('firebase/firestore');

  const result = {
    evaluated: 0,
    atRisk: [] as SixWeekRiskEvaluation[],
    passed: 0,
    notYetEvaluable: 0,
    errors: 0,
  };

  try {
    // 1. First, verify this is a 6-week organization
    const orgRef = doc(db, 'organizations', orgId);
    const orgSnap = await getDoc(orgRef);

    if (!orgSnap.exists()) {
      console.error(`[6W Risk] Organization not found: ${orgId}`);
      return result;
    }

    const orgData = orgSnap.data();
    const detection = detectJourneyFromOrganization({
      journeyType: orgData.journeyType,
      programDurationWeeks: orgData.programDurationWeeks,
      programDuration: orgData.programDuration,
    });

    // Skip if not a 6-week journey organization
    if (detection.journeyType !== '6W') {
      console.log(`[6W Risk] Org ${orgId} is ${detection.journeyType}, skipping 6W evaluation`);
      return result;
    }

    // 2. Get all learners in this organization
    const usersQuery = query(
      collection(db, 'profiles'),
      where('companyId', '==', orgId)
    );

    const usersSnap = await getDocs(usersQuery);

    // 3. Evaluate each learner
    for (const userDoc of usersSnap.docs) {
      try {
        const evaluation = await evaluateSixWeekLearnerRisk(userDoc.id);

        if (!evaluation) {
          result.errors++;
          continue;
        }

        result.evaluated++;

        if (evaluation.isAtRisk) {
          result.atRisk.push(evaluation);
        } else if (evaluation.currentWeek <= 5) {
          result.notYetEvaluable++;
        } else {
          result.passed++;
        }
      } catch (error) {
        console.error(`[6W Risk] Error evaluating user ${userDoc.id}:`, error);
        result.errors++;
      }
    }

    return result;
  } catch (error) {
    console.error('[6W Risk] Error in batch evaluation:', error);
    return result;
  }
}
```

---

## Part 3: Integrate with Existing Status Calculation

### Step 3.1: Modify `statusCalculationService.ts`

Add the following to the existing `determineStatus` function:

**File:** `src/services/statusCalculationService.ts` (MODIFY)

Add import at top:
```typescript
import { is6WeekJourneyAtRisk, isPastAtRiskThreshold } from '@/utils/journeyDetection';
import type { JourneyType } from '@/config/pointsConfig';
```

Create a new enhanced determination function:

```typescript
/**
 * Enhanced status determination with 6-week journey-specific logic
 *
 * CRITICAL: For 6W journey, at-risk status is ONLY set after week 5
 * if the learner has not reached 40,000 points
 */
export function determineStatusWithJourneyContext(
  engagementScore: number,
  daysSinceLastActivity: number,
  previousStatus: LearnerStatus | undefined,
  journeyContext: {
    journeyType: JourneyType;
    currentWeek: number;
    totalPoints: number;
  },
  recoveryStartedAt?: Timestamp,
  config: StatusCalculationConfig = DEFAULT_CONFIG,
): LearnerStatus {
  const { journeyType, currentWeek, totalPoints } = journeyContext;

  // ═══════════════════════════════════════════════════════════════════
  // 6-WEEK JOURNEY SPECIAL HANDLING
  // ═══════════════════════════════════════════════════════════════════
  if (journeyType === '6W') {
    const PASS_MARK = 40000;
    const AT_RISK_WEEK_THRESHOLD = 5;

    // If in weeks 1-5: Use standard engagement-based status (NOT points-based at-risk)
    if (currentWeek <= AT_RISK_WEEK_THRESHOLD) {
      // Standard logic without points-based at-risk
      if (previousStatus === 'in_recovery' && recoveryStartedAt) {
        const recoveryDuration =
          (Date.now() - recoveryStartedAt.toDate().getTime()) / (1000 * 60 * 60 * 24);
        if (
          recoveryDuration >= config.recovery.daysInRecoveryBeforeActive &&
          daysSinceLastActivity <= 3
        ) {
          return 'active';
        }
        return 'in_recovery';
      }

      // Only use engagement-based inactive status (not at_risk for points)
      if (
        daysSinceLastActivity >= config.inactive.daysSinceLastActivityMin &&
        engagementScore < config.inactive.engagementScoreThreshold
      ) {
        return 'inactive';
      }

      return 'active';
    }

    // Week 6+: Apply points-based at-risk logic
    if (totalPoints < PASS_MARK) {
      return 'at_risk'; // 6W specific: below 40,000 after week 5
    }

    // Passed - learner is active (or completing)
    return 'active';
  }

  // ═══════════════════════════════════════════════════════════════════
  // STANDARD LOGIC FOR OTHER JOURNEY TYPES (4W, 3M, 6M, 9M)
  // ═══════════════════════════════════════════════════════════════════
  return determineStatus(
    engagementScore,
    daysSinceLastActivity,
    previousStatus,
    recoveryStartedAt,
    config
  );
}
```

### Step 3.2: Update `calculateAndUpdateLearnerStatus` Function

Modify the existing function to use journey context:

```typescript
export async function calculateAndUpdateLearnerStatus(
  userId: string,
  orgId?: string,
): Promise<LearnerStatusRecord | null> {
  try {
    // Get previous status
    const statusRef = doc(db, 'learner_status', userId);
    const previousStatusSnap = await getDoc(statusRef);
    const previousStatus = previousStatusSnap.data() as LearnerStatusRecord | undefined;

    // Get user profile for journey context
    const profileRef = doc(db, 'profiles', userId);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      return null;
    }

    const profile = profileSnap.data();
    const totalPoints = profile.totalPoints ?? 0;
    const currentWeek = profile.currentWeek ?? 1;

    // Resolve journey type
    let journeyType: JourneyType = profile.journeyType ?? '3M';

    // If not on profile, check organization
    if (!profile.journeyType && (orgId || profile.companyId)) {
      const resolvedOrgId = orgId ?? profile.companyId;
      const orgRef = doc(db, 'organizations', resolvedOrgId);
      const orgSnap = await getDoc(orgRef);

      if (orgSnap.exists()) {
        const orgData = orgSnap.data();
        journeyType = resolveJourneyType({
          journeyType: orgData.journeyType,
          programDurationWeeks: orgData.programDurationWeeks,
          programDuration: orgData.programDuration,
        }) ?? '3M';
      }
    }

    // Calculate metrics
    const metrics = await getEngagementMetrics(userId);
    const daysSinceLastActivity = await calculateDaysSinceLastActivity(userId);
    const windowProgress = await getCurrentWindowProgress(userId, orgId);
    const engagementScore = await calculateEngagementScore(userId, metrics);

    // ═══════════════════════════════════════════════════════════════════
    // USE JOURNEY-AWARE STATUS DETERMINATION
    // ═══════════════════════════════════════════════════════════════════
    const newStatus = determineStatusWithJourneyContext(
      engagementScore.score,
      daysSinceLastActivity,
      previousStatus?.currentStatus,
      {
        journeyType,
        currentWeek,
        totalPoints,
      },
      previousStatus?.recoveryStartedAt,
    );

    // ... rest of the function remains the same
```

---

## Part 4: Organization Registration Integration

### Step 4.1: Ensure Journey Type is Stored on Registration

**File:** `src/services/organizationService.ts` (VERIFY/MODIFY)

When an organization is created or updated, ensure the journey type is calculated and stored:

```typescript
import { resolveJourneyType, journeyTypeFromDurationWeeks } from '@/utils/journeyType';

/**
 * Calculate and normalize journey type when saving organization
 */
function normalizeOrganizationJourneyData(data: Partial<OrganizationRecord>): {
  journeyType: JourneyType | null;
  programDurationWeeks: number | null;
} {
  // Explicit journey type takes priority
  if (data.journeyType && isJourneyType(data.journeyType)) {
    return {
      journeyType: data.journeyType as JourneyType,
      programDurationWeeks: JOURNEY_META[data.journeyType as JourneyType].weeks,
    };
  }

  // Calculate from weeks
  if (data.programDurationWeeks) {
    const journeyType = journeyTypeFromDurationWeeks(data.programDurationWeeks);
    return {
      journeyType,
      programDurationWeeks: data.programDurationWeeks,
    };
  }

  // Calculate from months
  if (data.programDuration) {
    const weeks = resolveDurationWeeksFromProgramDuration(data.programDuration);
    const journeyType = journeyTypeFromDurationWeeks(weeks);
    return {
      journeyType,
      programDurationWeeks: weeks,
    };
  }

  return { journeyType: null, programDurationWeeks: null };
}

// Use this in createOrganization and updateOrganization functions
```

---

## Part 5: Testing Checklist

### Unit Tests to Create

**File:** `src/utils/__tests__/journeyDetection.test.ts`

```typescript
import {
  is6WeekJourneyAtRisk,
  detectJourneyFromOrganization,
  isPastAtRiskThreshold,
} from '../journeyDetection';

describe('6-Week Journey At-Risk Logic', () => {
  describe('is6WeekJourneyAtRisk', () => {
    // Should NOT be at-risk in weeks 1-5
    it.each([1, 2, 3, 4, 5])('should NOT flag as at-risk in week %i even with 0 points', (week) => {
      const result = is6WeekJourneyAtRisk({
        journeyType: '6W',
        currentWeek: week,
        totalPoints: 0,
      });
      expect(result.isAtRisk).toBe(false);
    });

    // Should be at-risk in week 6 if below 40,000
    it('should flag as at-risk in week 6 with < 40,000 points', () => {
      const result = is6WeekJourneyAtRisk({
        journeyType: '6W',
        currentWeek: 6,
        totalPoints: 39999,
      });
      expect(result.isAtRisk).toBe(true);
    });

    // Should NOT be at-risk if passed
    it('should NOT flag as at-risk with >= 40,000 points', () => {
      const result = is6WeekJourneyAtRisk({
        journeyType: '6W',
        currentWeek: 6,
        totalPoints: 40000,
      });
      expect(result.isAtRisk).toBe(false);
    });

    // Should NOT apply to other journey types
    it.each(['4W', '3M', '6M', '9M'] as const)('should not apply to %s journey', (journeyType) => {
      const result = is6WeekJourneyAtRisk({
        journeyType,
        currentWeek: 6,
        totalPoints: 0,
      });
      expect(result.isAtRisk).toBe(false);
    });
  });

  describe('detectJourneyFromOrganization', () => {
    it('should detect 6W from programDurationWeeks: 6', () => {
      const result = detectJourneyFromOrganization({
        programDurationWeeks: 6,
      });
      expect(result.journeyType).toBe('6W');
      expect(result.passMarkPoints).toBe(40000);
      expect(result.atRiskWeekThreshold).toBe(5);
    });

    it('should detect 6W from programDuration: 1.5 (months)', () => {
      const result = detectJourneyFromOrganization({
        programDuration: 1.5,
      });
      expect(result.journeyType).toBe('6W');
    });

    it('should use explicit journeyType over calculated', () => {
      const result = detectJourneyFromOrganization({
        journeyType: '6W',
        programDurationWeeks: 12, // Would normally be 3M
      });
      expect(result.journeyType).toBe('6W');
      expect(result.detectedFrom).toBe('explicit');
    });
  });
});
```

---

## Part 6: Database Considerations

### Firestore Indexes Required

Ensure these composite indexes exist:

```json
{
  "collectionGroup": "profiles",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "journeyType", "order": "ASCENDING" }
  ]
}
```

### Schema Updates

The `learner_status` collection should include journey-aware fields:

```typescript
interface LearnerStatusRecord {
  // ... existing fields

  // NEW: Journey-specific at-risk data
  journeyType?: JourneyType;
  journeyAtRiskReason?: string; // e.g., "6W: 35,000 < 40,000 pass mark"
  pointsBasedAtRisk?: boolean;  // true if at-risk due to points (vs engagement)
}
```

---

## Summary: Key Rules for 6-Week Journey

| Condition | Status |
|-----------|--------|
| Week 1-5, any points | **NOT at-risk** (standard engagement rules only) |
| Week 6+, points < 40,000 | **AT RISK** |
| Week 6+, points >= 40,000 | **PASSED** (active status) |

### Critical Implementation Points

1. **NEVER** flag a 6W learner as "at-risk" due to points in weeks 1-5
2. **ALWAYS** check journey type before applying at-risk logic
3. **ALWAYS** resolve journey type from organization if not on profile
4. **SEPARATE** engagement-based inactivity from points-based at-risk
5. **40,000 is the magic number** - this is the 6W pass mark

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/journeyDetection.ts` | CREATE | Journey detection utilities |
| `src/services/sixWeekRiskService.ts` | CREATE | 6W-specific risk evaluation |
| `src/services/statusCalculationService.ts` | MODIFY | Add journey-aware status logic |
| `src/services/organizationService.ts` | VERIFY | Ensure journey type is stored |
| `src/utils/__tests__/journeyDetection.test.ts` | CREATE | Unit tests |

---

## Execution Order

1. Create `src/utils/journeyDetection.ts` (foundation)
2. Create `src/services/sixWeekRiskService.ts` (6W-specific logic)
3. Modify `src/services/statusCalculationService.ts` (integration)
4. Verify `src/services/organizationService.ts` (data integrity)
5. Create tests
6. Deploy and verify with test organization
