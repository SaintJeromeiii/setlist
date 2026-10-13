"use client";

import { useEffect, useRef, useState } from "react";
import Mark from "@/components/Mark";
import Live from "@/components/Live";
import YouTube from "@/components/YouTube";
import { boothHeaders, useShow } from "@/components/use-show";
import { money } from "@/lib/money";
import { clashNote } from "@/lib/song";
import type { Accent, Position, Skin, Track } from "@/lib/types";

type Check = {
  status: "checking" | "match" | "none" | "error";
  title?: string;
  artist?: string;
  artUrl?: string | null;
  message?: string;
};

export default function Booth() {
  const { show, error, setError, send, closed } = useShow();
  const [copied, setCopied] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [requester, setRequester] = useState("");
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [spotify, setSpotify] = useState("");
  const [looking, setLooking] = useState(false);
  const [venue, setVenue] = useState("Setlist");
  const [refused, setRefused] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [ending, setEnding] = useState(false);
  const [screen, setScreen] = useState<"set" | "setup">("set");
  const venueFocused = useRef(false);
  const refusedFocused = useRef(false);

  useEffect(() => {
    if (!show || venueFocused.current) return;
    setVenue(show.settings.venueName);
  }, [show]);

  useEffect(() => {
    if (!show || refusedFocused.current) return;
    setRefused(show.settings.refusedWords ?? "");
  }, [show]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      send({ action: "next" }).catch((reason: Error) => setError(reason.message));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send, setError]);

  useEffect(() => {
    void fetch("/api/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { phonePassword?: string } | null) => {
        if (data?.phonePassword) setPhonePassword(data.phonePassword);
      })
      .catch(() => undefined);
  }, []);

  async function copy(kind: "overlay" | "request" | "phone") {
    const url = show?.links[kind];
    if (!url) {
      setError("This Mac has no network address yet, so phones cannot open that link.");
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1400);
  }

  async function rotatePassword() {
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: boothHeaders(),
        body: JSON.stringify({ action: "rotate-password" }),
      });
      const data = (await response.json()) as { phonePassword?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not change the password.");
      if (data.phonePassword) setPhonePassword(data.phonePassword);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not change the password.");
    }
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.set("logo", file);
    try {
      const response = await fetch("/api/logo", { method: "POST", headers: boothHeaders(false), body });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save that logo.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save that logo.");
    }
  }

  async function lookup() {
    setLooking(true);
    setError(null);
    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: boothHeaders(),
        body: JSON.stringify({ url: spotify }),
      });
      const data = (await response.json()) as { title?: string; artist?: string; artUrl?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not look up that song.");
      setTitle(data.title ?? "");
      setArtist(data.artist ?? "");
      setArtUrl(data.artUrl ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not look up that song.");
    } finally {
      setLooking(false);
    }
  }

  async function add(destination: "queued" | "playing") {
    try {
      await send({
        action: "add",
        title,
        artist,
        requester: requester || "Booth",
        artUrl,
        destination,
      });
      setTitle("");
      setArtist("");
      setRequester("");
      setArtUrl(null);
      setSpotify("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add that song.");
    }
  }

  async function checkTrack(track: Track) {
    setChecks((current) => ({ ...current, [track.id]: { status: "checking" } }));
    setError(null);
    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: boothHeaders(),
        body: JSON.stringify({ title: track.title, artist: track.artist }),
      });
      const data = (await response.json()) as {
        error?: string;
        match?: { title: string; artist: string; artUrl: string | null } | null;
      };
      if (!response.ok) throw new Error(data.error || "Could not check that song.");
      if (!data.match) {
        setChecks((current) => ({ ...current, [track.id]: { status: "none" } }));
        return;
      }
      setChecks((current) => ({
        ...current,
        [track.id]: { status: "match", title: data.match?.title, artist: data.match?.artist, artUrl: data.match?.artUrl },
      }));
    } catch (reason) {
      setChecks((current) => ({
        ...current,
        [track.id]: { status: "error", message: reason instanceof Error ? reason.message : "Could not check that song." },
      }));
    }
  }

  async function act(body: Record<string, unknown>) {
    try {
      await send(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the set.");
    }
  }

  if (closed) {
    return (
      <main className="booth">
        <p className="booting">
          The booth is locked. <a href="/login">Open it</a>
        </p>
      </main>
    );
  }

  if (!show) {
    return (
      <main className="booth">
        <p className="booting">Opening the booth…</p>
      </main>
    );
  }

  const idle = !show.nowPlaying && show.queue.length === 0 && show.pending.length === 0;
  const blocked = show.blocked ?? [];

  return (
    <main className="booth" data-accent={show.settings.accent}>
      <header className="top">
        <div>
          <p className="wordmark">Setlist</p>
          <h1>{screen === "set" ? show.settings.venueName : "Setup"}</h1>
        </div>
        <div className="links">
          <button type="button" className={`btn ${screen === "set" ? "on" : ""}`} onClick={() => setScreen("set")}>
            The set
          </button>
          <button type="button" className={`btn ${screen === "setup" ? "on" : ""}`} onClick={() => setScreen("setup")}>
            Setup
          </button>
          <a className="btn" href="/history">
            Past nights
          </a>
        </div>
      </header>
      {error ? <p className="banner">{error}</p> : null}

      {screen === "setup" ? (
        <>
          <section className="live-panel">
            <div className="panel-head">
              <h2>On the stream</h2>
            </div>
            <p className="hint">
              Set YouTube to ultra low-latency before you go live. In OBS, put the webcam on the bottom. Add one browser
              source on top at 1920×1080 and paste the overlay link. The card sits on the picture and the camera shows
              through.
            </p>
            <div className="live-actions">
              <button type="button" className="btn" onClick={() => void copy("overlay")}>
                {copied === "overlay" ? "Copied" : "Copy overlay link"}
              </button>
              <button type="button" className="btn" onClick={() => void copy("request")} disabled={!show.links.request}>
                {copied === "request" ? "Copied" : "Copy request link"}
              </button>
              <button type="button" className="btn" onClick={() => void copy("phone")} disabled={!show.links.phone}>
                {copied === "phone" ? "Copied" : "Copy phone booth"}
              </button>
            </div>
            <p className="hint">
              {show.links.overlay ? `Overlay: ${show.links.overlay}` : "Overlay link is on this computer."}
            </p>
            <p className="hint">
              {show.links.request
                ? `Requests: ${show.links.request}`
                : "This computer has no network address yet, so phones cannot open requests."}
            </p>
            {show.links.phone ? (
              <p className="hint">
                Phone booth: {show.links.phone}
                {phonePassword ? ` · password ${phonePassword}` : ""}
                {phonePassword ? (
                  <button type="button" className="btn tiny" onClick={() => void rotatePassword()}>
                    New password
                  </button>
                ) : null}
              </p>
            ) : null}
          </section>

          <section className="live-panel">
            <div className="panel-head">
              <h2>Another computer</h2>
            </div>
            <p className="hint">
              Another streamer runs Setlist on their own computer. Their blocks and nights stay on that machine.
              They open Setup, paste the live URL, and build the same OBS scene: webcam underneath, overlay on top.
            </p>
          </section>

          <YouTube />
          <Live />

          <div className="monitor" data-accent={show.settings.accent} data-skin={show.settings.skin}>
            <div className={`anchor ${show.settings.skin === "paper" ? "paper" : show.settings.position}`}>
              <Mark show={{ ...show, logoUrl: show.logoStamp ? `/api/logo?v=${show.logoStamp}` : null }} />
            </div>
            {!show.nowPlaying ? <p className="stage-idle">The preview matches the overlay once a song is on stage.</p> : null}
          </div>
        </>
      ) : null}

      {screen === "set" ? (
        <>
        <section className="stage-card gig-stage">
          <div className="panel-head">
            <h2>On stage</h2>
          </div>
          {show.nowPlaying ? (
            <div className="onstage">
              <p className="eyebrow">
                <span className="live-dot" aria-hidden />
                Live
              </p>
              <h3>{show.nowPlaying.title}</h3>
              <p className="artist">{show.nowPlaying.artist}</p>
              <p className="for">for {show.nowPlaying.requester}</p>
              {show.nowPlaying.tipCents > 0 ? <p className="for">{money(show.nowPlaying.tipCents)} tip</p> : null}
              <button type="button" className="btn primary next" onClick={() => void act({ action: "next" })}>
                Next
              </button>
            </div>
          ) : (
            <div className="onstage empty">
              <h3>Nothing on stage</h3>
              <p>Queue a song, or load a practice set to check the overlay before you go live.</p>
              {idle ? (
                <button type="button" className="btn" onClick={() => void act({ action: "practice" })}>
                  Load a practice set
                </button>
              ) : (
                <button type="button" className="btn primary" onClick={() => void act({ action: "next" })}>
                  Start the queue
                </button>
              )}
            </div>
          )}
        </section>

        {blocked.length > 0 ? <BlockedPeople people={blocked} onUnblock={(name) => void act({ action: "unblock", name })} /> : null}

        <p className="hint">Press N for the next song. Play the audio in Serato or Spotify.</p>

      <form
        className="adder"
        onSubmit={(event) => {
          event.preventDefault();
          void add("queued");
        }}
      >
        <div className="spotify-row">
          <label>
            <span>Spotify link</span>
            <input
              value={spotify}
              onChange={(event) => setSpotify(event.target.value)}
              placeholder="https://open.spotify.com/track/…"
              inputMode="url"
            />
          </label>
          <button type="button" className="btn" onClick={() => void lookup()} disabled={!spotify || looking}>
            {looking ? "Looking…" : "Fill from link"}
          </button>
        </div>
        <div className="fields">
          <label>
            <span>Song</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label>
            <span>Artist</span>
            <input value={artist} onChange={(event) => setArtist(event.target.value)} required />
          </label>
          <label>
            <span>Requested by</span>
            <input
              value={requester}
              onChange={(event) => setRequester(event.target.value)}
              placeholder="Booth"
            />
          </label>
        </div>
        <div className="adder-actions">
          {artUrl ? <p className="art-note">Album art ready</p> : <p className="art-note">No art yet</p>}
          <button type="submit" className="btn">
            Add to queue
          </button>
          <button type="button" className="btn primary" onClick={() => void add("playing")}>
            Play now
          </button>
        </div>
      </form>

      <div className="lanes">
        <Lane title="Requests" count={show.pending.length} empty="Nothing waiting.">
          {show.pending.map((track) => {
            const flag = clashNote(show, track);
            const check = checks[track.id];
            return (
              <TrackRow
                key={track.id}
                track={track}
                note={
                  <>
                    {flag ? <p className="flag">{flag}</p> : null}
                    {check?.status === "checking" ? <p className="check-note">Checking…</p> : null}
                    {check?.status === "none" ? <p className="check-note">No released match.</p> : null}
                    {check?.status === "error" ? <p className="flag">{check.message}</p> : null}
                    {check?.status === "match" ? (
                      <div className="check-note">
                        <p>
                          Released as {check.title} — {check.artist}
                        </p>
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() =>
                            void act({
                              action: "revise",
                              id: track.id,
                              title: check.title,
                              artist: check.artist,
                              artUrl: check.artUrl,
                            })
                          }
                        >
                          Use this
                        </button>
                      </div>
                    ) : null}
                  </>
                }
              >
                <button type="button" className="btn tiny" onClick={() => void checkTrack(track)} disabled={check?.status === "checking"}>
                  Check
                </button>
                <button type="button" className="btn tiny primary" onClick={() => void act({ action: "approve", id: track.id })}>
                  Queue
                </button>
                <button type="button" className="btn tiny" onClick={() => void act({ action: "play", id: track.id })}>
                  Play
                </button>
                <button type="button" className="btn tiny quiet" onClick={() => void act({ action: "pass", id: track.id })}>
                  Pass
                </button>
                <button type="button" className="btn tiny quiet" onClick={() => void act({ action: "block", id: track.id })}>
                  Block
                </button>
              </TrackRow>
            );
          })}
        </Lane>
        <Lane title="Queue" count={show.queue.length} empty="The set is open.">
          {show.queue.map((track, index) => (
            <TrackRow key={track.id} track={track} index={index}>
              <button type="button" className="btn tiny" onClick={() => void act({ action: "move", id: track.id, direction: -1 })} disabled={index === 0}>
                Up
              </button>
              <button
                type="button"
                className="btn tiny"
                onClick={() => void act({ action: "move", id: track.id, direction: 1 })}
                disabled={index === show.queue.length - 1}
              >
                Down
              </button>
              <button type="button" className="btn tiny primary" onClick={() => void act({ action: "play", id: track.id })}>
                Play
              </button>
              <button type="button" className="btn tiny quiet" onClick={() => void act({ action: "remove", id: track.id })}>
                Remove
              </button>
              <button type="button" className="btn tiny quiet" onClick={() => void act({ action: "block", id: track.id })}>
                Block
              </button>
            </TrackRow>
          ))}
        </Lane>
        <Lane title="Played" count={show.recent.length} empty="No songs yet.">
          {show.recent.map((track) => (
            <TrackRow key={track.id} track={track} />
          ))}
        </Lane>
      </div>
        </>
      ) : null}

      {screen === "setup" ? (
      <form
        className="settings"
        onSubmit={(event) => {
          event.preventDefault();
          void act({ action: "settings", ...show.settings, venueName: venue, refusedWords: refused });
        }}
      >
        <label>
          <span>Venue name</span>
          <input
            value={venue}
            maxLength={40}
            onFocus={() => {
              venueFocused.current = true;
            }}
            onBlur={() => {
              venueFocused.current = false;
              void act({ action: "settings", ...show.settings, venueName: venue });
            }}
            onChange={(event) => setVenue(event.target.value)}
          />
        </label>
        <Choice
          label="Look"
          value={show.settings.skin}
          options={[
            ["warm", "Warm"],
            ["paper", "Paper"],
            ["club", "Club"],
          ]}
          onChange={(skin) => void act({ action: "settings", ...show.settings, skin })}
        />
        <p className="hint">Warm is the corner card. Paper is a white bar along the bottom. Club is a darker corner card.</p>
        <Choice
          label="Accent"
          value={show.settings.accent}
          options={[
            ["amber", "Amber"],
            ["bone", "Bone"],
            ["oxblood", "Oxblood"],
          ]}
          onChange={(accent) => void act({ action: "settings", ...show.settings, accent })}
        />
        <Choice
          label="Place"
          value={show.settings.position}
          options={[
            ["left", "Left"],
            ["center", "Center"],
            ["right", "Right"],
          ]}
          onChange={(position) => void act({ action: "settings", ...show.settings, position })}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={show.settings.showRequester}
            onChange={(event) =>
              void act({ action: "settings", ...show.settings, showRequester: event.target.checked })
            }
          />
          Show who requested it
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={show.settings.showUpNext}
            onChange={(event) =>
              void act({ action: "settings", ...show.settings, showUpNext: event.target.checked })
            }
          />
          Show up next
        </label>
        <label>
          <span>Also refuse</span>
          <input
            value={refused}
            maxLength={200}
            placeholder="Words, separated by commas"
            onFocus={() => {
              refusedFocused.current = true;
            }}
            onBlur={() => {
              refusedFocused.current = false;
              void act({ action: "settings", ...show.settings, refusedWords: refused });
            }}
            onChange={(event) => setRefused(event.target.value)}
          />
        </label>
        <label>
          <span>Logo</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void uploadLogo(file);
            }}
          />
        </label>
        {show.logoStamp ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="logo-preview" src={`/api/logo?v=${show.logoStamp}`} alt="" />
        ) : null}
        <p className="hint">
          {show.tips
            ? "Tips are connected. A tipped song waits on you, then moves ahead of songs with a smaller tip."
            : "Tips need STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET on the server."}
          {show.links.request ? ` Webhook ${new URL(show.links.request).origin}/api/stripe/webhook` : ""}
        </p>
        {(show.blocked ?? []).length > 0 ? (
          <div className="blocked">
            <span>Blocked</span>
            {(show.blocked ?? []).map((person) => (
              <button
                key={`${person.name}-${person.fbId ?? ""}-${person.ytId ?? ""}`}
                type="button"
                className="btn tiny"
                onClick={() => void act({ action: "unblock", name: person.name })}
              >
                {person.name}
                {person.fbId ? " · Facebook" : ""}
                {person.ytId ? " · YouTube" : ""} · Unblock
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (!ending) {
              setEnding(true);
              return;
            }
            setEnding(false);
            void act({ action: "end-night" });
          }}
        >
          {ending ? "Save the night and clear the set" : "End night"}
        </button>
      </form>
      ) : null}
    </main>
  );
}

function BlockedPeople({
  people,
  onUnblock,
}: {
  people: { name: string; fbId: string | null; ytId: string | null }[];
  onUnblock: (name: string) => void;
}) {
  return (
    <div className="blocked">
      <span>Blocked</span>
      {people.map((person) => (
        <button
          key={`${person.name}-${person.fbId ?? ""}-${person.ytId ?? ""}`}
          type="button"
          className="btn tiny"
          onClick={() => onUnblock(person.name)}
        >
          {person.name}
          {person.fbId ? " · Facebook" : ""}
          {person.ytId ? " · YouTube" : ""} · Unblock
        </button>
      ))}
    </div>
  );
}

function Lane({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="lane">
      <div className="panel-head">
        <h2>{title}</h2>
        <span>{String(count).padStart(2, "0")}</span>
      </div>
      <div className="lane-body">{count === 0 ? <p className="empty-copy">{empty}</p> : children}</div>
    </section>
  );
}

function TrackRow({
  track,
  index,
  note,
  children,
}: {
  track: Track;
  index?: number;
  note?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <article className="row">
      {index !== undefined ? <span className="index">{String(index + 1).padStart(2, "0")}</span> : null}
      <div>
        <h3>{track.title}</h3>
        <p>
          {track.artist}
          <em> · {track.requester}</em>
          {track.source === "facebook" ? <em> · Facebook</em> : null}
          {track.source === "youtube" ? <em> · YouTube</em> : null}
          {track.tipCents > 0 ? <em> · {money(track.tipCents)} tip</em> : null}
        </p>
        {note}
      </div>
      {children ? <div className="row-actions">{children}</div> : null}
    </article>
  );
}

function Choice<T extends Accent | Position | Skin>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="segment">
        {options.map(([option, name]) => (
          <button
            key={option}
            type="button"
            className={option === value ? "on" : ""}
            onClick={() => onChange(option)}
          >
            {name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
