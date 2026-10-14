import path from "path";

export function dataDir(): string {
  const configured = process.env.SETLIST_DATA_DIR?.trim();
  return configured || path.join(process.cwd(), "data");
}
