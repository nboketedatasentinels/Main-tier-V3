# Deploy runbook: AI auto-grading of programme submissions

This turns on automatic, advisory AI grading. Once the four switches below are
on, a learner submitting a capstone / case study / practical gets graded with no
manual step, and the partner opens it already graded.

## How it works (no human in the grading loop)

```
Learner clicks Submit
  -> row inserted into  public.programme_component_submissions   (Supabase)
  -> Database Webhook fires on INSERT/UPDATE
  -> grade-submission Edge Function runs:
        matches the artefact rubric by component_id,
        grades with Gemini 3 Flash,
        writes ai_grade back onto the row (service role, bypasses RLS)
  -> partner opens the submission already graded
```

`ai_grade` is ADVISORY ONLY. It never changes `status` and never awards points.
The partner stays the gate.

## Status checklist

- [x] `0014_programme_submissions.sql` applied to the database (table exists).
- [x] Rubrics for all four pillars wired (`rubrics.ts` + `_rubrics_*.ts`, 40 artefacts).
- [ ] **Switch 1:** App deployed with the Supabase write-path (merge `feat/ai-advisory-grading` -> `main`).
- [ ] **Switch 2:** `GEMINI_API_KEY` secret set.
- [ ] **Switch 3:** `grade-submission` Edge Function deployed.
- [ ] **Switch 4:** Database Webhook created on `programme_component_submissions`.

---

## Prerequisites (once)

```bash
# Supabase CLI installed, then:
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>     # ref is in your Supabase project URL
```

## Switch 2 - set the model API key

The function reads `GEMINI_API_KEY`. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
are injected by the runtime automatically (do not set those).

```bash
supabase secrets set GEMINI_API_KEY=<your-google-ai-studio-key>
```

(Key from Google AI Studio. To switch the model later, edit `MODEL` in `index.ts`.)

## Switch 3 - deploy the Edge Function

Run from the repo root. The whole `grade-submission/` folder deploys together,
so `rubrics.ts` and the four `_rubrics_*.ts` files ship with it.

```bash
supabase functions deploy grade-submission --no-verify-jwt
```

`--no-verify-jwt` lets the Database Webhook call the function without a user JWT.
(Alternative: deploy without that flag and add an `Authorization: Bearer <ANON_KEY>`
header in the webhook config below. Pick one.)

Function URL after deploy:
`https://<YOUR_PROJECT_REF>.functions.supabase.co/grade-submission`

## Switch 4 - create the Database Webhook

Dashboard -> Database -> Webhooks -> Create a new hook:

- **Name:** `grade_on_submission`
- **Table:** `public.programme_component_submissions`
- **Events:** Insert, Update
- **Type:** Supabase Edge Functions -> `grade-submission`
  (or HTTP Request -> POST to the function URL above)
- **HTTP headers:** `Content-Type: application/json`
  - If you deployed WITHOUT `--no-verify-jwt`, also add:
    `Authorization: Bearer <YOUR_PROJECT_ANON_KEY>`
- **Payload:** leave default. Supabase sends `{ type, table, record, old_record, schema }`;
  the function reads `record`.

Creating a webhook auto-enables the required `pg_net` extension.

## Switch 1 - ship the app

Vercel deploys `main`. Merge the branch so the runtime that writes submissions to
Supabase goes live:

```bash
# open a PR feat/ai-advisory-grading -> main, review, merge
```

Until this is merged, learners on prod do not write to the Supabase table, so
nothing reaches the webhook.

---

## Verify it works

1. Submit a test artefact through the app (or have a test learner do it).
2. Check the row got graded:

```sql
select component_id,
       ai_grade->>'status'   as ai_status,
       ai_grade->>'score'    as ai_score,
       ai_grade->>'pass'     as ai_pass,
       left(ai_grade->>'feedback', 120) as feedback_preview,
       submitted_at
from public.programme_component_submissions
order by submitted_at desc
limit 5;
```

Expect `ai_status = completed` with a score/feedback within a few seconds of submit.

3. Watch function logs if needed:

```bash
supabase functions logs grade-submission
```

## Behaviour notes

- **Re-grading:** a resubmit is an UPDATE, which re-fires the webhook. The function
  hashes the answers and skips if unchanged ("already graded this version"), so it
  re-grades only when the answers actually changed.
- **No rubric:** if a `component_id` has no rubric, the function returns
  "no rubric for component" and does NOT grade (it never grades against the wrong
  standard). All 40 current artefacts have rubrics.
- **Failures are non-fatal:** on a model/API error the function writes
  `ai_grade.status = 'error'` with the message; the submission row is untouched
  otherwise and the partner can still review it manually.
- **Placeholder rubrics:** `innovation-practical-1` and `innovation-practical-2`
  are still placeholder pages; regenerate their rubrics once the real content ships.
