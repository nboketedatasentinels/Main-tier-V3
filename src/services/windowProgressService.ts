import { doc, serverTimestamp, type Transaction } from "firebase/firestore";
import { db } from "@/services/firebase";
import { JOURNEY_META, type ActivityDef, type JourneyType } from "@/config/pointsConfig";
import { getWindowNumber, getWindowRange } from "@/utils/windowCalculations";

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
  const windowNumber = getWindowNumber(weekNumber);
  const { windowWeeks } = getWindowRange(weekNumber, programDurationWeeks);

  const weeklyTarget = JOURNEY_META[journeyType].weeklyTarget;
  const windowTarget = weeklyTarget * windowWeeks;

  const progressRef = doc(db, "windowProgress", `${uid}__${windowNumber}`);
  const progressDoc = await transaction.get(progressRef);

  const currentPoints = progressDoc.exists() ? progressDoc.data().pointsEarned ?? 0 : 0;
  const newPoints = currentPoints + activity.points;

  const ratio = windowTarget > 0 ? newPoints / windowTarget : 0;
  let status: "on_track" | "warning" | "alert" = "alert";
  if (ratio >= 1) {
    status = "on_track";
  } else if (ratio >= 0.75) {
    status = "warning";
  }

  transaction.set(
    progressRef,
    {
      uid,
      windowNumber,
      windowTarget,
      pointsEarned: newPoints,
      status,
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
    const windowNumber = getWindowNumber(weekNumber);
    const { windowWeeks } = getWindowRange(weekNumber, programDurationWeeks);

    const weeklyTarget = JOURNEY_META[journeyType].weeklyTarget;
    const windowTarget = weeklyTarget * windowWeeks;

    const progressRef = doc(db, "windowProgress", `${uid}__${windowNumber}`);
    const progressDoc = await transaction.get(progressRef);

    if (!progressDoc.exists()) {
      return;
    }

    const currentPoints = progressDoc.data().pointsEarned ?? 0;
    const newPoints = Math.max(0, currentPoints - activity.points);

    const ratio = windowTarget > 0 ? newPoints / windowTarget : 0;
    let status: "on_track" | "warning" | "alert" = "alert";
    if (ratio >= 1) {
      status = "on_track";
    } else if (ratio >= 0.75) {
      status = "warning";
    }

    transaction.set(
        progressRef,
        {
            uid,
            windowNumber,
            windowTarget,
            pointsEarned: newPoints,
            status,
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );
}
