export function spotifyTrackUrl(input: string): string | null {
  const value = input.trim();
  const uri = value.match(/^spotify:track:([a-zA-Z0-9]+)$/);
  if (uri) return `https://open.spotify.com/track/${uri[1]}`;
  const web = value.match(
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([a-zA-Z0-9]+)/i,
  );
  if (web) return `https://open.spotify.com/track/${web[1]}`;
  return null;
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function lookupSpotify(input: string): Promise<{
  title: string;
  artist: string;
  artUrl: string | null;
}> {
  const url = spotifyTrackUrl(input);
  if (!url) {
    throw new Error("Paste a Spotify song link, not a playlist or album.");
  }

  const [oembedResponse, pageResponse] = await Promise.all([
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`),
    fetch(url, { headers: { "user-agent": "Mozilla/5.0", accept: "text/html" } }),
  ]);
  if (!oembedResponse.ok || !pageResponse.ok) {
    throw new Error("Spotify didn’t recognize that link.");
  }

  const data = (await oembedResponse.json()) as { title?: string; thumbnail_url?: string };
  const html = await pageResponse.text();
  const description = html.match(/property="og:description" content="([^"]+)"/)?.[1];
  const artist = description ? decode(description).split("·")[0]?.trim() : "";
  const title = data.title?.trim();
  if (!title || !artist) {
    throw new Error("That link didn’t include a song and artist.");
  }

  return {
    title,
    artist,
    artUrl: data.thumbnail_url ?? null,
  };
}
