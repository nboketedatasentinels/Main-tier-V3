// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

// ---------------------------------------------------------------------------
// send-course-assessment-report
// Partner emails a combined Pre/Post (+ rater) org assessment report.
// Auth: JWT verified in-function; partner/admin only.
// ---------------------------------------------------------------------------

const APP_NAME = "Transformation Leader";
const PLUM = "#27062e";
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

interface Recipient {
  email: string;
  role?: string;
}

interface Payload {
  recipients: Recipient[];
  subject: string;
  organizationName?: string;
  htmlBody: string;
  textBody?: string;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function authorizePartner(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json(401, { error: "missing_authorization" });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return json(500, { error: "server_misconfigured" });

  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData.user) return json(401, { error: "invalid_token" });

  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  const role = String(profile?.role || "").toLowerCase();
  const privileged =
    role === "partner" ||
    role === "super_admin" ||
    role === "admin" ||
    role === "company_admin";
  if (!privileged) {
    return json(403, { error: "forbidden", detail: "partner/admin required" });
  }
  return { userId: userData.user.id, email: userData.user.email || "" };
}

function getTransporter() {
  const host = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
  const port = Number(Deno.env.get("SMTP_PORT") || "465");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) throw new Error("SMTP credentials missing");
  const secure = port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function wrapHtml(orgName: string | undefined, inner: string): string {
  const title = orgName
    ? `${APP_NAME} · Course assessment report · ${orgName}`
    : `${APP_NAME} · Course assessment report`;
  return `<!doctype html><html><body style="margin:0;background:${WASH};font-family:Arial,sans-serif;color:${BODY}">
  <div style="max-width:720px;margin:24px auto;background:#fff;border:1px solid ${HAIR};border-radius:12px;overflow:hidden">
    <div style="background:${PLUM};color:#fff;padding:20px 24px">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.75">${APP_NAME}</div>
      <div style="font-size:20px;font-weight:700;color:#fff;margin-top:4px">${title}</div>
    </div>
    <div style="padding:24px;color:${INK};font-size:14px;line-height:1.55">${inner}</div>
    <div style="padding:16px 24px;border-top:1px solid ${HAIR};color:${MUTE};font-size:12px">
      Confidential — for sponsor / HR / senior management / line managers.
    </div>
  </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const auth = await authorizePartner(req);
    if (auth instanceof Response) return auth;

    const body = (await req.json().catch(() => ({}))) as Partial<Payload>;
    const recipients = (body.recipients || [])
      .map((r) => ({
        email: String(r.email || "").trim().toLowerCase(),
        role: r.role ? String(r.role) : undefined,
      }))
      .filter((r) => Boolean(r.email));
    const subject = String(body.subject || "").trim();
    const htmlBody = String(body.htmlBody || "").trim();

    if (!recipients.length || !subject || !htmlBody) {
      return json(400, {
        error: "invalid_argument",
        detail: "recipients, subject, and htmlBody are required",
      });
    }

    const fromAddressRaw =
      Deno.env.get("SMTP_FROM") || Deno.env.get("SMTP_USER") || "info@t4leader.com";
    const fromEmailMatch = fromAddressRaw.match(/<([^>]+)>/);
    const fromEmail = (fromEmailMatch?.[1] || fromAddressRaw).trim();
    const transport = getTransporter();
    const html = wrapHtml(body.organizationName, htmlBody);
    const text =
      body.textBody?.trim() ||
      htmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const recipient of recipients) {
      try {
        await transport.sendMail({
          from: `"${APP_NAME}" <${fromEmail}>`,
          to: recipient.email,
          subject,
          text,
          html,
        });
        results.push({ email: recipient.email, ok: true });
      } catch (err) {
        results.push({
          email: recipient.email,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    const failed = results.length - sent;
    return json(200, {
      success: failed === 0,
      partial: sent > 0 && failed > 0,
      sent,
      failed,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-course-assessment-report error:", message);
    return json(500, { error: "send_failed", detail: message });
  }
});
