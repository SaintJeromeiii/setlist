import { authorized, denied } from "@/lib/auth";
import { disconnectYouTube, listenToVideo, saveYouTubeKey, startYouTubePoll, stopYouTube, youtubeStatus } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  startYouTubePoll();
  if (!(await authorized(request))) return denied();
  return Response.json(await youtubeStatus());
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return denied();
  const body = (await request.json().catch(() => null)) as { action?: string; key?: string; url?: string } | null;
  try {
    switch (body?.action) {
      case "key":
        return Response.json(await saveYouTubeKey(body.key ?? ""));
      case "listen":
        return Response.json(await listenToVideo(body.url ?? ""));
      case "stop":
        return Response.json(await stopYouTube());
      case "disconnect":
        return Response.json(await disconnectYouTube());
      default:
        return Response.json({ error: "Missing action." }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "YouTube didn't answer.";
    return Response.json({ error: message }, { status: 400 });
  }
}
