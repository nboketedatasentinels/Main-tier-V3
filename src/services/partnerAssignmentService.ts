import { db } from "@/services/firebase";
import { doc, getDoc } from "firebase/firestore";
import { supabase } from "@/services/supabase";
import { getActivityDefinitionById, JourneyType } from "@/config/pointsConfig";
import { UserProfile } from "@/types";
import { createApprovalRequest } from "./approvalsService";
import { upsertChecklistActivity } from "./checklistService";
import { awardChecklistPoints } from "./pointsService";
import { createInAppNotification } from "./notificationService";

type EligibleLearnerRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  role: string | null
  organization_id: string | null
  company_code: string | null
  journey_type: string | null
  total_points: number | null
}

const ELIGIBLE_LEARNER_COLUMNS =
  'id, email, first_name, last_name, full_name, role, organization_id, ' +
  'company_code, journey_type, total_points'

/**
 * Eligible learners for partner-issued activities, read from Supabase `profiles`
 * (migrated off Firestore in the auth cutover). Scoped to the partner's assigned
 * org keys, matched against either `organization_id` or `company_code` (org
 * assignments come through as ids and/or codes). Returns loosely-typed profiles
 * the assignment page reads by `id/email/fullName/journeyType`.
 */
export async function getEligibleLearnersForActivity(
  _activityId: string,
  organizationIds?: string[],
) {
  try {
    const keys = Array.from(
      new Set((organizationIds || []).map((id) => (id ?? '').trim()).filter(Boolean)),
    )

    let query = supabase.from('profiles').select(ELIGIBLE_LEARNER_COLUMNS)
    if (keys.length) {
      const list = `(${keys.map((k) => `"${k.replace(/"/g, '')}"`).join(',')})`
      query = query.or(`organization_id.in.${list},company_code.in.${list}`)
    }

    const { data, error } = await query
    if (error) throw error

    return ((data ?? []) as unknown as EligibleLearnerRow[]).map((row) => {
      const fullName =
        row.full_name ||
        [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
        row.email ||
        'Learner'
      return {
        id: row.id,
        email: row.email ?? '',
        firstName: row.first_name ?? undefined,
        lastName: row.last_name ?? undefined,
        fullName,
        role: row.role ?? undefined,
        organizationId: row.organization_id ?? undefined,
        companyCode: row.company_code ?? undefined,
        journeyType: row.journey_type ?? undefined,
        totalPoints: row.total_points ?? 0,
      }
    }) as unknown as UserProfile[]
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
    // (uid, weekNumber, activityId) - the same ledger doc id self-completion
    // would write to - so partner re-issues and learner self-completes can't
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
    // ProgrammePushPopup mounted in MainLayout - same modal design the
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
