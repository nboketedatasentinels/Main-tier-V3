/**
 * Admin API for 6-Week At-Risk Learners
 *
 * Provides endpoints for partners and admins to view at-risk learners
 * in their 6-Week Power Journey cohorts.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { applyCors } from "./cors";

const db = admin.firestore();

// Constants
const SIX_WEEK_JOURNEY_TYPE = "6W";
const PASS_MARK_POINTS = 40000;
const AT_RISK_WEEK_THRESHOLD = 5;

interface AtRiskLearner {
  userId: string;
  email: string;
  fullName: string;
  currentWeek: number;
  totalPoints: number;
  pointsNeeded: number;
  weeksRemaining: number;
  canStillPass: boolean;
  lastActivityDate: admin.firestore.Timestamp | null;
  flaggedAt: admin.firestore.Timestamp | null;
}

interface AtRiskResponse {
  cohortId: string;
  cohortName: string;
  journeyType: string;
  currentDate: string;
  totalLearners: number;
  atRiskCount: number;
  passedCount: number;
  notYetEvaluableCount: number;
  learners: AtRiskLearner[];
}

/**
 * Calculate current week of journey from start date
 */
function calculateCurrentWeek(journeyStartDate: admin.firestore.Timestamp | string | null): number {
  if (!journeyStartDate) return 1;

  const startDate = journeyStartDate instanceof admin.firestore.Timestamp
    ? journeyStartDate.toDate()
    : new Date(journeyStartDate);

  if (isNaN(startDate.getTime())) return 1;

  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const currentWeek = Math.floor(diffDays / 7) + 1;

  return Math.max(1, currentWeek);
}

/**
 * GET /admin/cohorts/:cohortId/at-risk-learners
 *
 * Returns all at-risk learners for a 6-Week Power Journey cohort.
 * Only available for 6W journey type organizations.
 */
export const getAtRiskLearners = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    // Handle CORS
    const corsResult = applyCors(req, res);
    if (corsResult.done) return;

    // Only allow GET
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      // Extract cohortId from path
      // Expected path: /admin/cohorts/:cohortId/at-risk-learners
      const pathParts = req.path.split("/").filter(Boolean);
      const cohortIdIndex = pathParts.indexOf("cohorts") + 1;
      const cohortId = pathParts[cohortIdIndex];

      if (!cohortId) {
        res.status(400).json({ error: "Missing cohortId in path" });
        return;
      }

      // Verify authentication via Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const idToken = authHeader.split("Bearer ")[1];
      let decodedToken: admin.auth.DecodedIdToken;

      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch {
        res.status(401).json({ error: "Invalid authentication token" });
        return;
      }

      // Verify caller has permission (super_admin or partner)
      const callerDoc = await db.collection("profiles").doc(decodedToken.uid).get();
      const callerData = callerDoc.data();
      const callerRole = callerData?.role;

      if (callerRole !== "super_admin" && callerRole !== "partner") {
        res.status(403).json({ error: "Permission denied. Only admins and partners can access this endpoint." });
        return;
      }

      // If partner, verify they have access to this organization
      if (callerRole === "partner") {
        const partnerOrgs = callerData?.assignedOrganizations ?? [];
        const transformationPartnerId = callerData?.transformationPartnerId;

        // Check if partner is assigned to this org
        const orgDoc = await db.collection("organizations").doc(cohortId).get();
        const orgData = orgDoc.data();

        if (!orgDoc.exists) {
          res.status(404).json({ error: "Organization not found" });
          return;
        }

        const isAssigned = partnerOrgs.includes(cohortId) ||
          orgData?.transformationPartnerId === decodedToken.uid ||
          orgData?.assignedPartnerId === decodedToken.uid;

        if (!isAssigned) {
          res.status(403).json({ error: "You do not have access to this organization" });
          return;
        }
      }

      // Get organization
      const orgDoc = await db.collection("organizations").doc(cohortId).get();

      if (!orgDoc.exists) {
        res.status(404).json({ error: "Organization not found" });
        return;
      }

      const orgData = orgDoc.data()!;

      // ═══════════════════════════════════════════════════════════════════════════
      // CRITICAL: Only allow for 6-Week Power Journey
      // ═══════════════════════════════════════════════════════════════════════════
      if (orgData.journeyType !== SIX_WEEK_JOURNEY_TYPE) {
        res.status(400).json({
          error: "At-Risk logic only applies to the 6-Week Power Journey",
          message: `This organization is on the ${orgData.journeyType ?? "unknown"} journey. At-risk evaluation is only available for 6-Week Power Journey (6W) organizations.`,
          journeyType: orgData.journeyType,
        });
        return;
      }

      // Get all learners in this organization
      const usersSnapshot = await db.collection("profiles")
        .where("companyId", "==", cohortId)
        .where("role", "in", ["paid_member", "free_user"])
        .get();

      const atRiskLearners: AtRiskLearner[] = [];
      let passedCount = 0;
      let notYetEvaluableCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const profile = userDoc.data();
        const totalPoints = profile.totalPoints ?? 0;
        const journeyStartDate = profile.journeyStartDate ?? profile.cohortStartDate ?? orgData.cohortStartDate;
        const currentWeek = profile.currentWeek ?? calculateCurrentWeek(journeyStartDate);

        if (currentWeek <= AT_RISK_WEEK_THRESHOLD) {
          notYetEvaluableCount++;
          continue;
        }

        if (totalPoints >= PASS_MARK_POINTS) {
          passedCount++;
          continue;
        }

        // This learner is at-risk
        const weeksRemaining = Math.max(0, 6 - currentWeek + 1);
        const pointsNeeded = PASS_MARK_POINTS - totalPoints;
        const requiredWeeklyAverage = weeksRemaining > 0 ? Math.ceil(pointsNeeded / weeksRemaining) : pointsNeeded;

        // Get status record for flagged date
        const statusDoc = await db.collection("learner_status").doc(userDoc.id).get();
        const statusData = statusDoc.data();

        atRiskLearners.push({
          userId: userDoc.id,
          email: profile.email ?? "",
          fullName: profile.fullName ?? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim(),
          currentWeek,
          totalPoints,
          pointsNeeded,
          weeksRemaining,
          canStillPass: requiredWeeklyAverage <= 10000,
          lastActivityDate: profile.lastActiveAt ?? null,
          flaggedAt: statusData?.statusChangedAt ?? null,
        });
      }

      // Sort by points needed (most urgent first)
      atRiskLearners.sort((a, b) => b.pointsNeeded - a.pointsNeeded);

      const response: AtRiskResponse = {
        cohortId,
        cohortName: orgData.name ?? cohortId,
        journeyType: SIX_WEEK_JOURNEY_TYPE,
        currentDate: new Date().toISOString().split("T")[0],
        totalLearners: usersSnapshot.size,
        atRiskCount: atRiskLearners.length,
        passedCount,
        notYetEvaluableCount,
        learners: atRiskLearners,
      };

      res.status(200).json(response);

    } catch (error) {
      functions.logger.error("Error in getAtRiskLearners:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

/**
 * Callable function version for use with Firebase SDK
 */
export const getAtRiskLearnersCallable = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required");
    }

    const cohortId = data?.cohortId;
    if (!cohortId) {
      throw new functions.https.HttpsError("invalid-argument", "cohortId is required");
    }

    // Verify caller has permission
    const callerDoc = await db.collection("profiles").doc(context.auth.uid).get();
    const callerData = callerDoc.data();
    const callerRole = callerData?.role;

    if (callerRole !== "super_admin" && callerRole !== "partner") {
      throw new functions.https.HttpsError("permission-denied", "Only admins and partners can access this endpoint");
    }

    // Get organization
    const orgDoc = await db.collection("organizations").doc(cohortId).get();

    if (!orgDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Organization not found");
    }

    const orgData = orgDoc.data()!;

    // CRITICAL: Only allow for 6-Week Power Journey
    if (orgData.journeyType !== SIX_WEEK_JOURNEY_TYPE) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `At-Risk logic only applies to the 6-Week Power Journey. This organization is ${orgData.journeyType ?? "unknown"}.`
      );
    }

    // Get all learners
    const usersSnapshot = await db.collection("profiles")
      .where("companyId", "==", cohortId)
      .where("role", "in", ["paid_member", "free_user"])
      .get();

    const atRiskLearners: AtRiskLearner[] = [];
    let passedCount = 0;
    let notYetEvaluableCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const profile = userDoc.data();
      const totalPoints = profile.totalPoints ?? 0;
      const journeyStartDate = profile.journeyStartDate ?? profile.cohortStartDate ?? orgData.cohortStartDate;
      const currentWeek = profile.currentWeek ?? calculateCurrentWeek(journeyStartDate);

      if (currentWeek <= AT_RISK_WEEK_THRESHOLD) {
        notYetEvaluableCount++;
        continue;
      }

      if (totalPoints >= PASS_MARK_POINTS) {
        passedCount++;
        continue;
      }

      const weeksRemaining = Math.max(0, 6 - currentWeek + 1);
      const pointsNeeded = PASS_MARK_POINTS - totalPoints;
      const requiredWeeklyAverage = weeksRemaining > 0 ? Math.ceil(pointsNeeded / weeksRemaining) : pointsNeeded;

      const statusDoc = await db.collection("learner_status").doc(userDoc.id).get();
      const statusData = statusDoc.data();

      atRiskLearners.push({
        userId: userDoc.id,
        email: profile.email ?? "",
        fullName: profile.fullName ?? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim(),
        currentWeek,
        totalPoints,
        pointsNeeded,
        weeksRemaining,
        canStillPass: requiredWeeklyAverage <= 10000,
        lastActivityDate: profile.lastActiveAt ?? null,
        flaggedAt: statusData?.statusChangedAt ?? null,
      });
    }

    atRiskLearners.sort((a, b) => b.pointsNeeded - a.pointsNeeded);

    return {
      cohortId,
      cohortName: orgData.name ?? cohortId,
      journeyType: SIX_WEEK_JOURNEY_TYPE,
      currentDate: new Date().toISOString().split("T")[0],
      totalLearners: usersSnapshot.size,
      atRiskCount: atRiskLearners.length,
      passedCount,
      notYetEvaluableCount,
      learners: atRiskLearners,
    };
  });
