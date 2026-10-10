import { promises as fs } from "fs";
import path from "path";
import type { Show, Track } from "./types";

const dir = path.join(process.cwd(), "data", "nights");

export type NightSong = {
  title: string;
  artist: string;
  requester: string;
  status: Track["status"];
  tipCents: number;
  source: Track["source"];
};

export type NightRecord = {
  id: string;
  endedAt: number;
  venueName: string;
  tipCents: number;
  requests: number;
  played: number;
  passed: number;
  blocked: { name: string; facebook: boolean; youtube: boolean }[];
  songs: NightSong[];
};

type StoredNight = {
  id: string;
  endedAt: number;
  venueName: string;
  tracks: Track[];
  blocked: unknown;
};

export async function archiveNight(show: Show): Promise<void> {
  const night: StoredNight = {
    id: crypto.randomUUID(),
    endedAt: Date.now(),
    venueName: show.settings.venueName,
    tracks: show.tracks,
    blocked: show.blocked ?? [],
  };
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${night.endedAt}-${night.id}.json`), JSON.stringify(night, null, 2));
}

function present(night: StoredNight): NightRecord {
  const tracks = Array.isArray(night.tracks) ? night.tracks : [];
  return {
    id: night.id,
    endedAt: night.endedAt,
    venueName: night.venueName || "Setlist",
    tipCents: tracks.reduce((sum, track) => sum + (track.tipCents || 0), 0),
    requests: tracks.length,
    played: tracks.filter((track) => track.status === "played").length,
    passed: tracks.filter((track) => track.status === "passed").length,
    blocked: (Array.isArray(night.blocked) ? night.blocked : []).flatMap((person) => {
      if (typeof person === "string" && person.trim()) return [{ name: person, facebook: false, youtube: false }];
      if (!person || typeof person !== "object") return [];
      const record = person as { name?: unknown; fbId?: unknown; ytId?: unknown };
      if (typeof record.name !== "string") return [];
      return [
        {
          name: record.name,
          facebook: typeof record.fbId === "string" && record.fbId.length > 0,
          youtube: typeof record.ytId === "string" && record.ytId.length > 0,
        },
      ];
    }),
    songs: tracks.map((track) => ({
      title: track.title,
      artist: track.artist,
      requester: track.requester,
      status: track.status,
      tipCents: track.tipCents || 0,
      source: track.source || "form",
    })),
  };
}

export async function listNights(): Promise<NightRecord[]> {
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const nights: NightRecord[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(dir, name), "utf8")) as StoredNight;
      if (!parsed?.id || typeof parsed.endedAt !== "number") continue;
      nights.push(present(parsed));
    } catch {
      // Skip a record that cannot be read.
    }
  }
  return nights.sort((a, b) => b.endedAt - a.endedAt).slice(0, 40);
}
