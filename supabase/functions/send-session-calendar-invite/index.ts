import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

/**
 * send-session-calendar-invite
 * Emails the learner (and optional CC) a meeting invite with .ics attachment
 * so they can add it to Google / Outlook / Apple Calendar.
 *
 * Auth: Bearer JWT of mentor/coach/admin. verify_jwt=false; checked in-function.
 * Secrets: SMTP_USER, SMTP_PASS (same as other mail functions)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INK = "#111827";
const BODY = "#374151";
const PLUM = "#27062e";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type Payload = {
  to: string;
  learnerName?: string;
  organizerName?: string;
  title: string;
  whenLabel: string;
  startIso: string;
  endIso?: string;
  meetingLink?: string | null;
  description?: string | null;
  icsContent: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "missing_auth" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const to = (payload.to || "").trim().toLowerCase();
  if (!to || !payload.title || !payload.icsContent || !payload.startIso) {
    return json({ error: "missing_fields" }, 400);
  }

  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  if (!smtpUser || !smtpPass) return json({ error: "smtp_not_configured" }, 503);

  const organizer = payload.organizerName?.trim() || "Your Transformation Leader guide";
  const learner = payload.learnerName?.trim() || "there";
  const link = payload.meetingLink?.trim();
  const when = payload.whenLabel || payload.startIso;

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BODY};">
  <p style="color:${INK};">Hi ${learner},</p>
  <p><strong>${organizer}</strong> scheduled: <strong>${payload.title}</strong></p>
  <p>When: ${when}</p>
  ${link ? `<p>Join: <a href="${link}">${link}</a></p>` : ""}
  <p>A calendar invite (<code>.ics</code>) is attached — open it to add this to Google Calendar or Outlook.</p>
  <p style="color:${PLUM};font-weight:700;">Transformation Leader</p>
</body></html>`;

  const transporter = nodemailer.createTransport({
    host: Deno.env.get("SMTP_HOST") || "smtp.gmail.com",
    port: Number(Deno.env.get("SMTP_PORT") || 465),
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    await transporter.sendMail({
      from: `"Transformation Leader" <${smtpUser}>`,
      to,
      subject: `Calendar invite: ${payload.title}`,
      text: `${organizer} scheduled "${payload.title}" for ${when}.${link ? ` Join: ${link}` : ""}\n\nOpen the attached .ics to save it to your calendar.`,
      html,
      attachments: [
        {
          filename: "t4l-session.ics",
          content: payload.icsContent,
          contentType: "text/calendar; charset=utf-8; method=REQUEST",
        },
      ],
    });
  } catch (err) {
    console.error("[send-session-calendar-invite] send failed", err);
    return json({
      success: false,
      error: err instanceof Error ? err.message : "send_failed",
    }, 500);
  }

  return json({ success: true });
});
