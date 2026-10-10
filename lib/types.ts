export type TrackStatus = "pending" | "queued" | "playing" | "played" | "passed";

export type Accent = "amber" | "bone" | "oxblood";

export type Position = "left" | "center" | "right";

export type Track = {
  id: string;
  title: string;
  artist: string;
  requester: string;
  artUrl: string | null;
  status: TrackStatus;
  createdAt: number;
  order: number;
  playedAt: number | null;
};

export type Settings = {
  venueName: string;
  accent: Accent;
  position: Position;
  showRequester: boolean;
  showUpNext: boolean;
};

export type Show = {
  settings: Settings;
  tracks: Track[];
};

export type PublicShow = Show & {
  nowPlaying: Track | null;
  upNext: Track | null;
  pending: Track[];
  queue: Track[];
  recent: Track[];
};

export const defaultSettings: Settings = {
  venueName: "Setlist",
  accent: "amber",
  position: "left",
  showRequester: true,
  showUpNext: true,
};

export function emptyShow(): Show {
  return { settings: { ...defaultSettings }, tracks: [] };
}
