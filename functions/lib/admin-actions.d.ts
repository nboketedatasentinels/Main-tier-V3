/**
 * Cloud Function: Process Admin Actions
 *
 * Handles secure updates to user data initiated by Partners or Admins.
 * This ensures sensitive fields like 'role' are only modified via controlled logic.
 */
import * as functions from "firebase-functions";
export declare const processAdminAction: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
