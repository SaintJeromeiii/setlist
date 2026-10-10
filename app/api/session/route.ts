import { authorized, boothKey, denied } from "@/lib/auth";
import { phonePassword, publishPhonePassword, rotatePhonePassword } from "@/lib/password";
import { clearSessions } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (request.headers.get("x-setlist-peer") !== "booth") return denied();
  return Response.json({ key: await boothKey(), phonePassword: await publishPhonePassword() });
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return denied();
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (body?.action === "rotate-password") {
    await clearSessions();
    return Response.json({ phonePassword: await rotatePhonePassword() });
  }
  return Response.json({ ok: true, phonePassword: await phonePassword() });
}
