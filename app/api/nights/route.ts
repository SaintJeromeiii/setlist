import { authorized, denied } from "@/lib/auth";
import { listNights } from "@/lib/nights";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await authorized(request))) return denied();
  return Response.json({ nights: await listNights() });
}
