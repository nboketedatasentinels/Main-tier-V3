/**
 * Firebase Cloud Functions Entry Point
 *
 * Exports all Cloud Functions for deployment.
 */

import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK (must be done before importing other modules)
try {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin SDK:", error);
}

export * from "./sync-profiles";
export * from "./automated-peer-matching";
export * from "./referral-points";
export * from "./admin-actions";
export * from "./partner-impact-sync";
export * from "./impact-api";
