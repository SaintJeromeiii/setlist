import { parseSongComment } from "./comment";
import { requestTrack } from "./show";
import { updateShow } from "./store";
import { promises as fs } from "fs";
import path from "path";

const file = path.join(process.cwd(), "data", "facebook.json");

type FacebookState = {
  pageToken: string;
  pageId: string;
  pageName: string;
  liveVideoId: string;
  liveTitle: string;
  connectedAt: number;
  seen: string[];
  lastError: string;
  lastPollAt: number;
};

export type FacebookPublic = {
  connected: boolean;
  listening: boolean;
  pageName: string;
  liveTitle: string;
  lastError: string;
  lastPollAt: number;
};

type GraphError = { error?: { message?: string } };
type LiveVideo = { id?: string; title?: string; status?: string; broadcast_status?: string };
type GraphComment = {
  id?: string;
  message?: string;
  created_time?: string;
  from?: { id?: string; name?: string };
};

const empty = (): FacebookState => ({
  pageToken: "",
  pageId: "",
  pageName: "",
  liveVideoId: "",
  liveTitle: "",
  connectedAt: 0,
  seen: [],
  lastError: "",
  lastPollAt: 0,
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

async function readFacebook(): Promise<FacebookState> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as Partial<FacebookState>;
    return { ...empty(), ...parsed, seen: Array.isArray(parsed.seen) ? parsed.seen.filter((id) => typeof id === "string") : [] };
  } catch {
    return empty();
  }
}

async function writeFacebook(state: FacebookState): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(state), { mode: 0o600 });
}

function present(state: FacebookState): FacebookPublic {
  return {
    connected: Boolean(state.pageToken),
    listening: Boolean(state.liveVideoId),
    pageName: state.pageName,
    liveTitle: state.liveTitle,
    lastError: state.lastError,
    lastPollAt: state.lastPollAt,
  };
}

async function graph<T>(pathname: string, token: string): Promise<T> {
  const url = new URL(`https://graph.facebook.com/v21.0/${pathname.replace(/^\//, "")}`);
  url.searchParams.set("access_token", token);
  const response = await fetch(url);
  const data = (await response.json()) as T & GraphError;
  if (!response.ok) {
    throw new Error(data.error?.message || "Facebook didn't answer.");
  }
  return data;
}

export function facebookStatus(): Promise<FacebookPublic> {
  return locked(async () => present(await readFacebook()));
}

export function savePageToken(token: string): Promise<FacebookPublic> {
  const trimmed = token.trim();
  if (trimmed.length < 20 || trimmed.length > 500) {
    return Promise.reject(new Error("That doesn't look like a Page token."));
  }
  return locked(async () => {
    const state = await readFacebook();
    state.pageToken = trimmed;
    state.liveVideoId = "";
    state.liveTitle = "";
    state.lastError = "";
    await writeFacebook(state);
    return findLiveLocked();
  });
}

async function findLiveLocked(): Promise<FacebookPublic> {
  const state = await readFacebook();
  if (!state.pageToken) throw new Error("Add a Page token first.");
  try {
    const page = await graph<{ id?: string; name?: string }>("me?fields=id,name", state.pageToken);
    const videos = await graph<{ data?: LiveVideo[] }>(
      "me/live_videos?fields=id,title,status,broadcast_status&limit=10",
      state.pageToken,
    );
    const live = (videos.data ?? []).find(
      (video) => video.id && (video.status === "LIVE" || video.broadcast_status === "LIVE"),
    );
    if (!live?.id) throw new Error("No live video on that Page right now.");
    state.pageId = page.id ?? state.pageId;
    state.pageName = page.name ?? state.pageName;
    state.liveVideoId = live.id;
    state.liveTitle = live.title || "Live";
    state.connectedAt = Date.now();
    state.lastError = "";
    await writeFacebook(state);
    return present(state);
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "Facebook didn't answer.";
    await writeFacebook(state);
    throw new Error(state.lastError);
  }
}

export function findLive(): Promise<FacebookPublic> {
  return locked(() => findLiveLocked());
}

export function stopLive(): Promise<FacebookPublic> {
  return locked(async () => {
    const state = await readFacebook();
    state.liveVideoId = "";
    state.liveTitle = "";
    state.lastError = "";
    await writeFacebook(state);
    return present(state);
  });
}

export function disconnectFacebook(): Promise<FacebookPublic> {
  return locked(async () => {
    const state = empty();
    await writeFacebook(state);
    return present(state);
  });
}

let importing = false;

export async function importLiveComments(): Promise<void> {
  if (importing) return;
  importing = true;
  try {
    await importOnce();
  } finally {
    importing = false;
  }
}

async function importOnce(): Promise<void> {
  const state = await locked(() => readFacebook());
  if (!state.pageToken || !state.liveVideoId) return;
  try {
    const payload = await graph<{ data?: GraphComment[] }>(
      `${state.liveVideoId}/comments?fields=id,message,from{id,name},created_time&order=reverse_chronological&limit=50`,
      state.pageToken,
    );
    const comments = payload.data ?? [];
    const seen = new Set(state.seen);
    for (const comment of [...comments].reverse()) {
      if (!comment.id || seen.has(comment.id)) continue;
      const created = Date.parse(comment.created_time ?? "");
      if (!Number.isFinite(created) || created + 120_000 < state.connectedAt) {
        seen.add(comment.id);
        continue;
      }
      const parsed = parseSongComment(comment.message ?? "");
      const fbId = comment.from?.id;
      const fbName = comment.from?.name;
      const commentId = comment.id;
      if (!parsed || !fbId || !fbName) {
        seen.add(commentId);
        continue;
      }
      try {
        await updateShow((show) =>
          requestTrack(
            show,
            { title: parsed.title, artist: parsed.artist, requester: fbName },
            { fbId, commentId, source: "facebook", skipTurn: true },
          ),
        );
      } catch {
        // A refusal still counts as heard, so the same comment is not tried again.
      }
      seen.add(commentId);
    }
    await locked(async () => {
      const latest = await readFacebook();
      if (latest.liveVideoId !== state.liveVideoId) return;
      latest.seen = [...seen].slice(-800);
      latest.lastError = "";
      latest.lastPollAt = Date.now();
      await writeFacebook(latest);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Facebook didn't answer.";
    await locked(async () => {
      const latest = await readFacebook();
      latest.lastError = message;
      latest.lastPollAt = Date.now();
      await writeFacebook(latest);
    });
  }
}

export function startFacebookPoll(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const g = globalThis as { setlistPoll?: boolean };
  if (g.setlistPoll) return;
  g.setlistPoll = true;
  const timer = setInterval(() => {
    void importLiveComments();
  }, 4000);
  timer.unref();
}
