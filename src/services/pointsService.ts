import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Transaction,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import pointsConfig from "@/config/pointsConfig";
import type { ActivityDef, JourneyType } from "@/config/pointsConfig";
import { calculateLevel, calculateUserTotalPoints } from "@/utils/points";
import { calculateEngagementStatus } from "@/utils/statusCalculation";
import { awardBadge } from "./badgeService";
import { updateWindowOnAward, updateWindowOnRevoke } from "./windowProgressService";
import { checkAndHandleJourneyCompletion } from "./journeyCompletionService";
import { detectStatusChangeAndNudge } from "./nudgeMonitorService";
import { executeWithPartialFailureRecovery } from "@/utils/firestoreErrorHandling";

const { JOURNEY_META, getMonthNumber } = pointsConfig;

const RETRYABLE_TRANSACTION_CODES = new Set(["aborted", "failed-precondition", "unavailable"]);

const runTransactionWithRetry = async <T>(
  operation: (transaction: Transaction) => Promise<T>,
  maxAttempts = 3
): Promise<T> => {
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      return await runTransaction(db, operation);
    } catch (error) {
      attempt += 1;
      const code = (error as { code?: string }).code;
      const shouldRetry = code ? RETRYABLE_TRANSACTION_CODES.has(code) : false;
      if (!shouldRetry || attempt >= maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    }
  }

  throw new Error("Transaction failed after retries");
};

export async function awardChecklistPoints(params: {
  uid: string;
  journeyType: JourneyType;
  weekNumber: number;
  activity: ActivityDef;
  source?: string;
}) {
  const { uid, journeyType, weekNumber, activity, source = "weekly_checklist" } = params;

  if (!uid) throw new Error('[PointsService] uid is required')
  if (!journeyType) throw new Error('[PointsService] journeyType is required')
  if (typeof weekNumber !== 'number') throw new Error('[PointsService] weekNumber is required')
  if (!activity || !activity.id) {
    throw new Error(
      `[PointsService] activity.id is required. Got: ${JSON.stringify(activity)}`
    )
  }

  const monthNumber = getMonthNumber(weekNumber);
  const weeklyTarget = JOURNEY_META[journeyType].weeklyTarget;

  const ledgerRef = doc(db, "pointsLedger", `${uid}__w${weekNumber}__${activity.id}`);
  const progressRef = doc(db, "weeklyProgress", `${uid}__${weekNumber}`);
  const ledgerQuery = query(
    collection(db, "pointsLedger"),
    where("uid", "==", uid),
    where("weekNumber", "==", weekNumber)
  );
  const weeklyActivityQuery = query(
    collection(db, "pointsLedger"),
    where("uid", "==", uid),
    where("weekNumber", "==", weekNumber),
    where("activityId", "==", activity.id)
  );
  const windowActivityQuery = query(
    collection(db, "pointsLedger"),
    where("uid", "==", uid),
    where("monthNumber", "==", monthNumber),
    where("activityId", "==", activity.id)
  );
  const lastActivityQuery = query(
    collection(db, "pointsLedger"),
    where("uid", "==", uid),
    where("activityId", "==", activity.id),
    orderBy("weekNumber", "desc"),
    limit(1)
  );

  try {
    // Use executeWithPartialFailureRecovery to gracefully handle partial query failures
    const { results, failures } = await executeWithPartialFailureRecovery([
      getDocs(ledgerQuery),
      getDocs(weeklyActivityQuery),
      getDocs(windowActivityQuery),
      getDocs(lastActivityQuery),
    ], 'pointsService.awardChecklistPoints');

    if (failures.length > 0) {
      console.warn(`[pointsService] ${failures.length} query(ies) failed, proceeding with available data`);
    }

    const [
      ledgerSnapshot,
      weeklyActivitySnapshot,
      windowActivitySnapshot,
      lastActivitySnapshot,
    ] = results;

    // Variables to capture from transaction for post-transaction operations
    let transactionResult: {
      previousStatus: string;
      currentStatus: string;
      newPoints: number;
    } | null = null;
    let windowNudgeData: Awaited<ReturnType<typeof import('./windowProgressService').updateWindowOnAward>> = null;

    await runTransactionWithRetry(async (tx) => {
      const [ledgerDoc, progressDoc] = await Promise.all([
        tx.get(ledgerRef),
        tx.get(progressRef),
      ]);

      if (ledgerDoc.exists()) return;

      const maxPerWeek = activity.maxPerWeek ?? 1;
      if (maxPerWeek && weeklyActivitySnapshot.size >= maxPerWeek) {
        throw new Error("Weekly activity limit reached");
      }

      if (activity.maxPerMonth && windowActivitySnapshot.size >= activity.maxPerMonth) {
        throw new Error("Window activity limit reached");
      }

      if (activity.cooldownWeeks && lastActivitySnapshot.size > 0) {
        const lastWeekNumber = lastActivitySnapshot.docs[0]?.data()?.weekNumber as number | undefined;
        if (lastWeekNumber && weekNumber - lastWeekNumber <= activity.cooldownWeeks) {
          throw new Error("Activity cooldown in effect");
        }
      }

      const currentProgress = progressDoc.exists()
        ? progressDoc.data()
        : { pointsEarned: 0, status: "alert" };
      const newPoints = currentProgress.pointsEarned + activity.points;
      const engagementCount = ledgerSnapshot.size + 1;

      const status = calculateEngagementStatus(
        newPoints,
        weeklyTarget,
        currentProgress.status as "on_track" | "warning" | "alert" | "recovery"
      );

      const currentTotal = await calculateUserTotalPoints(uid, { transaction: tx });
      const totalPoints = Math.max(0, currentTotal + activity.points);
      const level = calculateLevel(totalPoints);

      tx.set(ledgerRef, {
        uid,
        weekNumber,
        monthNumber,
        activityId: activity.id,
        points: activity.points,
        createdAt: serverTimestamp(),
        source,
        approvalType: activity.approvalType,
      });

      tx.set(
        progressRef,
        {
          uid,
          weekNumber,
          monthNumber,
          weeklyTarget,
          pointsEarned: newPoints,
          engagementCount,
          status,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const profileUpdate = {
        totalPoints,
        level,
        pointsVersion: increment(1),
        updatedAt: serverTimestamp(),
      };

      tx.set(doc(db, "users", uid), profileUpdate, { merge: true });
      tx.set(doc(db, "profiles", uid), profileUpdate, { merge: true });

      if (import.meta.env.VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING === 'true') {
        windowNudgeData = await updateWindowOnAward(tx, { uid, journeyType, weekNumber, activity });
      }

      // Capture transaction result for post-transaction operations
      transactionResult = {
        previousStatus: currentProgress.status,
        currentStatus: status,
        newPoints,
      };
    });

    // Post-transaction logic - trigger nudges after transaction commits
    if (transactionResult) {
      try {
        await detectStatusChangeAndNudge({
          uid,
          journeyType,
          previousStatus: transactionResult.previousStatus,
          currentStatus: transactionResult.currentStatus,
          pointsEarned: transactionResult.newPoints,
          windowTarget: weeklyTarget,
        });
      } catch (err) {
        // Log but don't fail the overall operation - nudges are non-critical
        console.error('[PointsService] Nudge trigger failed:', err);
      }
    }

    // Trigger window nudges if window tracking was updated
    if (windowNudgeData) {
      try {
        await detectStatusChangeAndNudge(windowNudgeData);
      } catch (err) {
        console.error('[PointsService] Window nudge trigger failed:', err);
      }
    }

    // Check for journey completion after points are awarded
    try {
      await checkAndHandleJourneyCompletion(uid, journeyType);
    } catch (err) {
      console.error('[PointsService] Error checking journey completion:', err);
    }

    if (activity.id.includes('peer')) {
      const peerActivitiesQuery = query(
        collection(db, 'pointsLedger'),
        where('uid', '==', uid),
        where('activityId', 'in', ['peer_matching', 'peer_to_peer'])
      );
      const peerActivitiesSnapshot = await getDocs(peerActivitiesQuery);
      if (peerActivitiesSnapshot.size >= 5) {
        await awardBadge(uid, 'peer-collaborator');
      }
    }
  } catch (error) {
    console.error("🔴 [Points] Failed to award checklist points", error);
    throw error;
  }
}

export async function revokeChecklistPoints(params: {
  uid: string;
  journeyType: JourneyType;
  weekNumber: number;
  activity: ActivityDef;
}) {
  const { uid, journeyType, weekNumber, activity } = params;

  if (!uid) throw new Error('[PointsService] uid is required')
  if (!journeyType) throw new Error('[PointsService] journeyType is required')
  if (typeof weekNumber !== 'number') throw new Error('[PointsService] weekNumber is required')
  if (!activity || !activity.id) {
    throw new Error(
      `[PointsService] activity.id is required. Got: ${JSON.stringify(activity)}`
    )
  }

  const monthNumber = getMonthNumber(weekNumber);
  const weeklyTarget = JOURNEY_META[journeyType].weeklyTarget;

  const ledgerRef = doc(db, "pointsLedger", `${uid}__w${weekNumber}__${activity.id}`);
  const progressRef = doc(db, "weeklyProgress", `${uid}__${weekNumber}`);
  const ledgerQuery = query(
    collection(db, "pointsLedger"),
    where("uid", "==", uid),
    where("weekNumber", "==", weekNumber)
  );

  try {
    const ledgerSnapshot = await getDocs(ledgerQuery);
    await runTransactionWithRetry(async (tx) => {
      const [ledgerDoc, progressDoc] = await Promise.all([tx.get(ledgerRef), tx.get(progressRef)]);

      if (!ledgerDoc.exists()) return;

      const ledgerPoints = ledgerDoc.data()?.points ?? activity.points;
      const currentProgressData = progressDoc.exists() ? progressDoc.data() : null;
      const currentPoints = currentProgressData?.pointsEarned ?? 0;
      const newPoints = Math.max(0, currentPoints - ledgerPoints);
      const engagementCount = Math.max(0, ledgerSnapshot.size - 1);

      const status = calculateEngagementStatus(
        newPoints,
        weeklyTarget,
        currentProgressData?.status as "on_track" | "warning" | "alert" | "recovery" | undefined
      );

      const currentTotal = await calculateUserTotalPoints(uid, { transaction: tx });
      const totalPoints = Math.max(0, currentTotal - ledgerPoints);
      const level = calculateLevel(totalPoints);

      tx.delete(ledgerRef);

      tx.set(
        progressRef,
        {
          uid,
          weekNumber,
          monthNumber,
          weeklyTarget,
          pointsEarned: newPoints,
          engagementCount,
          status,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Trigger nudges asynchronously after transaction
      setTimeout(() => {
        detectStatusChangeAndNudge({
          uid,
          journeyType,
          previousStatus: progressDoc.data()?.status || 'alert',
          currentStatus: status,
          pointsEarned: newPoints,
          windowTarget: weeklyTarget,
        }).catch(err => console.error('[PointsService] Revoke nudge trigger failed:', err));
      }, 100);

      const profileUpdate = {
        totalPoints,
        level,
        pointsVersion: increment(1),
        updatedAt: serverTimestamp(),
      };

      tx.set(doc(db, "users", uid), profileUpdate, { merge: true });
      tx.set(doc(db, "profiles", uid), profileUpdate, { merge: true });

      if (import.meta.env.VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING === 'true') {
        await updateWindowOnRevoke(tx, { uid, journeyType, weekNumber, activity });
      }
    });
  } catch (error) {
    console.error("🔴 [Points] Failed to revoke checklist points", error);
    throw error;
  }
}
