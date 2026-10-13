"use client";

import { useEffect, useState } from "react";
import { boothHeaders } from "@/components/use-show";
import type { YouTubePublic } from "@/lib/youtube";

const empty: YouTubePublic = {
  listening: false,
  title: "",
  channelTitle: "",
  videoId: "",
  lastError: "",
  lastPollAt: 0,
};

export default function YouTube() {
  const [state, setState] = useState<YouTubePublic>(empty);
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
        <span>{state.listening ? "Listening" : "Ready"}</span>
      </div>
      <p className="hint">
        Paste the live URL. A chat line like <strong>Song - Artist</strong> becomes a request under that person's
        YouTube name. The chat has to be public. Blocking them follows the channel.
      </p>
      {state.listening ? (
        <p className="hint">
          {state.channelTitle ? `${state.channelTitle} · ` : ""}
          {state.title}
        </p>
      ) : null}
      {state.lastError ? <p className="banner">{state.lastError}</p> : null}
      {error ? <p className="banner">{error}</p> : null}
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
        <button type="button" className="btn primary" disabled={busy || url.trim().length < 11} onClick={() => void send({ action: "listen", url })}>
          {busy ? "Connecting…" : "Listen to this live"}
        </button>
        {state.listening ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void send({ action: "stop" })}>
            Stop
          </button>
        ) : null}
      </div>
    </section>
  );
}
