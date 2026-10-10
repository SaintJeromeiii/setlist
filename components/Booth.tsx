"use client";

import { useEffect, useRef, useState } from "react";
import Mark from "@/components/Mark";
import { useShow } from "@/components/use-show";
import type { Accent, Position, Track } from "@/lib/types";

export default function Booth() {
  const { show, error, setError, send } = useShow();
  const [copied, setCopied] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [requester, setRequester] = useState("");
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [spotify, setSpotify] = useState("");
  const [looking, setLooking] = useState(false);
  const [venue, setVenue] = useState("Setlist");
  const venueFocused = useRef(false);

  useEffect(() => {
    if (!show || venueFocused.current) return;
    setVenue(show.settings.venueName);
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

  async function copy(kind: string, path: string) {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1400);
  }

  async function lookup() {
    setLooking(true);
    setError(null);
    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
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

  async function act(body: Record<string, unknown>) {
    try {
      await send(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the set.");
    }
  }

  if (!show) {
    return (
      <main className="booth">
        <p className="booting">Opening the booth…</p>
      </main>
    );
  }

  const idle = !show.nowPlaying && show.queue.length === 0 && show.pending.length === 0;

  return (
    <main className="booth" data-accent={show.settings.accent}>
      <header className="top">
        <div>
          <p className="wordmark">Setlist</p>
          <h1>The booth</h1>
        </div>
        <div className="links">
          <button type="button" className="btn" onClick={() => copy("overlay", "/overlay")}>
            {copied === "overlay" ? "Copied" : "Copy overlay link"}
          </button>
          <button type="button" className="btn" onClick={() => copy("request", "/request")}>
            {copied === "request" ? "Copied" : "Copy request link"}
          </button>
        </div>
      </header>

      <div className="desk">
        <section className="stage-column">
          <div className="monitor">
            <div className={`anchor ${show.settings.position}`}>
              <Mark show={show} />
            </div>
            {!show.nowPlaying ? <p className="stage-idle">Clear until a song takes the stage.</p> : null}
          </div>
        </section>

        <section className="stage-card">
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
      </div>

      <p className="hint">
        In OBS, add a Browser Source at 1920×1080 and paste the overlay link. Play the audio in Spotify or
        your DJ software. Setlist only puts the song on screen. Press N for the next track.
      </p>

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

      {error ? <p className="banner">{error}</p> : null}

      <div className="lanes">
        <Lane title="Requests" count={show.pending.length} empty="Nothing waiting.">
          {show.pending.map((track) => (
            <TrackRow key={track.id} track={track}>
              <button type="button" className="btn tiny primary" onClick={() => void act({ action: "approve", id: track.id })}>
                Queue
              </button>
              <button type="button" className="btn tiny" onClick={() => void act({ action: "play", id: track.id })}>
                Play
              </button>
              <button type="button" className="btn tiny quiet" onClick={() => void act({ action: "pass", id: track.id })}>
                Pass
              </button>
            </TrackRow>
          ))}
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
            </TrackRow>
          ))}
        </Lane>
        <Lane title="Played" count={show.recent.length} empty="No songs yet.">
          {show.recent.map((track) => (
            <TrackRow key={track.id} track={track} />
          ))}
        </Lane>
      </div>

      <form
        className="settings"
        onSubmit={(event) => {
          event.preventDefault();
          void act({ action: "settings", ...show.settings, venueName: venue });
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
      </form>
    </main>
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
  children,
}: {
  track: Track;
  index?: number;
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
        </p>
      </div>
      {children ? <div className="row-actions">{children}</div> : null}
    </article>
  );
}

function Choice<T extends Accent | Position>({
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
