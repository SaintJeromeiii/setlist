import { logoStamp } from "./logo";
import { stripeReady } from "./tips";
import { view } from "./show";
import type { Settings, Show, Track } from "./types";

export type BoardTrack = {
  title: string;
  artist: string;
  requester: string | null;
  artUrl: string | null;
};

export type Board = {
  venueName: string;
  accent: Settings["accent"];
  position: Settings["position"];
  skin: Settings["skin"];
  showRequester: boolean;
  showUpNext: boolean;
  nowPlaying: BoardTrack | null;
  upNext: BoardTrack | null;
  queue: BoardTrack[];
  tips: boolean;
  logoStamp: number;
};

function card(track: Track | null, showRequester: boolean): BoardTrack | null {
  if (!track) return null;
  return {
    title: track.title,
    artist: track.artist,
    requester: showRequester ? track.requester : null,
    artUrl: track.artUrl,
  };
}

export function board(show: Show): Board {
  const seen = view(show);
  const showRequester = seen.settings.showRequester;
  return {
    venueName: seen.settings.venueName,
    accent: seen.settings.accent,
    position: seen.settings.position,
    skin: seen.settings.skin,
    showRequester,
    showUpNext: seen.settings.showUpNext,
    nowPlaying: card(seen.nowPlaying, showRequester),
    upNext: seen.settings.showUpNext ? card(seen.upNext, showRequester) : null,
    queue: seen.queue.slice(0, 12).map((track) => card(track, showRequester)!),
    tips: stripeReady(),
    logoStamp: logoStamp(),
  };
}
