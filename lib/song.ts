import type { Show, Track } from "./types";

export function nameKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function songKey(title: string, artist: string): string {
  const norm = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${norm(title)}\n${norm(artist)}`;
}

export function clashNote(show: Show, track: Track): string | null {
  if (track.status !== "pending") return null;
  const key = songKey(track.title, track.artist);
  const match = show.tracks.find(
    (other) =>
      other.id !== track.id &&
      (other.status === "playing" || other.status === "queued") &&
      songKey(other.title, other.artist) === key,
  );
  if (!match) return null;
  return match.status === "playing" ? "On stage now" : "Already in the queue";
}
