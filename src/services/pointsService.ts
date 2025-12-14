import { doc, runTransaction, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { JOURNEY_META, getMonthNumber, ActivityDef, JourneyType } from "@/config/pointsConfig";

export async function awardChecklistPoints(params: {
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

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(ledgerRef);
    if (existing.exists()) return; // already awarded

    tx.set(ledgerRef, {
      uid,
      weekNumber,
      monthNumber,
      activityId: activity.id,
      points: activity.points,
      createdAt: serverTimestamp(),
      source: "weekly_checklist",
    });

    const progressSnap = await tx.get(progressRef);
    const currentProgress = progressSnap.exists() ? progressSnap.data() : { pointsEarned: 0, status: 'alert' };
    const newPoints = currentProgress.pointsEarned + activity.points;

    const ratio = weeklyTarget > 0 ? newPoints / weeklyTarget : 0;
    let status: "on_track" | "warning" | "alert" | "recovery" = "alert";
    if (ratio >= 1) {
      status = currentProgress.status === 'alert' ? 'recovery' : 'on_track';
    } else if (ratio >= 0.75) {
      status = "warning";
    } else {
      status = "alert";
    }

    tx.set(progressRef, {
      uid,
      weekNumber,
      monthNumber,
      weeklyTarget,
      pointsEarned: newPoints,
      status,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
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

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(ledgerRef);
    if (!existing.exists()) return;

    tx.delete(ledgerRef);

    const progressSnap = await tx.get(progressRef);
    const currentPoints = progressSnap.exists() ? (progressSnap.data().pointsEarned ?? 0) : 0;
    const newPoints = Math.max(0, currentPoints - activity.points);

    const ratio = weeklyTarget > 0 ? newPoints / weeklyTarget : 0;
    let status: "on_track" | "warning" | "alert" | "recovery" = "alert";
    if (ratio >= 1) status = "on_track";
    else if (ratio >= 0.75) status = "warning";
    else status = "alert";

    tx.set(progressRef, {
      uid,
      weekNumber,
      monthNumber,
      weeklyTarget,
      pointsEarned: newPoints,
      status,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}
