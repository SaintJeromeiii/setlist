import { promises as fs } from "fs";
import path from "path";
import { emptyShow, type Show } from "./types";

const file = path.join(process.cwd(), "data", "show.json");

let chain: Promise<unknown> = Promise.resolve();

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function read(): Promise<Show> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Show;
    if (!parsed || !parsed.settings || !Array.isArray(parsed.tracks)) return emptyShow();
    return parsed;
  } catch {
    return emptyShow();
  }
}

async function write(show: Show): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(show, null, 2));
}

export function updateShow(change: (show: Show) => Show): Promise<Show> {
  return locked(async () => {
    const show = change(await read());
    await write(show);
    return show;
  });
}

export function readShow(): Promise<Show> {
  return locked(() => read());
}
