"use client";

import { useState } from "react";

export default function RequestDesk({ venueName }: { venueName: string }) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [requester, setRequester] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, artist, requester }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not send that request.");
      setSent(title);
      setTitle("");
      setArtist("");
      setRequester("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send that request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="request-page">
      <form className="request-card" onSubmit={(event) => void submit(event)}>
        <p className="wordmark">Setlist</p>
        <h1>Request a song</h1>
        <p className="lede">
          {venueName !== "Setlist" ? `For ${venueName}. ` : null}
          The booth hears it before it goes on stage.
        </p>
        {sent ? <p className="sent">“{sent}” is with the booth.</p> : null}
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
        {error ? <p className="banner">{error}</p> : null}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "Sending…" : "Send to the booth"}
        </button>
      </form>
    </main>
  );
}
