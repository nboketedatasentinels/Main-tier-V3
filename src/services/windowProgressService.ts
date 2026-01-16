import { doc, serverTimestamp, type Transaction } from "firebase/firestore";
import { db } from "@/services/firebase";
import { JOURNEY_META, type ActivityDef, type JourneyType } from "@/config/pointsConfig";
import { getWindowNumber, getWindowRange, PARALLEL_WINDOW_SIZE_WEEKS } from "@/utils/windowCalculations";

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

  const programDurationWeeks = JOURNEY_META[journeyType].weeks;
  const windowNumber = getWindowNumber(weekNumber, PARALLEL_WINDOW_SIZE_WEEKS);
  const { windowWeeks } = getWindowRange(weekNumber, programDurationWeeks, PARALLEL_WINDOW_SIZE_WEEKS);

  const weeklyTarget = JOURNEY_META[journeyType].weeklyTarget;
  const windowTarget = weeklyTarget * windowWeeks;

  const progressRef = doc(db, "windowProgress", `${uid}__${journeyType}__${windowNumber}`);
  const progressDoc = await transaction.get(progressRef);

  const currentData = progressDoc.exists() ? progressDoc.data() : null;
  const currentPoints = currentData?.pointsEarned ?? 0;
  const previousStatus = currentData?.status ?? "alert";
  const newPoints = currentPoints + activity.points;

  const ratio = windowTarget > 0 ? newPoints / windowTarget : 0;
  let status: "on_track" | "warning" | "alert" | "recovery" = "alert";
  if (ratio >= 1) {
    status = "on_track";
  } else if (ratio >= 0.75) {
    status = "warning";
  }

  // Apply Recovery when status moves from alert to on_track or warning
  if (previousStatus === "alert" && (status === "on_track" || status === "warning")) {
    status = "recovery";
  }

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

    const programDurationWeeks = JOURNEY_META[journeyType].weeks;
    const windowNumber = getWindowNumber(weekNumber, PARALLEL_WINDOW_SIZE_WEEKS);
    const { windowWeeks } = getWindowRange(weekNumber, programDurationWeeks, PARALLEL_WINDOW_SIZE_WEEKS);

    const weeklyTarget = JOURNEY_META[journeyType].weeklyTarget;
    const windowTarget = weeklyTarget * windowWeeks;

    const progressRef = doc(db, "windowProgress", `${uid}__${journeyType}__${windowNumber}`);
    const progressDoc = await transaction.get(progressRef);

    if (!progressDoc.exists()) {
      return;
    }

    const currentData = progressDoc.data();
    const currentPoints = currentData.pointsEarned ?? 0;
    const previousStatus = currentData.status ?? "alert";
    const newPoints = Math.max(0, currentPoints - activity.points);

    const ratio = windowTarget > 0 ? newPoints / windowTarget : 0;
    let status: "on_track" | "warning" | "alert" | "recovery" = "alert";
    if (ratio >= 1) {
      status = "on_track";
    } else if (ratio >= 0.75) {
      status = "warning";
    }

    // Recovery check for consistency (unlikely to improve status on revoke)
    if (previousStatus === "alert" && (status === "on_track" || status === "warning")) {
      status = "recovery";
    }

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
}
