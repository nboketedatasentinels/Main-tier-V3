/**
 * Cloud Function: Send Programme Email
 *
 * Sends a structured programme notification email (Digital Edge or
 * Shameless Podcast) for the 6-Week Transforming Business Power Journey via SMTP.
 *
 * Called from the client-side scheduler (sixWeekProgrammeNotificationService) for
 * users on journeyType === '6W'.
 */

import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

interface SendProgrammeEmailData {
  to: string;
  recipientName: string;
  subject: string;
  preview: string;
  bodyHtml: string;
  bodyText: string;
  programme: string;
  templateKey: string;
}

const wrapEmailHtml = (data: SendProgrammeEmailData): string => {
  const safePreview = data.preview.replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${data.subject}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .px-content { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F7FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;font-size:1px;color:#F7FAFC;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${safePreview}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7FAFC;padding:32px 16px;">
    <tr><td align="center">
      <table class="container" width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="background:#350e6f;padding:24px;text-align:center;">
          <h1 style="margin:0;font-size:18px;color:#FFFFFF;font-weight:700;letter-spacing:0.3px;">Transforming Business Power Journey</h1>
          <p style="margin:6px 0 0;font-size:12px;color:#E9D8FD;text-transform:uppercase;letter-spacing:1px;">6-Week Programme</p>
        </td></tr>
        <tr><td class="px-content" style="padding:28px 32px;">
          ${data.bodyHtml}
        </td></tr>
        <tr><td class="px-content" style="padding:0 32px 24px;">
          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#350e6f;border-radius:8px;padding:12px 26px;">
              <a href="https://app.t4leader.com/" style="color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;display:inline-block;">Open the app</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid #E2E8F0;background:#FAFAFA;">
          <p style="margin:0;font-size:11px;color:#A0AEC0;text-align:center;line-height:1.5;">
            Tier 4 Leaders &bull; You received this because your organisation enrolled you in the 6-Week Power Journey.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
    throw new functions.https.HttpsError(
      "failed-precondition",
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

export const sendProgrammeEmail = functions
  .region("us-central1")
  .https.onCall(async (data: SendProgrammeEmailData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication required to send programme emails."
      );
    }

    if (!data.to || !data.recipientName || !data.subject || !data.bodyHtml) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields: to, recipientName, subject, bodyHtml."
      );
    }

    if (data.programme !== "transforming-business-6w") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Unsupported programme: ${data.programme}`
      );
    }

    // Authorize: callers may only send programme emails to themselves.
    // (The scheduler runs client-side and triggers a send for the signed-in
    // user. We block cross-user sends here to prevent abuse.)
    try {
      const adminSdk = (await import("firebase-admin")).default;
      const dbAdmin = adminSdk.firestore();
      const callerProfile = await dbAdmin
        .collection("profiles")
        .doc(context.auth.uid)
        .get();
      const callerEmail = callerProfile.data()?.email as string | undefined;
      if (
        !callerEmail ||
        callerEmail.trim().toLowerCase() !== data.to.trim().toLowerCase()
      ) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Programme emails may only be sent to the authenticated user's own email."
        );
      }
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      functions.logger.error("Caller authorization check failed", err);
      throw new functions.https.HttpsError(
        "internal",
        "Authorization check failed."
      );
    }

    const fromAddress =
      process.env.SMTP_FROM || process.env.SMTP_USER || "info@t4leader.com";
    const html = wrapEmailHtml(data);
    const text = `${data.bodyText}\n\n— Open the app: https://app.t4leader.com/`;

    try {
      const transport = getTransporter();
      const info = await transport.sendMail({
        from: `"Tier 4 Leaders" <${fromAddress}>`,
        to: data.to,
        subject: data.subject,
        html,
        text,
      });

      functions.logger.info("Programme email sent", {
        to: data.to,
        subject: data.subject,
        templateKey: data.templateKey,
        messageId: info.messageId,
      });

      return { success: true, messageId: info.messageId };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      functions.logger.error("Failed to send programme email", {
        to: data.to,
        templateKey: data.templateKey,
        error: errorMessage,
      });
      throw new functions.https.HttpsError(
        "internal",
        `Programme email delivery failed: ${errorMessage}`
      );
    }
  });
