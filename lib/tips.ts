import { isTip } from "./money";
import { publicOrigin } from "./network";
import { requestTrack, setTip } from "./show";
import { updateShow } from "./store";
import type Stripe from "stripe";

export function stripeReady(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

async function stripe(): Promise<Stripe> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !stripeReady()) throw new Error("Tips aren't turned on yet.");
  const { default: StripeClient } = await import("stripe");
  return new StripeClient(key);
}

export async function checkoutUrl(input: {
  title: string;
  artist: string;
  requester: string;
  tipCents: number;
  trackId?: string;
  request: Request;
}): Promise<string> {
  if (!isTip(input.tipCents)) throw new Error("Choose $2, $5, or $10.");
  const client = await stripe();
  const origin = publicOrigin(input.request);
  const session = await client.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.tipCents,
          product_data: {
            name: `Tip · ${input.title}`,
            description: input.artist,
          },
        },
      },
    ],
    metadata: {
      title: input.title,
      artist: input.artist,
      requester: input.requester,
      tipCents: String(input.tipCents),
      trackId: input.trackId ?? "",
    },
    success_url: input.trackId
      ? `${origin}/request/${input.trackId}?tipped=1`
      : `${origin}/request/thanks`,
    cancel_url: input.trackId ? `${origin}/request/${input.trackId}` : `${origin}/request`,
  });
  if (!session.url) throw new Error("Stripe didn't open a checkout.");
  return session.url;
}

export async function applyCheckout(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== "paid" && session.status !== "complete") return;
  const metadata = session.metadata ?? {};
  const tipCents = Number(metadata.tipCents);
  if (!isTip(tipCents)) return;
  const trackId = metadata.trackId ?? "";
  await updateShow((show) => {
    if (trackId) return setTip(show, trackId, tipCents);
    return requestTrack(
      show,
      { title: metadata.title, artist: metadata.artist, requester: metadata.requester },
      { tipCents, source: "form" },
    );
  });
}
