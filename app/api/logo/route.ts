import { authorized, denied } from "@/lib/auth";
import { readLogo, saveLogo } from "@/lib/logo";

export const dynamic = "force-dynamic";

export async function GET() {
  const logo = await readLogo();
  if (!logo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(logo.bytes), {
    headers: {
      "content-type": logo.type,
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return denied();
  const form = await request.formData().catch(() => null);
  const file = form?.get("logo");
  if (!(file instanceof File)) return Response.json({ error: "Choose a logo." }, { status: 400 });
  try {
    await saveLogo(Buffer.from(await file.arrayBuffer()), file.type);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save that logo.";
    return Response.json({ error: message }, { status: 400 });
  }
}
