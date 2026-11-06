// Supabase Edge Function: grade-submission
//
// Triggered by a Database Webhook on INSERT/UPDATE of
// public.programme_component_submissions. Grades the learner's answers against
// the artefact rubric with Gemini 3 Flash and writes an advisory `ai_grade`
// back onto the row (service role, bypasses RLS).
//
// ADVISORY ONLY: never changes status and never awards points.
//
// Secrets (set with `supabase secrets set`): GEMINI_API_KEY, GRADE_WEBHOOK_SECRET.
// The webhook must send header `x-webhook-secret: <GRADE_WEBHOOK_SECRET>`;
// any other caller is rejected (the function runs with verify_jwt = false).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the runtime.
//
// Deploy: supabase functions deploy grade-submission
// Then create a DB webhook: table programme_component_submissions, events
// INSERT + UPDATE, calling this function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rubricForComponent } from "./rubrics.ts";
import { assemble, callGemini, MODEL } from "./gemini.ts";

interface SubmissionRow {
  id: string;
  component_id: string | null;
  answers: Record<string, string> | null;
  ai_grade: { answers_hash?: string } | null;
  /** Set when the learner agreed to AI-assisted grading (migration 0105). */
  ai_consent_at?: string | null;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  record: SubmissionRow | null;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string compare, so the secret can't be guessed by timing. */
function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  // Only the database webhook may call this function.
  const expected = Deno.env.get("GRADE_WEBHOOK_SECRET");
  const given = req.headers.get("x-webhook-secret") ?? "";
  if (!expected || !safeEqual(given, expected)) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const recordId = payload.record?.id;
  if (!recordId) return new Response("no record", { status: 200 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Read the submission from the database instead of trusting the request body.
  const { data: row, error: readError } = await supabase
    .from("programme_component_submissions")
    .select("id, component_id, answers, ai_grade, ai_consent_at")
    .eq("id", recordId)
    .maybeSingle<SubmissionRow>();
  if (readError) return new Response(`read failed: ${readError.message}`, { status: 500 });
  if (!row) return new Response("no such submission", { status: 200 });

  // Never send answers to Gemini without the learner's consent.
  if (!row.ai_consent_at) return new Response("no AI consent", { status: 200 });

  const rubric = rubricForComponent(row.component_id);
  if (!rubric) return new Response("no rubric for component", { status: 200 });

  const answers = row.answers ?? {};
  const submission = assemble(answers);
  if (!submission) return new Response("nothing to grade", { status: 200 });

  const answersHash = await sha256(submission);
  if (row.ai_grade?.answers_hash === answersHash) {
    return new Response("already graded this version", { status: 200 });
  }

  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_API_KEY not set");
    const result = await callGemini(key, rubric, submission);
    await supabase
      .from("programme_component_submissions")
      .update({
        ai_grade: {
          status: "completed",
          score: result.score,
          feedback: result.feedback,
          pass: result.pass,
          model: MODEL,
          answers_hash: answersHash,
          graded_at: new Date().toISOString(),
        },
      })
      .eq("id", row.id);
    return new Response("graded", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("programme_component_submissions")
      .update({
        ai_grade: {
          status: "error",
          error: message.slice(0, 500),
          model: MODEL,
          answers_hash: answersHash,
          graded_at: new Date().toISOString(),
        },
      })
      .eq("id", row.id);
    return new Response(`error: ${message}`, { status: 200 });
  }
});
