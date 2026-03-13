/**
 * Firestore trigger: when a new impact_logs document is created on the Tier
 * platform, notify the Ambassadors platform so it can pull the latest data.
 *
 * This bridges the gap between the Tier frontend (which writes to Firestore
 * directly via addDoc) and the Ambassadors webhook (which expects a POST).
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();

const AMBASSADORS_API_URL = (process.env.T4L_AMBASSADORS_API_URL || "").trim();
const CROSS_PLATFORM_API_KEY = (process.env.T4L_CROSS_PLATFORM_API_KEY || "").trim();

async function notifyAmbassadors(
  firebaseUid: string,
  action: string,
): Promise<void> {
  if (!AMBASSADORS_API_URL || !CROSS_PLATFORM_API_KEY) {
    console.warn("⚠️ Ambassadors sync skipped: missing T4L_AMBASSADORS_API_URL or T4L_CROSS_PLATFORM_API_KEY");
    return;
  }

  try {
    let email = "";
    let phone = "";

    try {
      const userRecord = await admin.auth().getUser(firebaseUid);
      email = userRecord.email || "";
    } catch {
      // user might not exist in Auth yet
    }

    try {
      const profileSnap = await db.collection("profiles").doc(firebaseUid).get();
      phone = profileSnap.data()?.phoneNumber || "";
    } catch {
      // profile might not exist yet
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(`${AMBASSADORS_API_URL}/api/sync/webhook/tier-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: CROSS_PLATFORM_API_KEY,
        firebase_uid: firebaseUid,
        email,
        phone_number: phone,
        action,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    console.log(`✅ Ambassadors notified (${action}): status=${resp.status}`);
  } catch (err) {
    console.warn(
      "⚠️ Ambassadors sync webhook failed (non-blocking):",
      err instanceof Error ? err.message : err,
    );
  }
}

export const onImpactLogCreated = functions
  .region("us-central1")
  .firestore.document("impact_logs/{logId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    if (!data) return;

    // Skip entries that came FROM the Ambassadors platform to avoid loops
    if (
      data.sourcePlatform === "t4l_ambassadors" ||
      data.sourcePlatform === "ambassadors"
    ) {
      console.log("↩️ Skipping sync for entry from Ambassadors platform:", snap.id);
      return;
    }

    const userId = data.userId || data.user_id;
    if (!userId) {
      console.warn("⚠️ impact_logs doc missing userId:", snap.id);
      return;
    }

    await notifyAmbassadors(userId, "entry_created");
  });

export const onImpactLogUpdated = functions
  .region("us-central1")
  .firestore.document("impact_logs/{logId}")
  .onUpdate(async (change) => {
    const data = change.after.data();
    if (!data) return;

    if (
      data.sourcePlatform === "t4l_ambassadors" ||
      data.sourcePlatform === "ambassadors"
    ) {
      return;
    }

    const userId = data.userId || data.user_id;
    if (!userId) return;

    await notifyAmbassadors(userId, "entry_updated");
  });

export const onImpactLogDeleted = functions
  .region("us-central1")
  .firestore.document("impact_logs/{logId}")
  .onDelete(async (snap) => {
    const data = snap.data();
    if (!data) return;

    if (
      data.sourcePlatform === "t4l_ambassadors" ||
      data.sourcePlatform === "ambassadors"
    ) {
      return;
    }

    const userId = data.userId || data.user_id;
    if (!userId) return;

    await notifyAmbassadors(userId, "entry_deleted");
  });
