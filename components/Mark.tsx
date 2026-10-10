type MarkShow = {
  settings: { showRequester: boolean; showUpNext: boolean };
  logoUrl?: string | null;
  nowPlaying: {
    id: string;
    title: string;
    artist: string;
    requester: string;
    artUrl: string | null;
  } | null;
  upNext: { title: string; artist: string } | null;
};

function hue(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) % 360;
  return 18 + (hash % 36);
}

function monogram(title: string): string {
  const words = title.split(" ").filter(Boolean);
  const letters = (words[0]?.[0] ?? "") + (words[1]?.[0] ?? "");
  return letters.toUpperCase() || "•";
}

export default function Mark({ show }: { show: MarkShow }) {
  const track = show.nowPlaying;
  if (!track) return null;
  const next = show.settings.showUpNext ? show.upNext : null;
  const tone = hue(`${track.title}${track.artist}`);

  return (
    <article className="mark" key={track.id}>
      <div className="sleeve">
        <div
          className={track.artUrl ? "art" : "art blank"}
          style={
            track.artUrl
              ? undefined
              : { background: `linear-gradient(160deg, hsl(${tone} 28% 28%), hsl(${tone + 18} 18% 12%))` }
          }
        >
          {track.artUrl ? (
            // Spotify album art is a remote CDN image; a plain img avoids optimizer config.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.artUrl} alt="" />
          ) : (
            <span className="disc" aria-hidden>
              <span className="label">{monogram(track.title)}</span>
            </span>
          )}
        </div>
      </div>
      <div className="mark-copy">
        {show.logoUrl ? (
          // The venue logo is served by this booth.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="venue-logo" src={show.logoUrl} alt="" />
        ) : null}
        <p className="eyebrow">
          <span className="live-dot" aria-hidden />
          Now playing
        </p>
        <h2>{track.title}</h2>
        <p className="artist">{track.artist}</p>
        {show.settings.showRequester ? <p className="for">for {track.requester}</p> : null}
        {next ? (
          <p className="up-next">
            <span>Up next</span>
            <strong>{next.title}</strong>
            <em>— {next.artist}</em>
          </p>
        ) : null}
      </div>
    </article>
  );
}
