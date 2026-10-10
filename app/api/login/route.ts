import { passwordMatches } from "@/lib/password";
import { openSession, sessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";
  if (!(await passwordMatches(password))) {
    return Response.json({ error: "That password doesn't open the booth." }, { status: 401 });
  }
  const token = await openSession();
  const response = Response.json({ ok: true });
  response.headers.set("set-cookie", sessionCookie(token));
  return response;
}
