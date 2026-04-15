/**
 * Cloud Function: Send Nudge Email
 *
 * Sends a professional at-risk nudge email to a learner via SMTP.
 * Called from the partner dashboard when sending journey reminders.
 */

import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

interface SendNudgeEmailData {
  to: string;
  recipientName: string;
  subject: string;
  journeyLabel: string;
  totalPoints: number;
  passMark: number;
  progressPercent: number;
  pointsBehind: number;
  expectedByNow: number;
  expectedGap: number;
  currentWeek: number;
}

function buildEmailHtml(data: SendNudgeEmailData): string {
  const {
    recipientName,
    journeyLabel,
    totalPoints,
    passMark,
    progressPercent,
    pointsBehind,
    expectedByNow,
    expectedGap,
    currentWeek,
  } = data;

  const progressBarColor =
    progressPercent < 25 ? "#E53E3E" : progressPercent < 50 ? "#DD6B20" : "#D69E2E";

  const pointsStatus =
    totalPoints === 0
      ? `We noticed you haven't earned any points yet on your <strong>${journeyLabel}</strong> journey. The pass mark is <strong>${passMark.toLocaleString()}</strong> points, and you're currently at Week ${currentWeek}.`
      : `You've earned <strong>${totalPoints.toLocaleString()}</strong> points so far on your <strong>${journeyLabel}</strong> journey &mdash; that's <strong>${progressPercent}%</strong> of the <strong>${passMark.toLocaleString()}</strong>-point pass mark.`;

  const paceSection =
    expectedGap > 0
      ? `<tr><td style="padding:16px 24px;">
           <div style="background:#FFF5F5;border:1px solid #FED7D7;border-radius:8px;padding:14px 18px;">
             <p style="margin:0;font-size:14px;color:#C53030;">
               At Week ${currentWeek}, expected pace is ~<strong>${expectedByNow.toLocaleString()}</strong> points.
               You're <strong>${expectedGap.toLocaleString()}</strong> points behind schedule.
             </p>
           </div>
         </td></tr>`
      : "";

  const remainingSection =
    pointsBehind > 0
      ? `<p style="margin:0 0 8px;font-size:14px;color:#4A5568;">You still need <strong>${pointsBehind.toLocaleString()}</strong> more points to pass your journey.</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7FAFC;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr><td style="background:#350e6f;padding:28px 24px;text-align:center;">
          <h1 style="margin:0;font-size:22px;color:#FFFFFF;font-weight:700;">Journey Progress Reminder</h1>
          <p style="margin:6px 0 0;font-size:14px;color:#E9D8FD;">Transformation 4 Leaders</p>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:28px 24px 12px;">
          <p style="margin:0;font-size:16px;color:#2D3748;">Hi <strong>${recipientName}</strong>,</p>
        </td></tr>

        <!-- Points status -->
        <tr><td style="padding:8px 24px;">
          <p style="margin:0;font-size:14px;color:#4A5568;line-height:1.6;">${pointsStatus}</p>
        </td></tr>

        <!-- Progress bar -->
        <tr><td style="padding:16px 24px;">
          <div style="background:#EDF2F7;border-radius:8px;padding:18px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:#718096;">Journey progress</td>
                <td align="right" style="font-size:13px;font-weight:600;color:#4A5568;">${totalPoints.toLocaleString()} / ${passMark.toLocaleString()} pts</td>
              </tr>
            </table>
            <div style="margin-top:10px;background:#E2E8F0;border-radius:100px;height:10px;overflow:hidden;">
              <div style="width:${Math.max(2, progressPercent)}%;height:100%;background:${progressBarColor};border-radius:100px;"></div>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
              <tr>
                <td style="font-size:12px;color:#718096;">${journeyLabel}</td>
                <td align="right" style="font-size:12px;font-weight:600;color:${progressBarColor};">${progressPercent}% complete</td>
              </tr>
            </table>
          </div>
        </td></tr>

        <!-- Pace gap warning -->
        ${paceSection}

        <!-- Remaining points -->
        <tr><td style="padding:8px 24px;">
          ${remainingSection}
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 16px;font-size:14px;color:#4A5568;line-height:1.6;">
            Every activity you complete brings you closer to your goal.
            Log in today, check your weekly checklist, and keep building momentum. You've got this!
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td style="background:#350e6f;border-radius:8px;padding:12px 28px;">
            <a href="https://man-tier-v2.web.app" style="color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;display:inline-block;">
              Open My Dashboard
            </a>
          </td></tr></table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 24px;border-top:1px solid #E2E8F0;">
          <p style="margin:0;font-size:12px;color:#A0AEC0;text-align:center;">
            Transformation 4 Leaders &bull; You received this because your organization enrolled you in a leadership journey.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

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

export const sendNudgeEmail = functions
  .region("us-central1")
  .https.onCall(async (data: SendNudgeEmailData, context) => {
    // Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication required to send nudge emails."
      );
    }

    // Verify caller has partner or admin role
    const db = (await import("firebase-admin")).default.firestore();
    const callerDoc = await db.collection("profiles").doc(context.auth.uid).get();
    const callerData = callerDoc.data();
    const callerRole = callerData?.role;

    if (!["partner", "super_admin", "admin", "company_admin"].includes(callerRole || "")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only partners and admins can send nudge emails."
      );
    }

    // Validate required fields
    if (!data.to || !data.recipientName || !data.subject) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields: to, recipientName, subject."
      );
    }

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "info@t4leader.com";
    const html = buildEmailHtml(data);

    try {
      const transport = getTransporter();
      await transport.sendMail({
        from: `"Transformation 4 Leaders" <${fromAddress}>`,
        to: data.to,
        subject: data.subject,
        html,
      });

      functions.logger.info("Nudge email sent successfully", {
        to: data.to,
        subject: data.subject,
        sentBy: context.auth.uid,
      });

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      functions.logger.error("Failed to send nudge email", {
        to: data.to,
        error: errorMessage,
      });
      throw new functions.https.HttpsError(
        "internal",
        `Email delivery failed: ${errorMessage}`
      );
    }
  });
