// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

// ---------------------------------------------------------------------------
// send-lift-results-email
// Emails a completed LIFT profile to the learner's work email and, when they
// consented, a copy to their employer contact.
//
// Two call paths:
//   1) { leadId } - anonymous public funnel. Service role loads the completed
//      lift_leads row and sends from DB fields (client scores are ignored).
//   2) Authenticated JWT, no leadId - loads lift_assessments for auth.uid().
//
// verify_jwt = false in config.toml; we authorize in-function.
// Transport: same SMTP mailbox as welcome / impact verification mail.
// ---------------------------------------------------------------------------

const FUNCTION_VERSION = "2026-08-24-lift-results";
const APP_NAME = "Transformation Leader";
const PLUM = "#27062e";
const GOLD = "#eab130";
const INK = "#111827";
const BODY = "#374151";
const MUTE = "#6b7280";
const HAIR = "#e5e7eb";
const WASH = "#f8fafc";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PILLAR_LABEL: Record<string, string> = {
  L: "Leading Self in the Age of AI",
  I: "Innovation and AI for Digital Transformation",
  F: "Fostering AI-Ready Teams",
  T: "Transforming Business with AI",
};

interface Payload {
  leadId?: string;
}

interface LiftSnapshot {
  recipientEmail: string;
  recipientName: string;
  employerEmail: string | null;
  shareWithEmployer: boolean;
  liftIndex: number;
  pillars: { L: number; I: number; F: number; T: number };
  archetype: string;
  developmentEdge: string | null;
  recommendedOffer: string | null;
  markEmailed: () => Promise<void>;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("server_misconfigured");
  return createClient(url, key);
}

async function authorizeUser(req: Request): Promise<
  | { userId: string; email: string }
  | Response
> {
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json(401, { error: "missing_authorization" });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return json(500, { error: "server_misconfigured" });

  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return json(401, { error: "invalid_token" });
  return {
    userId: data.user.id,
    email: (data.user.email || "").trim().toLowerCase(),
  };
}

// deno-lint-ignore no-explicit-any
let transporter: any = null;

function getTransporter() {
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

function displayName(first?: string | null, last?: string | null, fallback = "there"): string {
  const name = `${first || ""} ${last || ""}`.trim();
  return name || fallback;
}

function intakeShare(intake: Record<string, unknown> | null | undefined): {
  email: string;
  firstName: string | null;
  lastName: string | null;
  shareWithEmployer: boolean;
  employerEmail: string | null;
} {
  const raw = intake || {};
  const share =
    String(raw.shareWithEmployer || "").toLowerCase() === "yes" ||
    raw.shareWithEmployer === true;
  const employer = String(raw.employerEmail || "").trim().toLowerCase();
  return {
    email: String(raw.email || "").trim().toLowerCase(),
    firstName: raw.firstName ? String(raw.firstName) : null,
    lastName: raw.lastName ? String(raw.lastName) : null,
    shareWithEmployer: share,
    employerEmail: share && isEmail(employer) ? employer : null,
  };
}

async function loadFromLead(leadId: string): Promise<LiftSnapshot | Response> {
  const db = serviceClient();
  const { data, error } = await db
    .from("lift_leads")
    .select(
      "id, first_name, last_name, email, employer_email, share_with_employer, intake, pillar_l, pillar_i, pillar_f, pillar_t, lift_index, archetype, development_edge, recommended_offer, completed_at, results_emailed_at",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (error) return json(500, { error: "lead_lookup_failed", detail: error.message });
  if (!data) return json(404, { error: "lead_not_found" });
  if (!data.completed_at) {
    return json(409, { error: "lead_not_completed", detail: "Finish the assessment before emailing results." });
  }
  if (data.results_emailed_at) {
    return json(200, {
      success: true,
      already_sent: true,
      version: FUNCTION_VERSION,
    });
  }

  const fromIntake = intakeShare(data.intake as Record<string, unknown>);
  const recipientEmail =
    (data.email || "").trim().toLowerCase() || fromIntake.email;
  if (!isEmail(recipientEmail)) {
    return json(400, { error: "missing_recipient_email" });
  }

  const shareWithEmployer =
    Boolean(data.share_with_employer) || fromIntake.shareWithEmployer;
  const employerEmail =
    (shareWithEmployer &&
      ((data.employer_email || "").trim().toLowerCase() || fromIntake.employerEmail)) ||
    null;

  return {
    recipientEmail,
    recipientName: displayName(data.first_name || fromIntake.firstName, data.last_name || fromIntake.lastName),
    employerEmail: employerEmail && isEmail(employerEmail) ? employerEmail : null,
    shareWithEmployer,
    liftIndex: Number(data.lift_index) || 0,
    pillars: {
      L: Number(data.pillar_l) || 0,
      I: Number(data.pillar_i) || 0,
      F: Number(data.pillar_f) || 0,
      T: Number(data.pillar_t) || 0,
    },
    archetype: String(data.archetype || "Emerging Leader"),
    developmentEdge: data.development_edge ? String(data.development_edge) : null,
    recommendedOffer: data.recommended_offer ? String(data.recommended_offer) : null,
    markEmailed: async () => {
      await db
        .from("lift_leads")
        .update({ results_emailed_at: new Date().toISOString() })
        .eq("id", leadId);
    },
  };
}

async function loadFromAssessment(userId: string, authEmail: string): Promise<LiftSnapshot | Response> {
  const db = serviceClient();
  const { data, error } = await db
    .from("lift_assessments")
    .select(
      "uid, intake, pillar_l, pillar_i, pillar_f, pillar_t, lift_index, archetype, development_edge, recommended_offer, results_emailed_at",
    )
    .eq("uid", userId)
    .maybeSingle();

  if (error) return json(500, { error: "assessment_lookup_failed", detail: error.message });
  if (!data) return json(404, { error: "assessment_not_found" });

  const fromIntake = intakeShare(data.intake as Record<string, unknown>);
  const { data: profile } = await db
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  const recipientEmail =
    fromIntake.email ||
    (profile?.email || "").trim().toLowerCase() ||
    authEmail;
  if (!isEmail(recipientEmail)) {
    return json(400, { error: "missing_recipient_email" });
  }

  const profileName = (profile?.full_name || "").trim();
  const recipientName = displayName(
    fromIntake.firstName,
    fromIntake.lastName,
    profileName || "there",
  );

  return {
    recipientEmail,
    recipientName,
    employerEmail: fromIntake.employerEmail,
    shareWithEmployer: fromIntake.shareWithEmployer,
    liftIndex: Number(data.lift_index) || 0,
    pillars: {
      L: Number(data.pillar_l) || 0,
      I: Number(data.pillar_i) || 0,
      F: Number(data.pillar_f) || 0,
      T: Number(data.pillar_t) || 0,
    },
    archetype: String(data.archetype || "Emerging Leader"),
    developmentEdge: data.development_edge ? String(data.development_edge) : null,
    recommendedOffer: data.recommended_offer ? String(data.recommended_offer) : null,
    markEmailed: async () => {
      await db
        .from("lift_assessments")
        .update({ results_emailed_at: new Date().toISOString() })
        .eq("uid", userId);
    },
  };
}

function edgeLabel(key: string | null): string {
  if (!key) return "-";
  return PILLAR_LABEL[key] || key;
}

function buildHtml(snapshot: LiftSnapshot, audience: "learner" | "employer"): string {
  const greeting =
    audience === "employer"
      ? `A colleague shared their LIFT Index results with you.`
      : `Hi ${escapeHtml(snapshot.recipientName)},`;
  const intro =
    audience === "employer"
      ? `<p style="margin:0 0 16px;color:${BODY};font-size:15px;line-height:1.55">${escapeHtml(snapshot.recipientName)} completed the LIFT Index and asked Transformation Leader to share their profile with this address.</p>`
      : `<p style="margin:0 0 16px;color:${BODY};font-size:15px;line-height:1.55">Here is your LIFT Index profile so you never lose it. Keep this email - your pattern is a useful baseline for the next 90 days.</p>`;

  const pillarRows = (["L", "I", "F", "T"] as const)
    .map((key) => {
      const score = snapshot.pillars[key];
      const pct = Math.max(0, Math.min(100, Math.round((score / 16) * 100)));
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${HAIR};color:${INK};font-size:14px;font-weight:600">${escapeHtml(PILLAR_LABEL[key])}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${HAIR};text-align:right;color:${PLUM};font-size:14px;font-weight:700;white-space:nowrap">${score} / 16 · ${pct}%</td>
      </tr>`;
    })
    .join("");

  const appBase = (Deno.env.get("APP_BASE_URL") || "https://app.t4leader.com").replace(/\/$/, "");

  return `<!doctype html><html><body style="margin:0;background:${WASH};font-family:Arial,Helvetica,sans-serif;color:${BODY}">
  <div style="max-width:640px;margin:24px auto;background:#fff;border:1px solid ${HAIR};border-radius:12px;overflow:hidden">
    <div style="background:${PLUM};color:#fff;padding:22px 24px">
      <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.8">${APP_NAME}</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px;color:#fff">Your LIFT Index result</div>
      <div style="margin-top:10px;display:inline-block;background:${GOLD};color:${PLUM};font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:6px 10px;border-radius:999px">${escapeHtml(snapshot.archetype)}</div>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 8px;color:${INK};font-size:16px;font-weight:600">${greeting}</p>
      ${intro}
      <div style="background:${WASH};border:1px solid ${HAIR};border-radius:10px;padding:16px 18px;margin:0 0 20px">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${MUTE};font-weight:700">LIFT Index</div>
        <div style="font-size:36px;font-weight:800;color:${PLUM};line-height:1.1;margin-top:4px">${snapshot.liftIndex}<span style="font-size:16px;font-weight:600;color:${MUTE}"> / 64</span></div>
        <div style="margin-top:8px;color:${BODY};font-size:14px">Growth edge: <strong style="color:${INK}">${escapeHtml(edgeLabel(snapshot.developmentEdge))}</strong></div>
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 20px">${pillarRows}</table>
      <p style="margin:0 0 20px;color:${MUTE};font-size:13px;line-height:1.5">We develop the leaders who make AI and digital transformation succeed. Retake the LIFT Index in 90 days to see how your pattern shifts.</p>
      <a href="${escapeHtml(appBase)}/app/lift-results" style="display:inline-block;background:${PLUM};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:10px">Open your results</a>
    </div>
    <div style="padding:14px 24px;border-top:1px solid ${HAIR};color:${MUTE};font-size:12px">
      Your details are private and used only to deliver your results.
    </div>
  </div>
  </body></html>`;
}

function buildText(snapshot: LiftSnapshot, audience: "learner" | "employer"): string {
  const lines = [
    audience === "employer"
      ? `${snapshot.recipientName} shared their LIFT Index results with you.`
      : `Hi ${snapshot.recipientName},`,
    "",
    `Archetype: ${snapshot.archetype}`,
    `LIFT Index: ${snapshot.liftIndex} / 64`,
    `Growth edge: ${edgeLabel(snapshot.developmentEdge)}`,
    "",
    `L - ${PILLAR_LABEL.L}: ${snapshot.pillars.L}/16`,
    `I - ${PILLAR_LABEL.I}: ${snapshot.pillars.I}/16`,
    `F - ${PILLAR_LABEL.F}: ${snapshot.pillars.F}/16`,
    `T - ${PILLAR_LABEL.T}: ${snapshot.pillars.T}/16`,
    "",
    "Retake the LIFT Index in 90 days to see how your pattern shifts.",
    `${APP_NAME} · https://app.t4leader.com`,
  ];
  return lines.join("\n");
}

async function sendMails(snapshot: LiftSnapshot): Promise<{ learner: boolean; employer: boolean }> {
  const fromAddressRaw =
    Deno.env.get("SMTP_FROM") || Deno.env.get("SMTP_USER") || "info@t4leader.com";
  const fromEmailMatch = fromAddressRaw.match(/<([^>]+)>/);
  const fromEmail = (fromEmailMatch?.[1] || fromAddressRaw).trim();
  const transport = getTransporter();

  await transport.sendMail({
    from: `"${APP_NAME}" <${fromEmail}>`,
    to: snapshot.recipientEmail,
    subject: `Your LIFT Index result - ${snapshot.archetype}`,
    text: buildText(snapshot, "learner"),
    html: buildHtml(snapshot, "learner"),
  });

  let employerSent = false;
  if (
    snapshot.shareWithEmployer &&
    snapshot.employerEmail &&
    snapshot.employerEmail !== snapshot.recipientEmail
  ) {
    await transport.sendMail({
      from: `"${APP_NAME}" <${fromEmail}>`,
      to: snapshot.employerEmail,
      subject: `LIFT Index results shared with you - ${snapshot.recipientName}`,
      text: buildText(snapshot, "employer"),
      html: buildHtml(snapshot, "employer"),
    });
    employerSent = true;
  }

  return { learner: true, employer: employerSent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Payload;
    const leadId = (body.leadId || "").trim();

    let snapshot: LiftSnapshot | Response;

    if (leadId) {
      snapshot = await loadFromLead(leadId);
    } else {
      const auth = await authorizeUser(req);
      if (auth instanceof Response) return auth;
      snapshot = await loadFromAssessment(auth.userId, auth.email);
    }

    // loadFromLead may return an already_sent 200 Response
    if (snapshot instanceof Response) return snapshot;

    const sent = await sendMails(snapshot);
    await snapshot.markEmailed();

    return json(200, {
      success: true,
      sent,
      version: FUNCTION_VERSION,
    });
  } catch (error) {
    console.error("[send-lift-results-email]", error);
    return json(500, {
      error: "send_failed",
      detail: error instanceof Error ? error.message : String(error),
      version: FUNCTION_VERSION,
    });
  }
});
