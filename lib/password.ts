import { randomInt } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const file = path.join(process.cwd(), "data", "phone-password");

const WORDS = [
  "amber",
  "booth",
  "vinyl",
  "night",
  "stage",
  "brass",
  "velvet",
  "signal",
  "chorus",
  "encore",
  "lantern",
  "harbor",
  "ribbon",
  "cinder",
  "marble",
  "orbit",
  "tempo",
  "willow",
  "copper",
  "quartz",
];

function phrase(): string {
  const pick = () => WORDS[randomInt(WORDS.length)];
  return `${pick()}-${pick()}-${pick()}`;
}

export async function phonePassword(): Promise<string> {
  try {
    const existing = (await fs.readFile(file, "utf8")).trim();
    if (existing) return existing;
  } catch {
    // Created the first time the booth opens.
  }
  const created = phrase();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${created}\n`, { mode: 0o600 });
  return created;
}

export async function rotatePhonePassword(): Promise<string> {
  const created = phrase();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${created}\n`, { mode: 0o600 });
  return created;
}

export async function passwordMatches(input: string): Promise<boolean> {
  const expected = await phonePassword();
  return input.trim() === expected;
}

let logged = false;

export async function publishPhonePassword(): Promise<string> {
  const password = await phonePassword();
  if (!logged) {
    console.log(`Phone password  ${password}`);
    logged = true;
  }
  return password;
}
