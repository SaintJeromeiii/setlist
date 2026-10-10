import { refusesLanguage } from "./language";
import { takeListenerTurn } from "./limit";
import { nameKey, songKey } from "./song";
import type { Settings, Show, Track } from "./types";

const LIMITS = { title: 80, artist: 80, requester: 40, venue: 40, refused: 200 };

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
    .sort((a, b) => b.tipCents - a.tipCents || a.createdAt - b.createdAt);
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

type Incoming = {
  title?: unknown;
  artist?: unknown;
  requester?: unknown;
  artUrl?: unknown;
  fbId?: string | null;
  ytId?: string | null;
  commentId?: string | null;
  tipCents?: number;
  source?: Track["source"];
};

export function addTrack(show: Show, input: Incoming, destination: "pending" | "queued" | "playing"): Show {
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
  const tipCents = typeof input.tipCents === "number" && input.tipCents > 0 ? Math.round(input.tipCents) : 0;
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
    fbId: input.fbId ?? null,
    ytId: input.ytId ?? null,
    commentId: input.commentId ?? null,
    tipCents,
    source: input.source ?? (destination === "pending" ? "form" : "booth"),
  };
  let tracks = show.tracks;
  if (destination === "playing") tracks = finishCurrent(show, now);
  return trimHistory({ ...show, tracks: [...tracks, track] });
}

const PENDING_PER_NAME = 3;
const PENDING_ROOM = 40;

type RequestOptions = {
  fbId?: string | null;
  ytId?: string | null;
  commentId?: string | null;
  tipCents?: number;
  source?: Track["source"];
  skipTurn?: boolean;
};

export function checkRequest(
  show: Show,
  input: { title?: unknown; artist?: unknown; requester?: unknown },
  options?: { fbId?: string | null; ytId?: string | null; commentId?: string | null },
): { title: string; artist: string; requester: string } {
  const title = cleanText(input.title, LIMITS.title);
  const artist = cleanText(input.artist, LIMITS.artist);
  const requester = cleanText(input.requester, LIMITS.requester);
  if (!title || !artist) throw new Error("A song needs a title and an artist.");
  if (!requester) throw new Error("A song needs your name.");
  const blocked = show.blocked ?? [];
  if (blocked.some((person) => nameKey(person.name) === nameKey(requester))) {
    throw new Error("The booth isn't taking requests from this name.");
  }
  if (options?.fbId && blocked.some((person) => person.fbId && person.fbId === options.fbId)) {
    throw new Error("The booth isn't taking requests from this name.");
  }
  if (options?.ytId && blocked.some((person) => person.ytId && person.ytId === options.ytId)) {
    throw new Error("The booth isn't taking requests from this name.");
  }
  const refused = show.settings.refusedWords ?? "";
  if (
    refusesLanguage(title, refused) ||
    refusesLanguage(artist, refused) ||
    refusesLanguage(requester, refused)
  ) {
    throw new Error("Take that language out of the request.");
  }
  if (options?.commentId && show.tracks.some((track) => track.commentId === options.commentId)) {
    throw new Error("Already heard that.");
  }

  const pending = show.tracks.filter((track) => track.status === "pending");
  if (pending.length >= PENDING_ROOM) {
    throw new Error("The booth is full. Try again in a little while.");
  }
  const mine = pending.filter((track) => {
    if (options?.fbId && track.fbId === options.fbId) return true;
    if (options?.ytId && track.ytId === options.ytId) return true;
    return nameKey(track.requester) === nameKey(requester);
  }).length;
  if (mine >= PENDING_PER_NAME) throw new Error("The booth still has 3 of your songs.");

  const key = songKey(title, artist);
  const live = show.tracks.find(
    (track) =>
      (track.status === "pending" || track.status === "queued" || track.status === "playing") &&
      songKey(track.title, track.artist) === key,
  );
  if (live?.status === "playing") throw new Error("That's on stage right now.");
  if (live?.status === "queued") throw new Error("That's already in the queue.");
  if (live?.status === "pending") throw new Error("Someone already asked for that.");
  return { title, artist, requester };
}

export function requestTrack(
  show: Show,
  input: { title?: unknown; artist?: unknown; requester?: unknown },
  options?: RequestOptions,
): Show {
  const clean = checkRequest(show, input, options);
  if (!options?.skipTurn) takeListenerTurn(clean.requester);
  return addTrack(
    show,
    {
      ...clean,
      artUrl: null,
      fbId: options?.fbId ?? null,
      ytId: options?.ytId ?? null,
      commentId: options?.commentId ?? null,
      tipCents: options?.tipCents ?? 0,
      source: options?.source ?? "form",
    },
    "pending",
  );
}

export function reviseTrack(
  show: Show,
  id: string,
  input: { title?: unknown; artist?: unknown; artUrl?: unknown },
): Show {
  return update(show, id, (track) => {
    if (track.status === "played" || track.status === "passed") return track;
    const title = cleanText(input.title, LIMITS.title) || track.title;
    const artist = cleanText(input.artist, LIMITS.artist) || track.artist;
    return { ...track, title, artist, artUrl: cleanArt(input.artUrl) ?? track.artUrl };
  });
}

function nextOrder(show: Show): number {
  const queued = show.tracks.filter((track) => track.status === "queued");
  if (queued.length === 0) return Date.now();
  return Math.max(...queued.map((track) => track.order)) + 1;
}

function orderForTip(show: Show, tipCents: number): number {
  const queued = show.tracks
    .filter((track) => track.status === "queued")
    .sort((a, b) => a.order - b.order);
  if (queued.length === 0) return Date.now();
  const ahead = queued.filter((track) => track.tipCents >= tipCents);
  const behind = queued.filter((track) => track.tipCents < tipCents);
  if (behind.length === 0) return queued[queued.length - 1].order + 1;
  const floor = ahead.length > 0 ? ahead[ahead.length - 1].order : null;
  const ceiling = behind[0].order;
  if (floor === null) return ceiling - 1;
  if (floor < ceiling) return (floor + ceiling) / 2;
  return ceiling - 1;
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
    return { ...track, status: "queued", order: orderForTip(show, track.tipCents) };
  });
}

export function setTip(show: Show, id: string, tipCents: number): Show {
  const target = show.tracks.find((track) => track.id === id);
  if (!target) throw new Error("That song is no longer in the set.");
  const amount = tipCents > 0 ? Math.round(tipCents) : 0;
  const tipped = { ...target, tipCents: amount };
  if (target.status !== "queued") {
    return { ...show, tracks: show.tracks.map((track) => (track.id === id ? tipped : track)) };
  }
  const parked: Show = {
    ...show,
    tracks: show.tracks.map((track) => (track.id === id ? { ...tipped, status: "pending" } : track)),
  };
  return approve(parked, id);
}

export function clearNight(show: Show): Show {
  return { ...show, tracks: [] };
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

export function blockRequester(show: Show, id: string): Show {
  const target = show.tracks.find((track) => track.id === id);
  if (!target) throw new Error("That song is no longer in the set.");
  const key = nameKey(target.requester);
  if (!key) throw new Error("That name stays open.");
  const blocked = (show.blocked ?? []).filter((person) => nameKey(person.name) !== key);
  const previous = (show.blocked ?? []).find((person) => nameKey(person.name) === key);
  blocked.push({
    name: target.requester,
    fbId: target.fbId ?? previous?.fbId ?? null,
    ytId: target.ytId ?? previous?.ytId ?? null,
  });
  return {
    ...show,
    blocked,
    tracks: show.tracks.filter((track) => {
      if (track.status !== "pending") return true;
      if (nameKey(track.requester) === key) return false;
      if (target.fbId && track.fbId === target.fbId) return false;
      if (target.ytId && track.ytId === target.ytId) return false;
      return true;
    }),
  };
}

export function unblockRequester(show: Show, name: string): Show {
  const key = nameKey(name);
  return {
    ...show,
    blocked: (show.blocked ?? []).filter((person) => nameKey(person.name) !== key),
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
      refusedWords: cleanText(patch.refusedWords ?? show.settings.refusedWords ?? "", LIMITS.refused),
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
    fbId: null,
    ytId: null,
    commentId: null,
    tipCents: 0,
    source: "booth",
  }));
  const kept = finishCurrent(show, now).filter(
    (track) => track.status === "played" || track.status === "passed",
  );
  return { ...show, tracks: [...kept, ...tracks] };
}
