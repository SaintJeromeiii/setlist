import { promises as fs, readFileSync, statSync } from "fs";
import path from "path";

import { dataDir } from "./paths";

const dir = dataDir();
const kindFile = path.join(dir, "logo.kind");

const KINDS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

type Kind = (typeof KINDS)[keyof typeof KINDS];

const TYPES: Record<Kind, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

function logoPath(kind: Kind): string {
  return path.join(dir, `logo.${kind}`);
}

export async function saveLogo(bytes: Buffer, type: string): Promise<void> {
  const kind = KINDS[type as keyof typeof KINDS];
  if (!kind) throw new Error("Use a PNG, JPEG, or WebP.");
  if (bytes.length > 1_500_000) throw new Error("That logo is too large.");
  await fs.mkdir(dir, { recursive: true });
  await Promise.all(
    (Object.values(KINDS) as Kind[]).map(async (item) => {
      if (item === kind) return;
      await fs.rm(logoPath(item), { force: true });
    }),
  );
  await fs.writeFile(logoPath(kind), bytes);
  await fs.writeFile(kindFile, kind);
}

export function logoStamp(): number {
  try {
    const kind = statKind();
    if (!kind) return 0;
    return Math.round(statSync(logoPath(kind)).mtimeMs);
  } catch {
    return 0;
  }
}

function statKind(): Kind | null {
  try {
    const kind = readFileSync(kindFile, "utf8").trim();
    if (kind === "png" || kind === "jpg" || kind === "webp") return kind;
    return null;
  } catch {
    return null;
  }
}

export async function readLogo(): Promise<{ bytes: Buffer; type: string } | null> {
  try {
    const kind = (await fs.readFile(kindFile, "utf8")).trim();
    if (kind !== "png" && kind !== "jpg" && kind !== "webp") return null;
    const bytes = await fs.readFile(logoPath(kind));
    return { bytes, type: TYPES[kind] };
  } catch {
    return null;
  }
}
