"use client";

import { useEffect } from "react";
import { useShow } from "@/components/use-show";
import { money } from "@/lib/money";

export default function PhoneBooth() {
  const { show, error, setError, send, closed } = useShow();

  useEffect(() => {
    if (closed) window.location.href = "/login";
  }, [closed]);

  async function act(body: Record<string, unknown>) {
    try {
      await send(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the set.");
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }

  if (closed) {
    return (
      <main className="phone">
        <p className="booting">The booth is locked.</p>
      </main>
    );
  }

  if (!show) {
    return (
      <main className="phone">
        <p className="booting">Opening the booth…</p>
      </main>
    );
  }

  return (
    <main className="phone" data-accent={show.settings.accent}>
      <header className="phone-top">
        <div>
          <p className="wordmark">Setlist</p>
          <h1>{show.settings.venueName}</h1>
        </div>
        <div className="phone-links">
          <a className="btn tiny" href="/desk">
            Full booth
          </a>
          <button type="button" className="btn tiny" onClick={() => void logout()}>
            Lock
          </button>
        </div>
      </header>
      <section className="phone-stage">
        <p className="eyebrow">
          <span className="live-dot" aria-hidden />
          On stage
        </p>
        {show.nowPlaying ? (
          <>
            <h2>{show.nowPlaying.title}</h2>
            <p>
              {show.nowPlaying.artist}
              {show.nowPlaying.tipCents > 0 ? ` · ${money(show.nowPlaying.tipCents)} tip` : ""}
            </p>
          </>
        ) : (
          <h2>Nothing on stage</h2>
        )}
        {show.queue.length > 0 ? (
          <p className="phone-queue">
            Next {show.queue[0].title}
            {show.queue[0].tipCents > 0 ? ` · ${money(show.queue[0].tipCents)}` : ""}
          </p>
        ) : null}
      </section>
      {(show.blocked ?? []).length > 0 ? (
        <div className="blocked">
          <span>Blocked</span>
          {(show.blocked ?? []).map((person) => (
            <button
              key={`${person.name}-${person.ytId ?? ""}-${person.fbId ?? ""}`}
              type="button"
              className="btn tiny"
              onClick={() => void act({ action: "unblock", name: person.name })}
            >
              {person.name}
              {person.ytId ? " · YouTube" : ""}
              {person.fbId ? " · Facebook" : ""} · Unblock
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="banner">{error}</p> : null}
      <section>
        <div className="panel-head">
          <h2>Waiting</h2>
          <span>{String(show.pending.length).padStart(2, "0")}</span>
        </div>
        {show.pending.length === 0 ? <p className="empty-copy">No requests waiting.</p> : null}
        {show.pending.map((track) => (
          <article key={track.id} className="phone-card">
            <h3>{track.title}</h3>
            <p>{track.artist}</p>
            <p className="phone-who">
              {track.requester}
              {track.source === "facebook" ? " · Facebook" : ""}
              {track.source === "youtube" ? " · YouTube" : ""}
              {track.tipCents > 0 ? ` · ${money(track.tipCents)} tip` : ""}
            </p>
            <div className="phone-actions">
              <button type="button" className="btn primary" onClick={() => void act({ action: "approve", id: track.id })}>
                Accept
              </button>
              <button type="button" className="btn" onClick={() => void act({ action: "pass", id: track.id })}>
                Pass
              </button>
              <button type="button" className="btn" onClick={() => void act({ action: "block", id: track.id })}>
                Block
              </button>
            </div>
          </article>
        ))}
      </section>
      <button type="button" className="btn primary phone-next" onClick={() => void act({ action: "next" })}>
        Next
      </button>
    </main>
  );
}
