import { supabase } from "@/services/supabase";
import pointsConfig from "@/config/pointsConfig";
import type { ActivityDef, JourneyType } from "@/config/pointsConfig";
import { checkAndHandleJourneyCompletion } from "./journeyCompletionService";
import { detectStatusChangeAndNudge } from "./nudgeMonitorService";
import { recordUserActivity } from "./userProfileService";

/**
 * Checklist points award/revoke/reconcile.
 *
 * These now delegate to the Supabase SECURITY DEFINER RPCs
 * (`award_checklist_points`, `revoke_checklist_points`, `reconcile_user_points`)
 * which do the whole operation atomically server-side: authz, idempotency
 * (deterministic ledger id), per-week/window/total caps + cooldown, the
 * `points_ledger` row, `weekly_progress`, the profile total/level mirror,
 * optional parallel window tracking and challenge metrics.
 *
 * They replace the old Firestore transactions, which failed with "Missing or
 * insufficient permissions" after the Supabase auth cutover (no Firebase
 * session), silently breaking every points award. The deterministic ledger id
 * below is preserved verbatim so it matches the rows backfilled from Firestore
 * - that is what keeps awards idempotent across the two eras.
 */

const { JOURNEY_META, getMonthNumber } = pointsConfig;

const getActivityLimits = (activity: ActivityDef) => ({
  maxPerWeek: activity.activityPolicy?.maxPerWeek ?? activity.maxPerWeek ?? null,
  maxPerWindow: activity.activityPolicy?.maxPerWindow ?? activity.maxPerMonth ?? null,
  maxTotal: activity.activityPolicy?.maxTotal ?? null,
});

// ─── Deterministic ledger id (unchanged from the Firestore era) ──────────────
// The backfilled rows carry ids in this exact shape, so regenerating the same
// id is what makes `award_checklist_points` idempotent (it no-ops on conflict).
const LEDGER_ID_MAX_BYTES = 1500;
const textEncoder = new TextEncoder();
const getUtf8ByteLength = (value: string) => textEncoder.encode(value).length;

const shortDeterministicHash = (input: string) => {
  // FNV-1a 32-bit hash; deterministic and compact for id suffixes.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 8);
};

const truncateToUtf8ByteBudget = (value: string, budget: number) => {
  if (budget <= 0) return "";
  let result = "";
  for (const char of value) {
    const candidate = result + char;
    if (getUtf8ByteLength(candidate) > budget) break;
    result = candidate;
  }
  return result;
};

const normalizeClaimRef = (params: { claimRef: string; byteBudget: number }) => {
  const { claimRef, byteBudget } = params;
  if (byteBudget <= 0) return "";

  const sanitizedClaimRef = claimRef.replace(/[^a-zA-Z0-9_.-]/g, "_");
  if (getUtf8ByteLength(sanitizedClaimRef) <= byteBudget) {
    return sanitizedClaimRef;
  }

  const hash = shortDeterministicHash(claimRef);
  const suffix = `_${hash}`;
  const suffixBytes = getUtf8ByteLength(suffix);
  if (suffixBytes > byteBudget) {
    return truncateToUtf8ByteBudget(hash, byteBudget);
  }

  const prefixBudget = byteBudget - suffixBytes;
  const truncatedPrefix = truncateToUtf8ByteBudget(sanitizedClaimRef, prefixBudget);
  return `${truncatedPrefix}${suffix}`;
};

export const buildLedgerDocumentId = (params: {
  uid: string;
  weekNumber: number;
  activityId: string;
  claimRef?: string;
}) => {
  const { uid, weekNumber, activityId, claimRef } = params;
  const baseId = `${uid}__w${weekNumber}__${activityId}`;

  if (!claimRef) {
    if (getUtf8ByteLength(baseId) > LEDGER_ID_MAX_BYTES) {
      throw new Error("Ledger id exceeds 1500-byte limit");
    }
    return baseId;
  }

  const baseWithClaimSeparator = `${baseId}__`;
  const remainingByteBudget = LEDGER_ID_MAX_BYTES - getUtf8ByteLength(baseWithClaimSeparator);
  const normalizedClaimRef = normalizeClaimRef({ claimRef, byteBudget: remainingByteBudget });

  const finalId = `${baseWithClaimSeparator}${normalizedClaimRef}`;
  if (getUtf8ByteLength(finalId) > LEDGER_ID_MAX_BYTES) {
    throw new Error("Ledger id exceeds 1500-byte limit after claimRef normalization");
  }
  return finalId;
};

const isWindowTrackingEnabled = () =>
  import.meta.env.VITE_FEATURE_FLAG_PARALLEL_WINDOW_TRACKING === "true";

// ─── Public API ──────────────────────────────────────────────────────────────

export async function awardChecklistPoints(params: {
  uid: string;
  journeyType: JourneyType;
  weekNumber: number;
  activity: ActivityDef;
  source?: string;
  claimRef?: string;
}): Promise<{
  awarded: boolean;
  reason?: "already_awarded" | "limit_exceeded" | "rejected";
  message?: string;
}> {
  const { uid, journeyType, weekNumber, activity, source = "weekly_checklist", claimRef } = params;

  if (!uid) throw new Error("[PointsService] uid is required");
  if (!journeyType) throw new Error("[PointsService] journeyType is required");
  if (typeof weekNumber !== "number") throw new Error("[PointsService] weekNumber is required");
  if (!activity || !activity.id) {
    throw new Error(`[PointsService] activity.id is required. Got: ${JSON.stringify(activity)}`);
  }

  const monthNumber = getMonthNumber(weekNumber);
  const meta = JOURNEY_META[journeyType];
  const limits = getActivityLimits(activity);
  const trackWindow = isWindowTrackingEnabled();
  const ledgerId = buildLedgerDocumentId({ uid, weekNumber, activityId: activity.id, claimRef });

  try {
    const { data, error } = await supabase.rpc("award_checklist_points", {
      p: {
        uid,
        ledger_id: ledgerId,
        week: weekNumber,
        month: monthNumber,
        activity_id: activity.id,
        points: activity.points,
        source,
        claim_ref: claimRef ?? null,
        approval_type: activity.approvalType ?? null,
        category: activity.category ?? "Other",
        reason: activity.title ?? null,
        weekly_target: meta.weeklyTarget,
        max_per_week: limits.maxPerWeek,
        max_per_window: limits.maxPerWindow,
        max_total: limits.maxTotal,
        cooldown_weeks: activity.cooldownWeeks ?? null,
        // Partner-issued awards bypass frequency caps + cooldown: the partner's
        // verification is authoritative; idempotency still holds via ledger_id.
        bypass_limits: source === "partner_issued",
        track_window: trackWindow,
        journey_type: journeyType,
        window_number: trackWindow ? Math.ceil(weekNumber / 2) : null,
        window_target: meta.windowTarget ?? 0,
      },
    });

    if (error) {
      const message = error.message || "Could not award points";
      const lower = message.toLowerCase();
      // Soft-fail known policy rejections so the UI can show a clear reason
      // instead of a generic "Update Failed" toast.
      if (
        lower.includes("limit") ||
        lower.includes("cooldown") ||
        lower.includes("already") ||
        lower.includes("cap") ||
        lower.includes("exhausted")
      ) {
        return {
          awarded: false,
          reason: lower.includes("already") ? "already_awarded" : "limit_exceeded",
          message: friendlyAwardLimitMessage(message, activity.title),
        };
      }
      throw new Error(message);
    }

    const result = (data ?? {}) as {
      awarded?: boolean;
      reason?: string;
      previous_status?: string;
      status?: string;
      points_earned?: number;
      message?: string;
    };

    if (!result.awarded) {
      const reasonRaw = (result.reason ?? "").toLowerCase();
      if (
        reasonRaw.includes("limit") ||
        reasonRaw.includes("cooldown") ||
        reasonRaw.includes("cap") ||
        reasonRaw.includes("exhausted")
      ) {
        return {
          awarded: false,
          reason: "limit_exceeded",
          message: friendlyAwardLimitMessage(
            result.message ?? result.reason ?? "Activity limit reached",
            activity.title,
          ),
        };
      }
      return { awarded: false, reason: "already_awarded" };
    }

    // Best-effort side-effects - must never fail the award. (Some still target
    // the not-yet-migrated Firestore services and will no-op until migrated.)
    void recordUserActivity(uid).catch(() => {});
    setTimeout(() => {
      void detectStatusChangeAndNudge({
        uid,
        journeyType,
        previousStatus: result.previous_status ?? "alert",
        currentStatus: result.status ?? "alert",
        pointsEarned: result.points_earned ?? activity.points,
        windowTarget: meta.weeklyTarget,
      }).catch(() => {});
      void checkAndHandleJourneyCompletion(uid, journeyType).catch(() => {});
    }, 100);

    return { awarded: true };
  } catch (error) {
    console.error("🔴 [Points] Failed to award checklist points", error);
    throw error;
  }
}

const friendlyAwardLimitMessage = (raw: string, title?: string | null) => {
  const lower = raw.toLowerCase();
  const name = title?.trim() || "This activity";
  if (lower.includes("cooldown")) {
    return `${name} opens again after the 7-day wait between sessions.`;
  }
  if (lower.includes("week")) {
    return `${name} is already done for this week.`;
  }
  if (lower.includes("window") || lower.includes("month")) {
    return `${name} is already claimed for this window. Try the next open week.`;
  }
  if (lower.includes("total") || lower.includes("exhausted") || lower.includes("cap")) {
    return `${name} has reached its maximum number of completions.`;
  }
  if (lower.includes("already")) {
    return `${name} was already credited for this week.`;
  }
  return raw;
};

export async function reconcileUserPointsFromLedger(uid: string): Promise<{
  totalPoints: number;
  level: number;
}> {
  if (!uid) throw new Error("[PointsService] uid is required");

  const { error } = await supabase.rpc("reconcile_user_points", { p_uid: uid });
  if (error) throw new Error(error.message);

  // Read back the reconciled mirror the RPC just wrote.
  const { data: row, error: readError } = await supabase
    .from("profiles")
    .select("total_points, level")
    .eq("id", uid)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  return {
    totalPoints: typeof row?.total_points === "number" ? row.total_points : 0,
    level: typeof row?.level === "number" ? row.level : 1,
  };
}

export async function revokeChecklistPoints(params: {
  uid: string;
  journeyType: JourneyType;
  weekNumber: number;
  activity: ActivityDef;
  claimRef?: string;
}): Promise<void> {
  const { uid, journeyType, weekNumber, activity, claimRef } = params;

  if (!uid) throw new Error("[PointsService] uid is required");
  if (!journeyType) throw new Error("[PointsService] journeyType is required");
  if (typeof weekNumber !== "number") throw new Error("[PointsService] weekNumber is required");
  if (!activity || !activity.id) {
    throw new Error(`[PointsService] activity.id is required. Got: ${JSON.stringify(activity)}`);
  }

  const monthNumber = getMonthNumber(weekNumber);
  const meta = JOURNEY_META[journeyType];
  const trackWindow = isWindowTrackingEnabled();
  const ledgerId = buildLedgerDocumentId({ uid, weekNumber, activityId: activity.id, claimRef });

  try {
    const { data, error } = await supabase.rpc("revoke_checklist_points", {
      p: {
        uid,
        ledger_id: ledgerId,
        week: weekNumber,
        month: monthNumber,
        points: activity.points,
        weekly_target: meta.weeklyTarget,
        track_window: trackWindow,
        journey_type: journeyType,
        window_number: trackWindow ? Math.ceil(weekNumber / 2) : null,
        window_target: meta.windowTarget ?? 0,
      },
    });

    if (error) throw new Error(error.message);

    const result = (data ?? {}) as {
      revoked?: boolean;
      previous_status?: string;
      status?: string;
      points_earned?: number;
    };

    // Nothing to revoke (row already gone) - no-op.
    if (result.revoked === false) return;

    setTimeout(() => {
      void detectStatusChangeAndNudge({
        uid,
        journeyType,
        previousStatus: result.previous_status ?? "alert",
        currentStatus: result.status ?? "alert",
        pointsEarned: result.points_earned ?? 0,
        windowTarget: meta.weeklyTarget,
      }).catch(() => {});
    }, 100);
  } catch (error) {
    console.error("🔴 [Points] Failed to revoke checklist points", error);
    throw error;
  }
}
