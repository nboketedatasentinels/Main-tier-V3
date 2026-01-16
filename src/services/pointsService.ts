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
import { hasCompletedJourney } from "@/utils/completion";
import { awardBadge } from "./badgeService";
import { updateWindowOnAward, updateWindowOnRevoke } from "./windowProgressService";

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
    const [
      ledgerSnapshot,
      weeklyActivitySnapshot,
      windowActivitySnapshot,
      lastActivitySnapshot,
    ] = await Promise.all([
      getDocs(ledgerQuery),
      getDocs(weeklyActivityQuery),
      getDocs(windowActivityQuery),
      getDocs(lastActivityQuery),
    ]);

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
        await updateWindowOnAward(tx, { uid, journeyType, weekNumber, activity });
      }
    });

    // Post-transaction logic
    const finalPoints = (await calculateUserTotalPoints(uid)) ?? 0;
    if (hasCompletedJourney(finalPoints, journeyType)) {
      await awardBadge(uid, "journey-completion");
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

      if (import.meta.env.VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING === 'true') {
        await updateWindowOnRevoke(tx, { uid, journeyType, weekNumber, activity });
      }
    });
  } catch (error) {
    console.error("🔴 [Points] Failed to revoke checklist points", error);
    throw error;
  }
}
