const BROWSER = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
};

export type WebSession = {
  apiKey: string;
  clientVersion: string;
  continuation: string;
};

export type WebChatLine = {
  id: string;
  text: string;
  author: string;
  channelId: string;
  timestampMs: number;
};

export type WebChatPage = {
  lines: WebChatLine[];
  continuation: string;
  waitMs: number;
  ended: boolean;
};

export function readLiveSession(html: string): WebSession | null {
  const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1] ?? "";
  const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1] ?? "";
  const continuation = continuationFrom(html);
  if (!apiKey || !clientVersion || !continuation) return null;
  return { apiKey, clientVersion, continuation };
}

export function readChatPage(data: unknown): WebChatPage {
  const live = asRecord(asRecord(asRecord(data)?.continuationContents)?.liveChatContinuation);
  const actions = Array.isArray(live?.actions) ? live.actions : [];
  const lines: WebChatLine[] = [];
  for (const action of actions) {
    const item = asRecord(asRecord(action)?.addChatItemAction)?.item;
    const line = lineFrom(item);
    if (line) lines.push(line);
  }
  const continuations = Array.isArray(live?.continuations) ? live.continuations : [];
  let continuation = "";
  let waitMs = 0;
  let replay = false;
  for (const entry of continuations) {
    const record = asRecord(entry);
    if (!record) continue;
    const liveNext = asRecord(record.invalidationContinuationData) ?? asRecord(record.timedContinuationData);
    const replayNext = asRecord(record.liveChatReplayContinuationData);
    if (liveNext && typeof liveNext.continuation === "string") {
      continuation = liveNext.continuation;
      if (typeof liveNext.timeoutMs === "number") waitMs = liveNext.timeoutMs;
    } else if (replayNext?.continuation) {
      replay = true;
    }
  }
  return {
    lines,
    continuation,
    waitMs: clampWait(waitMs),
    ended: !continuation && (replay || continuations.length === 0),
  };
}

export function liveChatKind(html: string): "live" | "replay" | "none" {
  if (!readLiveSession(html)) return "none";
  const at = html.indexOf('"liveChatRenderer":');
  const window = html.slice(at, at + 8000);
  if (/"title":"(?:Top chat|Live chat) replay"/.test(window)) return "replay";
  return "live";
}

export async function openPublicLive(videoId: string): Promise<WebSession & { title: string; channelTitle: string }> {
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`;
  const [page, card] = await Promise.all([
    fetch(watchUrl, { headers: BROWSER, redirect: "follow" }),
    fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      { headers: BROWSER },
    ),
  ]);
  if (!page.ok) throw new Error("YouTube didn't answer.");
  const html = await page.text();
  const kind = liveChatKind(html);
  if (kind === "replay") throw new Error("That live chat has ended. Start the stream, then listen again.");
  const session = readLiveSession(html);
  if (!session) {
    throw new Error("That video doesn't have a live chat yet. Start the stream, then listen again.");
  }
  let title = "Live";
  let channelTitle = "";
  if (card.ok) {
    const data = (await card.json().catch(() => null)) as { title?: unknown; author_name?: unknown } | null;
    if (typeof data?.title === "string" && data.title.trim()) title = data.title.trim();
    if (typeof data?.author_name === "string") channelTitle = data.author_name.trim();
  }
  return { ...session, title, channelTitle };
}

export async function pullPublicChat(session: WebSession): Promise<WebChatPage> {
  const response = await fetch(
    `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${encodeURIComponent(session.apiKey)}&prettyPrint=false`,
    {
      method: "POST",
      headers: {
        ...BROWSER,
        "content-type": "application/json",
        origin: "https://www.youtube.com",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion: session.clientVersion,
            hl: "en",
            gl: "US",
          },
        },
        continuation: session.continuation,
      }),
    },
  );
  if (!response.ok) {
    if (response.status === 400) {
      throw new Error("That live chat has ended. Start the stream, then listen again.");
    }
    throw new Error("YouTube didn't answer.");
  }
  const data = (await response.json().catch(() => null)) as unknown;
  if (!data) throw new Error("YouTube didn't answer.");
  return readChatPage(data);
}

function continuationFrom(html: string): string {
  let from = 0;
  while (from < html.length) {
    const at = html.indexOf('"liveChatRenderer":', from);
    if (at < 0) return "";
    const token = html
      .slice(at, at + 2500)
      .match(/"(?:reload|invalidation|timed)ContinuationData":\{"continuation":"([^"]+)"/);
    if (token?.[1]) return token[1];
    from = at + 20;
  }
  return "";
}

function lineFrom(item: unknown): WebChatLine | null {
  const record = asRecord(item);
  if (!record) return null;
  const msg = asRecord(record.liveChatTextMessageRenderer) ?? asRecord(record.liveChatPaidMessageRenderer);
  if (!msg || typeof msg.id !== "string") return null;
  const author = textOf(msg.authorName).trim();
  const text = textOf(msg.message).replace(/\s+/g, " ").trim();
  if (!author || !text) return null;
  const raw =
    typeof msg.timestampUsec === "string" || typeof msg.timestampUsec === "number" ? Number(msg.timestampUsec) : NaN;
  return {
    id: msg.id,
    text,
    author,
    channelId: typeof msg.authorExternalChannelId === "string" ? msg.authorExternalChannelId : "",
    timestampMs: Number.isFinite(raw) ? Math.round(raw / 1000) : 0,
  };
}

function textOf(node: unknown): string {
  const record = asRecord(node);
  if (!record) return "";
  if (typeof record.simpleText === "string") return record.simpleText;
  if (!Array.isArray(record.runs)) return "";
  return record.runs
    .map((run) => {
      const item = asRecord(run);
      return typeof item?.text === "string" ? item.text : "";
    })
    .join("");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function clampWait(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 12000;
  return Math.min(30_000, Math.max(8_000, Math.round(ms)));
}
