export type CatalogMatch = {
  title: string;
  artist: string;
  artUrl: string | null;
};

type Hit = {
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
};

function norm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function closeness(want: string, found: string): number {
  if (!want || !found) return 0;
  if (want === found) return 3;
  if (want.length < 3) return 0;
  if (found.startsWith(`${want} `) || found.startsWith(`${want}(`)) return 2;
  if (want.startsWith(`${found} `) && found.length >= 3) return 2;
  return 0;
}

function artwork(url: string | undefined): string | null {
  if (!url) return null;
  const https = url.startsWith("http://") ? `https://${url.slice("http://".length)}` : url;
  try {
    const parsed = new URL(https);
    if (parsed.protocol !== "https:") return null;
    return parsed.toString().replace("100x100bb", "300x300bb");
  } catch {
    return null;
  }
}

export async function searchCatalog(title: string, artist: string): Promise<CatalogMatch | null> {
  const term = `${title} ${artist}`.trim();
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=8`,
    { headers: { accept: "application/json" } },
  );
  if (!response.ok) throw new Error("The music catalog didn't answer.");
  const data = (await response.json()) as { results?: Hit[] };
  let best: (CatalogMatch & { score: number }) | null = null;
  for (const hit of data.results ?? []) {
    if (!hit.trackName || !hit.artistName) continue;
    const score = closeness(norm(title), norm(hit.trackName)) + closeness(norm(artist), norm(hit.artistName));
    if (closeness(norm(title), norm(hit.trackName)) === 0 || closeness(norm(artist), norm(hit.artistName)) === 0) continue;
    if (score < 4) continue;
    if (best && score <= best.score) continue;
    best = { score, title: hit.trackName, artist: hit.artistName, artUrl: artwork(hit.artworkUrl100) };
  }
  if (!best) return null;
  return { title: best.title, artist: best.artist, artUrl: best.artUrl };
}
