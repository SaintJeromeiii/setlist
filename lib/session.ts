import { randomBytes, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { dataDir } from "./paths";

const file = path.join(dataDir(), "sessions.json");
const COOKIE = "setlist_phone";

let chain: Promise<unknown> = Promise.resolve();

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function read(): Promise<string[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === "string");
  } catch {
    return [];
  }
}

async function write(tokens: string[]): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(tokens), { mode: 0o600 });
}

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function same(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function sessionAuthorized(request: Request): Promise<boolean> {
  const token = readSessionCookie(request);
  if (!token) return false;
  const tokens = await read();
  return tokens.some((item) => same(item, token));
}

export function openSession(): Promise<string> {
  return locked(async () => {
    const token = randomBytes(24).toString("base64url");
    const tokens = await read();
    tokens.push(token);
    await write(tokens.slice(-20));
    return token;
  });
}

export function closeSession(token: string | null): Promise<void> {
  return locked(async () => {
    if (!token) return;
    const tokens = await read();
    await write(tokens.filter((item) => !same(item, token)));
  });
}

export function clearSessions(): Promise<void> {
  return locked(async () => {
    await write([]);
  });
}

export function sessionCookie(token: string): string {
  const secure = process.env.SETLIST_PUBLIC_URL?.trim().startsWith("https://") ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secure}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}
