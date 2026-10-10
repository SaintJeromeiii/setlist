const WORDS = new Set([
  "fuck",
  "fucking",
  "fucked",
  "fucker",
  "fuckers",
  "fucks",
  "fck",
  "fuk",
  "fuq",
  "fcking",
  "motherfucker",
  "motherfuckers",
  "motherfucking",
  "shit",
  "shits",
  "shitty",
  "shitting",
  "bullshit",
  "bitch",
  "bitches",
  "bitching",
  "asshole",
  "assholes",
  "bastard",
  "bastards",
  "cunt",
  "cunts",
  "pussy",
  "pussies",
  "cock",
  "cocks",
  "cocksucker",
  "whore",
  "whores",
  "slut",
  "sluts",
  "piss",
  "pissed",
  "nigger",
  "niggers",
  "nigga",
  "niggas",
  "faggot",
  "faggots",
  "fag",
  "fags",
  "retard",
  "retards",
  "retarded",
  "spic",
  "spics",
  "kike",
  "kikes",
  "chink",
  "chinks",
  "tranny",
  "trannies",
]);

function flatten(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[@4]/g, "a")
    .replace(/3/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

function collapse(word: string): string {
  return word.replace(/(.)\1+/g, "$1");
}

function hits(word: string, terms: Set<string>): boolean {
  if (!word) return false;
  return terms.has(word) || terms.has(collapse(word));
}

export function refusesLanguage(value: string, extra = ""): boolean {
  const terms = new Set(WORDS);
  for (const word of flatten(extra).split(" ").filter((word) => word.length > 1)) terms.add(word);
  const parts = flatten(value).split(" ").filter(Boolean);
  let run = "";
  for (const part of parts) {
    if (hits(part, terms)) return true;
    if (part.length === 1) {
      run += part;
      if (hits(run, terms)) return true;
      continue;
    }
    run = "";
  }
  return false;
}
