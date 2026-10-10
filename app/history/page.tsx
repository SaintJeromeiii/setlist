"use client";

import { useEffect, useState } from "react";
import { boothHeaders, useShow } from "@/components/use-show";
import { money } from "@/lib/money";
import type { NightRecord } from "@/lib/nights";

export default function HistoryPage() {
  const { show, closed } = useShow();
  const [nights, setNights] = useState<NightRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!show) return;
    let alive = true;
    fetch("/api/nights", { cache: "no-store", credentials: "include", headers: boothHeaders() })
      .then(async (response) => {
        if (response.status === 401) throw new Error("locked");
        if (!response.ok) throw new Error("The record didn't load.");
        return response.json() as Promise<{ nights: NightRecord[] }>;
      })
      .then((data) => {
        if (alive) setNights(data.nights);
      })
      .catch((reason: unknown) => {
        if (!alive) return;
        if (reason instanceof Error && reason.message === "locked") return;
        setError("The record didn't load.");
      });
    return () => {
      alive = false;
    };
  }, [show]);

  if (closed) {
    return (
      <main className="booth">
        <p className="booting">
          The record stays with the booth. <a href="/login">Open it</a>
        </p>
      </main>
    );
  }

  return (
    <main className="booth history">
      <header className="top">
        <div>
          <p className="wordmark">Setlist</p>
          <h1>Past nights</h1>
        </div>
        <a className="btn" href="/booth">
          Phone booth
        </a>
      </header>
      {error ? <p className="banner">{error}</p> : null}
      {nights === null ? <p className="booting">Opening the record…</p> : null}
      {nights?.length === 0 ? <p className="hint">End a night from the booth and it shows up here.</p> : null}
      {nights?.map((night) => (
        <article key={night.id} className="night">
          <div className="panel-head">
            <h2>
              {night.venueName} · {new Date(night.endedAt).toLocaleString()}
            </h2>
            <span>{money(night.tipCents)}</span>
          </div>
          <p className="hint">
            {night.requests} requested · {night.played} played · {night.passed} passed
          </p>
          {night.blocked.length > 0 ? (
            <p className="hint">
              Blocked:{" "}
              {night.blocked
                .map((person) => {
                  if (person.youtube) return `${person.name} (YouTube)`;
                  if (person.facebook) return `${person.name} (Facebook)`;
                  return person.name;
                })
                .join(", ")}
            </p>
          ) : null}
          <ul>
            {night.songs.map((song, index) => (
              <li key={`${song.title}-${song.artist}-${index}`}>
                <strong>{song.title}</strong>
                <span>
                  {song.artist} · {song.requester} · {song.status}
                  {song.source === "facebook" ? " · Facebook" : ""}
                  {song.source === "youtube" ? " · YouTube" : ""}
                  {song.tipCents > 0 ? ` · ${money(song.tipCents)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </main>
  );
}
