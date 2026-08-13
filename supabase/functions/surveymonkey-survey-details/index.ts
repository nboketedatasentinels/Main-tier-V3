// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * surveymonkey-survey-details
 *
 * Fetches one SurveyMonkey survey's full question details so the app can render
 * Pre/Post assessments exactly as defined in SurveyMonkey (live pull).
 *
 * Auth: logged-in Supabase user (Bearer JWT).
 * Secret: SURVEYMONKEY_ACCESS_TOKEN
 */
const FUNCTION_VERSION = "2026-08-13-survey-details";
const SM_API = "https://api.surveymonkey.com/v3";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SmChoice = { id?: string; text?: string; weight?: number };
type SmRow = { id?: string; text?: string };
type SmQuestion = {
  id?: string;
  family?: string;
  subtype?: string;
  headings?: Array<{ heading?: string }>;
  answers?: { rows?: SmRow[]; choices?: SmChoice[] };
};

type NativeQuestion =
  | { type: "info"; text: string }
  | { type: "rating"; text: string; min: number; max: number }
  | { type: "single_choice"; text: string; choices: string[] }
  | { type: "short_text" | "long_text"; text: string };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function stripHtml(value: string): string {
  return (value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function headingText(q: SmQuestion): string {
  return stripHtml((q.headings || []).map((h) => h.heading || "").join(" "));
}

function resolveScale(choices: SmChoice[] | undefined): { min: number; max: number } {
  const weights = (choices || [])
    .map((c) => c.weight)
    .filter((w): w is number => typeof w === "number" && Number.isFinite(w));
  if (weights.length > 0) return { min: Math.min(...weights), max: Math.max(...weights) };

  const parsed = (choices || [])
    .map((c) => Number.parseInt(String(c.text || "").trim(), 10))
    .filter((n) => Number.isFinite(n));
  if (parsed.length > 0) return { min: Math.min(...parsed), max: Math.max(...parsed) };

  return { min: 1, max: 10 };
}

function parseQuestions(pages: Array<{ questions?: SmQuestion[] }> | undefined): NativeQuestion[] {
  const questions: NativeQuestion[] = [];

  for (const page of pages || []) {
    for (const q of page.questions || []) {
      const heading = headingText(q);
      const family = (q.family || "").toLowerCase();
      const subtype = (q.subtype || "").toLowerCase();

      if (family === "presentation") {
        if (heading) questions.push({ type: "info", text: heading });
        continue;
      }

      if (family === "matrix" && (subtype === "rating" || subtype === "single" || !subtype)) {
        const rows = (q.answers?.rows || [])
          .map((row) => stripHtml(row.text || ""))
          .filter(Boolean);
        const scale = resolveScale(q.answers?.choices);
        if (rows.length > 0) {
          if (heading) questions.push({ type: "info", text: heading });
          for (const row of rows) {
            questions.push({ type: "rating", text: row, min: scale.min, max: scale.max });
          }
          continue;
        }
        if (heading) {
          questions.push({ type: "rating", text: heading, min: scale.min, max: scale.max });
        }
        continue;
      }

      if (family === "single_choice" || family === "multiple_choice") {
        const choices = (q.answers?.choices || [])
          .map((c) => stripHtml(c.text || ""))
          .filter(Boolean);
        if (!heading) continue;
        questions.push({ type: "single_choice", text: heading, choices });
        continue;
      }

      if (family === "open_ended") {
        if (!heading) continue;
        questions.push({
          type: subtype === "essay" || subtype === "multi" ? "long_text" : "short_text",
          text: heading,
        });
        continue;
      }

      if (family === "datetime" || family === "demographic") {
        if (!heading) continue;
        questions.push({ type: "short_text", text: heading });
        continue;
      }

      if (heading) questions.push({ type: "long_text", text: heading });
    }
  }

  return questions;
}

async function smFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${SM_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SurveyMonkey ${path} failed (HTTP ${res.status}): ${text.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed", version: FUNCTION_VERSION });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json(401, { error: "missing_token", version: FUNCTION_VERSION });
    }

    const token = Deno.env.get("SURVEYMONKEY_ACCESS_TOKEN");
    if (!token) {
      return json(500, {
        error: "missing_surveymonkey_token",
        detail: "Set SURVEYMONKEY_ACCESS_TOKEN as a Supabase Edge Function secret.",
        version: FUNCTION_VERSION,
      });
    }

    const body = (await req.json().catch(() => ({}))) as { surveyId?: string };
    const surveyId = String(body.surveyId || "").trim();
    if (!surveyId) {
      return json(400, { error: "missing_survey_id", version: FUNCTION_VERSION });
    }

    const details = await smFetch<{
      id?: string;
      title?: string;
      pages?: Array<{ questions?: SmQuestion[] }>;
    }>(`/surveys/${encodeURIComponent(surveyId)}/details`, token);

    const questions = parseQuestions(details.pages);

    return json(200, {
      ok: true,
      version: FUNCTION_VERSION,
      surveyId: details.id || surveyId,
      title: details.title || null,
      questionCount: questions.length,
      questions,
      // Raw pages kept for auditing / future exact re-parse on client if needed.
      pages: details.pages ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("surveymonkey-survey-details error", message);
    return json(500, { error: "internal_error", message, version: FUNCTION_VERSION });
  }
});
