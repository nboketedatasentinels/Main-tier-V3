// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * surveymonkey-list-surveys
 *
 * Lists SurveyMonkey surveys + their open web-link collectors so the app can
 * wire Pre/Post course assessments without hard-coding every /r/ URL.
 *
 * Auth: requires a logged-in Supabase user (partner/admin preferred; any
 * authenticated user may read the catalog since collector URLs are already
 * public share links).
 *
 * Secret: SURVEYMONKEY_ACCESS_TOKEN (Supabase Edge Function secret).
 */
const FUNCTION_VERSION = "2026-08-11-list-surveys";
const SM_API = "https://api.surveymonkey.com/v3";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SmSurvey = {
  id: string;
  title: string;
  nickname?: string;
  href?: string;
};

type SmCollector = {
  id: string;
  name?: string;
  type?: string;
  href?: string;
  status?: string;
  url?: string;
};

type ListedSurvey = {
  id: string;
  title: string;
  kind: "pre" | "post" | "other";
  collectorUrl: string | null;
  collectorId: string | null;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function inferKind(title: string): ListedSurvey["kind"] {
  const t = title.toLowerCase();
  if (t.includes("pre-course") || t.includes("pre course") || t.includes("pre-course assessment")) {
    return "pre";
  }
  if (t.includes("post-course") || t.includes("post course") || t.includes("post-course assessment")) {
    return "post";
  }
  if (/\bpre\b/.test(t) && t.includes("assessment")) return "pre";
  if (/\bpost\b/.test(t) && t.includes("assessment")) return "post";
  return "other";
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

async function listAllSurveys(token: string): Promise<SmSurvey[]> {
  const out: SmSurvey[] = [];
  let page = 1;
  for (;;) {
    const data = await smFetch<{ data?: SmSurvey[]; total?: number; per_page?: number }>(
      `/surveys?per_page=100&page=${page}`,
      token,
    );
    const batch = data.data ?? [];
    out.push(...batch);
    if (batch.length < 100) break;
    page += 1;
    if (page > 20) break; // hard stop for draft quota
  }
  return out;
}

async function getOpenWebLink(token: string, surveyId: string): Promise<{
  collectorUrl: string | null;
  collectorId: string | null;
}> {
  const list = await smFetch<{ data?: SmCollector[] }>(
    `/surveys/${surveyId}/collectors?per_page=50`,
    token,
  );
  const collectors = list.data ?? [];
  const preferred =
    collectors.find((c) => (c.type || "").toLowerCase().includes("weblink") && (c.status || "").toLowerCase() === "open") ||
    collectors.find((c) => (c.type || "").toLowerCase().includes("weblink")) ||
    collectors[0];

  if (!preferred?.id) return { collectorUrl: null, collectorId: null };

  // Detail endpoint often includes the public URL for weblink collectors.
  const detail = await smFetch<SmCollector>(`/collectors/${preferred.id}`, token);
  const url = detail.url || preferred.url || null;
  return { collectorUrl: url, collectorId: preferred.id };
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

    const body = (await req.json().catch(() => ({}))) as { kind?: string };
    const kindFilter = (body.kind || "").toLowerCase();

    const surveys = await listAllSurveys(token);
    const listed: ListedSurvey[] = [];

    for (const survey of surveys) {
      const kind = inferKind(survey.title || survey.nickname || "");
      if (kindFilter === "pre" || kindFilter === "post") {
        if (kind !== kindFilter) continue;
      } else if (kindFilter === "course") {
        if (kind === "other") continue;
      }

      // Only resolve collectors for pre/post (or when explicitly listing all).
      let collectorUrl: string | null = null;
      let collectorId: string | null = null;
      if (kind !== "other" || !kindFilter) {
        try {
          const link = await getOpenWebLink(token, survey.id);
          collectorUrl = link.collectorUrl;
          collectorId = link.collectorId;
        } catch (err) {
          console.warn(`collector lookup failed for ${survey.id}`, err);
        }
      }

      listed.push({
        id: survey.id,
        title: survey.title || survey.nickname || survey.id,
        kind,
        collectorUrl,
        collectorId,
      });
    }

    return json(200, {
      ok: true,
      version: FUNCTION_VERSION,
      count: listed.length,
      surveys: listed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("surveymonkey-list-surveys error", message);
    return json(500, { error: "internal_error", message, version: FUNCTION_VERSION });
  }
});
