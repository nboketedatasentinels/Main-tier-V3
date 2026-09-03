// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

// ---------------------------------------------------------------------------
// resolve-impact-verification
// Public (token-gated) endpoint for verifiers to preview / approve / reject.
// Supports:
//   - legacy activity impact logs (checklist points)
//   - improvement claims (measure owner / finance → claimStatus + dashboard $)
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_NAME = "Transformation Leader";
const PLUM = "#27062e";
const INK = "#111827";
const BODY = "#374151";
const MUTE = "#6b7280";
const HAIR = "#e5e7eb";
const WASH = "#f8fafc";
const GREEN = "#15803d";
const RED = "#b91c1c";

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

function buildLedgerId(uid: string, weekNumber: number, activityId: string, claimRef: string) {
  const raw = `${uid}__w${weekNumber}__${activityId}__${claimRef}`;
  return raw.length > 200 ? raw.slice(0, 200) : raw;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// deno-lint-ignore no-explicit-any
let transporter: any = null;
// deno-lint-ignore no-explicit-any
function getTransporter(): any {
  if (transporter) return transporter;
  const host = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
  const port = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
  const secure = (Deno.env.get("SMTP_SECURE") || "true").toLowerCase() === "true";
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) {
    throw new Error("SMTP credentials are not configured (SMTP_USER / SMTP_PASS).");
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return transporter;
}

async function notifyLearner(
  admin: ReturnType<typeof adminClient>,
  params: {
    userId: string;
    title: string;
    message: string;
    relatedId: string;
    approved: boolean;
    actionUrl?: string;
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
        actionUrl: params.actionUrl || "/app/impact",
        approved: params.approved,
      },
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("[resolve-impact-verification] notify failed", error);
  }
}

async function sendFinanceFollowUpEmail(params: {
  to: string;
  financeName: string;
  learnerName: string;
  token: string;
  claimTitle: string;
  appBaseUrl: string;
}) {
  const approveUrl = `${params.appBaseUrl}/verify-impact?token=${encodeURIComponent(params.token)}&decision=approve`;
  const rejectUrl = `${params.appBaseUrl}/verify-impact?token=${encodeURIComponent(params.token)}&decision=reject`;
  const from = Deno.env.get("SMTP_FROM") || Deno.env.get("SMTP_USER") || "noreply@t4leader.com";
  const html = `
  <div style="font-family:Arial,sans-serif;background:${WASH};padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid ${HAIR};border-radius:12px;overflow:hidden;">
      <div style="background:${PLUM};color:#fff;padding:18px 22px;">
        <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;">${APP_NAME}</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px;">Finance validation requested</div>
      </div>
      <div style="padding:22px;color:${BODY};font-size:14px;line-height:1.55;">
        <p style="margin:0 0 12px;color:${INK};">Hi ${escapeHtml(params.financeName)},</p>
        <p style="margin:0 0 12px;">The measure owner confirmed an improvement claim from <strong>${escapeHtml(params.learnerName)}</strong>. Finance validation is required before the value enters the headline register.</p>
        <p style="margin:0 0 18px;"><strong>Claim:</strong> ${escapeHtml(params.claimTitle)}</p>
        <p style="margin:0 0 10px;">Please confirm the figures are true against the source extract, or send the claim back.</p>
        <p style="margin:18px 0;">
          <a href="${approveUrl}" style="display:inline-block;background:${GREEN};color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;margin-right:8px;">Confirm as finance</a>
          <a href="${rejectUrl}" style="display:inline-block;background:${RED};color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">Send back</a>
        </p>
        <p style="margin:0;font-size:12px;color:${MUTE};">This link does not require a T4L login. It is single-use and expires when resolved.</p>
      </div>
    </div>
  </div>`;
  await getTransporter().sendMail({
    from,
    to: params.to,
    subject: `${APP_NAME}: Finance validation · ${params.claimTitle}`,
    html,
  });
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
      appBaseUrl?: string;
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
      impactSummary?: Record<string, unknown>;
      verifierName?: string;
      verifierRole?: string;
    };

    if (row.alreadyResolved) {
      return json(200, { success: true, verification: row, alreadyResolved: true });
    }

    const summary = (row.impactSummary || {}) as Record<string, unknown>;
    const isClaim = summary.kind === "improvement_claim" ||
      row.verifierRole === "measure_owner" ||
      row.verifierRole === "finance";

    if (isClaim) {
      const role = String(row.verifierRole || summary.role || "measure_owner");
      const { data: claimResult, error: claimError } = await admin.rpc(
        "apply_impact_claim_confirmation",
        {
          p_impact_log_id: row.impactLogId,
          p_role: role,
          p_decision: mapped,
          p_actor_name: row.verifierName ?? null,
          p_rejection_reason: body.rejectionReason ?? null,
        },
      );
      if (claimError) throw new Error(claimError.message);

      const applied = (claimResult || {}) as {
        claimStatus?: string;
        needsFinanceFollowUp?: boolean;
        recognized?: boolean;
        financeName?: string;
        financeEmail?: string;
        title?: string;
        usdValue?: number;
        tier?: number;
      };

      let financeEmailed = false;
      if (mapped === "approved" && applied.needsFinanceFollowUp) {
        const financeEmail = String(applied.financeEmail || summary.financeEmail || "").trim()
          .toLowerCase();
        const financeName = String(applied.financeName || summary.financeName || "Finance").trim();
        if (financeEmail) {
          const { data: created, error: createErr } = await admin.rpc(
            "create_impact_claim_confirmation",
            {
              p_impact_log_id: row.impactLogId,
              p_verifier_name: financeName,
              p_verifier_email: financeEmail,
              p_role: "finance",
              p_activity_title: applied.title || row.activityTitle || "Improvement claim",
              p_impact_summary: {
                kind: "improvement_claim",
                role: "finance",
                net: applied.usdValue ?? summary.net ?? 0,
                measure: applied.title || row.activityTitle,
              },
              p_learner_name: (preview as { learnerName?: string })?.learnerName ?? null,
              p_learner_email: (preview as { learnerEmail?: string })?.learnerEmail ?? null,
              p_user_id: row.userId,
            },
          );
          if (createErr) {
            console.error("[resolve-impact-verification] finance token failed", createErr);
          } else {
            const financeToken = (created as { token?: string })?.token;
            const appBase = (() => {
              const fallback = "https://app.t4leader.com";
              const candidate = (body.appBaseUrl || Deno.env.get("APP_BASE_URL") || fallback)
                .trim()
                .replace(/\/$/, "");
              try {
                const url = new URL(candidate);
                const host = url.hostname.toLowerCase();
                if (host === "tier.t4leader.com" || host === "www.tier.t4leader.com") {
                  return fallback;
                }
                return `${url.protocol}//${url.host}`;
              } catch {
                return fallback;
              }
            })();
            if (financeToken) {
              try {
                await sendFinanceFollowUpEmail({
                  to: financeEmail,
                  financeName,
                  learnerName: (preview as { learnerName?: string })?.learnerName || "a learner",
                  token: financeToken,
                  claimTitle: applied.title || row.activityTitle || "Improvement claim",
                  appBaseUrl: appBase,
                });
                financeEmailed = true;
              } catch (mailErr) {
                console.error("[resolve-impact-verification] finance email failed", mailErr);
              }
            }
          }
        }
      }

      const recognized = Boolean(applied.recognized);
      await notifyLearner(admin, {
        userId: row.userId,
        title: mapped === "approved"
          ? (recognized
            ? `Improvement claim recognized · Tier ${applied.tier ?? 3}`
            : "Measure owner confirmed your claim")
          : "Improvement claim sent back",
        message: mapped === "approved"
          ? (recognized
            ? `"${applied.title || row.activityTitle || "Your claim"}" was validated. The value now appears on your Impact Log dashboard.`
            : `"${applied.title || row.activityTitle || "Your claim"}" was confirmed by the measure owner.${
              financeEmailed
                ? " Finance has been emailed to validate next."
                : " Finance validation is still required before headline value."
            }`)
          : `"${applied.title || row.activityTitle || "Your claim"}" was returned for revision.${
            body.rejectionReason ? ` Reason: ${body.rejectionReason}` : ""
          }`,
        relatedId: row.impactLogId,
        approved: mapped === "approved",
        actionUrl: "/app/impact",
      });

      return json(200, {
        success: true,
        verification: { ...row, ...applied },
        alreadyResolved: false,
        pointsAwarded: false,
        claimConfirmation: true,
        claimStatus: applied.claimStatus,
        recognized,
        financeEmailed,
      });
    }

    // ---- Legacy activity impact log path ----
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
        actionUrl: "/app/weekly-checklist",
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
        actionUrl: "/app/weekly-checklist",
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
