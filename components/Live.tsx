"use client";

import { useEffect, useState } from "react";
import { boothHeaders } from "@/components/use-show";
import type { FacebookPublic } from "@/lib/facebook";

const empty: FacebookPublic = {
  connected: false,
  listening: false,
  pageName: "",
  liveTitle: "",
  lastError: "",
  lastPollAt: 0,
};

export default function Live() {
  const [state, setState] = useState<FacebookPublic>(empty);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      fetch("/api/facebook", { cache: "no-store", credentials: "include", headers: boothHeaders() })
        .then(async (response) => {
          if (!response.ok) return null;
          return response.json() as Promise<FacebookPublic>;
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
      const response = await fetch("/api/facebook", {
        method: "POST",
        credentials: "include",
        headers: boothHeaders(),
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as FacebookPublic & { error?: string };
      if (!response.ok) throw new Error(data.error || "Facebook didn't answer.");
      setState(data);
      setToken("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Facebook didn't answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="live-panel">
      <div className="panel-head">
        <h2>Facebook Live</h2>
        <span>{state.listening ? "Listening" : state.connected ? "Connected" : "Off"}</span>
      </div>
      <p className="hint">
        A comment like <strong>Song - Artist</strong> becomes a request under that person's Facebook name. Blocking
        them follows the Facebook account, even if the name changes. A tip is paid on the request page.
      </p>
      {state.pageName ? (
        <p className="hint">
          {state.pageName}
          {state.liveTitle ? ` · ${state.liveTitle}` : ""}
        </p>
      ) : null}
      {state.lastError ? <p className="banner">{state.lastError}</p> : null}
      {error ? <p className="banner">{error}</p> : null}
      <label>
        <span>Page token</span>
        <input
          type="password"
          value={token}
          autoComplete="off"
          placeholder="Paste a Page access token"
          onChange={(event) => setToken(event.target.value)}
        />
      </label>
      <div className="live-actions">
        <button type="button" className="btn primary" disabled={busy || token.trim().length < 20} onClick={() => void send({ action: "token", token })}>
          {busy ? "Connecting…" : "Connect and find the live"}
        </button>
        {state.connected ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void send({ action: "find" })}>
            Find the live
          </button>
        ) : null}
        {state.listening ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void send({ action: "stop" })}>
            Stop
          </button>
        ) : null}
        {state.connected ? (
          <button type="button" className="btn quiet" disabled={busy} onClick={() => void send({ action: "disconnect" })}>
            Disconnect
          </button>
        ) : null}
      </div>
    </section>
  );
}
