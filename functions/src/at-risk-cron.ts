/**
 * At-Risk Evaluation CRON Job
 *
 * Runs daily at 00:05 AM to evaluate all 6-Week Power Journey cohorts
 * and flag learners who are at-risk (after week 5, < 40,000 points).
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

// Constants
const SIX_WEEK_JOURNEY_TYPE = "6W";
const PASS_MARK_POINTS = 40000;
const AT_RISK_WEEK_THRESHOLD = 4; // At-risk evaluation starts at week 5 (> 4)

interface SixWeekRiskEvaluation {
  userId: string;
  journeyType: string;
  currentWeek: number;
  totalPoints: number;
  passMarkPoints: number;
  pointsDeficit: number;
  isAtRisk: boolean;
  reason: string;
  evaluatedAt: admin.firestore.Timestamp;
  weeksRemaining: number;
  canStillPass: boolean;
  orgId?: string;
}

interface EvaluationResult {
  orgId: string;
  orgName: string;
  evaluated: number;
  atRisk: SixWeekRiskEvaluation[];
  passed: number;
  notYetEvaluable: number;
  errors: number;
}

/**
 * Calculate current week of journey from start date
 */
function calculateCurrentWeek(journeyStartDate: admin.firestore.Timestamp | string | null): number {
  if (!journeyStartDate) return 1;

  const startDate = journeyStartDate instanceof admin.firestore.Timestamp
    ? journeyStartDate.toDate()
    : new Date(journeyStartDate);

  if (isNaN(startDate.getTime())) return 1;

  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const currentWeek = Math.floor(diffDays / 7) + 1;

  return Math.max(1, currentWeek);
}

/**
 * Evaluate a single learner for 6W at-risk status
 */
async function evaluateLearnerRisk(
  userId: string,
  profile: admin.firestore.DocumentData,
  orgId: string
): Promise<SixWeekRiskEvaluation | null> {
  try {
    const totalPoints = profile.totalPoints ?? 0;
    const journeyStartDate = profile.journeyStartDate ?? profile.cohortStartDate;
    const currentWeek = profile.currentWeek ?? calculateCurrentWeek(journeyStartDate);

    const weeksRemaining = Math.max(0, 6 - currentWeek + 1);
    const pointsDeficit = Math.max(0, PASS_MARK_POINTS - totalPoints);
    const requiredWeeklyAverage = weeksRemaining > 0 ? Math.ceil(pointsDeficit / weeksRemaining) : pointsDeficit;
    const canStillPass = requiredWeeklyAverage <= 10000;

    // Determine at-risk status
    let isAtRisk = false;
    let reason = "";

    if (currentWeek <= AT_RISK_WEEK_THRESHOLD) {
      reason = `Week ${currentWeek}: At-risk evaluation starts at week ${AT_RISK_WEEK_THRESHOLD + 1}`;
    } else if (totalPoints < PASS_MARK_POINTS) {
      isAtRisk = true;
      reason = `Week ${currentWeek}: ${totalPoints.toLocaleString()} points < ${PASS_MARK_POINTS.toLocaleString()} pass mark`;
    } else {
      reason = `Passed: ${totalPoints.toLocaleString()} >= ${PASS_MARK_POINTS.toLocaleString()} points`;
    }

    return {
      userId,
      journeyType: SIX_WEEK_JOURNEY_TYPE,
      currentWeek,
      totalPoints,
      passMarkPoints: PASS_MARK_POINTS,
      pointsDeficit,
      isAtRisk,
      reason,
      evaluatedAt: admin.firestore.Timestamp.now(),
      weeksRemaining,
      canStillPass,
      orgId,
    };
  } catch (error) {
    functions.logger.error(`Error evaluating learner ${userId}:`, error);
    return null;
  }
}

/**
 * Check if learner was previously at-risk
 */
async function wasLearnerAtRisk(userId: string): Promise<boolean> {
  try {
    const statusDoc = await db.collection("learner_status").doc(userId).get();
    if (!statusDoc.exists) return false;

    const data = statusDoc.data();
    return data?.currentStatus === "at_risk" && data?.pointsBasedAtRisk === true;
  } catch {
    return false;
  }
}

/**
 * Update learner status in Firestore
 */
async function updateLearnerStatus(evaluation: SixWeekRiskEvaluation): Promise<void> {
  const statusRef = db.collection("learner_status").doc(evaluation.userId);

  // Using Record type instead of UpdateData for flexibility
  const updateData: Record<string, unknown> = {
    journeyType: evaluation.journeyType,
    currentWeek: evaluation.currentWeek,
    totalPoints: evaluation.totalPoints,
    journeyPassMarkPoints: evaluation.passMarkPoints,
    pointsDeficit: evaluation.pointsDeficit,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (evaluation.isAtRisk) {
    updateData.currentStatus = "at_risk";
    updateData.pointsBasedAtRisk = true;
    updateData.journeyAtRiskReason = evaluation.reason;
    updateData.statusChangedAt = admin.firestore.FieldValue.serverTimestamp();
  } else if (evaluation.currentWeek > AT_RISK_WEEK_THRESHOLD && evaluation.totalPoints >= PASS_MARK_POINTS) {
    // Clear at-risk if learner has passed
    updateData.currentStatus = "active";
    updateData.pointsBasedAtRisk = false;
    updateData.journeyAtRiskReason = admin.firestore.FieldValue.delete();
  }

  await statusRef.set(updateData, { merge: true });
}

/**
 * Send at-risk notification to learner
 */
async function sendAtRiskNotification(evaluation: SixWeekRiskEvaluation): Promise<void> {
  try {
    const notificationData = {
      userId: evaluation.userId,
      orgId: evaluation.orgId,
      type: "six_week_at_risk",
      title: "Action Required: You're at risk of not completing your journey",
      message: `You currently have ${evaluation.totalPoints.toLocaleString()} points and need ${evaluation.pointsDeficit.toLocaleString()} more to pass. With ${evaluation.weeksRemaining} week(s) remaining, focus on completing activities to reach 40,000 points.`,
      severity: "critical",
      channels: ["in_app", "email"],
      status: "pending",
      metadata: {
        currentPoints: evaluation.totalPoints,
        pointsNeeded: evaluation.pointsDeficit,
        weeksRemaining: evaluation.weeksRemaining,
        passMarkPoints: PASS_MARK_POINTS,
        currentWeek: evaluation.currentWeek,
        canStillPass: evaluation.canStillPass,
      },
      actionRequired: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("status_alerts").add(notificationData);

    // Also create in-app notification
    await db.collection("notifications").add({
      userId: evaluation.userId,
      type: "engagement_alert",
      title: notificationData.title,
      message: notificationData.message,
      read: false,
      metadata: notificationData.metadata,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info(`Sent at-risk notification to user ${evaluation.userId}`);
  } catch (error) {
    functions.logger.error(`Error sending notification to user ${evaluation.userId}:`, error);
  }
}

/**
 * Send recovery notification when learner passes after being at-risk
 */
async function sendRecoveryNotification(evaluation: SixWeekRiskEvaluation): Promise<void> {
  try {
    await db.collection("notifications").add({
      userId: evaluation.userId,
      type: "achievement",
      title: "Congratulations! You've reached the pass mark!",
      message: `Amazing work! You've earned ${evaluation.totalPoints.toLocaleString()} points and passed the 6-Week Power Journey requirement of 40,000 points!`,
      read: false,
      metadata: {
        totalPoints: evaluation.totalPoints,
        passMarkPoints: PASS_MARK_POINTS,
        journeyType: SIX_WEEK_JOURNEY_TYPE,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info(`Sent recovery notification to user ${evaluation.userId}`);
  } catch (error) {
    functions.logger.error(`Error sending recovery notification to user ${evaluation.userId}:`, error);
  }
}

/**
 * Evaluate all learners in a 6-week organization
 */
async function evaluateOrganization(orgId: string, orgName: string): Promise<EvaluationResult> {
  const result: EvaluationResult = {
    orgId,
    orgName,
    evaluated: 0,
    atRisk: [],
    passed: 0,
    notYetEvaluable: 0,
    errors: 0,
  };

  try {
    // Get all learners in this organization
    const usersSnapshot = await db.collection("profiles")
      .where("companyId", "==", orgId)
      .where("role", "in", ["paid_member", "free_user"])
      .get();

    for (const userDoc of usersSnapshot.docs) {
      try {
        const profile = userDoc.data();
        const evaluation = await evaluateLearnerRisk(userDoc.id, profile, orgId);

        if (!evaluation) {
          result.errors++;
          continue;
        }

        result.evaluated++;

        // Check previous status
        const wasAtRisk = await wasLearnerAtRisk(userDoc.id);

        if (evaluation.isAtRisk) {
          result.atRisk.push(evaluation);

          // Update status
          await updateLearnerStatus(evaluation);

          // Send notification only if NEWLY flagged (was not at-risk before)
          if (!wasAtRisk) {
            await sendAtRiskNotification(evaluation);
          }
        } else if (evaluation.currentWeek <= AT_RISK_WEEK_THRESHOLD) {
          result.notYetEvaluable++;
        } else {
          result.passed++;

          // If was at-risk but now passed, send recovery notification
          if (wasAtRisk) {
            await updateLearnerStatus(evaluation);
            await sendRecoveryNotification(evaluation);
          }
        }
      } catch (error) {
        functions.logger.error(`Error evaluating user ${userDoc.id}:`, error);
        result.errors++;
      }
    }

    return result;
  } catch (error) {
    functions.logger.error(`Error evaluating organization ${orgId}:`, error);
    return result;
  }
}

/**
 * Main CRON function - runs daily at 00:05 AM
 */
export const dailyAtRiskEvaluation = functions
  .region("us-central1")
  .pubsub.schedule("5 0 * * *") // Run at 00:05 AM daily
  .timeZone("Africa/Johannesburg") // South Africa timezone
  .onRun(async () => {
    const startTime = Date.now();
    functions.logger.info("🌙 Starting Daily 6-Week At-Risk Evaluation...");

    const results: EvaluationResult[] = [];
    let totalEvaluated = 0;
    let totalAtRisk = 0;
    let totalPassed = 0;
    let totalErrors = 0;

    try {
      // Get all active 6-week journey organizations
      const orgsSnapshot = await db.collection("organizations")
        .where("status", "==", "active")
        .where("journeyType", "==", SIX_WEEK_JOURNEY_TYPE)
        .get();

      functions.logger.info(`Found ${orgsSnapshot.size} active 6-Week organizations to evaluate`);

      for (const orgDoc of orgsSnapshot.docs) {
        const orgData = orgDoc.data();
        const orgName = orgData.name ?? orgDoc.id;

        functions.logger.info(`Evaluating organization: ${orgName} (${orgDoc.id})`);

        const result = await evaluateOrganization(orgDoc.id, orgName);
        results.push(result);

        totalEvaluated += result.evaluated;
        totalAtRisk += result.atRisk.length;
        totalPassed += result.passed;
        totalErrors += result.errors;

        functions.logger.info(`Organization ${orgName}: ${result.evaluated} evaluated, ${result.atRisk.length} at-risk, ${result.passed} passed, ${result.errors} errors`);
      }

      // Log summary
      const duration = (Date.now() - startTime) / 1000;
      await db.collection("cron_logs").add({
        cronJob: "dailyAtRiskEvaluation",
        journeyType: SIX_WEEK_JOURNEY_TYPE,
        startedAt: admin.firestore.Timestamp.fromMillis(startTime),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        durationSeconds: duration,
        organizationsProcessed: orgsSnapshot.size,
        totalEvaluated,
        totalAtRisk,
        totalPassed,
        totalErrors,
        status: totalErrors === 0 ? "success" : "completed_with_errors",
      });

      functions.logger.info(`🏁 Daily At-Risk Evaluation complete in ${duration.toFixed(2)}s`);
      functions.logger.info(`Summary: ${totalEvaluated} evaluated, ${totalAtRisk} at-risk, ${totalPassed} passed, ${totalErrors} errors`);

    } catch (error) {
      functions.logger.error("Critical error in daily at-risk evaluation:", error);

      // Log failure
      await db.collection("cron_logs").add({
        cronJob: "dailyAtRiskEvaluation",
        journeyType: SIX_WEEK_JOURNEY_TYPE,
        startedAt: admin.firestore.Timestamp.fromMillis(startTime),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "failed",
        error: String(error),
      });
    }
  });

/**
 * HTTP endpoint to manually trigger at-risk evaluation (for testing/admin use)
 */
export const triggerAtRiskEvaluation = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    // Verify caller is admin
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required");
    }

    const callerDoc = await db.collection("profiles").doc(context.auth.uid).get();
    const callerRole = callerDoc.data()?.role;

    if (callerRole !== "super_admin" && callerRole !== "partner") {
      throw new functions.https.HttpsError("permission-denied", "Only admins can trigger at-risk evaluation");
    }

    const orgId = data?.orgId;

    if (orgId) {
      // Evaluate specific organization
      const orgDoc = await db.collection("organizations").doc(orgId).get();
      if (!orgDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Organization not found");
      }

      const orgData = orgDoc.data();
      if (orgData?.journeyType !== SIX_WEEK_JOURNEY_TYPE) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `At-Risk evaluation only applies to 6-Week Power Journey. This organization is ${orgData?.journeyType}`
        );
      }

      const result = await evaluateOrganization(orgId, orgData?.name ?? orgId);
      return { success: true, result };
    } else {
      // Evaluate all 6W organizations
      const orgsSnapshot = await db.collection("organizations")
        .where("status", "==", "active")
        .where("journeyType", "==", SIX_WEEK_JOURNEY_TYPE)
        .get();

      const results: EvaluationResult[] = [];
      for (const orgDoc of orgsSnapshot.docs) {
        const orgData = orgDoc.data();
        const result = await evaluateOrganization(orgDoc.id, orgData.name ?? orgDoc.id);
        results.push(result);
      }

      return {
        success: true,
        organizationsProcessed: results.length,
        results,
      };
    }
  });
