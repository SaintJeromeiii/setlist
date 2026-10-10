import type { Settings, Show, Track } from "./types";

const LIMITS = { title: 80, artist: 80, requester: 40, venue: 40 };

export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function cleanArt(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function view(show: Show) {
  const pending = show.tracks
    .filter((track) => track.status === "pending")
    .sort((a, b) => a.createdAt - b.createdAt);
  const queue = show.tracks
    .filter((track) => track.status === "queued")
    .sort((a, b) => a.order - b.order);
  const nowPlaying = show.tracks.find((track) => track.status === "playing") ?? null;
  const upNext = queue[0] ?? null;
  const recent = show.tracks
    .filter((track) => track.status === "played")
    .sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0))
    .slice(0, 8);
  return { ...show, pending, queue, nowPlaying, upNext, recent };
}

function trimHistory(show: Show): Show {
  const played = show.tracks
    .filter((track) => track.status === "played")
    .sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0));
  const passed = show.tracks
    .filter((track) => track.status === "passed")
    .sort((a, b) => b.createdAt - a.createdAt);
  const drop = new Set([
    ...played.slice(30).map((track) => track.id),
    ...passed.slice(20).map((track) => track.id),
  ]);
  if (drop.size === 0) return show;
  return { ...show, tracks: show.tracks.filter((track) => !drop.has(track.id)) };
}

function finishCurrent(show: Show, now: number): Track[] {
  return show.tracks.map((track) =>
    track.status === "playing" ? { ...track, status: "played" as const, playedAt: now } : track,
  );
}

export function addTrack(
  show: Show,
  input: { title?: unknown; artist?: unknown; requester?: unknown; artUrl?: unknown },
  destination: "pending" | "queued" | "playing",
): Show {
  const title = cleanText(input.title, LIMITS.title);
  const artist = cleanText(input.artist, LIMITS.artist);
  if (!title || !artist) {
    throw new Error("A song needs a title and an artist.");
  }
  const requester =
    cleanText(input.requester, LIMITS.requester) ||
    (destination === "pending" ? "A listener" : "Booth");
  const now = Date.now();
  const order = destination === "pending" ? now : nextOrder(show);
  const track: Track = {
    id: crypto.randomUUID(),
    title,
    artist,
    requester,
    artUrl: cleanArt(input.artUrl),
    status: destination,
    createdAt: now,
    order,
    playedAt: null,
  };
  let tracks = show.tracks;
  if (destination === "playing") tracks = finishCurrent(show, now);
  return trimHistory({ ...show, tracks: [...tracks, track] });
}

function nextOrder(show: Show): number {
  const queued = show.tracks.filter((track) => track.status === "queued");
  if (queued.length === 0) return Date.now();
  return Math.max(...queued.map((track) => track.order)) + 1;
}

function update(show: Show, id: string, change: (track: Track) => Track): Show {
  let found = false;
  const tracks = show.tracks.map((track) => {
    if (track.id !== id) return track;
    found = true;
    return change(track);
  });
  if (!found) throw new Error("That song is no longer in the set.");
  return trimHistory({ ...show, tracks });
}

export function approve(show: Show, id: string): Show {
  return update(show, id, (track) => {
    if (track.status !== "pending") return track;
    return { ...track, status: "queued", order: nextOrder(show) };
  });
}

export function pass(show: Show, id: string): Show {
  return update(show, id, (track) =>
    track.status === "pending" ? { ...track, status: "passed" } : track,
  );
}

export function play(show: Show, id: string): Show {
  const target = show.tracks.find((track) => track.id === id);
  if (!target || (target.status !== "queued" && target.status !== "pending")) {
    throw new Error("Only a waiting song can take the stage.");
  }
  const now = Date.now();
  const tracks = finishCurrent(show, now).map((track) =>
    track.id === id ? { ...track, status: "playing" as const } : track,
  );
  return trimHistory({ ...show, tracks });
}

export function nextTrack(show: Show): Show {
  const now = Date.now();
  const queue = show.tracks
    .filter((track) => track.status === "queued")
    .sort((a, b) => a.order - b.order);
  const upcoming = queue[0];
  const tracks = finishCurrent(show, now).map((track) =>
    upcoming && track.id === upcoming.id ? { ...track, status: "playing" as const } : track,
  );
  return trimHistory({ ...show, tracks });
}

export function move(show: Show, id: string, direction: -1 | 1): Show {
  const queue = show.tracks
    .filter((track) => track.status === "queued")
    .sort((a, b) => a.order - b.order);
  const index = queue.findIndex((track) => track.id === id);
  const swap = index + direction;
  if (index < 0 || swap < 0 || swap >= queue.length) return show;
  const current = queue[index];
  const neighbor = queue[swap];
  return {
    ...show,
    tracks: show.tracks.map((track) => {
      if (track.id === current.id) return { ...track, order: neighbor.order };
      if (track.id === neighbor.id) return { ...track, order: current.order };
      return track;
    }),
  };
}

export function removeTrack(show: Show, id: string): Show {
  const target = show.tracks.find((track) => track.id === id);
  if (!target || target.status === "playing" || target.status === "played") return show;
  return { ...show, tracks: show.tracks.filter((track) => track.id !== id) };
}

export function updateSettings(show: Show, patch: Partial<Settings>): Show {
  const venueName = cleanText(patch.venueName ?? show.settings.venueName, LIMITS.venue) || "Setlist";
  const accent = patch.accent === "bone" || patch.accent === "oxblood" ? patch.accent : patch.accent === "amber" ? "amber" : show.settings.accent;
  const position =
    patch.position === "center" || patch.position === "right" || patch.position === "left"
      ? patch.position
      : show.settings.position;
  return {
    ...show,
    settings: {
      venueName,
      accent,
      position,
      showRequester: patch.showRequester ?? show.settings.showRequester,
      showUpNext: patch.showUpNext ?? show.settings.showUpNext,
    },
  };
}

export function practiceSet(show: Show): Show {
  const now = Date.now();
  const samples = [
    ["Golden Hour", "House Band"],
    ["Last Call", "The Night Desk"],
    ["Slow Dance", "Room Tone"],
  ];
  const tracks: Track[] = samples.map(([title, artist], index) => ({
    id: crypto.randomUUID(),
    title,
    artist,
    requester: "Practice",
    artUrl: null,
    status: index === 0 ? "playing" : "queued",
    createdAt: now + index,
    order: now + index,
    playedAt: null,
  }));
  const kept = finishCurrent(show, now).filter(
    (track) => track.status === "played" || track.status === "passed",
  );
  return { ...show, tracks: [...kept, ...tracks] };
}
