import { authorized, denied } from "@/lib/auth";
import { searchCatalog } from "@/lib/catalog";
import { lookupSpotify } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await authorized(request))) return denied();
  const body = (await request.json().catch(() => null)) as {
    url?: string;
    title?: string;
    artist?: string;
  } | null;

  try {
    if (body?.url) return Response.json(await lookupSpotify(body.url));
    if (body?.title && body.artist) {
      return Response.json({ match: await searchCatalog(body.title, body.artist) });
    }
    return Response.json({ error: "Paste a Spotify song link." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not look up that song.";
    return Response.json({ error: message }, { status: 400 });
  }
}
