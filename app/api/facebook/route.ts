import { authorized, denied } from "@/lib/auth";
import { disconnectFacebook, facebookStatus, findLive, savePageToken, startFacebookPoll, stopLive } from "@/lib/facebook";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  startFacebookPoll();
  if (!(await authorized(request))) return denied();
  return Response.json(await facebookStatus());
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return denied();
  const body = (await request.json().catch(() => null)) as { action?: string; token?: string } | null;
  try {
    switch (body?.action) {
      case "token":
        return Response.json(await savePageToken(body.token ?? ""));
      case "find":
        return Response.json(await findLive());
      case "stop":
        return Response.json(await stopLive());
      case "disconnect":
        return Response.json(await disconnectFacebook());
      default:
        return Response.json({ error: "Missing action." }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Facebook didn't answer.";
    return Response.json({ error: message }, { status: 400 });
  }
}
