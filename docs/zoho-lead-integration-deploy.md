# Zoho Lead Sync — Deploy & Wire-Up

The code is scaffolded. This is the order of operations to take it live **once you
have the refresh token** (see `zoho-lead-integration-setup.md` for getting it).

---

## ⚠️ Gotchas we hit (read this first — saves hours)

- **Deploy isn't live until you click "Deploy updates" AND see the toast.** Editing
  the dashboard Code tab does nothing on its own. Verify which build is live via the
  `version` field every response returns (e.g. `-d '{}'` → `{"error":"missing_lead_id","version":"..."}`).
- **Zoho reads the created id from `data[0].details.id`, NOT `data[0].id`.** Zoho also
  returns HTTP 2xx even when it *rejects* a record — always check `data[0].status == "success"`.
  Missing this makes the function report fake success with a null id.
- **Infinite webhook loop.** The function writes `zoho_lead_id`/`zoho_sync_error` back to
  the row (an UPDATE), which re-fires a naive webhook forever and permanently rate-limits
  Zoho's token endpoint. Fix: the `0028` trigger has a `WHEN` clause excluding write-backs.
- **Zoho token rate limit** ("You have made too many requests continuously"): caused by the
  loop above + refreshing a token on every call. Clears only with real *inactivity* (~15–30 min,
  webhook OFF). The function now caches the access token (~1h) to avoid this. Don't loop-retry.
- **Unknown custom-field API name = whole create rejected.** Send only confirmed field API
  names (discover via `/crm/v2/settings/fields?module=Leads`). `ZOHO_INCLUDE_CUSTOM_FIELDS`
  stays off until names are confirmed.
- **Zoho formula fields have NO `||` / `&&`.** Use the `Or()` function, and it takes 2 args —
  nest for 3: `Or(a, Or(b, c))`. Strings use **single** quotes. Reference fields as
  `${Leads.FieldName}` (insert via the field picker). The syntax-error message is misleading —
  it blames field format even when the real problem is `||`.
- **Layout ≠ module.** "LIFT Assessment" is a *layout* under the **Leads** module, not a
  separate module — so field refs are `${Leads.…}` and the API posts to `/crm/v2/Leads`.

What was built:
- `supabase/migrations/0027_lift_leads_zoho_sync.sql` — `zoho_lead_id` / `zoho_synced_at` / `zoho_sync_error` columns + indexes (idempotency).
- `supabase/functions/zoho-lead-sync/index.ts` — the sync function.
- `supabase/config.toml` — disables JWT verification for this function.

---

## 1. Apply the migration

In the Supabase SQL editor, run the contents of
`supabase/migrations/0027_lift_leads_zoho_sync.sql` (or `supabase db push` if you
use the CLI). Idempotent — safe to re-run.

## 2. Set the secrets

```bash
supabase secrets set \
  ZOHO_DC=com \
  ZOHO_CLIENT_ID=1000.XXXX... \
  ZOHO_CLIENT_SECRET=........ \
  ZOHO_REFRESH_TOKEN=1000.cccc.dddd \
  ZOHO_WEBHOOK_SECRET="$(openssl rand -hex 24)"   # generate once, keep it for step 4
# Optional tier routing:
# ZOHO_OWNER_TIER_A=<id> ZOHO_OWNER_TIER_B=<id> ZOHO_OWNER_TIER_C=<id>
# Custom fields — leave OFF until you've created the fields & confirmed API names:
# ZOHO_INCLUDE_CUSTOM_FIELDS=false
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — don't set them.

> **Note the `ZOHO_WEBHOOK_SECRET` value** — you paste it into the webhook in step 4.

## 3. Deploy the function

```bash
supabase functions deploy zoho-lead-sync
```

## 4. Create the Database Webhook

Supabase Dashboard → **Database → Webhooks → Create a new hook**:

- **Table:** `public.lift_leads`
- **Events:** ✅ Insert, ✅ Update  (both — one-shot completes are INSERTs, capture-first completes are UPDATEs)
- **Type:** Supabase Edge Function → `zoho-lead-sync`
- **HTTP Headers:** add `Authorization` = `Bearer <the ZOHO_WEBHOOK_SECRET from step 2>`

The function self-gates: it ignores rows where `completed_at` is null and skips
any row that already has `zoho_lead_id`, so the write-back UPDATE won't loop and
abandoned assessments are never pushed.

## 5. Test

Complete a real assessment on the public funnel (or insert a test row with
`completed_at` set). Then check:

```sql
select id, email, lead_tier, zoho_lead_id, zoho_synced_at, zoho_sync_error
from public.lift_leads
order by created_at desc limit 5;
```

- `zoho_lead_id` populated → ✅ it's in Zoho (Leads, source = "LIFT Assessment").
- `zoho_sync_error` populated → read it; most often a bad/expired refresh token
  or (if you enabled custom fields) a wrong custom-field API name.

Function logs: `supabase functions logs zoho-lead-sync`.

## 6. (Later) Turn on custom fields

After you create the custom Lead fields in Zoho and confirm their **API names**
(Setup → Modules & Fields → Leads → field → API Name), update the `CUSTOM_FIELDS`
map at the top of `index.ts` to match, then:

```bash
supabase secrets set ZOHO_INCLUDE_CUSTOM_FIELDS=true
supabase functions deploy zoho-lead-sync
```

Until then the assessment data still lands in Zoho's standard **Description**
field, so nothing is lost.

---

### Retrying a failed lead
Clear the error and the next webhook re-fires won't help (the row already
exists). To force a retry, null out the sync columns so a manual re-trigger works:
```sql
update public.lift_leads
set zoho_lead_id = null, zoho_sync_error = null
where id = '<lead-id>';
```
Then re-save the row (or call the function manually with that record payload).
