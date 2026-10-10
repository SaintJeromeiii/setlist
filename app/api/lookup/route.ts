import { lookupSpotify } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  if (!body?.url) return Response.json({ error: "Paste a Spotify song link." }, { status: 400 });

  try {
    const track = await lookupSpotify(body.url);
    return Response.json(track);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not look up that song.";
    return Response.json({ error: message }, { status: 400 });
  }
}
