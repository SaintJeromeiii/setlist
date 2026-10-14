"use client";

import { useState } from "react";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "That password doesn't open the booth.");
      window.location.href = "/booth";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That password doesn't open the booth.");
      setBusy(false);
    }
  }

  return (
    <main className="request-page">
      <form className="request-card" onSubmit={(event) => void submit(event)}>
        <p className="wordmark">Setlist</p>
        <h1>Open the booth</h1>
        <p className="lede">The password is in Setup, on the computer running Setlist.</p>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="banner">{error}</p> : null}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "Opening…" : "Open"}
        </button>
      </form>
    </main>
  );
}
