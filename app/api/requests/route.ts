import { addTrack, view } from "@/lib/show";
import { updateShow } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    artist?: string;
    requester?: string;
  } | null;
  if (!body) return Response.json({ error: "Missing request." }, { status: 400 });

  try {
    const show = await updateShow((current) => addTrack(current, { ...body, artUrl: null }, "pending"));
    return Response.json(view(show));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send that request.";
    return Response.json({ error: message }, { status: 400 });
  }
}
