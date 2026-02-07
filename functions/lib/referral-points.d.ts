/**
 * Cloud Functions: Referral Points System
 *
 * Handles server-side referral point awards to prevent client manipulation.
 * Points are awarded when a referred user completes their first platform activity.
 *
 * Key Features:
 * - Triggered when referred user first writes to pointsLedger
 * - Awards points to referrer via proper ledger entries
 * - Idempotent - prevents duplicate awards
 * - Maintains audit trail in referrals collection
 * - Sends notifications to referrer
 *
 * Deploy with:
 * firebase deploy --only functions:onReferredUserFirstActivity,functions:creditReferralPointsCallable
 */
import * as functions from "firebase-functions";
/**
 * Firestore Trigger: Award referral points when referred user completes first activity
 *
 * Triggered when a new document is created in the pointsLedger collection.
 * Checks if the user was referred and if this is their first activity.
 * If so, awards referral bonus points to the referrer.
 */
export declare const onReferredUserFirstActivity: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * HTTPS Callable: Manually credit referral points (admin/partner use)
 *
 * Allows partners or admins to manually trigger referral point awards.
 * Useful for edge cases where automatic detection failed.
 */
export declare const creditReferralPointsCallable: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Scheduled Function: Check for stale pending referrals
 *
 * Runs daily to check for referrals that have been pending for too long.
 * Can be used to send reminders or auto-reject old referrals.
 */
export declare const checkStalePendingReferrals: functions.CloudFunction<unknown>;
