import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

function parseArgs(argv) {
  const args = {
    help: false,
    list: false,
    all: false,
    yes: false,
    dryRun: false,
    noDelay: false,
    noProxy: false,
    recursive: true,
    clearAuth: false,
    serviceAccountPath: './service-account-key.json',
    collections: []
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--list') args.list = true;
    else if (a === '--all') args.all = true;
    else if (a === '--yes' || a === '-y') args.yes = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--no-delay') args.noDelay = true;
    else if (a === '--no-proxy') args.noProxy = true;
    else if (a === '--recursive') args.recursive = true;
    else if (a === '--no-recursive' || a === '--shallow') args.recursive = false;
    else if (a === '--clear-auth') args.clearAuth = true;
    else if (a === '--service-account') args.serviceAccountPath = argv[++i];
    else if (a === '--collections') {
      const raw = argv[++i] ?? '';
      args.collections.push(
        ...raw
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      );
    } else if (a === '--collection') {
      const name = (argv[++i] ?? '').trim();
      if (name) args.collections.push(name);
    }
  }

  // Default to dry-run unless explicitly confirmed.
  if (!args.yes) args.dryRun = true;

  return args;
}

function printHelp() {
  console.log('CLEAR FIRESTORE DATA (Admin SDK)');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/clear-user-data.mjs --list');
  console.log('  node scripts/clear-user-data.mjs --yes                  # Clear default user-data collections');
  console.log('  node scripts/clear-user-data.mjs --collections profiles,users --yes');
  console.log('  node scripts/clear-user-data.mjs --all --yes            # Clear EVERYTHING');
  console.log('');
  console.log('Options:');
  console.log('  --list               List top-level collections and exit');
  console.log('  --collections <csv>  Comma-separated collection IDs to clear');
  console.log('  --collection <id>    Repeatable collection ID to clear');
  console.log('  --all                Clear ALL collections (including config/system)');
  console.log('  --yes, -y            Actually delete (otherwise dry-run)');
  console.log('  --dry-run            Print what would be deleted (default unless --yes)');
  console.log('  --no-delay           Skip the 5s abort window');
  console.log('  --no-proxy           Unset HTTP(S)_PROXY for this run');
  console.log('  --recursive          Delete subcollections too (default)');
  console.log('  --no-recursive       Only delete top-level documents (no subcollections)');
  console.log('  --shallow            Alias for --no-recursive');
  console.log('  --clear-auth         Also delete all Firebase Authentication users');
  console.log('  --service-account    Path to service account JSON (default: ./service-account-key.json)');
  console.log('  --help, -h           Show this help and exit');
  console.log('');
  console.log('Notes:');
  console.log('  - Default mode clears user data only (profiles, progress, etc). Config collections are preserved.');
  console.log('  - Use --all to also clear config collections (organizations, courses, nudge_templates, etc).');
  console.log('  - Recursive mode deletes subcollection documents (e.g. users/{uid}/... ) as well.');
  console.log('  - If you are checking a different Firebase project in the console, you will not see changes.');
  console.log('');
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

function maybeDisableBrokenProxy() {
  const keys = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'];
  const values = keys.map(k => [k, process.env[k]]).filter(([, v]) => Boolean(v));
  const isBrokenLocalProxy = v => typeof v === 'string' && /^(https?:\/\/)?127\.0\.0\.1:9\/?$/.test(v.trim());

  if (args.noProxy || values.some(([, v]) => isBrokenLocalProxy(v))) {
    for (const k of keys) delete process.env[k];
    if (!args.noProxy && values.length > 0) {
      console.log('Note: Disabled proxy env vars for this run (detected a local proxy setting that often breaks gRPC).');
      console.log('      Use your shell env if you need a corporate proxy instead.\n');
    }
  }
}

maybeDisableBrokenProxy();

const serviceAccount = JSON.parse(readFileSync(args.serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Default user data collections to clear (preserves config/system collections)
const DEFAULT_USER_DATA_COLLECTIONS = [
  // User profiles & accounts
  'profiles',
  'users',
  'user_badges',
  'user_courses',
  'user_daily_micro_challenges',
  'user_points',

  // Weekly progress & points
  'weekly_progress',
  'weekly_points',
  'weekly_checklist',
  'weekly_tasks',
  'pointsLedger',
  'points_transactions',
  'points_verification_requests',
  'engagement_point_logs',

  // Impact tracking
  'impactEntries',
  'impact_entries',
  'impact_goals',

  // Notifications & nudges
  'notifications',
  'nudge_status_transitions',

  // Peer & social features
  'peer_sessions',
  'peer_weekly_matches',
  'peer_session_requests',
  'peer_preferences',
  'friend_requests',
  'friends',
  'village_chat_messages',
  'village_invitations',
  'typing_status',

  // Mentorship & learning
  'mentorship_sessions',
  'assigned_courses',
  'bookClubVisits',
  'shameless_workbooks',

  // Approvals & submissions
  'approvals',
  'proof_submissions',

  // Onboarding & tutorials
  'onboarding_progress',
  'onboarding_analytics',
  'tutorial_completions',

  // Referrals & invitations
  'referrals',
  'referralCodes',
  'invitations',

  // Forums & challenges
  'forum_posts',
  'forum_replies',
  'challenges',

  // Activity logs (user-specific)
  'activities',
  'profile_access_logs',

  // Payments (if resetting test data)
  'payments'
];

// Collections that are PRESERVED by default (config/system data)
// Use --all to include these:
// - organizations, companies, partners
// - courses, resources, shared_resources, book_club_books
// - nudge_templates, weekly_activity_templates, activity_types
// - platform_config, admin_settings, free_user_points_limits
// - adminRoleHistory, admin_activity_log, admin_notifications
// - organization_capacity_metrics, partner_daily_digest_queue
// - eventAuditLogs, workshop_suggestion_votes

const auth = getAuth();

/**
 * Delete all Firebase Authentication users in batches
 * Firebase Auth deleteUsers() supports up to 1000 users per call
 */
async function clearAuthUsers() {
  console.log('\nClearing Firebase Authentication users...');
  let totalDeleted = 0;
  let nextPageToken;

  if (args.dryRun) {
    // Count users without deleting
    let totalUsers = 0;
    do {
      const listResult = await auth.listUsers(1000, nextPageToken);
      totalUsers += listResult.users.length;
      nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    console.log(`Firebase Auth: ${totalUsers} users would be deleted`);
    return;
  }

  do {
    const listResult = await auth.listUsers(1000, nextPageToken);

    if (listResult.users.length > 0) {
      const uids = listResult.users.map(user => user.uid);
      const deleteResult = await auth.deleteUsers(uids);
      totalDeleted += deleteResult.successCount;

      if (deleteResult.failureCount > 0) {
        console.log(`   Warning: ${deleteResult.failureCount} users failed to delete`);
        deleteResult.errors.forEach(err => {
          console.log(`      - ${err.error.message}`);
        });
      }

      console.log(`   Deleted batch of ${deleteResult.successCount} users (total: ${totalDeleted})`);
    }

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(`Firebase Auth: ${totalDeleted} users deleted`);
}

async function getTopLevelDocCount(collectionRef) {
  try {
    const agg = await collectionRef.count().get();
    return agg.data().count ?? 0;
  } catch {
    return null;
  }
}

/**
 * Delete all documents in a collection in batches
 * Firebase limits batch writes to 500 operations
 */
async function clearCollection(collectionName) {
  const collectionRef = db.collection(collectionName);
  const estimatedTopLevelCount = await getTopLevelDocCount(collectionRef);

  console.log(`\nClearing collection: ${collectionName}${args.recursive ? ' (recursive)' : ''}`);
  if (estimatedTopLevelCount !== null) {
    console.log(`   Top-level docs: ${estimatedTopLevelCount}${args.recursive ? ' (+ subcollections)' : ''}`);
  }

  if (args.dryRun) {
    if (args.recursive) {
      console.log('   Dry-run note: subcollection documents are not enumerated, but WOULD be deleted in --yes mode.');
    }

    const count = estimatedTopLevelCount ?? 0;
    console.log(`${collectionName}: ${count} top-level documents would be deleted${args.recursive ? ' (+ subcollections)' : ''}`);
    return;
  }

  if (args.recursive) {
    if (typeof db.recursiveDelete !== 'function') {
      throw new Error('Recursive delete not supported by this Firestore SDK version');
    }

    console.log('   Deleting all documents under this collection, including subcollections...');
    await db.recursiveDelete(collectionRef);
    console.log(`   ${collectionName}: recursive delete complete`);
    return;
  }

  const batchSize = 500;
  let totalDeleted = 0;
  let lastDoc = null;

  while (true) {
    let q = collectionRef.orderBy('__name__').limit(batchSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snapshot = await q.get();

    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted += snapshot.size;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    console.log(`   Deleted batch of ${snapshot.size} (total: ${totalDeleted})`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`${collectionName}: ${totalDeleted} top-level documents deleted`);
}

async function main() {
  console.log('FIRESTORE DATA CLEARING SCRIPT');
  console.log('==============================\n');
  console.log(`Target project_id: ${serviceAccount.project_id}`);
  console.log(`Service account:   ${serviceAccount.client_email}\n`);

  const topLevelCollections = await db.listCollections();
  const existing = new Set(topLevelCollections.map(c => c.id));
  const existingSorted = [...existing].sort((a, b) => a.localeCompare(b));

  if (args.list) {
    console.log('Top-level collections:');
    if (existingSorted.length === 0) console.log('  (none)');
    else existingSorted.forEach(id => console.log(`  - ${id}`));
    process.exit(0);
  }

  let collectionsToClear = [];
  if (args.all) collectionsToClear = existingSorted;
  else if (args.collections.length > 0) collectionsToClear = [...new Set(args.collections)];
  else collectionsToClear = DEFAULT_USER_DATA_COLLECTIONS;

  const toClearExisting = collectionsToClear.filter(c => existing.has(c));
  const missing = collectionsToClear.filter(c => !existing.has(c));

  console.log(args.dryRun ? 'DRY RUN (no deletes will be performed)\n' : 'DESTRUCTIVE MODE (deletes will be performed)\n');
  console.log(`Mode: ${args.recursive ? 'recursive (includes subcollections)' : 'shallow (top-level documents only)'}`);
  if (args.clearAuth) {
    console.log('Auth: Firebase Authentication users WILL be deleted');
  }
  console.log('\nPlan:');
  if (toClearExisting.length === 0) console.log('  (no matching collections found to clear)');
  else toClearExisting.forEach(c => console.log(`  - ${c}`));
  if (missing.length > 0) {
    console.log('\nSkipping (not found as a top-level collection in this project):');
    missing.forEach(c => console.log(`  - ${c}`));
  }
  console.log('');

  if (!args.all && args.collections.length === 0 && toClearExisting.length === 0 && !args.clearAuth) {
    console.log('Nothing to clear with the default user-data collection list.');
    console.log('Run `node scripts/clear-user-data.mjs --list` to see actual collections,');
    console.log('then run with `--collections <csv> --yes` (or `--all --yes`).');
    console.log('Use --clear-auth to delete Firebase Authentication users.');
    process.exit(1);
  }

  if (!args.noDelay) {
    console.log('Press Ctrl+C within 5 seconds to abort...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const startTime = Date.now();

  try {
    if (!args.dryRun && !args.yes) {
      // parseArgs() already forces dryRun when --yes isn't present,
      // but keep this check in case the logic changes later.
      throw new Error('Refusing to delete without --yes');
    }

    for (const collection of toClearExisting) {
      await clearCollection(collection);
    }

    // Clear Firebase Auth users if requested
    if (args.clearAuth) {
      await clearAuthUsers();
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nDone in ${duration}s`);
    const authMsg = args.clearAuth ? ' Auth users deleted.' : '';
    console.log(args.dryRun ? 'No data was deleted (dry-run).' : `Documents deleted. Collections preserved.${authMsg}`);
  } catch (error) {
    console.error('\nERROR:', error?.message ?? error);
    process.exit(1);
  }

  process.exit(0);
}

main();
