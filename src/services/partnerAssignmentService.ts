import { db } from "@/services/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { getActivityDefinitionById, JourneyType } from "@/config/pointsConfig";
import { UserProfile } from "@/types";
import { createApprovalRequest } from "./approvalsService";
import { upsertChecklistActivity } from "./checklistService";
import { awardChecklistPoints } from "./pointsService";
import { createInAppNotification } from "./notificationService";

const chunkList = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export async function getEligibleLearnersForActivity(
  _activityId: string,
  organizationIds?: string[],
) {
  try {
    const profilesCollection = collection(db, "profiles")
    const normalized = (organizationIds || []).filter((id) => !!id)

    if (!normalized.length) {
      const snapshot = await getDocs(query(profilesCollection))
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile))
    }

    const chunks = chunkList(normalized, 30)
    const snapshots = await Promise.all(
      chunks.map((chunk) =>
        getDocs(query(profilesCollection, where("organizationId", "in", chunk))),
      ),
    )

    const userMap = new Map<string, UserProfile>()
    snapshots.forEach((snapshot) => {
      snapshot.docs.forEach((docSnap) => {
        userMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as UserProfile)
      })
    })

    return Array.from(userMap.values())
  } catch (error) {
    console.error("[PartnerAssignmentService] Failed to fetch eligible learners", error);
    throw error;
  }
}

export async function assignActivityToLearner(params: {
  partnerId: string;
  learnerId: string;
  activityId: string;
  weekNumber: number;
}) {
  const { partnerId, learnerId, activityId, weekNumber } = params;
  const normalizedPartnerId = partnerId.trim();

  try {
    if (!normalizedPartnerId) {
      throw new Error("Partner identity is missing");
    }

    // 1. Fetch learner profile to get journeyType
    const profileRef = doc(db, "profiles", learnerId);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      throw new Error("Learner profile not found");
    }

    const profile = profileSnap.data() as UserProfile;
    const journeyType = (profile.journeyType || "6W") as JourneyType;

    // 2. Find activity definition (applies journey-specific points overrides)
    const activity = getActivityDefinitionById({ activityId, journeyType });
    if (!activity) {
      throw new Error("Activity definition not found");
    }

    // 3. Award points atomically. awardChecklistPoints is idempotent on
    // (uid, weekNumber, activityId) — the same ledger doc id self-completion
    // would write to — so partner re-issues and learner self-completes can't
    // double-award. Throws on activity-limit violations. Returns awarded=false
    // when an existing ledger entry is found, so we can surface that instead of
    // silently overwriting checklist metadata and writing a misleading audit row.
    const awardResult = await awardChecklistPoints({
      uid: learnerId,
      journeyType,
      weekNumber,
      activity,
      source: 'partner_issued',
    });

    if (!awardResult.awarded) {
      throw new Error(
        `${activity.title} was already credited to this learner for week ${weekNumber}. No new points awarded.`
      );
    }

    // 4. Mark the activity completed in the learner's checklist with
    // partner-issued metadata, so the learner can't try to self-claim again
    // and the UI shows it as already done.
    await upsertChecklistActivity({
      userId: learnerId,
      weekNumber,
      activityId,
      patch: {
        status: 'completed',
        issuedByPartner: true,
        issuedBy: normalizedPartnerId,
        issuedAt: new Date().toISOString(),
      },
    });

    // 5. Audit record for partner action history.
    await createApprovalRequest({
      userId: learnerId,
      type: 'partner_issued',
      approvalType: 'partner_issued',
      title: activity.title,
      source: {
        partnerId: normalizedPartnerId,
        weekNumber,
        activityId,
        assignedAt: new Date().toISOString()
      },
      points: activity.points,
      status: 'approved'
    });

    // 6. Push notification for the learner. Surfaces as a pop-up via the
    // ProgrammePushPopup mounted in MainLayout — same modal design the
    // scheduled programme-day notifications use. priority: 'push' is the
    // signal the popup listens for.
    try {
      await createInAppNotification({
        userId: learnerId,
        type: 'approval',
        title: `🎉 +${activity.points.toLocaleString()} points awarded`,
        message: `Your partner awarded you for completing "${activity.title}" (week ${weekNumber}).`,
        metadata: {
          priority: 'push',
          activityId,
          weekNumber,
          points: activity.points,
          partnerId: normalizedPartnerId,
          source: 'partner_issued',
        },
        relatedId: activityId,
      });
    } catch (notifyErr) {
      // Non-fatal: points + checklist already wrote successfully. Log and continue.
      console.warn(
        "[PartnerAssignmentService] Failed to write learner pop-up notification",
        notifyErr,
      );
    }

    return { success: true };
  } catch (error) {
    console.error("[PartnerAssignmentService] Failed to assign activity", error);
    throw error;
  }
}
