/**
 * Firebase -> Supabase migration switch.
 *
 * The app now authenticates with Supabase, so there is NO Firebase Auth session.
 * Every remaining Firestore read therefore fails with `permission-denied`
 * (Firestore rules require request.auth), flooding the console and throwing
 * uncaught rejections - even though the feature itself adds no value while it is
 * unauthenticated.
 *
 * This flag gates the not-yet-migrated Firestore listeners so they simply don't
 * attach. Flip it to `true` (or, better, delete the guard) only once those reads
 * have been moved onto Supabase.
 *
 * Currently gated: announcements, points notifications, programme notification
 * schedulers (4W + 6W), and the weekly-checklist points-ledger listeners.
 */
export const FIRESTORE_READS_AVAILABLE = false
