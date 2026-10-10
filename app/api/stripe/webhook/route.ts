import { applyCheckout } from "@/lib/tips";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

const KEPT = new Set([
  "A song needs a title and an artist.",
  "A song needs your name.",
  "The booth isn't taking requests from this name.",
  "Take that language out of the request.",
  "The booth is full. Try again in a little while.",
  "The booth still has 3 of your songs.",
  "That's on stage right now.",
  "That's already in the queue.",
  "Someone already asked for that.",
  "Already heard that.",
  "That song is no longer in the set.",
]);

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) return Response.json({ error: "Tips aren't turned on yet." }, { status: 400 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });
  const body = await request.text();
  const { default: StripeClient } = await import("stripe");
  const client = new StripeClient(key);
  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(body, signature, secret);
  } catch {
    return Response.json({ error: "That signature doesn't match." }, { status: 400 });
  }
  if (event.type === "checkout.session.completed") {
    try {
      await applyCheckout(event.data.object as Stripe.Checkout.Session);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      console.error(message || error);
      if (!KEPT.has(message)) return Response.json({ error: "Could not record that tip." }, { status: 500 });
    }
  }
  return Response.json({ received: true });
}
