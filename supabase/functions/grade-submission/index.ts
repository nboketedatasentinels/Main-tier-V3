// Supabase Edge Function: grade-submission
//
// Triggered by a Database Webhook on INSERT/UPDATE of
// public.programme_component_submissions. Grades the learner's answers against
// the artefact rubric with Gemini 3 Flash and writes an advisory `ai_grade`
// back onto the row (service role, bypasses RLS).
//
// ADVISORY ONLY: never changes status and never awards points.
//
// Secrets (set with `supabase secrets set`): GEMINI_API_KEY.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the runtime.
//
// Deploy: supabase functions deploy grade-submission
// Then create a DB webhook: table programme_component_submissions, events
// INSERT + UPDATE, calling this function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { rubricForComponent } from "./rubrics.ts";

const MODEL = "gemini-3-flash-preview";

interface SubmissionRow {
  id: string;
  component_id: string | null;
  answers: Record<string, string> | null;
  ai_grade: { answers_hash?: string } | null;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  record: SubmissionRow | null;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function assemble(answers: Record<string, string>): string {
  return Object.entries(answers)
    .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
    .map(([k, v]) => `${k}: ${v.trim()}`)
    .join("\n\n");
}

async function callGemini(rubric: string, submission: string) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const body = {
    systemInstruction: { parts: [{ text: rubric }] },
    contents: [{ role: "user", parts: [{ text: submission }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        required: ["response"],
        properties: {
          response: {
            type: "OBJECT",
            required: ["score", "feedback", "pass"],
            properties: {
              score: { type: "NUMBER" },
              feedback: { type: "STRING" },
              pass: { type: "BOOLEAN" },
            },
          },
        },
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");
  const parsed = JSON.parse(text);
  const r = parsed.response ?? parsed;
  return { score: Number(r.score), feedback: String(r.feedback ?? ""), pass: Boolean(r.pass) };
}

Deno.serve(async (req) => {
  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const row = payload.record;
  if (!row) return new Response("no record", { status: 200 });

  const rubric = rubricForComponent(row.component_id);
  if (!rubric) return new Response("no rubric for component", { status: 200 });

  const answers = row.answers ?? {};
  const submission = assemble(answers);
  if (!submission) return new Response("nothing to grade", { status: 200 });

  const answersHash = await sha256(submission);
  if (row.ai_grade?.answers_hash === answersHash) {
    return new Response("already graded this version", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const result = await callGemini(rubric, submission);
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
