# Browser Test Report – Impact & Partner Impact Log

**Tested:** 2026-03-04  
**URLs:** `http://localhost:4176/app/impact`, `http://localhost:3000/impactlog-partner.html`

---

## 1. Tier app – `http://localhost:4176/app/impact`

**Result:** **Working as intended.**

- Unauthenticated users are sent to the login flow (login form with Email, Password, Sign In, Magic Link, Google).
- URL may stay `/app/impact` or become `/login?redirect=%2Fapp%2Fimpact` depending on timing; in both cases the user sees the Sign In form.
- **How to test the impact page after login:** Sign in at `http://localhost:4176/login`, then go to `http://localhost:4176/app/impact` (or use the app nav). You should see the Impact Log page.

No code changes required in Man-tier-v2 for this URL.

---

## 2. Partner app – `http://localhost:3000/impactlog-partner.html`

**Result:** **Failing in the browser** – the partner app code is **not** in this repo (Tier-Platform only contains Man-tier-v2). The following was observed from the app running on port 3000.

### What happens

1. Request to `http://localhost:3000/impactlog-partner.html` loads the HTML page.
2. The page’s script then calls:
   - `GET /api/me`
   - `GET /api/impact/my-stats`
   - `GET /api/impact/events`
   - `GET /api/partner/impact/entries`
   - `GET /api/partner/impact/rates`
3. When the user is **not** logged in, the server responds with **HTML** (e.g. the sign-in page) instead of JSON, or redirects to `/signin` / `partner-signin`.
4. The client does `response.json()` on that HTML → **SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON**.
5. Console errors:
   - `Failed to load entries: SyntaxError: Unexpected token '<', "<!DOCTYPE "...`
   - `Failed to load stats: ...`
   - `Failed to load ESG rate configuration: ...`
   - `Failed to load events: ...`
   - `Error fetching current user: ...`
6. There is also: `TypeError: Cannot read properties of null (reading 'addEventListener')` in `signin.js:88` (missing DOM element).

So the partner app “wasn’t working” because **unauthenticated API responses are HTML, and the client always tries to parse them as JSON**.

### Fix to apply in the **partner app** codebase (the one serving port 3000)

In the JavaScript that runs on `impactlog-partner.html` (and any similar pages that call these APIs):

1. **Before calling `.json()`**, check the response:
   - If `!response.ok` (e.g. 401, 403) or `Content-Type` is not JSON, **do not** call `.json()`.
   - Redirect to the partner sign-in page (e.g. `window.location.href = '/partner-signin'`) and return.
2. **Centralize fetch logic** in a helper, for example:

```javascript
async function apiFetch(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok || !contentType.includes('application/json')) {
    window.location.href = '/partner-signin';
    throw new Error('Unauthorized');
  }
  return res.json();
}
```

Then use `apiFetch('/api/me')`, `apiFetch('/api/impact/my-stats')`, etc., instead of raw `fetch(...).then(r => r.json())`.

3. **Fix `signin.js`** so the code that calls `addEventListener` only runs when the target element exists (e.g. check for `null` or ensure the script runs only on the sign-in page).

### Optional: backend (port 3000)

- Prefer returning **401** with a JSON body like `{ "error": "Unauthorized" }` for API routes when the user is not logged in, instead of redirecting to HTML. Then the client can do `if (!response.ok) { redirect to partner-signin; return; }` and then `response.json()` only when `response.ok`.

---

## Summary

| URL | In this repo? | Status | Action |
|-----|----------------|--------|--------|
| `http://localhost:4176/app/impact` | Yes (Man-tier-v2) | OK | None; log in then open `/app/impact`. |
| `http://localhost:3000/impactlog-partner.html` | No (partner app elsewhere) | Fails when not logged in | In partner app: check response before `.json()`, redirect to partner-signin on non-JSON/401; fix signin.js DOM reference. |
