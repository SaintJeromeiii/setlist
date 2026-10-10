"use client";

import { useEffect, useRef, useState } from "react";
import { useBoard } from "@/components/use-show";
import { TIP_CENTS, money } from "@/lib/money";
import type { ListenerRequest, ListenerStatus } from "@/lib/requests";

const STORAGE_KEY = "setlist-requests";

type Held = ListenerRequest;

function statusLine(status: ListenerStatus): string {
  switch (status) {
    case "pending":
      return "Waiting on the booth.";
    case "queued":
      return "It's in the queue.";
    case "playing":
      return "It's on now.";
    case "played":
      return "It played.";
    case "passed":
      return "The booth passed on this one.";
    case "removed":
      return "The booth took it off the list.";
  }
}

function settle(previous: ListenerStatus, next: ListenerStatus): ListenerStatus {
  if (next !== "removed") return next;
  if (previous === "playing" || previous === "played") return "played";
  if (previous === "passed") return "passed";
  return "removed";
}

function readHeld(): Held[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Held[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === "string" && typeof item.title === "string");
  } catch {
    return [];
  }
}

export default function RequestDesk({
  venueName,
  trackId,
  invalidLink = false,
}: {
  venueName: string;
  trackId?: string;
  invalidLink?: boolean;
}) {
  const board = useBoard();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [requester, setRequester] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState<Held[]>([]);
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState(0);
  const [tipped, setTipped] = useState(false);
  const heldRef = useRef<Held[]>([]);
  const venue = board?.venueName || venueName;

  function remember(next: Held[]) {
    heldRef.current = next;
    setHeld(next);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  useEffect(() => {
    const loaded = readHeld();
    const seeded =
      trackId && !loaded.some((item) => item.id === trackId)
        ? [{ id: trackId, title: "", artist: "", status: "pending" as const }, ...loaded]
        : loaded;
    heldRef.current = seeded;
    setHeld(seeded);
  }, [trackId]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const current = heldRef.current;
      if (current.length === 0) return;
      try {
        const response = await fetch(`/api/requests?ids=${current.map((item) => item.id).join(",")}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { requests?: ListenerRequest[] };
        if (!alive || !Array.isArray(data.requests)) return;
        const byId = new Map(data.requests.map((item) => [item.id, item]));
        const next = heldRef.current.map((item) => {
          const remote = byId.get(item.id);
          if (!remote) return item;
          return {
            ...item,
            title: remote.title || item.title,
            artist: remote.artist || item.artist,
            status: settle(item.status, remote.status),
          };
        });
        const changed = next.some((item, index) => {
          const previous = heldRef.current[index];
          return item.status !== previous?.status || item.title !== previous?.title || item.artist !== previous?.artist;
        });
        if (!changed) return;
        remember(next);
      } catch {
        // Keep the last status the listener already saw.
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tipped") === "1") setTipped(true);
  }, []);

  async function pay(id: string, tipCents: number) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/tips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, tipCents }),
      });
      const data = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "Could not open the tip.");
      window.location.href = data.checkoutUrl;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open the tip.");
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, artist, requester, tipCents: tip }),
      });
      const data = (await response.json()) as ListenerRequest & { error?: string; checkoutUrl?: string };
      if (!response.ok) throw new Error(data.error || "Could not send that request.");
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      remember(
        [{ id: data.id, title: data.title, artist: data.artist, status: data.status }, ...heldRef.current].slice(0, 12),
      );
      setTitle("");
      setArtist("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send that request.");
    } finally {
      setBusy(false);
    }
  }

  const now = board?.nowPlaying ?? null;
  const queue = board?.queue ?? [];

  return (
    <main className="request-page">
      <form className="request-card" onSubmit={(event) => void submit(event)}>
        <p className="wordmark">Setlist</p>
        <h1>Request a song</h1>
        <p className="lede">
          {venue !== "Setlist" ? `For ${venue}. ` : null}
          The booth hears it before it goes on stage. Keep the status link if you leave.
        </p>
        <section className="board">
          <div>
            <h2>On stage</h2>
            {now ? (
              <p className="now">
                {now.title}
                <span>
                  {now.artist}
                  {now.requester ? ` · ${now.requester}` : ""}
                </span>
              </p>
            ) : (
              <p className="quiet">{board ? "Nothing on stage." : "Opening the set…"}</p>
            )}
          </div>
          <div>
            <h2>Queue</h2>
            {!board ? (
              <p className="quiet">Opening the set…</p>
            ) : queue.length > 0 ? (
              <ol>
                {queue.map((track, index) => (
                  <li key={`${track.title}-${track.artist}-${index}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>
                      {track.title}
                      <em>
                        {track.artist}
                        {track.requester ? ` · ${track.requester}` : ""}
                      </em>
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="quiet">The queue is open.</p>
            )}
          </div>
        </section>
        {invalidLink ? <p className="banner">That status link doesn't look right.</p> : null}
        {held.length > 0 ? (
          <section className="request-list" aria-live="polite">
            <h2>Your songs</h2>
            <ul>
              {held.map((item) => {
                const missing = !item.title && item.status === "removed";
                return (
                  <li key={item.id} data-status={item.status}>
                    <p className="song">
                      {item.title || "This request"}
                      {item.artist ? <span>{item.artist}</span> : null}
                    </p>
                    <p className="state">
                      {missing
                        ? "This request isn't in the set."
                        : item.title
                          ? statusLine(item.status)
                          : "Checking this request…"}
                    </p>
                    <a className="status-link" href={`/request/${item.id}`}>
                      Status link
                    </a>
                    {board?.tips && (item.status === "pending" || item.status === "queued") ? (
                      <span className="tip-picks">
                        {TIP_CENTS.map((cents) => (
                          <button key={cents} type="button" className="btn tiny" onClick={() => void pay(item.id, cents)}>
                            Tip {money(cents)}
                          </button>
                        ))}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
        <label>
          <span>Song</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          <span>Artist</span>
          <input value={artist} onChange={(event) => setArtist(event.target.value)} required />
        </label>
        <label>
          <span>Your name</span>
          <input value={requester} onChange={(event) => setRequester(event.target.value)} required />
        </label>
        {tipped ? <p className="banner">The tip is on the request. The booth has it.</p> : null}
        {board?.tips ? (
          <div className="tip-picks">
            <span>Tip</span>
            <button type="button" className={tip === 0 ? "btn tiny on" : "btn tiny"} onClick={() => setTip(0)}>
              No tip
            </button>
            {TIP_CENTS.map((cents) => (
              <button
                key={cents}
                type="button"
                className={tip === cents ? "btn tiny on" : "btn tiny"}
                onClick={() => setTip(cents)}
              >
                {money(cents)}
              </button>
            ))}
          </div>
        ) : board ? (
          <p className="quiet">Tips open when the booth connects Stripe.</p>
        ) : null}
        {error ? <p className="banner">{error}</p> : null}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "Sending…" : "Send to the booth"}
        </button>
      </form>
    </main>
  );
}
