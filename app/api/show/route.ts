import { authorized, denied } from "@/lib/auth";
import { startFacebookPoll } from "@/lib/facebook";
import { startYouTubePoll } from "@/lib/youtube";
import { logoStamp } from "@/lib/logo";
import { serviceLinks } from "@/lib/network";
import { archiveNight } from "@/lib/nights";
import { addTrack, approve, blockRequester, clearNight, move, nextTrack, pass, play, practiceSet, removeTrack, reviseTrack, unblockRequester, updateSettings, view } from "@/lib/show";
import { readShow, updateShow } from "@/lib/store";
import { stripeReady } from "@/lib/tips";
import type { Accent, Position, Show } from "@/lib/types";

export const dynamic = "force-dynamic";

function payload(show: Show) {
  return { ...view(show), links: serviceLinks(), tips: stripeReady(), logoStamp: logoStamp() };
}

export async function GET(request: Request) {
  startFacebookPoll();
  startYouTubePoll();
  if (!(await authorized(request))) return denied();
  return Response.json(payload(await readShow()));
}

type Body = {
  action?: string;
  id?: string;
  direction?: number;
  title?: string;
  artist?: string;
  requester?: string;
  artUrl?: string | null;
  destination?: "queued" | "playing";
  venueName?: string;
  accent?: Accent;
  position?: Position;
  showRequester?: boolean;
  showUpNext?: boolean;
  refusedWords?: string;
  name?: string;
};

export async function POST(request: Request) {
  if (!(await authorized(request))) return denied();
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.action) {
    return Response.json({ error: "Missing action." }, { status: 400 });
  }

  try {
    if (body.action === "end-night") {
      const current = await readShow();
      if (current.tracks.length === 0) {
        return Response.json({ error: "This night is already clear." }, { status: 400 });
      }
      await archiveNight(current);
      const show = await updateShow((night) => clearNight(night));
      return Response.json(payload(show));
    }
    const show = await updateShow((current) => {
      switch (body.action) {
        case "add":
          return addTrack(
            current,
            body,
            body.destination === "playing" ? "playing" : "queued",
          );
        case "approve":
          return approve(current, body.id ?? "");
        case "pass":
          return pass(current, body.id ?? "");
        case "play":
          return play(current, body.id ?? "");
        case "next":
          return nextTrack(current);
        case "move":
          return move(current, body.id ?? "", body.direction === -1 ? -1 : 1);
        case "remove":
          return removeTrack(current, body.id ?? "");
        case "block":
          return blockRequester(current, body.id ?? "");
        case "unblock":
          return unblockRequester(current, body.name ?? "");
        case "revise":
          return reviseTrack(current, body.id ?? "", body);
        case "settings":
          return updateSettings(current, body);
        case "practice":
          return practiceSet(current);
        default:
          throw new Error("Unknown action.");
      }
    });
    return Response.json(payload(show));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the set.";
    return Response.json({ error: message }, { status: 400 });
  }
}
