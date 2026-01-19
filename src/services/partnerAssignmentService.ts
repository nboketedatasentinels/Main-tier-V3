import { db } from "@/services/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { awardChecklistPoints } from "./pointsService";
import { FULL_ACTIVITIES, JourneyType } from "@/config/pointsConfig";
import { UserProfile } from "@/types";
import { createApprovalRequest } from "./approvalsService";

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

  try {
    // 1. Fetch learner profile to get journeyType
    const profileRef = doc(db, "profiles", learnerId);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      throw new Error("Learner profile not found");
    }

    const profile = profileSnap.data() as UserProfile;
    const journeyType = profile.journeyType || "6W";

    // 2. Find activity definition
    const activity = FULL_ACTIVITIES.find(a => a.id === activityId);
    if (!activity) {
      throw new Error("Activity definition not found");
    }

    // 3. Award points with partner_issued source
    await awardChecklistPoints({
      uid: learnerId,
      journeyType: journeyType as JourneyType,
      weekNumber,
      activity,
      source: `partner_issued:${partnerId}`
    });

    // 4. Update checklist status to 'completed'
    const checklistRef = doc(db, 'checklists', `${learnerId}_${weekNumber}`);
    const checklistSnap = await getDoc(checklistRef);
    if (checklistSnap.exists()) {
      const data = checklistSnap.data() as { activities?: { id: string; status?: string }[] };
      const activities = data.activities ?? [];
      const nextActivities = activities.map((a) =>
        a.id === activityId ? { ...a, status: 'completed', hasInteracted: true } : a
      );

      // If activity not in list, add it (though it should be there if UI shows it)
      if (!nextActivities.find(a => a.id === activityId)) {
        nextActivities.push({ id: activityId, status: 'completed', hasInteracted: true });
      }

      await updateDoc(checklistRef, {
        activities: nextActivities,
        updatedAt: serverTimestamp(),
      });
    }

    // 5. Create an approval record for history (auto-approved)
    await createApprovalRequest({
      userId: learnerId,
      type: 'partner_issued',
      approvalType: 'partner_issued',
      title: activity.title,
      source: {
        partnerId,
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
