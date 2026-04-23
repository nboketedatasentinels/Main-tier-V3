/**
 * Cloud Function: Send Feedback Notification
 *
 * Firestore trigger that emails admin when a user submits feedback
 * via the /app/feedback page. Mirrors the SMTP pattern used in
 * send-nudge-email.ts.
 */

import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

type FeedbackCategory = "bug" | "feature_request" | "general" | "appreciation";

interface FeedbackDoc {
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  category: FeedbackCategory;
  message: string;
  pageContext: string | null;
  status: string;
  createdAt: FirebaseFirestore.Timestamp | null;
}

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Bug report",
  feature_request: "Feature request",
  general: "General feedback",
  appreciation: "Appreciation",
};

const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  bug: "#E53E3E",
  feature_request: "#3182CE",
  general: "#805AD5",
  appreciation: "#38A169",
};

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error(
      "SMTP credentials are not configured. Set SMTP_USER and SMTP_PASS in functions/.env."
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(data: FeedbackDoc, feedbackId: string): string {
  const categoryLabel = CATEGORY_LABELS[data.category] || data.category;
  const categoryColor = CATEGORY_COLORS[data.category] || "#805AD5";
  const userLabel = data.userName || data.userEmail || "Anonymous user";
  const userEmailLine = data.userEmail
    ? `<p style="margin:0;font-size:13px;color:#4A5568;">${escapeHtml(data.userEmail)}</p>`
    : "";
  const userIdLine = data.userId
    ? `<p style="margin:4px 0 0;font-size:12px;color:#718096;">User ID: ${escapeHtml(data.userId)}</p>`
    : `<p style="margin:4px 0 0;font-size:12px;color:#718096;">Not signed in</p>`;
  const pageContextLine = data.pageContext
    ? `<tr><td style="padding:6px 24px;font-size:12px;color:#718096;">Submitted from: <code style="background:#EDF2F7;padding:2px 6px;border-radius:4px;">${escapeHtml(data.pageContext)}</code></td></tr>`
    : "";

  const safeMessage = escapeHtml(data.message).replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7FAFC;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

        <tr><td style="background:#350e6f;padding:24px 24px;text-align:center;">
          <h1 style="margin:0;font-size:20px;color:#FFFFFF;font-weight:700;">New feedback received</h1>
          <p style="margin:6px 0 0;font-size:13px;color:#E9D8FD;">Transformation 4 Leaders</p>
        </td></tr>

        <tr><td style="padding:20px 24px 8px;">
          <span style="display:inline-block;padding:4px 12px;background:${categoryColor};color:#FFFFFF;font-size:12px;font-weight:600;border-radius:999px;letter-spacing:0.04em;text-transform:uppercase;">
            ${escapeHtml(categoryLabel)}
          </span>
        </td></tr>

        <tr><td style="padding:12px 24px;">
          <p style="margin:0;font-size:14px;color:#2D3748;font-weight:600;">${escapeHtml(userLabel)}</p>
          ${userEmailLine}
          ${userIdLine}
        </td></tr>

        <tr><td style="padding:8px 24px 16px;">
          <div style="background:#F7FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px 18px;">
            <p style="margin:0;font-size:14px;color:#1A202C;line-height:1.6;">${safeMessage}</p>
          </div>
        </td></tr>

        ${pageContextLine}

        <tr><td style="padding:12px 24px 20px;font-size:12px;color:#A0AEC0;">
          Feedback ID: <code style="background:#EDF2F7;padding:2px 6px;border-radius:4px;">${escapeHtml(feedbackId)}</code>
        </td></tr>

        <tr><td style="padding:16px 24px;background:#F7FAFC;border-top:1px solid #E2E8F0;font-size:11px;color:#A0AEC0;text-align:center;">
          Sent automatically by T4L. Reply directly to this message to reach the sender${data.userEmail ? ` (${escapeHtml(data.userEmail)})` : ""}.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export const onFeedbackCreated = functions
  .region("us-central1")
  .firestore.document("feedback/{feedbackId}")
  .onCreate(async (snapshot, context) => {
    const feedbackId = context.params.feedbackId as string;
    const data = snapshot.data() as FeedbackDoc | undefined;

    if (!data) {
      functions.logger.warn("Feedback doc missing data", { feedbackId });
      return;
    }

    const recipient =
      process.env.FEEDBACK_NOTIFICATION_TO ||
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      "info@t4leader.com";

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "info@t4leader.com";
    const categoryLabel = CATEGORY_LABELS[data.category] || data.category;
    const subject = `[T4L Feedback] ${categoryLabel} — ${data.userName || data.userEmail || "Anonymous"}`;
    const html = buildEmailHtml(data, feedbackId);

    try {
      const transport = getTransporter();
      await transport.sendMail({
        from: `"T4L Feedback" <${fromAddress}>`,
        to: recipient,
        replyTo: data.userEmail || undefined,
        subject,
        html,
      });

      functions.logger.info("Feedback notification email sent", {
        feedbackId,
        category: data.category,
        recipient,
      });
    } catch (error) {
      functions.logger.error("Failed to send feedback notification email", {
        feedbackId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
