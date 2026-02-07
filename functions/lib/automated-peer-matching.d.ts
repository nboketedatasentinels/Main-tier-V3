/**
 * Cloud Function: Automated Weekly Peer Matching
 *
 * This function automatically creates random peer matches for users within
 * the same organization or village on a weekly basis.
 *
 * Deploy with:
 * firebase deploy --only functions:automatedWeeklyPeerMatching
 */
import * as functions from "firebase-functions";
/**
 * Automated Weekly Peer Matching
 *
 * Runs every Monday at 6 AM UTC to create new peer matches for the week.
 * Users are grouped by organization/village and matched randomly within their group.
 */
export declare const automatedWeeklyPeerMatching: functions.CloudFunction<unknown>;
/**
 * Manual Trigger for Peer Matching (Admin Only)
 *
 * Allows super admins to manually trigger peer matching outside the schedule.
 * Useful for testing or when matches need to be regenerated.
 */
export declare const triggerPeerMatching: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Expire Old Matches
 *
 * Runs daily to mark old matches as expired if they weren't completed.
 * Helps keep the peer_weekly_matches collection clean.
 */
export declare const expireOldPeerMatches: functions.CloudFunction<unknown>;
