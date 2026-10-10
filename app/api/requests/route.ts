import { listenerView, parseRequestIds } from "@/lib/requests";
import { isTip } from "@/lib/money";
import { checkRequest, requestTrack } from "@/lib/show";
import { readShow, updateShow } from "@/lib/store";
import { checkoutUrl, stripeReady } from "@/lib/tips";
import type { Track } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ids = parseRequestIds(new URL(request.url).searchParams.get("ids"));
  if (ids.length === 0) return Response.json({ requests: [] });
  const show = await readShow();
  return Response.json({ requests: listenerView(show, ids) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    artist?: string;
    requester?: string;
    tipCents?: number;
  } | null;
  if (!body) return Response.json({ error: "Missing request." }, { status: 400 });

  const tipCents = Number(body.tipCents ?? 0);
  if (tipCents > 0) {
    if (!stripeReady()) return Response.json({ error: "Tips aren't turned on yet." }, { status: 400 });
    if (!isTip(tipCents)) return Response.json({ error: "Choose $2, $5, or $10." }, { status: 400 });
    try {
      const clean = checkRequest(await readShow(), body);
      const url = await checkoutUrl({ ...clean, tipCents, request });
      return Response.json({ checkoutUrl: url });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send that request.";
      return Response.json({ error: message }, { status: 400 });
    }
  }

  try {
    const created: { track?: Track } = {};
    const show = await updateShow((current) => {
      const before = new Set(current.tracks.map((track) => track.id));
      const next = requestTrack(current, body);
      created.track = next.tracks.find((track) => !before.has(track.id));
      return next;
    });
    const track = created.track;
    if (!track) throw new Error("Could not send that request.");
    return Response.json(listenerView(show, [track.id])[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send that request.";
    return Response.json({ error: message }, { status: 400 });
  }
}
