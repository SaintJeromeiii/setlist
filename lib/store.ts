import { promises as fs } from "fs";
import path from "path";
import { dataDir } from "./paths";
import { defaultSettings, emptyShow, type Block, type Show, type Track, type TrackSource } from "./types";

const file = path.join(dataDir(), "show.json");

let chain: Promise<unknown> = Promise.resolve();

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function asSource(value: unknown): TrackSource {
  if (value === "facebook" || value === "youtube" || value === "form" || value === "booth") return value;
  return "form";
}

function asTrack(track: Track): Track {
  return {
    ...track,
    fbId: typeof track.fbId === "string" ? track.fbId : null,
    ytId: typeof track.ytId === "string" ? track.ytId : null,
    commentId: typeof track.commentId === "string" ? track.commentId : null,
    tipCents: typeof track.tipCents === "number" && track.tipCents > 0 ? Math.round(track.tipCents) : 0,
    source: asSource(track.source),
  };
}

function asBlocks(value: unknown): Block[] {
  if (!Array.isArray(value)) return [];
  const blocks: Block[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      blocks.push({ name: item, fbId: null, ytId: null });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as { name?: unknown; fbId?: unknown; ytId?: unknown };
    if (typeof record.name !== "string" || !record.name.trim()) continue;
    blocks.push({
      name: record.name,
      fbId: typeof record.fbId === "string" ? record.fbId : null,
      ytId: typeof record.ytId === "string" ? record.ytId : null,
    });
  }
  return blocks;
}

async function read(): Promise<Show> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Show;
    if (!parsed || !parsed.settings || !Array.isArray(parsed.tracks)) return emptyShow();
    return {
      ...parsed,
      settings: { ...defaultSettings, ...parsed.settings },
      tracks: parsed.tracks.map((track) => asTrack(track)),
      blocked: asBlocks(parsed.blocked),
    };
  } catch {
    return emptyShow();
  }
}

async function write(show: Show): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(show, null, 2));
}

export function updateShow(change: (show: Show) => Show): Promise<Show> {
  return locked(async () => {
    const show = change(await read());
    await write(show);
    return show;
  });
}

export function readShow(): Promise<Show> {
  return locked(() => read());
}
