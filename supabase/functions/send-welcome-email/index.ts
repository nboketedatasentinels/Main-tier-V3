// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// ---------------------------------------------------------------------------
// send-welcome-email  (Supabase Edge Function)
// Sends a clean, role-specific welcome email when a person is onboarded into a
// new role on the Transformation Tier platform:
//   - a partner is assigned an organization
//   - a mentor / ambassador is assigned to an organization
//   - a user is added to an organization
//
// Design: white primary (background), dark purple (#350e6f) secondary
// (header / button / accents), deeper plum (#27062e) footer band.
//
// Called from the browser via supabase.functions.invoke('send-welcome-email').
// Auth: this function runs with verify_jwt=false (see supabase/config.toml) to
// avoid the CORS-preflight 401; we verify the caller's JWT + role in-function.
// Transport: SMTP (reuses the existing info@t4leader.com mailbox).
// ---------------------------------------------------------------------------
const FUNCTION_VERSION = "2026-07-15-initial";

const APP_NAME = "Transformation Tier";
const PURPLE = "#350e6f"; // secondary colour (dark purple)
const PLUM = "#27062e"; // deeper accent for the footer band

type WelcomeRole = "partner" | "mentor" | "ambassador" | "user";

// Role-specific CTA destination. Partners land on the partner signup flow; all
// other roles open the main app.
const CTA_LINK: Record<WelcomeRole, string> = {
  partner: "https://app.t4leader.com/partner-signup",
  mentor: "https://app.t4leader.com/",
  ambassador: "https://app.t4leader.com/",
  user: "https://app.t4leader.com/",
};

interface WelcomePayload {
  to: string;
  recipientName: string;
  role: WelcomeRole;
  organizationName?: string | null;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RoleCopy {
  label: string;
  subject: (org?: string) => string;
  heading: string;
  intro: (org?: string) => string;
  points: string[];
  cta: string;
}

const ROLE_COPY: Record<WelcomeRole, RoleCopy> = {
  partner: {
    label: "Partner",
    subject: (org) =>
      org
        ? `Welcome to ${APP_NAME} — you're the Partner for ${org}`
        : `Welcome to ${APP_NAME} — you're now a Partner`,
    heading: "You're now a Partner",
    intro: (org) =>
      `You've been assigned as the Transformation Partner${
        org ? ` for <strong>${org}</strong>` : ""
      }. As a Partner you own the leadership journey for your organisation and its members.`,
    points: [
      "Oversee your organisation's cohorts and track their progress",
      "Assign mentors and ambassadors, and manage your members",
      "Send nudges and celebrate milestones as your teams advance",
    ],
    cta: "Open Partner Dashboard",
  },
  mentor: {
    label: "Mentor",
    subject: (org) =>
      org
        ? `Welcome to ${APP_NAME} — you're a Mentor for ${org}`
        : `Welcome to ${APP_NAME} — you're now a Mentor`,
    heading: "You're now a Mentor",
    intro: (org) =>
      `You've been assigned as a Mentor${
        org ? ` for <strong>${org}</strong>` : ""
      }. Your guidance helps learners stay on track and grow as leaders.`,
    points: [
      "Support and coach the learners paired with you",
      "Review progress and award points for meaningful work",
      "Encourage momentum through every two-week window",
    ],
    cta: "Open Mentor Dashboard",
  },
  ambassador: {
    label: "Ambassador",
    subject: (org) =>
      org
        ? `Welcome to ${APP_NAME} — you're an Ambassador for ${org}`
        : `Welcome to ${APP_NAME} — you're now an Ambassador`,
    heading: "You're now an Ambassador",
    intro: (org) =>
      `You've been assigned as an Ambassador${
        org ? ` for <strong>${org}</strong>` : ""
      }. You champion the transformation journey and keep your community engaged.`,
    points: [
      "Rally and inspire members across your organisation",
      "Recognise progress and award points for engagement",
      "Be the friendly face of the leadership programme",
    ],
    cta: "Open Ambassador Dashboard",
  },
  user: {
    label: "Member",
    subject: (org) =>
      org
        ? `Welcome to ${APP_NAME} — your leadership journey with ${org}`
        : `Welcome to ${APP_NAME} — your leadership journey starts here`,
    heading: "Welcome to your leadership journey",
    intro: (org) =>
      `You've been added to ${APP_NAME}${
        org ? ` as part of <strong>${org}</strong>` : ""
      }. Everything you need to grow as a leader is now in one place.`,
    points: [
      "Follow your guided journey, one two-week window at a time",
      "Earn points, badges and climb the leaderboard",
      "Track your real-world impact as you go",
    ],
    cta: "Open My Dashboard",
  },
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function buildWelcomeHtml(data: WelcomePayload): string {
  const copy = ROLE_COPY[data.role];
  const org = data.organizationName
    ? escapeHtml(String(data.organizationName).trim())
    : undefined;
  const name = escapeHtml((data.recipientName || "").trim() || "there");
  const preview = `Welcome to ${APP_NAME} — you're now a ${copy.label}.`;

  const bullets = copy.points
    .map(
      (point) =>
        `<tr>
          <td valign="top" style="padding:4px 12px 4px 0;font-size:15px;line-height:1.5;color:${PURPLE};font-weight:700;">&bull;</td>
          <td style="padding:4px 0;font-size:14px;line-height:1.6;color:#4A5568;">${point}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(copy.subject(org))}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .px-content { padding-left: 22px !important; padding-right: 22px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;font-size:1px;color:#FFFFFF;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(
    preview,
  )}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;padding:32px 16px;">
    <tr><td align="center">
      <table class="container" width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #EDEBF3;border-radius:14px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:${PURPLE};padding:32px 24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#C9B8E8;">${APP_NAME}</p>
          <h1 style="margin:0;font-size:24px;color:#FFFFFF;font-weight:700;">${copy.heading}</h1>
          <p style="margin:10px auto 0;display:inline-block;background:rgba(255,255,255,0.14);border-radius:100px;padding:5px 16px;font-size:12px;font-weight:600;letter-spacing:0.5px;color:#FFFFFF;text-transform:uppercase;">${copy.label}</p>
        </td></tr>

        <!-- Greeting + intro -->
        <tr><td class="px-content" style="padding:30px 36px 8px;">
          <p style="margin:0 0 16px;font-size:16px;color:#1A202C;">Hi <strong>${name}</strong>,</p>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#4A5568;">${copy.intro(
            org,
          )}</p>
        </td></tr>

        <!-- What you can do -->
        <tr><td class="px-content" style="padding:20px 36px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5FB;border:1px solid #EDEBF3;border-radius:10px;padding:6px 18px;">
            <tr><td style="padding:12px 4px 4px;font-size:12px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:${PURPLE};">Here's what you can do</td></tr>
            <tr><td style="padding:4px;">
              <table width="100%" cellpadding="0" cellspacing="0">${bullets}</table>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td class="px-content" style="padding:26px 36px 8px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:${PURPLE};border-radius:10px;">
              <a href="${CTA_LINK[data.role]}" style="display:inline-block;padding:14px 34px;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;">${copy.cta}</a>
            </td>
          </tr></table>
        </td></tr>

        <!-- Sign-off -->
        <tr><td class="px-content" style="padding:22px 36px 30px;">
          <p style="margin:0;font-size:14px;line-height:1.7;color:#4A5568;">We're glad to have you on board.<br/>&mdash; The ${APP_NAME} Team</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 24px;background:${PLUM};text-align:center;">
          <p style="margin:0;font-size:11px;color:#B9A8D6;line-height:1.6;">
            ${APP_NAME} &bull; You received this email because you were added to the platform.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildWelcomeText(data: WelcomePayload): string {
  const copy = ROLE_COPY[data.role];
  const org = data.organizationName
    ? String(data.organizationName).trim()
    : undefined;
  const name = (data.recipientName || "").trim() || "there";
  const intro = copy.intro(org).replace(/<[^>]+>/g, "");
  const points = copy.points.map((p) => `  - ${p}`).join("\n");
  return [
    `Hi ${name},`,
    "",
    intro,
    "",
    "Here's what you can do:",
    points,
    "",
    `${copy.cta}: ${CTA_LINK[data.role]}`,
    "",
    "We're glad to have you on board.",
    `- The ${APP_NAME} Team`,
  ].join("\n");
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/**
 * Verify the caller is an authenticated partner/admin. We run verify_jwt=false,
 * so we validate the bearer token ourselves and look up the caller's role with
 * the service role. Returns null when authorized, or an error Response.
 */
async function authorizeCaller(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "missing_token" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return json(401, { error: "invalid_token" });

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  const role = (profile?.role as string) || "";
  const allowed = ["partner", "super_admin", "admin", "company_admin"];
  if (!allowed.includes(role)) {
    return json(403, { error: "forbidden", detail: "partner/admin role required" });
  }
  return null;
}

let smtpClient: SMTPClient | null = null;

function getSmtpClient(): SMTPClient {
  if (smtpClient) return smtpClient;
  const hostname = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
  const port = parseInt(Deno.env.get("SMTP_PORT") || "587", 10);
  const secure = (Deno.env.get("SMTP_SECURE") || "").toLowerCase() === "true";
  const username = Deno.env.get("SMTP_USER");
  const password = Deno.env.get("SMTP_PASS");
  if (!username || !password) {
    throw new Error("SMTP credentials are not configured (SMTP_USER / SMTP_PASS).");
  }
  smtpClient = new SMTPClient({
    connection: {
      hostname,
      port,
      // Implicit TLS on 465; STARTTLS is negotiated automatically on 587.
      tls: secure,
      auth: { username, password },
    },
  });
  return smtpClient;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  try {
    const authError = await authorizeCaller(req);
    if (authError) return authError;

    const body = (await req.json().catch(() => ({}))) as Partial<WelcomePayload>;
    const to = (body.to || "").trim();
    const recipientName = (body.recipientName || "").trim();
    const role = body.role as WelcomeRole;

    if (!to || !recipientName || !role) {
      return json(400, {
        error: "invalid_argument",
        detail: "to, recipientName and role are required",
        version: FUNCTION_VERSION,
      });
    }
    if (!ROLE_COPY[role]) {
      return json(400, { error: "unsupported_role", role, version: FUNCTION_VERSION });
    }

    const payload: WelcomePayload = {
      to,
      recipientName,
      role,
      organizationName: body.organizationName ?? null,
    };

    const fromAddress =
      Deno.env.get("SMTP_FROM") || Deno.env.get("SMTP_USER") || "info@t4leader.com";
    const subject = ROLE_COPY[role].subject(
      payload.organizationName ? String(payload.organizationName).trim() : undefined,
    );

    const client = getSmtpClient();
    await client.send({
      from: `${APP_NAME} <${fromAddress}>`,
      to,
      subject,
      content: buildWelcomeText(payload),
      html: buildWelcomeHtml(payload),
    });

    console.log(`send-welcome-email ok: ${role} -> ${to}`);
    return json(200, { success: true, version: FUNCTION_VERSION });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`send-welcome-email error: ${message}`);
    return json(500, { success: false, error: message, version: FUNCTION_VERSION });
  }
});
