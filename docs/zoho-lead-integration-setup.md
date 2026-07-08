# Zoho CRM Lead Integration — Setup Guide

**Goal:** When an anonymous visitor completes the public LIFT assessment, automatically
create a **Lead** in Zoho CRM (in addition to the existing Supabase record the admin views).

This guide covers **only the credentials + Zoho-side setup you do by hand**. Once these are
done, the Supabase Edge Function + webhook get built against them.

---

## 0. Before you start — know your Zoho data center

Zoho runs region-specific data centers. Your API URLs depend on where your CRM account lives.
Check the URL in your browser when logged into CRM:

| Your CRM URL contains | Data center | Accounts/API domain | Token domain |
|---|---|---|---|
| `crm.zoho.com`     | US  | `www.zohoapis.com`    | `accounts.zoho.com`    |
| `crm.zoho.eu`      | EU  | `www.zohoapis.eu`     | `accounts.zoho.eu`     |
| `crm.zoho.in`      | IN  | `www.zohoapis.in`     | `accounts.zoho.in`     |
| `crm.zoho.com.au`  | AU  | `www.zohoapis.com.au` | `accounts.zoho.com.au` |
| `crm.zoho.com.cn`  | CN  | `www.zohoapis.com.cn` | `accounts.zoho.com.cn` |

> Your screenshot shows `crmplus.zoho.com` → **US data center**. So you'll use
> `accounts.zoho.com` and `www.zohoapis.com`. If that's wrong, swap the domains accordingly.

**Write your data center down — every step below uses it.**

---

## 1. Create a "Self Client" (gets you Client ID + Secret)

A Self Client is the simplest OAuth app for server-to-server automation (no user login flow).

1. Go to the **Zoho API Console**: https://api-console.zoho.com
   (If on EU/IN/etc., it redirects to your region automatically once logged in.)
2. Click **Add Client** (top right).
3. Choose **Self Client** → **Create**.
4. Confirm. You now have a client. Click into it and open the **Client Secret** tab.
5. Copy and save these two values somewhere safe (you'll need them later):
   - **Client ID**
   - **Client Secret**

---

## 2. Generate an authorization code (one-time, 10-min lifespan)

Still in the Self Client:

1. Open the **Generate Code** tab.
2. In the **Scope** field, paste exactly:
   ```
   ZohoCRM.modules.leads.CREATE,ZohoCRM.modules.leads.READ,ZohoCRM.settings.fields.READ
   ```
   - `leads.CREATE` → create the lead
   - `leads.READ` → de-dupe / look up existing leads by email (optional but recommended)
   - `settings.fields.READ` → lets us discover your custom field API names
3. **Time Duration:** choose `10 minutes` (default is fine — you'll use it immediately).
4. **Scope Description:** type anything, e.g. `LIFT assessment lead sync`.
5. Click **Create**. Select your CRM portal + environment (**Production**) if prompted.
6. Copy the **generated code** (the `grant_token`). It looks like `1000.xxxx.yyyy`.

> ⚠️ This code expires in 10 minutes and is single-use. Do step 3 right away.

---

## 3. Exchange the code for a REFRESH TOKEN (the durable credential)

The grant token from step 2 is short-lived. Exchange it once for a **refresh token**, which
never expires (until manually revoked) and is what the integration actually stores.

Run this in your terminal (replace the 3 placeholders; use **your** token domain from step 0):

```bash
curl -s -X POST "https://accounts.zoho.com/oauth/v2/token" \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_GRANT_TOKEN_FROM_STEP_2"
```

The response looks like:

```json
{
  "access_token":  "1000.aaaa.bbbb",
  "refresh_token": "1000.cccc.dddd",
  "api_domain":    "https://www.zohoapis.com",
  "token_type":    "Bearer",
  "expires_in":    3600
}
```

**Save the `refresh_token`.** That's the one we keep. (The access_token expires in 1 hour;
the integration auto-refreshes it using the refresh token + client id/secret.)

> If you get `"error":"invalid_code"` → the grant token expired or was already used.
> Just redo step 2 to mint a fresh one, then rerun this.

---

## 4. (Recommended) Create custom fields in Zoho for the assessment data

Standard Lead fields cover the contact info. To store the assessment results, create custom
fields so your team can see/filter them. In Zoho CRM:

**Setup (gear icon) → Modules and Fields → Leads → (edit layout) → drag in new fields.**

Suggested custom fields:

| Field label | Type | Holds |
|---|---|---|
| LIFT Index            | Number          | `lift_index` (0–100) |
| Archetype             | Single Line / Picklist | `archetype` |
| Lead Tier             | Picklist (A/B/C)| `lead_tier` |
| Development Edge      | Single Line     | `development_edge` (L/I/F/T) |
| Pillar L / I / F / T  | Number (×4)     | `pillar_l/i/f/t` |
| Recommended Offer     | Single Line     | `recommended_offer` |
| Coaching Triggered    | Checkbox        | `coaching_triggered` |

After creating them, we'll fetch their **API names** automatically (that's what
`settings.fields.READ` scope is for) when wiring the function. You don't need to record them
by hand.

### Standard field mapping (no setup needed)

| Supabase `lift_leads` | Zoho Lead standard field |
|---|---|
| `first_name`  | First_Name |
| `last_name`   | Last_Name  (**required** by Zoho — see note) |
| `email`       | Email |
| `phone`       | Phone |
| `organisation`| Company  (**required** by Zoho — see note) |
| `country`     | Country |

> **Zoho requires `Last_Name` and `Company` on every Lead.** Some assessment takers may leave
> these blank. The function will fall back (e.g. `Last_Name = "(not provided)"`,
> `Company = organisation || "Individual"`) so the create never fails. We'll confirm the
> exact fallbacks when building.

---

## 5. Lead owner routing (optional, by tier)

You mentioned tier owners (A→Nono, B→Nyaga, C→Ayakwa). To auto-assign the Zoho lead owner,
we need each owner's **Zoho user ID** (not their name). Get them via:

```bash
curl -s "https://www.zohoapis.com/crm/v8/users?type=ActiveUsers" \
  -H "Authorization: Zoho-oauthtoken YOUR_ACCESS_TOKEN"
```

Find each person in the response and note their `id` (a long number). Provide them as:
`A=<id>, B=<id>, C=<id>`. (Optional — if skipped, leads use Zoho's default assignment rules.)

---

## 6. What to hand over to build the integration

Once you've done the above, the integration needs these stored as **Supabase secrets**
(never in client code / git):

```
ZOHO_DC                 = com            # your data center suffix (com | eu | in | com.au ...)
ZOHO_CLIENT_ID          = 1000.XXXX...
ZOHO_CLIENT_SECRET      = ......
ZOHO_REFRESH_TOKEN      = 1000.cccc.dddd
ZOHO_OWNER_TIER_A       = <user id>      # optional
ZOHO_OWNER_TIER_B       = <user id>      # optional
ZOHO_OWNER_TIER_C       = <user id>      # optional
```

They'll be set with:

```bash
supabase secrets set ZOHO_CLIENT_ID=... ZOHO_CLIENT_SECRET=... ZOHO_REFRESH_TOKEN=... ZOHO_DC=com
```

---

## What gets built after this (preview — not your task yet)

1. **Supabase Edge Function** `zoho-lead-sync` — receives a webhook payload, refreshes the
   Zoho access token, maps fields, and POSTs to
   `https://www.zohoapis.com/crm/v8/Leads` (with optional email de-dupe + tier owner routing).
2. **Supabase Database Webhook** on `public.lift_leads` — fires on INSERT/UPDATE; the function
   only proceeds when `completed_at` is set (so partial/abandoned leads aren't pushed).
3. **Idempotency + audit** — a small `zoho_lead_syncs` table (or a `zoho_lead_id` column on
   `lift_leads`) records the Zoho lead id and prevents duplicate pushes on retries.
4. Existing admin view is untouched — Zoho runs *alongside* it.

---

### Quick checklist

- [ ] Identified data center (likely **US / .com**)
- [ ] Created Self Client → saved **Client ID** + **Client Secret**
- [ ] Generated grant token with the 3 scopes
- [ ] Exchanged it → saved **Refresh Token**
- [ ] (Optional) Created custom Lead fields in Zoho
- [ ] (Optional) Collected tier owner Zoho user IDs
- [ ] Ready to set Supabase secrets
