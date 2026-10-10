"use client";

import { useEffect, useState } from "react";
import { boothHeaders } from "@/components/use-show";
import type { YouTubePublic } from "@/lib/youtube";

const empty: YouTubePublic = {
  hasKey: false,
  keyFromEnv: false,
  listening: false,
  title: "",
  channelTitle: "",
  videoId: "",
  lastError: "",
  lastPollAt: 0,
};

export default function YouTube() {
  const [state, setState] = useState<YouTubePublic>(empty);
  const [key, setKey] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      fetch("/api/youtube", { cache: "no-store", credentials: "include", headers: boothHeaders() })
        .then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<YouTubePublic>;
        })
        .then((data) => {
          if (alive && data) setState(data);
        })
        .catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/youtube", {
        method: "POST",
        credentials: "include",
        headers: boothHeaders(),
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as YouTubePublic & { error?: string };
      if (!response.ok) throw new Error(data.error || "YouTube didn't answer.");
      setState(data);
      if (body.action === "key") setKey("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "YouTube didn't answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="live-panel">
      <div className="panel-head">
        <h2>YouTube Live</h2>
        <span>{state.listening ? "Listening" : state.hasKey ? "Ready" : "Needs a key"}</span>
      </div>
      <p className="hint">
        Paste the live URL. A chat line like <strong>Song - Artist</strong> becomes a request under that person's
        YouTube name. Blocking them follows the channel. A tip is paid on the request page.
      </p>
      {state.listening ? (
        <p className="hint">
          {state.channelTitle ? `${state.channelTitle} · ` : ""}
          {state.title}
        </p>
      ) : null}
      {state.lastError ? <p className="banner">{state.lastError}</p> : null}
      {error ? <p className="banner">{error}</p> : null}
      {state.keyFromEnv ? (
        <p className="hint">The YouTube key is already on this server.</p>
      ) : (
        <label>
          <span>YouTube API key</span>
          <input
            type="password"
            value={key}
            autoComplete="off"
            placeholder={state.hasKey ? "Key saved on this booth" : "Paste an API key"}
            onChange={(event) => setKey(event.target.value)}
          />
        </label>
      )}
      {!state.hasKey && !state.keyFromEnv ? (
        <p className="hint">
          One key for this booth. In Google Cloud, turn on YouTube Data API v3, create an API key, and paste it here.
          The chat on the stream has to be public.
        </p>
      ) : null}
      <label>
        <span>Live URL</span>
        <input
          value={url}
          autoComplete="off"
          placeholder="https://www.youtube.com/watch?v=…"
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <div className="live-actions">
        {!state.keyFromEnv ? (
          <button type="button" className="btn" disabled={busy || key.trim().length < 20} onClick={() => void send({ action: "key", key })}>
            Save key
          </button>
        ) : null}
        <button type="button" className="btn primary" disabled={busy || url.trim().length < 11} onClick={() => void send({ action: "listen", url })}>
          {busy ? "Connecting…" : "Listen to this live"}
        </button>
        {state.listening ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void send({ action: "stop" })}>
            Stop
          </button>
        ) : null}
        {state.hasKey && !state.keyFromEnv ? (
          <button type="button" className="btn quiet" disabled={busy} onClick={() => void send({ action: "disconnect" })}>
            Remove key
          </button>
        ) : null}
      </div>
    </section>
  );
}
