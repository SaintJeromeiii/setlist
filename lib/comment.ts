export function parseSongComment(message: string): { title: string; artist: string } | null {
  let text = message.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  text = text.replace(/^!tip\s+\d+(?:\.\d{1,2})?\s+/i, "");
  text = text.replace(/^!(?:request|sr|song)\b\s*/i, "");
  const match = text.match(/^(.{1,80}?)\s+(?:by|-|–|—)\s+(.{1,80})$/i);
  if (!match) return null;
  const title = match[1].trim();
  const artist = match[2].trim();
  if (!title || !artist) return null;
  return { title, artist };
}
