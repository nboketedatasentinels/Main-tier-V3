/**
 * One-time backfill: copy Firestore `programmeComponentSubmissions` into the
 * Supabase `programme_component_submissions` table (migration 0014).
 *
 * Maps the Firestore Firebase uid -> Supabase profiles.id (uuid) via the
 * profiles.firebase_uid column. Submissions whose learner has no matching
 * Supabase profile are skipped and reported (run the profile backfill first).
 *
 * Idempotent: upserts on (user_id, component_id).
 *
 * Requires (set in env, do NOT hardcode):
 *   GOOGLE_APPLICATION_CREDENTIALS  -> path to a Firebase service-account json
 *   SUPABASE_URL                    -> https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY       -> service-role key (server-side only!)
 *
 * Run:  node scripts/grading/backfill_submissions_to_supabase.mjs [--dry-run]
 */

import admin from "firebase-admin";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the env.");
  process.exit(1);
}

admin.initializeApp(); // uses GOOGLE_APPLICATION_CREDENTIALS
const fs = admin.firestore();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const toIso = (v) => {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  return null;
};

async function buildUidMap() {
  // firebase_uid -> profiles.id (uuid)
  const map = new Map();
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, firebase_uid")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) if (row.firebase_uid) map.set(row.firebase_uid, row.id);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN - no writes\n" : "Backfilling...\n");
  const uidMap = await buildUidMap();
  console.log(`Loaded ${uidMap.size} profile uid mappings`);

  const snap = await fs.collection("programmeComponentSubmissions").get();
  console.log(`Found ${snap.size} Firestore submissions`);

  let migrated = 0;
  const skipped = [];
  for (const docSnap of snap.docs) {
    const d = docSnap.data();
    const userId = uidMap.get(d.uid);
    if (!userId) {
      skipped.push(`${docSnap.id} (uid ${d.uid} -> no Supabase profile)`);
      continue;
    }
    const row = {
      user_id: userId,
      organization_id: d.organizationId ?? null,
      component_id: d.componentId,
      component_type: d.componentType ?? null,
      component_title: d.componentTitle ?? null,
      pillar: d.pillar ?? null,
      part_id: d.partId ?? null,
      part_title: d.partTitle ?? null,
      answers: d.answers ?? {},
      answer_count: typeof d.answerCount === "number" ? d.answerCount : 0,
      status: d.status ?? "submitted",
      submitted_at: toIso(d.submittedAt) ?? new Date().toISOString(),
      last_updated_at: toIso(d.lastUpdatedAt) ?? new Date().toISOString(),
      resubmitted_at: toIso(d.resubmittedAt),
      source_page: d.sourcePage ?? null,
      reviewed_at: toIso(d.reviewedAt),
      reviewer_name: d.reviewerName ?? null,
      partner_notes: d.partnerNotes ?? null,
      score: typeof d.score === "number" ? d.score : null,
    };
    if (DRY_RUN) {
      migrated++;
      continue;
    }
    const { error } = await supabase
      .from("programme_component_submissions")
      .upsert(row, { onConflict: "user_id,component_id" });
    if (error) {
      skipped.push(`${docSnap.id} (upsert error: ${error.message})`);
    } else {
      migrated++;
    }
  }

  console.log(`\nMigrated: ${migrated}`);
  console.log(`Skipped: ${skipped.length}`);
  skipped.slice(0, 50).forEach((s) => console.log("  - " + s));
  if (skipped.length > 50) console.log(`  ... and ${skipped.length - 50} more`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
