import { promises as fs } from "fs";
import path from "path";
import { parseSongComment } from "./comment";
import { requestTrack } from "./show";
import { updateShow } from "./store";

const file = path.join(process.cwd(), "data", "youtube.json");

type YouTubeState = {
  apiKey: string;
  videoId: string;
  liveChatId: string;
  title: string;
  channelTitle: string;
  connectedAt: number;
  pageToken: string;
  seen: string[];
  lastError: string;
  lastPollAt: number;
  waitMs: number;
};

export type YouTubePublic = {
  hasKey: boolean;
  keyFromEnv: boolean;
  listening: boolean;
  title: string;
  channelTitle: string;
  videoId: string;
  lastError: string;
  lastPollAt: number;
};

type GoogleError = { error?: { message?: string; errors?: { reason?: string }[] } };
type VideoItem = {
  snippet?: { title?: string; channelTitle?: string };
  liveStreamingDetails?: { activeLiveChatId?: string };
};
type ChatItem = {
  id?: string;
  snippet?: {
    type?: string;
    publishedAt?: string;
    displayMessage?: string;
    textMessageDetails?: { messageText?: string };
    superChatDetails?: { userComment?: string };
  };
  authorDetails?: { channelId?: string; displayName?: string };
};
type ChatPage = GoogleError & {
  nextPageToken?: string;
  pollingIntervalMillis?: number;
  items?: ChatItem[];
};

const empty = (): YouTubeState => ({
  apiKey: "",
  videoId: "",
  liveChatId: "",
  title: "",
  channelTitle: "",
  connectedAt: 0,
  pageToken: "",
  seen: [],
  lastError: "",
  lastPollAt: 0,
  waitMs: 12000,
});

let chain: Promise<unknown> = Promise.resolve();

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readYouTube(): Promise<YouTubeState> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as Partial<YouTubeState>;
    return {
      ...empty(),
      ...parsed,
      seen: Array.isArray(parsed.seen) ? parsed.seen.filter((id) => typeof id === "string") : [],
    };
  } catch {
    return empty();
  }
}

async function writeYouTube(state: YouTubeState): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(state), { mode: 0o600 });
}

function activeKey(state: YouTubeState): string {
  return process.env.YOUTUBE_API_KEY?.trim() || state.apiKey;
}

function present(state: YouTubeState): YouTubePublic {
  const envKey = Boolean(process.env.YOUTUBE_API_KEY?.trim());
  return {
    hasKey: envKey || Boolean(state.apiKey),
    keyFromEnv: envKey,
    listening: Boolean(state.liveChatId),
    title: state.title,
    channelTitle: state.channelTitle,
    videoId: state.videoId,
    lastError: state.lastError,
    lastPollAt: state.lastPollAt,
  };
}

export function youtubeVideoId(input: string): string | null {
  const text = input.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "music.youtube.com") {
      const watch = url.searchParams.get("v") ?? "";
      if (/^[\w-]{11}$/.test(watch)) return watch;
      const parts = url.pathname.split("/").filter(Boolean);
      const slot = parts[0] === "live" || parts[0] === "embed" || parts[0] === "shorts" ? parts[1] : "";
      return /^[\w-]{11}$/.test(slot) ? slot : null;
    }
  } catch {
    return null;
  }
  return null;
}

function explain(status: number, data: GoogleError): string {
  const reason = data.error?.errors?.[0]?.reason ?? "";
  const message = data.error?.message || "YouTube didn't answer.";
  if (reason === "quotaExceeded") return "YouTube's daily read limit is used up. It resets overnight Pacific time.";
  if (reason === "keyInvalid") return "That YouTube key was refused. Turn on YouTube Data API v3, then create a new key.";
  if (reason === "liveChatEnded" || reason === "liveChatNotFound") return "That live chat has ended.";
  if (status === 403 && /has not been used|is disabled/i.test(message)) {
    return "Turn on YouTube Data API v3 for this key in Google Cloud.";
  }
  if (/API keys are not supported/i.test(message)) {
    return "YouTube refused a key for this chat. The stream's chat has to be public.";
  }
  return message;
}

async function google<T>(pathname: string, params: Record<string, string>, key: string): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${pathname}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("key", key);
  const response = await fetch(url);
  const data = (await response.json()) as T & GoogleError;
  if (!response.ok) throw new Error(explain(response.status, data));
  return data;
}

export function youtubeStatus(): Promise<YouTubePublic> {
  return locked(async () => present(await readYouTube()));
}

export function saveYouTubeKey(key: string): Promise<YouTubePublic> {
  const trimmed = key.trim();
  if (trimmed.length < 20 || trimmed.length > 200) return Promise.reject(new Error("That doesn't look like a YouTube API key."));
  return locked(async () => {
    const state = await readYouTube();
    state.apiKey = trimmed;
    state.lastError = "";
    await writeYouTube(state);
    return present(state);
  });
}

export function listenToVideo(input: string): Promise<YouTubePublic> {
  const videoId = youtubeVideoId(input);
  if (!videoId) {
    return Promise.reject(new Error("Paste the watch link for this stream. YouTube Studio copies it from the live."));
  }
  return locked(async () => {
    const state = await readYouTube();
    const key = activeKey(state);
    if (!key) throw new Error("Add the YouTube key first. It stays on this booth.");
    try {
      const payload = await google<{ items?: VideoItem[] }>(
        "videos",
        { part: "snippet,liveStreamingDetails", id: videoId },
        key,
      );
      const video = payload.items?.[0];
      const liveChatId = video?.liveStreamingDetails?.activeLiveChatId;
      if (!video || !liveChatId) throw new Error("That video doesn't have a live chat yet. Start the stream, then listen again.");
      state.videoId = videoId;
      state.liveChatId = liveChatId;
      state.title = video.snippet?.title || "Live";
      state.channelTitle = video.snippet?.channelTitle || "";
      state.connectedAt = Date.now();
      state.pageToken = "";
      state.seen = [];
      state.lastError = "";
      state.waitMs = 12000;
      await writeYouTube(state);
      return present(state);
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : "YouTube didn't answer.";
      await writeYouTube(state);
      throw new Error(state.lastError);
    }
  });
}

export function stopYouTube(): Promise<YouTubePublic> {
  return locked(async () => {
    const state = await readYouTube();
    state.videoId = "";
    state.liveChatId = "";
    state.title = "";
    state.channelTitle = "";
    state.pageToken = "";
    state.lastError = "";
    await writeYouTube(state);
    return present(state);
  });
}

export function disconnectYouTube(): Promise<YouTubePublic> {
  return locked(async () => {
    const state = empty();
    await writeYouTube(state);
    return present(state);
  });
}

function chatText(item: ChatItem): string {
  return (
    item.snippet?.textMessageDetails?.messageText ||
    item.snippet?.superChatDetails?.userComment ||
    item.snippet?.displayMessage ||
    ""
  );
}

let importing = false;

export async function importYouTubeChat(): Promise<void> {
  if (importing) return;
  importing = true;
  try {
    await importOnce();
  } finally {
    importing = false;
  }
}

async function importOnce(): Promise<void> {
  const state = await locked(() => readYouTube());
  const key = activeKey(state);
  if (!key || !state.liveChatId) return;
  if (state.lastPollAt && Date.now() < state.lastPollAt + state.waitMs) return;
  try {
    const params: Record<string, string> = {
      liveChatId: state.liveChatId,
      part: "snippet,authorDetails",
    };
    if (state.pageToken) params.pageToken = state.pageToken;
    const payload = await google<ChatPage>("liveChat/messages", params, key);
    const seen = new Set(state.seen);
    for (const item of payload.items ?? []) {
      if (!item.id || seen.has(item.id)) continue;
      const kind = item.snippet?.type;
      const created = Date.parse(item.snippet?.publishedAt ?? "");
      if (kind !== "textMessageEvent" && kind !== "superChatEvent") {
        seen.add(item.id);
        continue;
      }
      if (!Number.isFinite(created) || created + 120_000 < state.connectedAt) {
        seen.add(item.id);
        continue;
      }
      const parsed = parseSongComment(chatText(item));
      const ytId = item.authorDetails?.channelId;
      const name = item.authorDetails?.displayName;
      const commentId = item.id;
      if (!parsed || !ytId || !name) {
        seen.add(commentId);
        continue;
      }
      try {
        await updateShow((show) =>
          requestTrack(
            show,
            { title: parsed.title, artist: parsed.artist, requester: name },
            { ytId, commentId, source: "youtube", skipTurn: true },
          ),
        );
      } catch {
        // A refusal still counts as heard, so the same chat line is not tried again.
      }
      seen.add(commentId);
    }
    await locked(async () => {
      const latest = await readYouTube();
      if (latest.liveChatId !== state.liveChatId) return;
      latest.pageToken = payload.nextPageToken || latest.pageToken;
      latest.waitMs = Math.min(30_000, Math.max(12_000, payload.pollingIntervalMillis || 12000));
      latest.seen = [...seen].slice(-800);
      latest.lastError = "";
      latest.lastPollAt = Date.now();
      await writeYouTube(latest);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "YouTube didn't answer.";
    await locked(async () => {
      const latest = await readYouTube();
      latest.lastError = message;
      latest.lastPollAt = Date.now();
      if (message === "That live chat has ended.") {
        latest.liveChatId = "";
        latest.pageToken = "";
      }
      await writeYouTube(latest);
    });
  }
}

export function startYouTubePoll(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const g = globalThis as { setlistYouTubePoll?: boolean };
  if (g.setlistYouTubePoll) return;
  g.setlistYouTubePoll = true;
  const timer = setInterval(() => {
    void importYouTubeChat();
  }, 4000);
  timer.unref();
}
