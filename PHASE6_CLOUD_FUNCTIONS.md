# Phase 6: Cloud Functions Specifications

## Overview

Six Cloud Functions support Phase 6 implementation:
1. **onOrgConfigUpdate** - Triggered when org config changes
2. **evaluateActivityVisibility** - Hourly visibility recalculation
3. **recalculatePassMarks** - Daily pass mark recalculation
4. **syncOrgDashboard** - Daily dashboard snapshot
5. **enforceOrgRules** - Rules engine executor
6. **processRuleTriggers** - Monitor and execute rules

---

## Function 1: onOrgConfigUpdate

**Trigger:** Firestore write on `organization_configuration/{orgId}`

**Purpose:** Apply changes when org config is modified

```typescript
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

const db = admin.firestore()

export const onOrgConfigUpdate = functions.firestore
  .document('organization_configuration/{orgId}')
  .onWrite(async (change, context) => {
    const { orgId } = context.params
    const newConfig = change.after.data()
    const oldConfig = change.before.data()

    if (!newConfig) return // Deletion

    try {
      // Detect what changed
      const leadershipChanged =
        JSON.stringify(oldConfig?.leadership) !==
        JSON.stringify(newConfig.leadership)

      const featuresChanged =
        JSON.stringify(oldConfig?.features) !==
        JSON.stringify(newConfig.features)

      const passMarkChanged =
        JSON.stringify(oldConfig?.passMark) !==
        JSON.stringify(newConfig.passMark)

      // If leadership changed, recalculate visibility
      if (leadershipChanged) {
        console.log(`Leadership changed for org ${orgId}`)

        // Queue activity visibility refresh
        await db.collection('tasks').add({
          type: 'refresh_visibility',
          orgId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        // Notify admins
        await notifyAdmins(
          orgId,
          'Leadership configuration updated',
          'Some activities may have been hidden or shown'
        )
      }

      // If pass marks changed, recalculate learner marks
      if (passMarkChanged) {
        console.log(`Pass marks changed for org ${orgId}`)

        // Queue pass mark recalculation
        await db.collection('tasks').add({
          type: 'recalculate_pass_marks',
          orgId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        // Notify learners
        await notifyLearnersOfPassMarkChange(orgId)
      }

      // Log change
      await db
        .collection('organization_configuration')
        .doc(orgId)
        .collection('changes')
        .add({
          type: 'auto_detection',
          leadershipChanged,
          featuresChanged,
          passMarkChanged,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        })
    } catch (error) {
      console.error(`Error processing config update for ${orgId}:`, error)
      // Don't throw - log for debugging
    }
  })
```

---

## Function 2: evaluateActivityVisibility

**Trigger:** Cloud Scheduler (hourly, 00:00 UTC)

**Purpose:** Update activity visibility based on current org state

```typescript
export const evaluateActivityVisibility = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    try {
      // Get all orgs
      const orgsSnapshot = await db.collection('organizations').get()

      console.log(`Evaluating visibility for ${orgsSnapshot.size} organizations`)

      const batch = db.batch()
      let updateCount = 0

      for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id

        // Get org configuration
        const configDoc = await db
          .collection('organization_configuration')
          .doc(orgId)
          .get()

        if (!configDoc.exists) continue

        const config = configDoc.data()
        const activityOverrides = config.passMark?.activityOverrides || {}

        // Evaluate each activity
        for (const [activityId, override] of Object.entries(
          activityOverrides
        )) {
          const visibilityId = `${activityId}-${orgId}`
          const visibility = {
            id: visibilityId,
            orgId,
            activityId,
            visible: shouldActivityBeVisible(override, config),
            reason: getVisibilityReason(override, config),
            detailedReason: getDetailedReason(override, config),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: 'system',
          }

          batch.set(
            db.collection('organization_activity_visibility').doc(visibilityId),
            visibility,
            { merge: true }
          )

          updateCount++
        }
      }

      if (updateCount > 0) {
        await batch.commit()
      }

      console.log(`Updated visibility for ${updateCount} activities`)
    } catch (error) {
      console.error('Error evaluating activity visibility:', error)
      throw error
    }
  })

function shouldActivityBeVisible(
  override: any,
  config: any
): boolean {
  if (override.visibleWhen === 'always') return true
  if (override.visibleWhen === 'never') return false

  // If leadership required, check if available
  if (override.leadershipDependency) {
    const leadershipKey = `has${override.leadershipDependency
      .charAt(0)
      .toUpperCase()}${override.leadershipDependency.slice(1)}`
    return config.leadership?.[leadershipKey] === true
  }

  return true
}

function getVisibilityReason(override: any, config: any): string {
  if (override.visibleWhen === 'never') return 'custom_rule'
  if (override.leadershipDependency) {
    const leadershipKey = `has${override.leadershipDependency
      .charAt(0)
      .toUpperCase()}${override.leadershipDependency.slice(1)}`
    if (!config.leadership?.[leadershipKey]) {
      return 'leadership_unavailable'
    }
  }
  return 'available'
}

function getDetailedReason(override: any, config: any): string {
  if (override.visibleWhen === 'never') {
    return override.reason || 'Activity is currently unavailable'
  }
  if (override.leadershipDependency) {
    const role = override.leadershipDependency
    const leadershipKey = `has${role
      .charAt(0)
      .toUpperCase()}${role.slice(1)}`
    if (!config.leadership?.[leadershipKey]) {
      return `This activity requires a ${role} who is not currently available`
    }
  }
  return 'Activity is available'
}
```

---

## Function 3: recalculatePassMarks

**Trigger:** Cloud Scheduler (daily, 05:00 UTC)

**Purpose:** Recalculate and update pass marks for all active learners

```typescript
export const recalculatePassMarks = functions.pubsub
  .schedule('every 1 days 05:00')
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      console.log('Starting daily pass mark recalculation')

      // Get all active windows
      const windowsSnapshot = await db
        .collectionGroup('windows')
        .where('status', '==', 'active')
        .get()

      console.log(`Processing ${windowsSnapshot.size} active windows`)

      let updatedCount = 0

      for (const windowDoc of windowsSnapshot.docs) {
        const window = windowDoc.data()
        const orgId = window.orgId

        // Get all active learners in this window
        const learnersSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('learner_pass_marks')
          .where('windowId', '==', windowDoc.id)
          .get()

        for (const learnerDoc of learnersSnapshot.docs) {
          const learner = learnerDoc.data()

          // Recalculate pass mark
          const passmark = await calculateLearnerPassMark(
            orgId,
            learner.userId,
            windowDoc.id
          )

          const hasChanged =
            passmark !== learner.finalPassMark

          if (hasChanged) {
            // Update
            await db
              .collection('organizations')
              .doc(orgId)
              .collection('learner_pass_marks')
              .doc(learnerDoc.id)
              .update({
                finalPassMark: passmark,
                'transparency.explanation': generateExplanation(
                  passmark
                ),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              })

            // Notify learner
            await notifyLearnerOfPassMarkChange(
              learner.userId,
              passmark
            )

            updatedCount++
          }
        }
      }

      console.log(`Updated pass marks for ${updatedCount} learners`)
    } catch (error) {
      console.error('Error recalculating pass marks:', error)
      throw error
    }
  })
```

---

## Function 4: syncOrgDashboard

**Trigger:** Cloud Scheduler (daily, 06:00 UTC)

**Purpose:** Generate daily dashboard snapshot for admins

```typescript
export const syncOrgDashboard = functions.pubsub
  .schedule('every 1 days 06:00')
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      console.log('Starting daily org dashboard sync')

      // Get all organizations
      const orgsSnapshot = await db.collection('organizations').get()

      for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id
        const today = new Date().toISOString().split('T')[0]

        // Calculate statistics
        const stats = await calculateOrgStatistics(orgId)

        // Generate snapshot
        const snapshot = {
          id: `${orgId}-${today}`,
          orgId,
          date: today,
          teamStats: stats.teamStats,
          leadershipStats: stats.leadershipStats,
          adjustmentStats: stats.adjustmentStats,
          activityStats: stats.activityStats,
          alerts: generateAlerts(stats),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }

        // Store snapshot
        await db
          .collection('organization_dashboard_snapshots')
          .doc(`${orgId}-${today}`)
          .set(snapshot)

        // Send email if configured
        const config = await db
          .collection('organization_configuration')
          .doc(orgId)
          .get()

        if (
          config.data()?.dashboardConfig?.reportSchedule === 'daily' &&
          config.data()?.dashboardConfig?.reportRecipients
        ) {
          await sendDashboardEmail(orgId, snapshot)
        }

        // Alert on critical issues
        const criticalAlerts = snapshot.alerts.filter(
          (a) => a.severity === 'critical'
        )

        if (criticalAlerts.length > 0) {
          await notifyAdmins(
            orgId,
            '🚨 Critical Dashboard Alerts',
            criticalAlerts.map((a) => a.message).join('\n')
          )
        }
      }

      console.log(
        `Completed dashboard sync for ${orgsSnapshot.size} organizations`
      )
    } catch (error) {
      console.error('Error syncing org dashboard:', error)
      throw error
    }
  })

async function calculateOrgStatistics(orgId: string) {
  // Calculate team health, leadership utilization, adjustments, etc.
  // Return comprehensive statistics object
}

function generateAlerts(stats: any) {
  const alerts = []

  if (stats.leadershipStats.mentorUtilization > 90) {
    alerts.push({
      severity: 'warning',
      message: 'Mentor is at 90%+ capacity',
    })
  }

  if (stats.adjustmentStats.learnersWithAdjustments > stats.teamStats.totalMembers * 0.5) {
    alerts.push({
      severity: 'info',
      message:
        'More than 50% of learners have pass mark adjustments',
    })
  }

  return alerts
}
```

---

## Function 5: enforceOrgRules

**Trigger:** Activity claim submission

**Purpose:** Enforce org rules when activities are completed

```typescript
export const enforceOrgRules = functions.https.onCall(
  async (data, context) => {
    const { orgId, learnerUserId, activityId, windowId } = data

    if (!context.auth || !orgId) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      )
    }

    try {
      // Get org configuration
      const config = await db
        .collection('organization_configuration')
        .doc(orgId)
        .get()

      if (!config.exists) {
        return { allowed: true, reason: 'No config' }
      }

      const configData = config.data()

      // Check if activity is visible
      const visibility = await db
        .collection('organization_activity_visibility')
        .doc(`${activityId}-${orgId}`)
        .get()

      if (visibility.exists && !visibility.data().visible) {
        return {
          allowed: false,
          reason: 'Activity is not currently available',
          detail: visibility.data().detailedReason,
        }
      }

      // Check activity override
      const override = configData.passMark?.activityOverrides?.[
        activityId
      ]

      if (override?.leadershipDependency) {
        const leadershipKey = `has${override.leadershipDependency
          .charAt(0)
          .toUpperCase()}${override.leadershipDependency.slice(1)}`

        if (!configData.leadership?.[leadershipKey]) {
          return {
            allowed: true,
            warning: `Awaiting ${override.leadershipDependency} approval`,
            countsTowardPassMark: false,
          }
        }
      }

      return {
        allowed: true,
        countsTowardPassMark: true,
      }
    } catch (error) {
      console.error('Error enforcing org rules:', error)
      throw new functions.https.HttpsError(
        'internal',
        'Error enforcing rules'
      )
    }
  }
)
```

---

## Function 6: processRuleTriggers

**Trigger:** Firestore writes or custom events

**Purpose:** Execute dynamic journey rules

```typescript
export const processRuleTriggers = functions.firestore
  .document('organization_configuration/{orgId}')
  .onUpdate(async (change, context) => {
    const { orgId } = context.params
    const newConfig = change.after.data()

    try {
      // Create evaluation context
      const context_data = {
        org: {
          id: orgId,
          leadership: newConfig.leadership,
          features: newConfig.features,
        },
        timestamp: new Date().toISOString(),
      }

      // Get rules
      const rules = newConfig.journeyRules || []

      // Execute applicable rules
      for (const rule of rules.sort((a, b) => b.priority - a.priority)) {
        if (!rule.enabled) continue

        // Evaluate conditions
        const conditionsMet = evaluateConditions(
          rule.conditions,
          context_data
        )

        if (conditionsMet) {
          console.log(`Executing rule: ${rule.name}`)

          // Execute actions
          for (const action of rule.actions) {
            await executeAction(orgId, action, context_data)
          }

          // Record execution
          await db
            .collection('organizations')
            .doc(orgId)
            .collection('rule_executions')
            .add({
              ruleId: rule.id,
              ruleName: rule.name,
              executedAt: admin.firestore.FieldValue.serverTimestamp(),
              success: true,
            })

          // If runOnce, disable
          if (rule.runOnce) {
            rule.enabled = false
          }
        }
      }

      // Update rules in config
      if (newConfig.journeyRules) {
        await db
          .collection('organization_configuration')
          .doc(orgId)
          .update({
            journeyRules: newConfig.journeyRules,
          })
      }
    } catch (error) {
      console.error(`Error processing rule triggers for ${orgId}:`, error)
    }
  })

function evaluateConditions(conditions: any[], context: any): boolean {
  // Implement condition evaluation logic
  return true
}

async function executeAction(
  orgId: string,
  action: any,
  context: any
) {
  // Implement action execution logic based on action.type
}
```

---

## Firestore Indexes Required

```yaml
indexes:
  - collection: organization_configuration
    queryScope: Collection
    fields:
      - fieldPath: enabled
        order: ASCENDING
      - fieldPath: createdAt
        order: DESCENDING

  - collection: organizations
    queryScope: Collection
    fields:
      - fieldPath: leadership.hasMentor
        order: ASCENDING
      - fieldPath: status
        order: ASCENDING

  - collection: organization_activity_visibility
    queryScope: Collection
    fields:
      - fieldPath: orgId
        order: ASCENDING
      - fieldPath: visible
        order: ASCENDING
      - fieldPath: updatedAt
        order: DESCENDING

  - collection: learner_pass_marks
    queryScope: Collection
    fields:
      - fieldPath: orgId
        order: ASCENDING
      - fieldPath: windowId
        order: ASCENDING
      - fieldPath: createdAt
        order: DESCENDING
```

---

## Security Rules

```firebase
match /organization_configuration/{orgId} {
  allow read: if resource.data.orgId == request.auth.uid ||
              request.auth.token.orgAdmin == orgId ||
              request.auth.token.superAdmin == true;
  allow write: if request.auth.token.orgAdmin == orgId ||
               request.auth.token.superAdmin == true;
}

match /organization_activity_visibility/{document=**} {
  allow read: if true;
  allow write: if request.auth.token.orgAdmin == resource.data.orgId ||
               request.auth.token.superAdmin == true;
}

match /organizations/{orgId}/learner_pass_marks/{document=**} {
  allow read: if request.auth.uid == resource.data.userId ||
              request.auth.token.orgAdmin == orgId ||
              request.auth.token.superAdmin == true;
  allow write: if request.auth.token.orgAdmin == orgId ||
               request.auth.token.superAdmin == true;
}
```

---

## Deployment

```bash
# Deploy all Phase 6 functions
firebase deploy --only functions:onOrgConfigUpdate,functions:evaluateActivityVisibility,functions:recalculatePassMarks,functions:syncOrgDashboard,functions:enforceOrgRules,functions:processRuleTriggers

# Deploy with specific region
firebase deploy --only functions:evaluateActivityVisibility --region us-central1
```

---

## Monitoring & Alerts

Configure Cloud Monitoring alerts for:

- **Function Errors:** Alert if any function error rate > 1%
- **Duration:** Alert if execution time > 60s
- **Backlog:** Alert if message backlog > 100

---

## Cost Optimization

- Use scheduled functions (cheaper than continuous polling)
- Batch operations where possible
- Implement caching for org configurations
- Use transactional writes to prevent duplicates
