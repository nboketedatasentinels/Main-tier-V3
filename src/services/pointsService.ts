import {
  collection,
  doc,
  increment,
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
    await runTransactionWithRetry(async (tx) => {
      const [ledgerDoc, progressDoc, ledgerSnapshot] = await Promise.all([
        tx.get(ledgerRef),
        tx.get(progressRef),
        tx.get(ledgerQuery),
      ]);

      if (ledgerDoc.exists()) return;

      const currentProgress = progressDoc.exists()
        ? progressDoc.data()
        : { pointsEarned: 0, status: "alert" };
      const newPoints = currentProgress.pointsEarned + activity.points;
      const engagementCount = ledgerSnapshot.size + 1;

      const ratio = weeklyTarget > 0 ? newPoints / weeklyTarget : 0;
      let status: "on_track" | "warning" | "alert" | "recovery" = "alert";
      if (ratio >= 1) {
        status = currentProgress.status === "alert" ? "recovery" : "on_track";
      } else if (ratio >= 0.75) {
        status = "warning";
      } else {
        status = "alert";
      }

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
    });
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
    await runTransactionWithRetry(async (tx) => {
      const [ledgerDoc, progressDoc, ledgerSnapshot] = await Promise.all([
        tx.get(ledgerRef),
        tx.get(progressRef),
        tx.get(ledgerQuery),
      ]);

      if (!ledgerDoc.exists()) return;

      const ledgerPoints = ledgerDoc.data()?.points ?? activity.points;
      const currentPoints = progressDoc.exists()
        ? progressDoc.data().pointsEarned ?? 0
        : 0;
      const newPoints = Math.max(0, currentPoints - ledgerPoints);
      const engagementCount = Math.max(0, ledgerSnapshot.size - 1);

      const ratio = weeklyTarget > 0 ? newPoints / weeklyTarget : 0;
      let status: "on_track" | "warning" | "alert" | "recovery" = "alert";
      if (ratio >= 1) status = "on_track";
      else if (ratio >= 0.75) status = "warning";
      else status = "alert";

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

      const profileUpdate = {
        totalPoints,
        level,
        pointsVersion: increment(1),
        updatedAt: serverTimestamp(),
      };

      tx.set(doc(db, "users", uid), profileUpdate, { merge: true });
      tx.set(doc(db, "profiles", uid), profileUpdate, { merge: true });
    });
  } catch (error) {
    console.error("🔴 [Points] Failed to revoke checklist points", error);
    throw error;
  }
}
