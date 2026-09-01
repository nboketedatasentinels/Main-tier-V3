import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.25.0";

/**
 * stripe-webhook — set impact_log_pro on profiles from subscription events.
 * Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 * Deploy with verify_jwt=false (Stripe signature verifies the caller).
 */

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    return new Response("stripe_not_configured", { status: 503 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing_signature", { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("[stripe-webhook] signature failed", err);
    return new Response("invalid_signature", { status: 400 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const setPro = async (
    userId: string | null | undefined,
    customerId: string | null | undefined,
    pro: boolean,
    subscriptionId?: string | null,
  ) => {
    if (!userId && customerId) {
      const { data } = await admin
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      userId = data?.id as string | undefined;
    }
    if (!userId) {
      console.warn("[stripe-webhook] no user for event", event.type);
      return;
    }
    const patch: Record<string, unknown> = {
      impact_log_pro: pro,
      updated_at: new Date().toISOString(),
    };
    if (customerId) patch.stripe_customer_id = customerId;
    if (subscriptionId) patch.stripe_subscription_id = subscriptionId;
    const { error } = await admin.from("profiles").update(patch).eq("id", userId);
    if (error) console.error("[stripe-webhook] profile update failed", error);
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.product !== "impact_log_pro") break;
        const userId =
          session.metadata?.supabase_user_id || session.client_reference_id;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
        await setPro(
          userId,
          typeof session.customer === "string" ? session.customer : null,
          true,
          subId,
        );
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.metadata?.product !== "impact_log_pro") break;
        const active = ["active", "trialing"].includes(sub.status);
        await setPro(
          sub.metadata?.supabase_user_id,
          typeof sub.customer === "string" ? sub.customer : null,
          event.type === "customer.subscription.deleted" ? false : active,
          sub.id,
        );
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error", err);
    return new Response("handler_error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
