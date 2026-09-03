// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.25.0";

/**
 * create-checkout-session
 * Authenticated learner starts Stripe Checkout for:
 *   - impact_log_pro ($5/month · Impact Log Pro — Monthly) — STRIPE_IMPACT_LOG_PRICE_ID
 *   - full_programme ($50/year · Impact Log Pro — Annual) — STRIPE_FULL_PROGRAMME_PRICE_ID
 * Secrets: STRIPE_SECRET_KEY + the price id for the requested kind
 * Optional: APP_BASE_URL
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CheckoutKind = "impact_log_pro" | "full_programme";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return json({ error: "Stripe is not configured. Set STRIPE_SECRET_KEY." }, 503);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "missing_auth" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);
  const user = userData.user;

  let body: { kind?: string; successPath?: string; cancelPath?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const kind = (body.kind || "impact_log_pro") as CheckoutKind;
  if (kind !== "impact_log_pro" && kind !== "full_programme") {
    return json({ error: "unsupported_product" }, 400);
  }

  const priceId =
    kind === "full_programme"
      ? Deno.env.get("STRIPE_FULL_PROGRAMME_PRICE_ID")
      : Deno.env.get("STRIPE_IMPACT_LOG_PRICE_ID");
  if (!priceId) {
    return json({
      error:
        kind === "full_programme"
          ? "Stripe Impact Log Pro — Annual price is not configured. Set STRIPE_FULL_PROGRAMME_PRICE_ID."
          : "Stripe Impact Log Pro price is not configured. Set STRIPE_IMPACT_LOG_PRICE_ID.",
    }, 503);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name, stripe_customer_id, impact_log_pro, membership_status, role")
    .eq("id", user.id)
    .maybeSingle();

  const isPaid =
    profile?.membership_status === "paid" ||
    String(profile?.role || "").toLowerCase() === "paid_member";

  if (kind === "full_programme" && isPaid) {
    return json({ error: "already_entitled" }, 400);
  }
  if (
    kind === "impact_log_pro" &&
    (profile?.impact_log_pro || isPaid)
  ) {
    return json({ error: "already_entitled" }, 400);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

  // Hard-guard billing periods so misconfigured secrets cannot charge customers wrong.
  // Impact Log Pro — Monthly = 1 month. Impact Log Pro — Annual = 12 months (yearly).
  const expectedInterval = kind === "full_programme" ? "year" : "month";
  const expectedAmount = kind === "full_programme" ? 5000 : 500; // cents
  const price = await stripe.prices.retrieve(priceId);
  const interval = price.recurring?.interval;
  if (
    !price.active ||
    interval !== expectedInterval ||
    price.unit_amount !== expectedAmount ||
    price.currency !== "usd"
  ) {
    console.error("[create-checkout-session] price misconfigured", {
      kind,
      priceId,
      active: price.active,
      interval,
      unit_amount: price.unit_amount,
      currency: price.currency,
      expectedInterval,
      expectedAmount,
    });
    return json({
      error:
        kind === "full_programme"
          ? "Impact Log Pro — Annual checkout is misconfigured. Expected $50 USD billed yearly (12 months)."
          : "Impact Log Pro checkout is misconfigured. Expected $5 USD billed monthly (1 month).",
    }, 503);
  }

  let customerId =
    typeof profile?.stripe_customer_id === "string"
      ? profile.stripe_customer_id
      : null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email || user.email || undefined,
      name: typeof profile?.full_name === "string" ? profile.full_name : undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const appBase = (Deno.env.get("APP_BASE_URL") || "https://app.t4leader.com").replace(
    /\/$/,
    "",
  );
  const defaultSuccess =
    kind === "full_programme"
      ? "/upgrade?full_programme=success"
      : "/upgrade?impact_pro=success";
  const defaultCancel =
    kind === "full_programme"
      ? "/upgrade?full_programme=cancel"
      : "/upgrade?impact_pro=cancel";
  const successPath = (body.successPath || defaultSuccess).startsWith("/")
    ? body.successPath || defaultSuccess
    : defaultSuccess;
  const cancelPath = (body.cancelPath || defaultCancel).startsWith("/")
    ? body.cancelPath || defaultCancel
    : defaultCancel;

  const accessMonths = kind === "full_programme" ? "12" : "1";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appBase}${successPath}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBase}${cancelPath}`,
    client_reference_id: user.id,
    metadata: {
      supabase_user_id: user.id,
      product: kind,
      access_months: accessMonths,
    },
    subscription_data: {
      metadata: {
        supabase_user_id: user.id,
        product: kind,
        access_months: accessMonths,
      },
    },
  });

  if (!session.url) return json({ error: "no_checkout_url" }, 500);
  return json({ url: session.url });
});
