// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// resolve-impact-verification
// Public (token-gated) endpoint for verifiers to preview / approve / reject.
// On approve: awards checklist impact_log points. On reject: 0 points.
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Decision = "approve" | "reject" | "preview";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function adminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Deterministic ledger id matching src/services/pointsService.ts (claimRef form). */
function buildLedgerId(uid: string, weekNumber: number, activityId: string, claimRef: string) {
  const raw = `${uid}__w${weekNumber}__${activityId}__${claimRef}`;
  return raw.length > 200 ? raw.slice(0, 200) : raw;
}

async function notifyLearner(
  admin: ReturnType<typeof adminClient>,
  params: {
    userId: string;
    title: string;
    message: string;
    relatedId: string;
    approved: boolean;
  },
) {
  try {
    await admin.from("notifications").insert({
      user_id: params.userId,
      title: params.title,
      message: params.message,
      type: "approval",
      related_id: params.relatedId,
      metadata: {
        actionUrl: "/app/weekly-checklist",
        approved: params.approved,
      },
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("[resolve-impact-verification] notify failed", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      token?: string;
      decision?: Decision;
      rejectionReason?: string;
    };
    const token = (body.token || "").trim();
    const decision = (body.decision || "preview") as Decision;
    if (!token || token.length < 16) {
      return json(400, { error: "invalid_token" });
    }

    const admin = adminClient();

    const { data: preview, error: previewError } = await admin.rpc(
      "get_impact_verification_by_token",
      { p_token: token },
    );
    if (previewError) throw new Error(previewError.message);
    if (!preview) return json(404, { error: "not_found" });

    if (decision === "preview") {
      return json(200, { success: true, verification: preview });
    }

    const mapped = decision === "approve" ? "approved" : "rejected";
    const { data: resolved, error: resolveError } = await admin.rpc(
      "resolve_impact_verification",
      {
        p_token: token,
        p_decision: mapped,
        p_rejection_reason: body.rejectionReason ?? null,
      },
    );
    if (resolveError) throw new Error(resolveError.message);

    const row = resolved as {
      id: string;
      status: string;
      alreadyResolved: boolean;
      impactLogId: string;
      userId: string;
      weekNumber: number;
      journeyType: string | null;
      activityTitle?: string;
      pointsToAward?: number;
    };

    if (row.alreadyResolved) {
      return json(200, { success: true, verification: row, alreadyResolved: true });
    }

    const weekNumber = Number(row.weekNumber) || 1;
    const journeyType = row.journeyType || "6W";
    const activityId = "impact_log";
    const points = Number(row.pointsToAward) || 1000;
    const monthNumber = Math.ceil(weekNumber / 4) || 1;

    if (mapped === "approved") {
      const ledgerId = buildLedgerId(row.userId, weekNumber, activityId, row.impactLogId);
      const { error: awardError } = await admin.rpc("award_checklist_points", {
        p: {
          uid: row.userId,
          ledger_id: ledgerId,
          week: weekNumber,
          month: monthNumber,
          activity_id: activityId,
          points,
          source: "impact_log_verification",
          claim_ref: row.impactLogId,
          approval_type: "verifier_approved",
          category: "Impact",
          reason: row.activityTitle || "Impact Log Entry",
          weekly_target: null,
          max_per_week: null,
          max_per_window: null,
          max_total: null,
          cooldown_weeks: null,
          bypass_limits: false,
          track_window: false,
          journey_type: journeyType,
          window_number: null,
          window_target: 0,
        },
      });
      if (awardError) {
        console.error("[resolve-impact-verification] award failed", awardError);
      }

      try {
        await admin.rpc("upsert_checklist_activity", {
          p_uid: row.userId,
          p_week: weekNumber,
          p_activity_id: activityId,
          p_patch: {
            status: "completed",
            hasInteracted: true,
            rejectionReason: null,
            notes: "Verified by impact verifier",
          },
        });
      } catch (error) {
        console.warn("[resolve-impact-verification] checklist update failed", error);
      }

      await notifyLearner(admin, {
        userId: row.userId,
        title: "Impact log approved",
        message: `Your impact log "${row.activityTitle || "Impact activity"}" was approved and points were added.`,
        relatedId: row.id,
        approved: true,
      });
    } else {
      try {
        await admin.rpc("upsert_checklist_activity", {
          p_uid: row.userId,
          p_week: weekNumber,
          p_activity_id: activityId,
          p_patch: {
            status: "rejected",
            hasInteracted: true,
            rejectionReason: body.rejectionReason || "Rejected by verifier",
            notes: null,
          },
        });
      } catch (error) {
        console.warn("[resolve-impact-verification] checklist reject failed", error);
      }

      await notifyLearner(admin, {
        userId: row.userId,
        title: "Impact log rejected",
        message: `Your impact log "${row.activityTitle || "Impact activity"}" was rejected. No points were awarded.`,
        relatedId: row.id,
        approved: false,
      });
    }

    return json(200, {
      success: true,
      verification: row,
      alreadyResolved: false,
      pointsAwarded: mapped === "approved",
    });
  } catch (error) {
    console.error("[resolve-impact-verification]", error);
    return json(500, {
      error: "resolve_failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
