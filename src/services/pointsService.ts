import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Transaction,
} from "./firestoreDebug";
import { db } from "@/services/firebase";
import pointsConfig from "@/config/pointsConfig";
import type { ActivityDef, JourneyType } from "@/config/pointsConfig";
import { calculateLevel } from "@/utils/points";
import { awardBadge } from "./badgeService";
import { updateWindowOnAward, updateWindowOnRevoke } from "./windowProgressService";
import { checkAndHandleJourneyCompletion } from "./journeyCompletionService";
import { detectStatusChangeAndNudge } from "./nudgeMonitorService";

const { JOURNEY_META, getMonthNumber } = pointsConfig;

// Helper to parse Firestore dates robustly
const parseDate = (val: unknown): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: unknown }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const RETRYABLE_TRANSACTION_CODES = new Set(["aborted", "failed-precondition", "unavailable"]);
const FIRESTORE_DOCUMENT_ID_MAX_BYTES = 1500;
const textEncoder = new TextEncoder();

const getActivityLimits = (activity: ActivityDef) => ({
  maxPerWeek: activity.activityPolicy?.maxPerWeek ?? activity.maxPerWeek ?? null,
  maxPerWindow: activity.activityPolicy?.maxPerWindow ?? activity.maxPerMonth ?? null,
  maxTotal: activity.activityPolicy?.maxTotal ?? null,
});

const getUtf8ByteLength = (value: string) => textEncoder.encode(value).length;

const shortDeterministicHash = (input: string) => {
  // FNV-1a 32-bit hash; deterministic and compact for document-id suffixes.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 8);
};

const truncateToUtf8ByteBudget = (value: string, budget: number) => {
  if (budget <= 0) return "";
  let result = "";
  for (const char of value) {
    const candidate = result + char;
    if (getUtf8ByteLength(candidate) > budget) break;
    result = candidate;
  }
  return result;
};

const normalizeClaimRef = (params: {
  claimRef: string;
  byteBudget: number;
}) => {
  const { claimRef, byteBudget } = params;
  if (byteBudget <= 0) return "";

  const sanitizedClaimRef = claimRef.replace(/[^a-zA-Z0-9_.-]/g, "_");
  if (getUtf8ByteLength(sanitizedClaimRef) <= byteBudget) {
    return sanitizedClaimRef;
  }

  const hash = shortDeterministicHash(claimRef);
  const suffix = `_${hash}`;
  const suffixBytes = getUtf8ByteLength(suffix);
  if (suffixBytes > byteBudget) {
    return truncateToUtf8ByteBudget(hash, byteBudget);
  }

  const prefixBudget = byteBudget - suffixBytes;
  const truncatedPrefix = truncateToUtf8ByteBudget(sanitizedClaimRef, prefixBudget);
  return `${truncatedPrefix}${suffix}`;
};

const buildLedgerDocumentId = (params: {
  uid: string;
  weekNumber: number;
  activityId: string;
  claimRef?: string;
}) => {
  const { uid, weekNumber, activityId, claimRef } = params;
  const baseId = `${uid}__w${weekNumber}__${activityId}`;

  if (!claimRef) {
    if (getUtf8ByteLength(baseId) > FIRESTORE_DOCUMENT_ID_MAX_BYTES) {
      throw new Error("Ledger document ID exceeds Firestore 1500-byte limit");
    }
    return baseId;
  }

  const baseWithClaimSeparator = `${baseId}__`;
  const remainingByteBudget =
    FIRESTORE_DOCUMENT_ID_MAX_BYTES - getUtf8ByteLength(baseWithClaimSeparator);
  const normalizedClaimRef = normalizeClaimRef({
    claimRef,
    byteBudget: remainingByteBudget,
  });

  const finalId = `${baseWithClaimSeparator}${normalizedClaimRef}`;
  if (getUtf8ByteLength(finalId) > FIRESTORE_DOCUMENT_ID_MAX_BYTES) {
    throw new Error("Ledger document ID exceeds Firestore 1500-byte limit after claimRef normalization");
  }
  return finalId;
};

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
  claimRef?: string;
}) {
  const { uid, journeyType, weekNumber, activity, source = "weekly_checklist", claimRef } = params;

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
  const limits = getActivityLimits(activity);

  const ledgerRef = doc(
    db,
    "pointsLedger",
    buildLedgerDocumentId({ uid, weekNumber, activityId: activity.id, claimRef })
  );
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
  const totalActivityQuery = query(
    collection(db, "pointsLedger"),
    where("uid", "==", uid),
    where("activityId", "==", activity.id)
  );

  const activeChallengesQuery = query(
    collection(db, "challenges"),
    where("participants", "array-contains", uid)
  );

  try {
    const [
      ledgerSnapshot,
      weeklyActivitySnapshot,
      windowActivitySnapshot,
      lastActivitySnapshot,
      totalActivitySnapshot,
      activeChallengesSnapshot,
      profileSnap,
    ] = await Promise.all([
      getDocs(ledgerQuery),
      getDocs(weeklyActivityQuery),
      getDocs(windowActivityQuery),
      getDocs(lastActivityQuery),
      getDocs(totalActivityQuery),
      getDocs(activeChallengesQuery),
      getDoc(doc(db, "profiles", uid)),
    ]);

    const companyId = profileSnap.exists() ? profileSnap.data()?.companyId : null;

    await runTransactionWithRetry(async (tx) => {
      const [ledgerDoc, progressDoc, userDoc] = await Promise.all([
        tx.get(ledgerRef),
        tx.get(progressRef),
        tx.get(doc(db, "users", uid)),
      ]);

      if (ledgerDoc.exists()) return;

      if (limits.maxPerWeek && weeklyActivitySnapshot.size >= limits.maxPerWeek) {
        throw new Error("Weekly activity limit reached");
      }

      if (limits.maxPerWindow && windowActivitySnapshot.size >= limits.maxPerWindow) {
        throw new Error("Window activity limit reached");
      }

      if (limits.maxTotal && totalActivitySnapshot.size >= limits.maxTotal) {
        throw new Error("Total activity limit reached");
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

      const currentTotal = userDoc.exists() ? (userDoc.data()?.totalPoints ?? 0) : 0;
      const totalPoints = Math.max(0, currentTotal + activity.points);
      const level = calculateLevel(totalPoints);

      if (import.meta.env.VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING === 'true') {
        await updateWindowOnAward(tx, { uid, journeyType, weekNumber, activity });
      }

      tx.set(ledgerRef, {
        uid,
        weekNumber,
        monthNumber,
        activityId: activity.id,
        points: activity.points,
        createdAt: serverTimestamp(),
        source,
        claimRef: claimRef ?? null,
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

      // Trigger nudges asynchronously after transaction
      // Note: We use setTimeout to ensure it happens after tx completes
      setTimeout(() => {
        detectStatusChangeAndNudge({
          uid,
          journeyType,
          previousStatus: currentProgress.status,
          currentStatus: status,
          pointsEarned: newPoints,
          windowTarget: weeklyTarget,
        }).catch(err => console.error('[PointsService] Nudge trigger failed:', err));
      }, 100);

      const profileUpdate = {
        totalPoints,
        level,
        pointsVersion: increment(1),
        updatedAt: serverTimestamp(),
      };

      tx.set(doc(db, "users", uid), profileUpdate, { merge: true });
      tx.set(doc(db, "profiles", uid), profileUpdate, { merge: true });

      // Record transaction for leaderboard and activity feeds
      tx.set(doc(collection(db, "points_transactions")), {
        userId: uid,
        points: activity.points,
        category: activity.category || "Other",
        reason: activity.title,
        createdAt: serverTimestamp(),
        companyId: companyId || null,
      });

      // Update active/pending challenges metrics
      activeChallengesSnapshot.docs.forEach((challengeDoc) => {
        const challengeData = challengeDoc.data();

        // Process both active and pending challenges to ensure points start counting immediately
        if (challengeData.status !== 'active' && challengeData.status !== 'pending') return;

        const start = parseDate(challengeData.start_date);
        const end = parseDate(challengeData.end_date);
        const now = new Date();

        if (start && end && now >= start && now <= end) {
          const isChallenger = challengeData.challenger_id === uid;
          const field = isChallenger ? "metrics.challenger.total" : "metrics.challenged.total";
          tx.update(challengeDoc.ref, {
            [field]: increment(activity.points),
            updatedAt: serverTimestamp(),
          });
        }
      });
    });

    // Post-transaction logic
    // Check for journey completion after points are awarded
    setTimeout(() => {
      checkAndHandleJourneyCompletion(uid, journeyType).catch(err =>
        console.error('Error checking journey completion:', err)
      );
    }, 100);

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
  claimRef?: string;
}) {
  const { uid, journeyType, weekNumber, activity, claimRef } = params;

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

  const ledgerRef = doc(
    db,
    "pointsLedger",
    buildLedgerDocumentId({ uid, weekNumber, activityId: activity.id, claimRef })
  );
  const progressRef = doc(db, "weeklyProgress", `${uid}__${weekNumber}`);
  const ledgerQuery = query(
    collection(db, "pointsLedger"),
    where("uid", "==", uid),
    where("weekNumber", "==", weekNumber)
  );

  const activeChallengesQuery = query(
    collection(db, "challenges"),
    where("participants", "array-contains", uid)
  );

  try {
    const [ledgerSnapshot, activeChallengesSnapshot, profileSnap] = await Promise.all([
      getDocs(ledgerQuery),
      getDocs(activeChallengesQuery),
      getDoc(doc(db, "profiles", uid)),
    ]);

    const companyId = profileSnap.exists() ? profileSnap.data()?.companyId : null;

    await runTransactionWithRetry(async (tx) => {
      const [ledgerDoc, progressDoc, userDoc] = await Promise.all([
        tx.get(ledgerRef),
        tx.get(progressRef),
        tx.get(doc(db, "users", uid)),
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

      const currentTotal = userDoc.exists() ? (userDoc.data()?.totalPoints ?? 0) : 0;
      const totalPoints = Math.max(0, currentTotal - ledgerPoints);
      const level = calculateLevel(totalPoints);

      if (import.meta.env.VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING === 'true') {
        await updateWindowOnRevoke(tx, { uid, journeyType, weekNumber, activity });
      }

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

      // Record transaction for leaderboard and activity feeds
      tx.set(doc(collection(db, "points_transactions")), {
        userId: uid,
        points: -ledgerPoints,
        category: activity.category || "Other",
        reason: activity.title,
        createdAt: serverTimestamp(),
        companyId: companyId || null,
      });

      // Update active/pending challenges metrics
      activeChallengesSnapshot.docs.forEach((challengeDoc) => {
        const challengeData = challengeDoc.data();

        // Process both active and pending challenges to ensure points start counting immediately
        if (challengeData.status !== 'active' && challengeData.status !== 'pending') return;

        const start = parseDate(challengeData.start_date);
        const end = parseDate(challengeData.end_date);
        const now = new Date();

        if (start && end && now >= start && now <= end) {
          const isChallenger = challengeData.challenger_id === uid;
          const field = isChallenger ? "metrics.challenger.total" : "metrics.challenged.total";
          tx.update(challengeDoc.ref, {
            [field]: increment(-ledgerPoints),
            updatedAt: serverTimestamp(),
          });
        }
      });
    });
  } catch (error) {
    console.error("🔴 [Points] Failed to revoke checklist points", error);
    throw error;
  }
}
