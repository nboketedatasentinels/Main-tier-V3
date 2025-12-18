import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
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
    const [ledgerDoc, progressDoc] = await Promise.all([
      tx.get(ledgerRef),
      tx.get(progressRef),
    ]);

    if (ledgerDoc.exists()) return;

    const currentProgress = progressDoc.exists()
      ? progressDoc.data()
      : { pointsEarned: 0, status: "alert" };
    const newPoints = currentProgress.pointsEarned + activity.points;

    const ratio = weeklyTarget > 0 ? newPoints / weeklyTarget : 0;
    let status: "on_track" | "warning" | "alert" | "recovery" = "alert";
    if (ratio >= 1) {
      status = currentProgress.status === "alert" ? "recovery" : "on_track";
    } else if (ratio >= 0.75) {
      status = "warning";
    } else {
      status = "alert";
    }

    tx.set(ledgerRef, {
      uid,
      weekNumber,
      monthNumber,
      activityId: activity.id,
      points: activity.points,
      createdAt: serverTimestamp(),
      source: "weekly_checklist",
    });

    tx.set(
      progressRef,
      {
        uid,
        weekNumber,
        monthNumber,
        weeklyTarget,
        pointsEarned: newPoints,
        status,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
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
    const [ledgerDoc, progressDoc] = await Promise.all([
      tx.get(ledgerRef),
      tx.get(progressRef),
    ]);

    if (!ledgerDoc.exists()) return;

    const currentPoints = progressDoc.exists()
      ? progressDoc.data().pointsEarned ?? 0
      : 0;
    const newPoints = Math.max(0, currentPoints - activity.points);

    const ratio = weeklyTarget > 0 ? newPoints / weeklyTarget : 0;
    let status: "on_track" | "warning" | "alert" | "recovery" = "alert";
    if (ratio >= 1) status = "on_track";
    else if (ratio >= 0.75) status = "warning";
    else status = "alert";

    tx.delete(ledgerRef);

    tx.set(
      progressRef,
      {
        uid,
        weekNumber,
        monthNumber,
        weeklyTarget,
        pointsEarned: newPoints,
        status,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });
}
