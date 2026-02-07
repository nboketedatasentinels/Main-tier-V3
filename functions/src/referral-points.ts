/**
 * Cloud Functions: Referral Points System
 *
 * Handles server-side referral point awards to prevent client manipulation.
 * Points are awarded when a referred user completes their first platform activity.
 *
 * Key Features:
 * - Triggered when referred user first writes to pointsLedger
 * - Awards points to referrer via proper ledger entries
 * - Idempotent - prevents duplicate awards
 * - Maintains audit trail in referrals collection
 * - Sends notifications to referrer
 *
 * Deploy with:
 * firebase deploy --only functions:onReferredUserFirstActivity,functions:creditReferralPointsCallable
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

// Constants matching the client-side config
const REFERRAL_POINTS = 100;
const REFERRAL_MAX_PER_USER = 100;

interface ReferralRecord {
  referredUid: string;
  referrerUid: string;
  refCode: string;
  status: "pending" | "credited" | "rejected";
  createdAt?: admin.firestore.Timestamp;
  creditedAt?: admin.firestore.Timestamp;
  firstActivityId?: string;
  firstActivityAt?: admin.firestore.Timestamp;
}

interface UserProfile {
  id?: string;
  referredBy?: string | null;
  referralStatus?: "pending" | "credited" | "rejected" | null;
  referralCount?: number;
  totalPoints?: number;
  level?: number;
  journeyType?: string;
  currentWeek?: number;
  companyId?: string | null;
}

interface PointsLedgerEntry {
  uid: string;
  weekNumber: number;
  monthNumber: number;
  activityId: string;
  points: number;
  source: string;
  approvalType: string;
  createdAt: admin.firestore.Timestamp;
}

/**
 * Calculate user level based on total points.
 * Mirrors the client-side calculation for consistency.
 */
function calculateLevel(totalPoints: number): number {
  if (totalPoints < 1000) return 1;
  if (totalPoints < 5000) return 2;
  if (totalPoints < 15000) return 3;
  if (totalPoints < 35000) return 4;
  if (totalPoints < 75000) return 5;
  if (totalPoints < 150000) return 6;
  return 7;
}

/**
 * Get the window number (month) from a week number.
 * 2-week windows: weeks 1-2 = window 1, weeks 3-4 = window 2, etc.
 */
function getWindowNumber(weekNumber: number): number {
  return Math.ceil(weekNumber / 2);
}

/**
 * Firestore Trigger: Award referral points when referred user completes first activity
 *
 * Triggered when a new document is created in the pointsLedger collection.
 * Checks if the user was referred and if this is their first activity.
 * If so, awards referral bonus points to the referrer.
 */
export const onReferredUserFirstActivity = functions
  .region("us-central1")
  .firestore.document("pointsLedger/{ledgerId}")
  .onCreate(async (snapshot, context) => {
    const ledgerData = snapshot.data() as PointsLedgerEntry;
    const referredUid = ledgerData.uid;

    console.log(
      `[Referral] New ledger entry for user ${referredUid}, activity: ${ledgerData.activityId}`
    );

    // Skip if this is a referral bonus entry (prevent infinite loop)
    if (ledgerData.activityId === "referral_bonus") {
      console.log("[Referral] Skipping referral_bonus activity to prevent loop");
      return null;
    }

    try {
      // Check if user was referred
      const userDoc = await db.collection("profiles").doc(referredUid).get();
      if (!userDoc.exists) {
        console.log(`[Referral] User ${referredUid} profile not found`);
        return null;
      }

      const userData = userDoc.data() as UserProfile;
      const referrerUid = userData.referredBy;

      // Skip if user wasn't referred or already credited
      if (!referrerUid) {
        console.log(`[Referral] User ${referredUid} was not referred`);
        return null;
      }

      if (userData.referralStatus === "credited") {
        console.log(`[Referral] Referral already credited for user ${referredUid}`);
        return null;
      }

      if (userData.referralStatus === "rejected") {
        console.log(`[Referral] Referral was rejected for user ${referredUid}`);
        return null;
      }

      // Check referral record exists
      const referralDoc = await db.collection("referrals").doc(referredUid).get();
      if (!referralDoc.exists) {
        console.log(`[Referral] No referral record found for ${referredUid}`);
        return null;
      }

      const referralData = referralDoc.data() as ReferralRecord;
      if (referralData.status !== "pending") {
        console.log(
          `[Referral] Referral status is ${referralData.status}, not pending`
        );
        return null;
      }

      // We rely on referral status to keep this idempotent instead of checking ledger count.
      // That way we credit the referrer as soon as the referred user completes any activity, even if other points were recorded earlier.

      console.log(
        `[Referral] First activity detected for referred user ${referredUid}, crediting referrer ${referrerUid}`
      );

      // Award points to referrer
      return await creditReferralPointsInternal(
        referredUid,
        referrerUid,
        ledgerData.activityId
      );
    } catch (error) {
      console.error(`[Referral] Error processing referral for ${referredUid}:`, error);
      throw error;
    }
  });

/**
 * HTTPS Callable: Manually credit referral points (admin/partner use)
 *
 * Allows partners or admins to manually trigger referral point awards.
 * Useful for edge cases where automatic detection failed.
 */
export const creditReferralPointsCallable = functions
  .region("us-central1")
  .https.onCall(
    async (
      data: { referredUid: string },
      context
    ): Promise<{ success: boolean; message: string }> => {
      // Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "User must be authenticated"
        );
      }

      // Check authorization (super_admin or partner only)
      const callerUid = context.auth.uid;
      const callerDoc = await db.collection("profiles").doc(callerUid).get();

      if (!callerDoc.exists) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "User profile not found"
        );
      }

      const callerRole = callerDoc.data()?.role;
      if (callerRole !== "super_admin" && callerRole !== "partner") {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only super admins and partners can manually credit referral points"
        );
      }

      const { referredUid } = data;
      if (!referredUid) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "referredUid is required"
        );
      }

      try {
        // Get user profile to find referrer
        const userDoc = await db.collection("profiles").doc(referredUid).get();
        if (!userDoc.exists) {
          return { success: false, message: "User profile not found" };
        }

        const userData = userDoc.data() as UserProfile;
        const referrerUid = userData.referredBy;

        if (!referrerUid) {
          return { success: false, message: "User was not referred" };
        }

        if (userData.referralStatus === "credited") {
          return { success: false, message: "Referral already credited" };
        }

        // Check referral record
        const referralDoc = await db.collection("referrals").doc(referredUid).get();
        if (!referralDoc.exists) {
          return { success: false, message: "No referral record found" };
        }

        const referralData = referralDoc.data() as ReferralRecord;
        if (referralData.status === "credited") {
          return { success: false, message: "Referral already credited" };
        }

        await creditReferralPointsInternal(
          referredUid,
          referrerUid,
          "manual_credit"
        );

        console.log(
          `[Referral] Manual credit by ${callerUid} for referral: ${referredUid} -> ${referrerUid}`
        );

        return { success: true, message: "Referral points credited successfully" };
      } catch (error) {
        console.error(`[Referral] Manual credit failed:`, error);
        throw new functions.https.HttpsError(
          "internal",
          `Failed to credit referral points: ${error}`
        );
      }
    }
  );

/**
 * Internal function to award referral points with proper ledger entries.
 * Uses Firestore transactions for consistency.
 */
async function creditReferralPointsInternal(
  referredUid: string,
  referrerUid: string,
  triggerActivityId: string
): Promise<void> {
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    // Re-fetch all documents within transaction for consistency
    const referralRef = db.collection("referrals").doc(referredUid);
    const referrerUserRef = db.collection("users").doc(referrerUid);
    const referrerProfileRef = db.collection("profiles").doc(referrerUid);
    const referredUserRef = db.collection("users").doc(referredUid);
    const referredProfileRef = db.collection("profiles").doc(referredUid);

    const [referralSnap, referrerSnap] = await Promise.all([
      tx.get(referralRef),
      tx.get(referrerUserRef),
    ]);

    // Idempotency check - if already credited, return early
    if (!referralSnap.exists) {
      console.log(`[Referral] Referral record not found in transaction`);
      return;
    }

    const referralData = referralSnap.data() as ReferralRecord;
    if (referralData.status !== "pending") {
      console.log(
        `[Referral] Referral status changed to ${referralData.status}, skipping`
      );
      return;
    }

    if (!referrerSnap.exists) {
      console.log(`[Referral] Referrer ${referrerUid} not found`);
      // Mark referral as rejected since referrer doesn't exist
      tx.update(referralRef, {
        status: "rejected",
        creditedAt: timestamp,
        rejectionReason: "referrer_not_found",
        updatedAt: timestamp,
      });
      return;
    }

    const referrerData = referrerSnap.data() as UserProfile;
    const currentTotalPoints = referrerData.totalPoints ?? 0;
    const currentReferralCount = referrerData.referralCount ?? 0;

    // Check if referrer has reached max referrals
    if (currentReferralCount >= REFERRAL_MAX_PER_USER) {
      console.log(
        `[Referral] Referrer ${referrerUid} has reached max referrals (${REFERRAL_MAX_PER_USER})`
      );
      tx.update(referralRef, {
        status: "rejected",
        creditedAt: timestamp,
        rejectionReason: "max_referrals_reached",
        updatedAt: timestamp,
      });
      tx.set(referredUserRef, { referralStatus: "rejected", updatedAt: timestamp }, { merge: true });
      tx.set(referredProfileRef, { referralStatus: "rejected", updatedAt: timestamp }, { merge: true });
      return;
    }

    // Calculate new values
    const updatedTotalPoints = currentTotalPoints + REFERRAL_POINTS;
    const updatedReferralCount = currentReferralCount + 1;
    const updatedLevel = calculateLevel(updatedTotalPoints);

    // Determine referrer's current week for ledger entry
    const referrerJourneyType = referrerData.journeyType || "6W";
    const referrerWeek = referrerData.currentWeek || 1;
    const monthNumber = getWindowNumber(referrerWeek);

    // Create referral bonus ledger entry for referrer
    const ledgerId = `${referrerUid}__referral__${referredUid}`;
    const ledgerRef = db.collection("pointsLedger").doc(ledgerId);

    // Check if ledger entry already exists (idempotency)
    const existingLedger = await tx.get(ledgerRef);
    if (existingLedger.exists) {
      console.log(`[Referral] Ledger entry ${ledgerId} already exists, skipping`);
      return;
    }

    // Create the ledger entry
    tx.set(ledgerRef, {
      uid: referrerUid,
      weekNumber: referrerWeek,
      monthNumber: monthNumber,
      activityId: "referral_bonus",
      points: REFERRAL_POINTS,
      source: "referral_bonus",
      approvalType: "partner_issued",
      referredUserId: referredUid,
      triggerActivityId: triggerActivityId,
      createdAt: timestamp,
    });

    // Update referrer's weeklyProgress
    const progressRef = db
      .collection("weeklyProgress")
      .doc(`${referrerUid}__${referrerWeek}`);
    const progressSnap = await tx.get(progressRef);

    if (progressSnap.exists) {
      const progressData = progressSnap.data();
      tx.update(progressRef, {
        pointsEarned: (progressData?.pointsEarned ?? 0) + REFERRAL_POINTS,
        engagementCount: (progressData?.engagementCount ?? 0) + 1,
        updatedAt: timestamp,
      });
    } else {
      // Create new progress document if it doesn't exist
      tx.set(progressRef, {
        uid: referrerUid,
        weekNumber: referrerWeek,
        monthNumber: monthNumber,
        weeklyTarget: 4000, // Default, will be recalculated by client
        pointsEarned: REFERRAL_POINTS,
        engagementCount: 1,
        status: "alert",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    // Update referral record
    tx.update(referralRef, {
      status: "credited",
      creditedAt: timestamp,
      firstActivityId: triggerActivityId,
      firstActivityAt: timestamp,
      updatedAt: timestamp,
    });

    // Update referrer profiles (both users and profiles collections)
    const referrerUpdate = {
      totalPoints: updatedTotalPoints,
      level: updatedLevel,
      referralCount: updatedReferralCount,
      updatedAt: timestamp,
    };

    tx.set(referrerUserRef, referrerUpdate, { merge: true });
    tx.set(referrerProfileRef, referrerUpdate, { merge: true });

    // Update referred user status
    const referredUpdate = {
      referralStatus: "credited",
      updatedAt: timestamp,
    };

    tx.set(referredUserRef, referredUpdate, { merge: true });
    tx.set(referredProfileRef, referredUpdate, { merge: true });

    // Create points_transaction for leaderboard
    tx.set(db.collection("points_transactions").doc(), {
      userId: referrerUid,
      points: REFERRAL_POINTS,
      category: "Referral",
      reason: "Referral Bonus",
      referredUserId: referredUid,
      createdAt: timestamp,
      companyId: referrerData.companyId || null,
    });

    console.log(
      `[Referral] Successfully credited ${REFERRAL_POINTS} points to ${referrerUid} for referring ${referredUid}`
    );
  });

  // Send notification to referrer (outside transaction)
  try {
    await db.collection("notifications").add({
      userId: referrerUid,
      type: "referral_success",
      title: "Referral Successful!",
      message: `Your referral was successful! You've earned ${REFERRAL_POINTS} points.`,
      actionUrl: "/app/referral-rewards",
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Check for tier milestones and send additional notification
    const referrerDoc = await db.collection("profiles").doc(referrerUid).get();
    const newReferralCount = referrerDoc.data()?.referralCount ?? 1;

    // Reward tier milestones: 1, 5, 15, 20
    const tierMilestones: Record<number, { title: string; reward: string }> = {
      1: { title: "First Referral", reward: "100 Points" },
      5: { title: "Community Builder", reward: "Community Builder Badge" },
      15: { title: "Network Champion", reward: "25% off AI Stacking 101 Course" },
      20: { title: "Referrer of the Month", reward: "Featured in Newsletter" },
    };

    const tier = tierMilestones[newReferralCount];
    if (tier) {
      await db.collection("notifications").add({
        userId: referrerUid,
        type: "referral_reward",
        title: `New Reward Unlocked: ${tier.title}!`,
        message: `Congratulations! You've reached ${newReferralCount} referrals and unlocked: ${tier.reward}.`,
        actionUrl: "/app/referral-rewards",
        isRead: false,
        metadata: { tierId: newReferralCount },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    console.log(`[Referral] Notification sent to referrer ${referrerUid}`);
  } catch (notifyError) {
    // Don't fail the function if notification fails
    console.error(`[Referral] Failed to send notification:`, notifyError);
  }
}

/**
 * Scheduled Function: Check for stale pending referrals
 *
 * Runs daily to check for referrals that have been pending for too long.
 * Can be used to send reminders or auto-reject old referrals.
 */
export const checkStalePendingReferrals = functions
  .region("us-central1")
  .pubsub.schedule("0 3 * * *") // 3 AM UTC daily
  .timeZone("UTC")
  .onRun(async () => {
    console.log("[Referral] Checking for stale pending referrals...");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const stalePendingQuery = await db
        .collection("referrals")
        .where("status", "==", "pending")
        .where("createdAt", "<", thirtyDaysAgo)
        .get();

      console.log(
        `[Referral] Found ${stalePendingQuery.size} stale pending referrals`
      );

      let processed = 0;
      for (const doc of stalePendingQuery.docs) {
        const referralData = doc.data() as ReferralRecord;

        // Send reminder notification to referrer
        await db.collection("notifications").add({
          userId: referralData.referrerUid,
          type: "referral_reminder",
          title: "Referral Pending",
          message:
            "Your referred user hasn't completed their first activity yet. Encourage them to get started!",
          actionUrl: "/app/referral-rewards",
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        processed++;
      }

      return {
        status: "success",
        staleReferrals: stalePendingQuery.size,
        remindersProcessed: processed,
      };
    } catch (error) {
      console.error("[Referral] Error checking stale referrals:", error);
      throw error;
    }
  });
