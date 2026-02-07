/**
 * Cloud Function: Process Admin Actions
 *
 * Handles secure updates to user data initiated by Partners or Admins.
 * This ensures sensitive fields like 'role' are only modified via controlled logic.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const processAdminAction = functions
  .region("us-central1")
  .firestore.document("admin_actions/{actionId}")
  .onCreate(async (snapshot, context) => {
    const actionData = snapshot.data();
    if (!actionData) return;

    const { type, targetUserId, data, createdBy } = actionData;

    try {
      // 1. Verify the performer has permission
      // We check the 'users' collection as the source of truth for roles
      const performerDoc = await db.collection("users").doc(createdBy).get();
      const performerData = performerDoc.data();
      const performerRole = performerData?.role;

      if (performerRole !== "super_admin" && performerRole !== "partner") {
        throw new Error("Unauthorized: Only Partners and Admins can perform admin actions.");
      }

      // 2. Perform the action
      let updateData: any = {};
      let logSummary = "";

      switch (type) {
        case "update_user_role":
          // STRICT: Only super_admin can modify role fields
          if (performerRole !== "super_admin") {
            throw new Error("Unauthorized: Only Super Admins can change user roles.");
          }
          if (!data.role) {
            throw new Error("Missing 'role' in action data.");
          }
          updateData = { role: data.role };
          logSummary = `Updated role for user ${targetUserId} to ${data.role}`;
          break;

        case "update_membership_status":
          if (!data.status) {
            throw new Error("Missing 'status' in action data.");
          }
          updateData = { membershipStatus: data.status };
          logSummary = `Updated membership status for user ${targetUserId} to ${data.status}`;
          break;

        case "update_user_profile": {
          // Limit what can be updated to prevent accidental field corruption
          const { firstName: fName, lastName: lName, fullName: fullNm } = data;
          if (fName) updateData.firstName = fName;
          if (lName) updateData.lastName = lName;
          if (fullNm) updateData.fullName = fullNm;

          if (Object.keys(updateData).length === 0) {
            throw new Error("No valid profile fields provided for update.");
          }
          logSummary = `Updated profile for user ${targetUserId}`;
          break;
        }

        default:
          throw new Error(`Unknown action type: ${type}`);
      }

      // 3. Apply the update
      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        await db.collection("users").doc(targetUserId).update(updateData);
        // Note: The existing syncUserToProfile function will automatically sync these changes to profiles collection
      }

      // 4. Log the success to admin_activity_log
      await db.collection("admin_activity_log").add({
        actionType: type,
        summary: logSummary,
        performedBy: createdBy,
        targetUserId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: "success",
        details: data,
        actionId: context.params.actionId
      });

      functions.logger.info(`✓ Successfully processed admin action ${context.params.actionId}`, {
        actionId: context.params.actionId,
        type,
        targetUserId,
        summary: logSummary
      });

    } catch (error: any) {
      functions.logger.error(`✗ Error processing admin action ${context.params.actionId}`, {
        actionId: context.params.actionId,
        error: error.message,
        type,
        targetUserId
      });

      // Log the failure to admin_activity_log for auditability
      try {
        await db.collection("admin_activity_log").add({
          actionType: type || "unknown",
          summary: `Failed to perform ${type || "action"} on user ${targetUserId || "unknown"}`,
          performedBy: createdBy || "unknown",
          targetUserId: targetUserId || "unknown",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          status: "failure",
          error: error.message,
          actionId: context.params.actionId
        });
      } catch (logError) {
        console.error("Failed to log admin action failure:", logError);
      }

      // We don't necessarily want to retry if it's a permission or validation error
      // But we can throw to let Firebase Functions handle retry if configured
      return;
    }
  });
