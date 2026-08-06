import { supabase } from "@/services/supabase";
import pointsConfig, {
  getActivityDefinitionById,
  type JourneyType,
} from "@/config/pointsConfig";
import { UserProfile } from "@/types";
import { isLearnerRole } from "@/utils/role";
import { awardChecklistPoints, buildLedgerDocumentId } from "./pointsService";

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

const { JOURNEY_META, getMonthNumber } = pointsConfig

const getActivityLimits = (activity: { activityPolicy?: { maxPerWeek?: number | null; maxPerWindow?: number | null; maxTotal?: number | null }; maxPerWeek?: number | null; maxPerMonth?: number | null }) => ({
  maxPerWeek: activity.activityPolicy?.maxPerWeek ?? activity.maxPerWeek ?? null,
  maxPerWindow: activity.activityPolicy?.maxPerWindow ?? activity.maxPerMonth ?? null,
  maxTotal: activity.activityPolicy?.maxTotal ?? null,
})

const isWindowTrackingEnabled = () =>
  import.meta.env.VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING === "true"

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

    return ((data ?? []) as unknown as EligibleLearnerRow[])
      .filter((row) => isLearnerRole(row.role))
      .map((row) => {
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

export type AssignActivityResult = {
  success: true
  alreadyAwarded: boolean
  points: number
}

type PartnerIssueRpcResult = {
  success?: boolean
  awarded?: boolean
  already_awarded?: boolean
  points?: number
  message?: string
}

/**
 * Partner assigns marks for an activity. Persists atomically via the
 * `partner_issue_activity` SECURITY DEFINER RPC:
 *   - points_ledger / weekly_progress / profile totals
 *   - checklists (completed + issuedByPartner)
 *   - point_verifications (approve pending or write audit row)
 *   - notifications (learner push)
 *
 * Falls back to the previous multi-step client path only if the RPC is not
 * deployed yet, so local/dev still works before migration 0048 is applied.
 */
export async function assignActivityToLearner(params: {
  partnerId: string;
  learnerId: string;
  activityId: string;
  weekNumber: number;
  partnerName?: string | null;
}): Promise<AssignActivityResult> {
  const { partnerId, learnerId, activityId, weekNumber, partnerName } = params;
  const normalizedPartnerId = partnerId.trim();

  try {
    if (!normalizedPartnerId) {
      throw new Error("Partner identity is missing");
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("journey_type, organization_id, data")
      .eq("id", learnerId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profileRow) {
      throw new Error("Learner profile not found");
    }

    const profileData = (profileRow.data as Record<string, unknown>) || {};
    const journeyType = ((profileRow.journey_type as string) ||
      (profileData.journeyType as string) ||
      "6W") as JourneyType;

    const activity = getActivityDefinitionById({ activityId, journeyType });
    if (!activity) {
      throw new Error("Activity definition not found");
    }

    const monthNumber = getMonthNumber(weekNumber);
    const meta = JOURNEY_META[journeyType];
    const limits = getActivityLimits(activity);
    const trackWindow = isWindowTrackingEnabled();
    const ledgerId = buildLedgerDocumentId({
      uid: learnerId,
      weekNumber,
      activityId: activity.id,
    });

    const awardPayload =
      activity.points > 0
        ? {
            uid: learnerId,
            ledger_id: ledgerId,
            week: weekNumber,
            month: monthNumber,
            activity_id: activity.id,
            points: activity.points,
            source: "partner_issued",
            claim_ref: null,
            approval_type: activity.approvalType ?? null,
            category: activity.category ?? "Other",
            reason: activity.title ?? null,
            weekly_target: meta.weeklyTarget,
            max_per_week: limits.maxPerWeek,
            max_per_window: limits.maxPerWindow,
            max_total: limits.maxTotal,
            cooldown_weeks: activity.cooldownWeeks ?? null,
            bypass_limits: true,
            track_window: trackWindow,
            journey_type: journeyType,
            window_number: trackWindow ? Math.ceil(weekNumber / 2) : null,
            window_target: meta.windowTarget ?? 0,
          }
        : null;

    const { data, error } = await supabase.rpc("partner_issue_activity", {
      p: {
        learner_id: learnerId,
        week: weekNumber,
        activity_id: activity.id,
        points: activity.points,
        activity_title: activity.title,
        partner_name: partnerName ?? null,
        award: awardPayload,
      },
    });

    if (!error) {
      const result = (data ?? {}) as PartnerIssueRpcResult;
      return {
        success: true,
        alreadyAwarded: Boolean(result.already_awarded),
        points: typeof result.points === "number" ? result.points : activity.points,
      };
    }

    // RPC missing (migration not applied yet) -> fall back so partners are not blocked.
    const missingRpc =
      /could not find the function|partner_issue_activity|PGRST202|42883/i.test(
        error.message || "",
      );
    if (!missingRpc) {
      throw new Error(error.message || "Could not save partner-issued marks to the database.");
    }

    console.warn(
      "[PartnerAssignmentService] partner_issue_activity RPC missing; using fallback path. Apply migration 0048.",
      error.message,
    );
    return assignActivityToLearnerFallback({
      partnerId: normalizedPartnerId,
      learnerId,
      weekNumber,
      activity,
      journeyType,
      partnerName,
    });
  } catch (error) {
    console.error("[PartnerAssignmentService] Failed to assign activity", error);
    throw error;
  }
}

/** Legacy multi-step path used only when migration 0048 is not deployed. */
async function assignActivityToLearnerFallback(params: {
  partnerId: string
  learnerId: string
  weekNumber: number
  activity: NonNullable<ReturnType<typeof getActivityDefinitionById>>
  journeyType: JourneyType
  partnerName?: string | null
}): Promise<AssignActivityResult> {
  const { partnerId, learnerId, weekNumber, activity, journeyType, partnerName } = params
  let alreadyAwarded = false

  if (activity.points > 0) {
    const awardResult = await awardChecklistPoints({
      uid: learnerId,
      journeyType,
      weekNumber,
      activity,
      source: "partner_issued",
    })
    if (!awardResult.awarded) {
      if (awardResult.reason === "already_awarded") {
        alreadyAwarded = true
      } else {
        throw new Error(
          awardResult.message ||
            `${activity.title} could not be awarded for week ${weekNumber}.`,
        )
      }
    }
  }

  const { error: checklistError } = await supabase.rpc("upsert_checklist_activity", {
    p_uid: learnerId,
    p_week: weekNumber,
    p_activity_id: activity.id,
    p_patch: {
      status: "completed",
      hasInteracted: true,
      issuedByPartner: true,
      issuedBy: partnerId,
      issuedAt: new Date().toISOString(),
      rejectionReason: null,
    },
  })
  if (checklistError) throw new Error(checklistError.message)

  const approvedAt = new Date().toISOString()
  const { error: clearPendingError } = await supabase
    .from("point_verifications")
    .update({
      status: "approved",
      approved_by: partnerId,
      approved_by_name: partnerName ?? null,
      approved_at: approvedAt,
    })
    .eq("uid", learnerId)
    .eq("week", weekNumber)
    .eq("activity_id", activity.id)
    .eq("status", "pending")
  if (clearPendingError) {
    throw new Error(
      `Marks were awarded but could not update verification records: ${clearPendingError.message}`,
    )
  }

  const { data: existing, error: existingError } = await supabase
    .from("point_verifications")
    .select("id")
    .eq("uid", learnerId)
    .eq("week", weekNumber)
    .eq("activity_id", activity.id)
    .limit(1)
  if (existingError) throw new Error(existingError.message)

  if (!existing?.length) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", learnerId)
      .maybeSingle()

    const { error: auditError } = await supabase.from("point_verifications").insert({
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `pv_${Date.now()}_${Math.round(Math.random() * 1e9)}`,
      uid: learnerId,
      organization_id: (profileRow as { organization_id?: string | null } | null)?.organization_id ?? null,
      week: weekNumber,
      activity_id: activity.id,
      activity_title: activity.title,
      points: activity.points,
      proof_url: null,
      notes: "Issued directly by partner",
      status: "approved",
      approved_by: partnerId,
      approved_by_name: partnerName ?? null,
      approved_at: approvedAt,
    })
    if (auditError) {
      throw new Error(
        `Marks were awarded but could not save the verification audit row: ${auditError.message}`,
      )
    }
  }

  return {
    success: true,
    alreadyAwarded,
    points: activity.points,
  }
}
