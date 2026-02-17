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
    const journeyType = profile.journeyType || "6W";

    // 2. Find activity definition
    const activity = getActivityDefinitionById({ activityId, journeyType: journeyType as JourneyType });
    if (!activity) {
      throw new Error("Activity definition not found");
    }

    // 3. Mark activity as partner-issued in checklist.
    // Learner still completes the activity to claim points.
    await upsertChecklistActivity({
      userId: learnerId,
      weekNumber,
      activityId,
      patch: {
        issuedByPartner: true,
        issuedBy: normalizedPartnerId,
        issuedAt: new Date().toISOString(),
      },
    });

    // 4. Create an approval record for history (issued event).
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

    return { success: true };
  } catch (error) {
    console.error("[PartnerAssignmentService] Failed to assign activity", error);
    throw error;
  }
}
