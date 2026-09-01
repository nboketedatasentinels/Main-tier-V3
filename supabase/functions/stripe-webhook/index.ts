import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.25.0";

/**
 * stripe-webhook — unlock Impact Log Pro or Full Programme from subscription events.
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

  const resolveUserId = async (
    userId: string | null | undefined,
    customerId: string | null | undefined,
  ) => {
    if (userId) return userId;
    if (!customerId) return null;
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return (data?.id as string | undefined) ?? null;
  };

  const applyEntitlement = async (params: {
    userId?: string | null;
    customerId?: string | null;
    product: string;
    active: boolean;
    subscriptionId?: string | null;
  }) => {
    const userId = await resolveUserId(params.userId, params.customerId);
    if (!userId) {
      console.warn("[stripe-webhook] no user for event", event.type, params.product);
      return;
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (params.customerId) patch.stripe_customer_id = params.customerId;
    if (params.subscriptionId) patch.stripe_subscription_id = params.subscriptionId;

    if (params.product === "full_programme") {
      patch.impact_log_pro = params.active;
      if (params.active) {
        patch.membership_status = "paid";
        patch.role = "paid_member";
      } else {
        // Downgrade to free; keep impact_log_pro false with cancelled full programme
        patch.membership_status = "free";
        patch.role = "free_user";
        patch.impact_log_pro = false;
      }
    } else if (params.product === "impact_log_pro") {
      patch.impact_log_pro = params.active;
    } else {
      console.warn("[stripe-webhook] unknown product", params.product);
      return;
    }

    const { error } = await admin.from("profiles").update(patch).eq("id", userId);
    if (error) console.error("[stripe-webhook] profile update failed", error);
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const product = session.metadata?.product || "";
        if (product !== "impact_log_pro" && product !== "full_programme") break;
        const userId =
          session.metadata?.supabase_user_id || session.client_reference_id;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
        await applyEntitlement({
          userId,
          customerId: typeof session.customer === "string" ? session.customer : null,
          product,
          active: true,
          subscriptionId: subId,
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const product = sub.metadata?.product || "";
        if (product !== "impact_log_pro" && product !== "full_programme") break;
        const active =
          event.type !== "customer.subscription.deleted" &&
          ["active", "trialing"].includes(sub.status);
        await applyEntitlement({
          userId: sub.metadata?.supabase_user_id,
          customerId: typeof sub.customer === "string" ? sub.customer : null,
          product,
          active,
          subscriptionId: sub.id,
        });
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
