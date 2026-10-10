import { clearSessionCookie, closeSession, readSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await closeSession(readSessionCookie(request));
  const response = Response.json({ ok: true });
  response.headers.set("set-cookie", clearSessionCookie());
  return response;
}
