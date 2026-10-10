import type { Show, TrackStatus } from "./types";

export type ListenerStatus = TrackStatus | "removed";

export type ListenerRequest = {
  id: string;
  title: string;
  artist: string;
  status: ListenerStatus;
};

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRequestId(value: string): boolean {
  return ID.test(value);
}

export function parseRequestIds(value: string | null): string[] {
  if (!value) return [];
  const ids = value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => ID.test(id));
  return [...new Set(ids)].slice(0, 12);
}

export function listenerView(show: Show, ids: string[]): ListenerRequest[] {
  const byId = new Map(show.tracks.map((track) => [track.id, track]));
  return ids.map((id) => {
    const track = byId.get(id);
    if (!track) return { id, title: "", artist: "", status: "removed" };
    return {
      id: track.id,
      title: track.title,
      artist: track.artist,
      status: track.status,
    };
  });
}
