import { isTip } from "@/lib/money";
import { readShow } from "@/lib/store";
import { checkoutUrl, stripeReady } from "@/lib/tips";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: string; tipCents?: number } | null;
  if (!body?.id) return Response.json({ error: "Missing request." }, { status: 400 });
  const tipCents = Number(body.tipCents);
  if (!stripeReady()) return Response.json({ error: "Tips aren't turned on yet." }, { status: 400 });
  if (!isTip(tipCents)) return Response.json({ error: "Choose $2, $5, or $10." }, { status: 400 });
  const show = await readShow();
  const track = show.tracks.find((item) => item.id === body.id);
  if (!track) return Response.json({ error: "That song is no longer in the set." }, { status: 404 });
  if (track.status === "played" || track.status === "passed") {
    return Response.json({ error: "That song has already left the booth." }, { status: 400 });
  }
  try {
    const url = await checkoutUrl({
      title: track.title,
      artist: track.artist,
      requester: track.requester,
      tipCents,
      trackId: track.id,
      request,
    });
    return Response.json({ checkoutUrl: url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not open the tip.";
    return Response.json({ error: message }, { status: 400 });
  }
}
