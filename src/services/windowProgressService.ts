import { doc, serverTimestamp, type Transaction } from "firebase/firestore";
import { db } from "@/services/firebase";
import { JOURNEY_META, type ActivityDef, type JourneyType } from "@/config/pointsConfig";
import { getWindowNumber, PARALLEL_WINDOW_SIZE_WEEKS } from "@/utils/windowCalculations";
import { calculateWindowStatus, type WindowStatus } from "@/utils/windowStatus";
import { detectStatusChangeAndNudge } from "./nudgeMonitorService";

/**
 * Updates the windowProgress document when points are awarded.
 * This function is designed to be called from within an existing Firestore transaction.
 */
export async function updateWindowOnAward(
  transaction: Transaction,
  params: {
    uid: string;
    journeyType: JourneyType;
    weekNumber: number;
    activity: ActivityDef;
  }
) {
  const { uid, journeyType, weekNumber, activity } = params;

  const windowNumber = getWindowNumber(weekNumber, PARALLEL_WINDOW_SIZE_WEEKS);
  const windowTarget = JOURNEY_META[journeyType].windowTarget;

  const progressRef = doc(db, "windowProgress", `${uid}__${journeyType}__${windowNumber}`);
  const progressDoc = await transaction.get(progressRef);

  const currentData = progressDoc.exists() ? progressDoc.data() : null;
  const currentPoints = currentData?.pointsEarned ?? 0;
  // Missing history must NOT default to "alert" - that falsely triggers Recovery.
  const previousStatus = (currentData?.status as WindowStatus | undefined) ?? null;
  const newPoints = currentPoints + activity.points;
  const status = calculateWindowStatus(newPoints, windowTarget, previousStatus);

  transaction.set(
    progressRef,
    {
      uid,
      journeyType,
      windowNumber,
      windowTarget,
      pointsEarned: newPoints,
      status,
      previousStatus,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Trigger nudges asynchronously after transaction
  setTimeout(() => {
    detectStatusChangeAndNudge({
      uid,
      journeyType,
      previousStatus: previousStatus ?? "on_track",
      currentStatus: status,
      pointsEarned: newPoints,
      windowTarget,
    }).catch(err => console.error('[WindowProgress] Nudge trigger failed:', err));
  }, 100);
}

/**
 * Updates the windowProgress document when points are revoked.
 * This function is designed to be called from within an existing Firestore transaction.
 */
export async function updateWindowOnRevoke(
  transaction: Transaction,
  params: {
    uid: string;
    journeyType: JourneyType;
    weekNumber: number;
    activity: ActivityDef;
  }
) {
    const { uid, journeyType, weekNumber, activity } = params;

    const windowNumber = getWindowNumber(weekNumber, PARALLEL_WINDOW_SIZE_WEEKS);
    const windowTarget = JOURNEY_META[journeyType].windowTarget;

    const progressRef = doc(db, "windowProgress", `${uid}__${journeyType}__${windowNumber}`);
    const progressDoc = await transaction.get(progressRef);

    if (!progressDoc.exists()) {
      return;
    }

    const currentData = progressDoc.data();
    const currentPoints = currentData.pointsEarned ?? 0;
    const previousStatus = (currentData.status as WindowStatus | undefined) ?? null;
    const newPoints = Math.max(0, currentPoints - activity.points);
    const status = calculateWindowStatus(newPoints, windowTarget, previousStatus);

    transaction.set(
        progressRef,
        {
            uid,
            journeyType,
            windowNumber,
            windowTarget,
            pointsEarned: newPoints,
            status,
            previousStatus,
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );

    // Trigger nudges asynchronously after transaction
    setTimeout(() => {
        detectStatusChangeAndNudge({
            uid,
            journeyType,
            previousStatus: previousStatus ?? "on_track",
            currentStatus: status,
            pointsEarned: newPoints,
            windowTarget,
        }).catch(err => console.error('[WindowProgress] Nudge trigger failed:', err));
    }, 100);
}
