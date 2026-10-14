import { randomBytes, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { dataDir } from "./paths";
import { sessionAuthorized } from "./session";

const file = path.join(dataDir(), "booth.key");

let cached: string | null = null;

export async function boothKey(): Promise<string> {
  if (cached) return cached;
  try {
    const existing = (await fs.readFile(file, "utf8")).trim();
    if (existing) {
      cached = existing;
      return existing;
    }
  } catch {
    // The key file is created on first use.
  }
  const created = randomBytes(24).toString("base64url");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, created, { mode: 0o600 });
  cached = created;
  return created;
}

export async function authorized(request: Request): Promise<boolean> {
  if (await sessionAuthorized(request)) return true;
  const provided = request.headers.get("x-booth-key") ?? "";
  const expected = await boothKey();
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function denied(): Response {
  return Response.json({ error: "The booth is locked." }, { status: 401 });
}
