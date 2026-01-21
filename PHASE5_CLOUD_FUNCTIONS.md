# Phase 5: Cloud Functions Specifications

## Overview
Cloud Functions handle the backend automation for Phase 5. These functions run on a schedule or in response to events.

---

## Function 1: `calculateLearnerStatus` (Scheduled)

**Trigger:** Firestore scheduled function (every 1 hour)  
**Purpose:** Calculate and update learner status for all active users

```typescript
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { calculateAndUpdateLearnerStatus, getAtRiskLearners } from './statusCalculationService'
import { createStatusChangeAlert } from './statusChangeDetectorService'
import { sendStatusChangeNotification } from './statusNotificationService'

export const calculateLearnerStatus = functions.pubsub
  .schedule('every 60 minutes')
  .onRun(async (context) => {
    const db = admin.firestore()
    const logger = functions.logger
    
    try {
      // Get all organizations
      const orgsSnapshot = await db.collection('organizations').get()
      let totalProcessed = 0
      let statusChanges = 0

      for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id
        const orgData = orgDoc.data()

        // Get all users in organization
        const usersSnapshot = await db.collection('profiles')
          .where('companyId', '==', orgId)
          .get()

        for (const userDoc of usersSnapshot.docs) {
          const userId = userDoc.id

          try {
            // Calculate status
            const previousStatusSnap = await db.collection('learner_status').doc(userId).get()
            const previousStatus = previousStatusSnap.data()?.currentStatus

            const newStatusRecord = await calculateAndUpdateLearnerStatus(userId, orgId)

            if (newStatusRecord) {
              totalProcessed++

              // If status changed, trigger alerts
              if (newStatusRecord.currentStatus !== previousStatus) {
                statusChanges++

                // Create alert
                const alert = await createStatusChangeAlert(
                  userId,
                  orgId,
                  previousStatus || 'active',
                  newStatusRecord.currentStatus,
                  {
                    engagementScore: newStatusRecord.engagementScore,
                    daysSinceActivity: newStatusRecord.daysSinceLastActivity,
                    completionRate: newStatusRecord.completionRate,
                    pointsTrend: 'stable',
                  },
                )

                // Send notification if alert created
                if (alert) {
                  await sendStatusChangeNotification({
                    userId,
                    previousStatus: previousStatus || 'active',
                    newStatus: newStatusRecord.currentStatus,
                    engagementScore: newStatusRecord.engagementScore,
                    daysSinceActivity: newStatusRecord.daysSinceLastActivity,
                    suggestedActions: alert.suggestedActions || [],
                  })
                }
              }
            }
          } catch (error) {
            logger.error(`Error processing user ${userId}:`, error)
          }
        }
      }

      logger.log(`Status calculation completed. Processed: ${totalProcessed}, Changes: ${statusChanges}`)
      return { processed: totalProcessed, statusChanges }
    } catch (error) {
      logger.error('Error in calculateLearnerStatus:', error)
      throw error
    }
  })
```

---

## Function 2: `sendStatusAlerts` (Scheduled)

**Trigger:** Firestore scheduled function (every 15 minutes)  
**Purpose:** Dequeue and send pending status alerts

```typescript
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { processPendingAlerts } from './statusNotificationService'

export const sendStatusAlerts = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    const logger = functions.logger
    
    try {
      const result = await processPendingAlerts()
      logger.log('Alert processing completed:', result)
      return result
    } catch (error) {
      logger.error('Error in sendStatusAlerts:', error)
      throw error
    }
  })
```

---

## Function 3: `sendPartnerDigests` (Scheduled)

**Trigger:** Firestore scheduled function (daily at 9 AM UTC)  
**Purpose:** Generate and send daily digests to partners/mentors

```typescript
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { generatePartnerDigest, sendPartnerDigestEmail, processPendingDigests } from './partnerDigestService'

export const sendPartnerDigests = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = admin.firestore()
    const logger = functions.logger
    
    try {
      // Get all organizations
      const orgsSnapshot = await db.collection('organizations').get()
      let generatedCount = 0
      let sentCount = 0

      for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id

        // Get all mentors/partners in org
        const partnersSnapshot = await db.collection('profiles')
          .where('companyId', '==', orgId)
          .where('role', 'in', ['mentor', 'ambassador', 'company_admin'])
          .get()

        for (const partnerDoc of partnersSnapshot.docs) {
          const partnerId = partnerDoc.id
          const partnerEmail = partnerDoc.data().email

          try {
            // Generate digest
            const digest = await generatePartnerDigest(
              partnerId,
              partnerEmail,
              orgId,
            )

            if (digest) {
              generatedCount++

              // Send email
              const sent = await sendPartnerDigestEmail(digest)
              if (sent) {
                sentCount++
              }
            }
          } catch (error) {
            logger.error(`Error generating digest for ${partnerId}:`, error)
          }
        }
      }

      logger.log(`Digest processing completed. Generated: ${generatedCount}, Sent: ${sentCount}`)
      return { generated: generatedCount, sent: sentCount }
    } catch (error) {
      logger.error('Error in sendPartnerDigests:', error)
      throw error
    }
  })
```

---

## Function 4: `onActivityApproved` (Triggered)

**Trigger:** Firestore document write on `activityClaims/{claimId}`  
**Purpose:** Update engagement metrics when activity is approved

```typescript
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { onActivityCompleted } from './statusChangeDetectorService'

export const onActivityApproved = functions.firestore
  .document('activityClaims/{claimId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after = change.after.data()
    const logger = functions.logger

    // Only process if status changed to 'approved'
    if (before.status === 'approved' || after.status !== 'approved') {
      return
    }

    try {
      const userId = after.uid
      const orgId = after.orgId
      const pointsClaimed = after.pointsClaimed

      // Trigger metric update
      await onActivityCompleted(userId, orgId, pointsClaimed)

      logger.log(`Updated metrics for user ${userId}`)
    } catch (error) {
      logger.error('Error in onActivityApproved:', error)
    }
  })
```

---

## Function 5: `retryFailedNotifications` (Scheduled)

**Trigger:** Firestore scheduled function (every 4 hours)  
**Purpose:** Retry sending failed notifications

```typescript
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { retryFailedAlerts } from './statusChangeDetectorService'

export const retryFailedNotifications = functions.pubsub
  .schedule('every 4 hours')
  .onRun(async (context) => {
    const logger = functions.logger

    try {
      const result = await retryFailedAlerts(3)
      logger.log('Retry processing completed:', result)
      return result
    } catch (error) {
      logger.error('Error in retryFailedNotifications:', error)
      throw error
    }
  })
```

---

## Function 6: `cleanupOldDigests` (Scheduled)

**Trigger:** Firestore scheduled function (daily at 3 AM UTC)  
**Purpose:** Archive and cleanup old digests

```typescript
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

export const cleanupOldDigests = functions.pubsub
  .schedule('0 3 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = admin.firestore()
    const logger = functions.logger

    try {
      // Delete digests older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const oldDigestsQuery = db.collection('partner_daily_digest_queue')
        .where('status', '==', 'sent')
        .where('sentAt', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))

      const batch = db.batch()
      let deletedCount = 0

      const oldDigests = await oldDigestsQuery.get()
      oldDigests.docs.forEach((doc) => {
        batch.delete(doc.ref)
        deletedCount++
      })

      await batch.commit()

      logger.log(`Cleaned up ${deletedCount} old digests`)
      return { deleted: deletedCount }
    } catch (error) {
      logger.error('Error in cleanupOldDigests:', error)
      throw error
    }
  })
```

---

## Firestore Indexes Required

Create these composite indexes for efficient queries:

```
Collection: learner_status
Indexes:
  - orgId, currentStatus (for querying at-risk by org)
  - orgId, currentStatus, daysSinceLastActivity
  - orgId, statusChangedAt (for recent changes)
  - engagementScore, daysSinceLastActivity

Collection: status_alerts
Indexes:
  - userId, status, createdAt
  - orgId, status, createdAt
  - userId, type, createdAt

Collection: partner_daily_digest_queue
Indexes:
  - partnerId, status, digestDate
  - orgId, status, createdAt
  - status, createdAt (for processing)

Collection: engagement_metrics
Indexes:
  - userId, date (for daily tracking)
  - orgId, date (for org analytics)
```

---

## Firestore Security Rules Updates

Add these rules to `firestore.rules`:

```
// Allow users to read their own status
match /learner_status/{userId} {
  allow read: if request.auth.uid == userId || 
                 userIsPartner(userId) ||
                 request.auth.token.role == 'super_admin'
  allow write: if request.auth.token.role == 'super_admin'
}

// Allow users to read their own alerts
match /status_alerts/{alertId} {
  allow read: if request.auth.uid == resource.data.userId
  allow write: if request.auth.token.role == 'super_admin'
}

// Allow partners to read digests
match /partner_daily_digest_queue/{digestId} {
  allow read: if request.auth.uid == resource.data.partnerId ||
                 request.auth.token.role == 'super_admin'
  allow write: if request.auth.token.role == 'super_admin'
}

// Notification preferences
match /notification_preferences/{userId} {
  allow read, write: if request.auth.uid == userId
}
```

---

## Deployment Instructions

1. **Copy functions to `functions/src/`**
2. **Update `functions/package.json` with dependencies:**
   ```json
   {
     "dependencies": {
       "firebase-admin": "^12.0.0",
       "firebase-functions": "^5.0.0"
     }
   }
   ```

3. **Deploy:**
   ```bash
   firebase deploy --only functions
   ```

4. **Create indexes (if not auto-created):**
   ```bash
   firebase firestore:indexes
   ```

---

## Testing the Functions

### Test locally with Firebase emulator:

```bash
firebase emulators:start --only firestore,pubsub,functions
```

### Manual triggers for testing:

```bash
# Calculate status now
curl -X POST "http://localhost:5001/PROJECT/us-central1/calculateLearnerStatus" \
  -H "Content-Type: application/json" \
  -d '{"data":{}}'

# Send alerts now
curl -X POST "http://localhost:5001/PROJECT/us-central1/sendStatusAlerts" \
  -H "Content-Type: application/json" \
  -d '{"data":{}}'

# Send digests now
curl -X POST "http://localhost:5001/PROJECT/us-central1/sendPartnerDigests" \
  -H "Content-Type: application/json" \
  -d '{"data":{}}'
```

---

## Monitoring & Observability

Enable logging for each function:

```bash
gcloud functions deploy calculateLearnerStatus --update-env-vars LOG_LEVEL=INFO
gcloud functions deploy sendStatusAlerts --update-env-vars LOG_LEVEL=INFO
gcloud functions deploy sendPartnerDigests --update-env-vars LOG_LEVEL=INFO
```

View logs:

```bash
gcloud functions logs read calculateLearnerStatus --limit 50
gcloud functions logs read sendStatusAlerts --limit 50
gcloud functions logs read sendPartnerDigests --limit 50
```
