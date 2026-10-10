import { addTrack, approve, move, nextTrack, pass, play, practiceSet, removeTrack, updateSettings, view } from "@/lib/show";
import { readShow, updateShow } from "@/lib/store";
import type { Accent, Position } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const show = await readShow();
  return Response.json(view(show));
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
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.action) {
    return Response.json({ error: "Missing action." }, { status: 400 });
  }

  try {
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
        case "settings":
          return updateSettings(current, body);
        case "practice":
          return practiceSet(current);
        default:
          throw new Error("Unknown action.");
      }
    });
    return Response.json(view(show));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the set.";
    return Response.json({ error: message }, { status: 400 });
  }
}
