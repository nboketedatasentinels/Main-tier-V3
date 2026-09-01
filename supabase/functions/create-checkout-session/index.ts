// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.25.0";

/**
 * create-checkout-session
 * Authenticated learner starts Stripe Checkout for Impact Log Pro ($5/mo).
 * Secrets: STRIPE_SECRET_KEY, STRIPE_IMPACT_LOG_PRICE_ID
 * Optional: APP_BASE_URL (fallback VITE_APP_BASE_URL style via request origin)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  const priceId = Deno.env.get("STRIPE_IMPACT_LOG_PRICE_ID");
  if (!stripeKey || !priceId) {
    return json({
      error:
        "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_IMPACT_LOG_PRICE_ID.",
    }, 503);
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
  if (body.kind && body.kind !== "impact_log_pro") {
    return json({ error: "unsupported_product" }, 400);
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

  if (profile?.impact_log_pro || profile?.membership_status === "paid") {
    return json({ error: "already_entitled" }, 400);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
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
  const successPath = (body.successPath || "/upgrade?impact_pro=success").startsWith("/")
    ? body.successPath || "/upgrade?impact_pro=success"
    : "/upgrade?impact_pro=success";
  const cancelPath = (body.cancelPath || "/upgrade?impact_pro=cancel").startsWith("/")
    ? body.cancelPath || "/upgrade?impact_pro=cancel"
    : "/upgrade?impact_pro=cancel";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appBase}${successPath}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBase}${cancelPath}`,
    client_reference_id: user.id,
    metadata: {
      supabase_user_id: user.id,
      product: "impact_log_pro",
    },
    subscription_data: {
      metadata: {
        supabase_user_id: user.id,
        product: "impact_log_pro",
      },
    },
  });

  if (!session.url) return json({ error: "no_checkout_url" }, 500);
  return json({ url: session.url });
});
