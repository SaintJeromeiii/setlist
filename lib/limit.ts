import { nameKey } from "./song";

const hits = new Map<string, number[]>();

const COOLDOWN = 15_000;
const WINDOW = 10 * 60 * 1000;
const BURST = 6;

export function takeListenerTurn(name: string): void {
  const key = nameKey(name);
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW);
  const last = recent[recent.length - 1] ?? 0;
  if (now - last < COOLDOWN) {
    throw new Error("Wait a few seconds before sending another.");
  }
  if (recent.length >= BURST) {
    throw new Error("That's a lot of songs from one name. Give the booth a minute.");
  }
  recent.push(now);
  hits.set(key, recent);
}
