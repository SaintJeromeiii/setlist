type Links = { overlay: string; request: string; phone: string };

export default function StartHere({
  links,
  copied,
  onCopy,
  onSetup,
}: {
  links: Links;
  copied: string | null;
  onCopy: (kind: "overlay" | "request" | "phone") => void;
  onSetup: () => void;
}) {
  return (
    <ol className="start-steps">
      <li>
        <span className="num">1</span>
        <div>
          <h2>Keep this window open</h2>
          <p>
            This is the booth. Leave Setlist open while you play. Listeners never use this screen.
          </p>
        </div>
      </li>
      <li>
        <span className="num">2</span>
        <div>
          <h2>Put the card on the stream</h2>
          <p>
            In OBS, put the webcam on the bottom. Add one browser source on top at 1920×1080 and paste the overlay
            link. The card sits on the picture and the camera shows through.
          </p>
          <p className="link-line">{links.overlay}</p>
          <button type="button" className="btn" onClick={() => onCopy("overlay")}>
            {copied === "overlay" ? "Copied" : "Copy overlay link"}
          </button>
        </div>
      </li>
      <li>
        <span className="num">3</span>
        <div>
          <h2>Share the request link</h2>
          <p>
            Paste it in the stream title, a panel, or chat. People on the same Wi-Fi open it and send a song. You
            approve it before it goes on stage.
          </p>
          {links.request ? (
            <>
              <p className="link-line">{links.request}</p>
              <button type="button" className="btn" onClick={() => onCopy("request")}>
                {copied === "request" ? "Copied" : "Copy request link"}
              </button>
            </>
          ) : (
            <p>This computer has no network address yet, so phones cannot open requests.</p>
          )}
        </div>
      </li>
      <li>
        <span className="num">4</span>
        <div>
          <h2>Listen to YouTube chat</h2>
          <p>
            When the stream is live, open Setup and paste tonight’s watch link under YouTube Live. Press Listen to
            this live. A chat line like <strong>Song - Artist</strong> becomes a request under that person’s YouTube
            name. There is no API key. The chat has to be public.
          </p>
          <button type="button" className="btn" onClick={onSetup}>
            Open Setup
          </button>
        </div>
      </li>
      <li>
        <span className="num">5</span>
        <div>
          <h2>Run the set</h2>
          <p>
            On The set, press Queue or Play on a request. Press N for the next song. When the night is over, open
            Setup and end the night. The phone booth password is already on Setup if you want the set on a second
            screen.
          </p>
          {links.phone ? <p className="link-line">Phone booth: {links.phone}</p> : null}
        </div>
      </li>
    </ol>
  );
}
