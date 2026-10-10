export type TrackStatus = "pending" | "queued" | "playing" | "played" | "passed";

export type Accent = "amber" | "bone" | "oxblood";

export type Position = "left" | "center" | "right";

export type TrackSource = "form" | "facebook" | "youtube" | "booth";

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
  fbId: string | null;
  ytId: string | null;
  commentId: string | null;
  tipCents: number;
  source: TrackSource;
};

export type Block = {
  name: string;
  fbId: string | null;
  ytId: string | null;
};

export type Settings = {
  venueName: string;
  accent: Accent;
  position: Position;
  showRequester: boolean;
  showUpNext: boolean;
  refusedWords: string;
};

export type Show = {
  settings: Settings;
  tracks: Track[];
  blocked: Block[];
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
  refusedWords: "",
};

export function emptyShow(): Show {
  return { settings: { ...defaultSettings }, tracks: [], blocked: [] };
}
