// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

// ---------------------------------------------------------------------------
// send-impact-verification-email
// Professional verification request with the full impact-log record.
// ---------------------------------------------------------------------------

const APP_NAME = "Transformation Leader";
const PLUM = "#27062e";
const INK = "#111827";
const BODY = "#374151";
const MUTE = "#6b7280";
const HAIR = "#e5e7eb";
const WASH = "#f8fafc";
const GREEN = "#15803d";
const RED = "#b91c1c";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DetailRow {
  label: string;
  value: string;
}

interface DetailSection {
  title: string;
  rows: DetailRow[];
}

interface Payload {
  to: string;
  verifierName: string;
  learnerName: string;
  learnerEmail?: string;
  token: string;
  activityTitle?: string;
  submittedAt?: string;
  organizationName?: string;
  /** Preferred structured payload for the professional email layout. */
  sections?: DetailSection[];
  /** Fallback flat lines (label: value) if sections are omitted. */
  summaryLines?: string[];
  appBaseUrl?: string;
}

/** Canonical app host. Legacy tier.t4leader.com no longer resolves in DNS. */
function resolveAppBaseUrl(raw?: string | null): string {
  const fallback = "https://app.t4leader.com";
  const candidate = (raw || Deno.env.get("APP_BASE_URL") || fallback).trim().replace(/\/$/, "");
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

/** Escape text and wrap http(s) URLs as clickable links for the email HTML. */
function formatValueHtml(raw: string): string {
  const value = String(raw ?? "");
  if (!value) return "-";
  const urlRe = /(https?:\/\/[^\s<>"']+)/gi;
  let html = "";
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = urlRe.exec(value)) !== null) {
    html += escapeHtml(value.slice(last, match.index));
    const full = match[1];
    const url = full.replace(/[.,);]+$/g, "");
    const trailing = full.slice(url.length);
    html += `<a href="${escapeHtml(url)}" style="color:#350e6f;text-decoration:underline;word-break:break-all;" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>${escapeHtml(trailing)}`;
    last = match.index + full.length;
  }
  html += escapeHtml(value.slice(last));
  return html || escapeHtml(value);
}

function formatDisplayValue(value: unknown): string {
  if (value == null) return "-";
  if (Array.isArray(value)) {
    const joined = value.map((v) => String(v).trim()).filter(Boolean).join(", ");
    return joined || "-";
  }
  const text = String(value).trim();
  return text.length ? text : "-";
}

async function authorizeCaller(req: Request): Promise<string | Response> {
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
  return userData.user.id;
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

function normalizeSections(body: Partial<Payload>): DetailSection[] {
  if (Array.isArray(body.sections) && body.sections.length > 0) {
    return body.sections
      .map((section) => ({
        title: String(section?.title || "").trim() || "Details",
        rows: (Array.isArray(section?.rows) ? section.rows : [])
          .map((row) => ({
            label: String(row?.label || "").trim(),
            value: formatDisplayValue(row?.value),
          }))
          .filter((row) => row.label),
      }))
      .filter((section) => section.rows.length > 0);
  }

  const lines = Array.isArray(body.summaryLines) ? body.summaryLines : [];
  if (!lines.length) return [];
  return [
    {
      title: "Impact log details",
      rows: lines.map((line) => {
        const raw = String(line);
        const idx = raw.indexOf(":");
        if (idx === -1) return { label: "Detail", value: raw };
        return {
          label: raw.slice(0, idx).trim() || "Detail",
          value: raw.slice(idx + 1).trim() || "-",
        };
      }),
    },
  ];
}

function buildSectionsHtml(sections: DetailSection[]): string {
  if (!sections.length) {
    return `<p style="margin:0;font-size:14px;color:${MUTE};">No additional details were provided.</p>`;
  }

  return sections
    .map((section) => {
      const rowsHtml = section.rows
        .map((row, index) => {
          const border = index === section.rows.length - 1 ? "0" : `1px solid ${HAIR}`;
          const isLong = row.value.length > 120 || row.value.includes("\n");
          const valueHtml = isLong
            ? `<div style="margin:0;font-size:14px;line-height:1.65;color:${INK};white-space:pre-wrap;">${formatValueHtml(row.value)}</div>`
            : `<div style="margin:0;font-size:14px;line-height:1.5;color:${INK};word-break:break-word;">${formatValueHtml(row.value)}</div>`;
          return `<tr>
            <td style="padding:12px 14px;border-bottom:${border};width:38%;vertical-align:top;">
              <div style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTE};">${escapeHtml(row.label)}</div>
            </td>
            <td style="padding:12px 14px;border-bottom:${border};vertical-align:top;">
              ${valueHtml}
            </td>
          </tr>`;
        })
        .join("");

      return `
        <tr><td style="padding:18px 0 8px;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${PLUM};">${escapeHtml(section.title)}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${HAIR};border-radius:10px;overflow:hidden;background:#FFFFFF;">
            ${rowsHtml}
          </table>
        </td></tr>`;
    })
    .join("");
}

function buildHtml(data: {
  verifierName: string;
  learnerName: string;
  learnerEmail: string;
  activityTitle: string;
  submittedAt: string;
  organizationName: string;
  sectionsHtml: string;
  approveUrl: string;
  rejectUrl: string;
}): string {
  const orgLine = data.organizationName
    ? `<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.78);">${escapeHtml(data.organizationName)}</p>`
    : "";
  const learnerEmailLine = data.learnerEmail
    ? `<p style="margin:4px 0 0;font-size:13px;color:${MUTE};">${escapeHtml(data.learnerEmail)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Impact verification request - ${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Georgia,'Times New Roman',Times,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:36px 16px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid ${HAIR};border-radius:4px;overflow:hidden;">

        <!-- Brand header -->
        <tr><td style="background:${PLUM};padding:28px 36px;">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.72);">Official verification request</p>
          <p style="margin:10px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#FFFFFF;line-height:1.3;">${APP_NAME}</p>
          ${orgLine}
        </td></tr>

        <!-- Intro -->
        <tr><td style="padding:32px 36px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <p style="margin:0 0 16px;font-size:16px;color:${INK};">Dear ${escapeHtml(data.verifierName)},</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:${BODY};">
            You have been designated as the independent verifier for an impact log submitted on the ${APP_NAME} platform.
            Please review the complete record below and confirm whether the activity and reported outcomes are accurate to the best of your knowledge.
          </p>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.75;color:${BODY};">
            <strong style="color:${INK};">Approving</strong> this entry will release the learner’s associated journey points.
            <strong style="color:${INK};">Rejecting</strong> it will award zero points for this submission.
          </p>
        </td></tr>

        <!-- Snapshot card -->
        <tr><td style="padding:12px 36px 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${WASH};border:1px solid ${HAIR};border-radius:10px;">
            <tr>
              <td style="padding:18px 20px;width:50%;vertical-align:top;border-right:1px solid ${HAIR};">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${MUTE};">Submitted by</p>
                <p style="margin:0;font-size:15px;font-weight:700;color:${INK};">${escapeHtml(data.learnerName)}</p>
                ${learnerEmailLine}
              </td>
              <td style="padding:18px 20px;vertical-align:top;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${MUTE};">Activity title</p>
                <p style="margin:0;font-size:15px;font-weight:700;color:${INK};">${escapeHtml(data.activityTitle)}</p>
                ${
                  data.submittedAt
                    ? `<p style="margin:6px 0 0;font-size:13px;color:${MUTE};">Submitted ${escapeHtml(data.submittedAt)}</p>`
                    : ""
                }
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Full details -->
        <tr><td style="padding:8px 36px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0">${data.sectionsHtml}</table>
        </td></tr>

        <!-- Decision -->
        <tr><td style="padding:20px 36px 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${PLUM};">Your decision</p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:${BODY};">
            Please select one of the options below. Each link may be used once and will open a secure verification page.
          </p>
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:${GREEN};border-radius:8px;">
              <a href="${data.approveUrl}" style="display:inline-block;padding:14px 26px;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.02em;">Approve impact log</a>
            </td>
            <td width="12"></td>
            <td style="background:#FFFFFF;border:1px solid ${RED};border-radius:8px;">
              <a href="${data.rejectUrl}" style="display:inline-block;padding:13px 26px;color:${RED};text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.02em;">Reject impact log</a>
            </td>
          </tr></table>
        </td></tr>

        <!-- Closing -->
        <tr><td style="padding:18px 36px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:${BODY};">
            If you believe you received this message in error, you may disregard it. No action will be taken unless you approve or reject the submission.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:${INK};">
            Kind regards,<br/>
            <strong>The ${APP_NAME} Team</strong>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:18px 28px;background:${WASH};border-top:1px solid ${HAIR};text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <p style="margin:0;font-size:11px;line-height:1.6;color:${MUTE};">
            ${APP_NAME} · Confidential verification correspondence<br/>
            This email contains learner-submitted impact data intended solely for the named verifier.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildText(data: {
  verifierName: string;
  learnerName: string;
  learnerEmail: string;
  activityTitle: string;
  submittedAt: string;
  organizationName: string;
  sections: DetailSection[];
  approveUrl: string;
  rejectUrl: string;
}): string {
  const lines: string[] = [
    `Dear ${data.verifierName},`,
    "",
    `You have been designated as the independent verifier for an impact log submitted on the ${APP_NAME} platform.`,
    "Please review the complete record below and confirm whether the activity and reported outcomes are accurate.",
    "",
    "Approving this entry will release the learner's associated journey points.",
    "Rejecting it will award zero points for this submission.",
    "",
    `Submitted by: ${data.learnerName}${data.learnerEmail ? ` <${data.learnerEmail}>` : ""}`,
    `Activity title: ${data.activityTitle}`,
  ];
  if (data.organizationName) lines.push(`Organisation: ${data.organizationName}`);
  if (data.submittedAt) lines.push(`Submitted: ${data.submittedAt}`);
  lines.push("");

  for (const section of data.sections) {
    lines.push(section.title.toUpperCase());
    lines.push("-".repeat(Math.min(48, section.title.length + 8)));
    for (const row of section.rows) {
      lines.push(`${row.label}: ${row.value}`);
    }
    lines.push("");
  }

  lines.push(
    "YOUR DECISION",
    `Approve: ${data.approveUrl}`,
    `Reject:  ${data.rejectUrl}`,
    "",
    "Each link may be used once.",
    "",
    "Kind regards,",
    `The ${APP_NAME} Team`,
  );
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  try {
    const caller = await authorizeCaller(req);
    if (caller instanceof Response) return caller;

    const body = (await req.json().catch(() => ({}))) as Partial<Payload>;
    const to = (body.to || "").trim().toLowerCase();
    const verifierName = (body.verifierName || "").trim();
    const learnerName = (body.learnerName || "").trim() || "A learner";
    const learnerEmail = (body.learnerEmail || "").trim();
    const token = (body.token || "").trim();
    const activityTitle = (body.activityTitle || "").trim() || "Impact activity";
    const submittedAt = (body.submittedAt || "").trim();
    const organizationName = (body.organizationName || "").trim();
    const sections = normalizeSections(body);
    const base = resolveAppBaseUrl(body.appBaseUrl);

    if (!to || !verifierName || !token) {
      return json(400, { error: "invalid_argument" });
    }

    const approveUrl = `${base}/verify-impact?token=${encodeURIComponent(token)}&decision=approve`;
    const rejectUrl = `${base}/verify-impact?token=${encodeURIComponent(token)}&decision=reject`;
    const sectionsHtml = buildSectionsHtml(sections);

    const html = buildHtml({
      verifierName,
      learnerName,
      learnerEmail,
      activityTitle,
      submittedAt,
      organizationName,
      sectionsHtml,
      approveUrl,
      rejectUrl,
    });

    const text = buildText({
      verifierName,
      learnerName,
      learnerEmail,
      activityTitle,
      submittedAt,
      organizationName,
      sections,
      approveUrl,
      rejectUrl,
    });

    const fromAddressRaw =
      Deno.env.get("SMTP_FROM") || Deno.env.get("SMTP_USER") || "info@t4leader.com";
    const fromEmailMatch = fromAddressRaw.match(/<([^>]+)>/);
    const fromEmail = (fromEmailMatch?.[1] || fromAddressRaw).trim();
    await getTransporter().sendMail({
      from: `"${APP_NAME}" <${fromEmail}>`,
      to,
      subject: `Verification requested: ${activityTitle} - ${learnerName}`,
      text,
      html,
    });

    return json(200, { success: true });
  } catch (error) {
    console.error("[send-impact-verification-email]", error);
    return json(500, {
      error: "send_failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
