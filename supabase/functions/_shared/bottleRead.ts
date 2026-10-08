// Reading the label on a photographed bottle. Plain TypeScript (no Deno APIs)
// so scripts/bottleRead.check.ts can run it under Node too.

/** One bottle as its label reads. lib/bottleMatch.ts finds it in the catalog. */
export interface BottleReading {
  /** The maker or brand ("Tanqueray", "Carpano"), or null when no brand is printed. */
  brand: string | null;
  /** The full product name, brand included ("Tanqueray No. Ten"). */
  name: string;
  /** What kind of bottle it is, plainly ("London dry gin", "Sweet vermouth"). */
  kind: string | null;
  /** Alcohol by volume, in percent, when it's printed. */
  abv: number | null;
}

export interface BottlesReading {
  bottles: BottleReading[];
}

// A shelf photo can hold a few; more than this is a stock count, not a photo.
const MAX_BOTTLES = 12;

export const BOTTLE_READ_PROMPT = `You are reading the labels on bottles in a photo, for a cocktail app that keeps track of the bottles on someone's bar.

List each bottle whose label you can read, front to back and left to right. Skip a bottle when you can't read its brand or product name; never guess one from the bottle's shape or colour alone.

For each bottle:
- brand: the maker or brand as printed (e.g. "Tanqueray", "Carpano", "Buffalo Trace"). null if no brand is printed.
- name: the product name as a bartender would write it, brand first, without the size or ABV (e.g. "Tanqueray No. Ten", "Carpano Antica Formula", "Buffalo Trace Bourbon"). Include an age statement when printed ("Hampden Estate 8 Year Old"). Use title case.
- kind: what the bottle is, in a few plain words (e.g. "London dry gin", "Sweet vermouth", "Bourbon", "Amaro", "Orange liqueur", "Aromatic bitters"). null if you can't tell.
- abv: the alcohol by volume as a number in percent (e.g. 43.1). null if it isn't printed.

Return an empty list if there is no readable bottle in the photo.`;

/** The reply shape, as a Gemini response schema. */
export const BOTTLE_READ_SCHEMA = {
  type: "OBJECT",
  properties: {
    bottles: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          brand: { type: "STRING", nullable: true },
          name: { type: "STRING" },
          kind: { type: "STRING", nullable: true },
          abv: { type: "NUMBER", nullable: true },
        },
        required: ["name"],
      },
    },
  },
  required: ["bottles"],
};

/** One line of text: no line breaks, single spaces, at most `max` characters. */
function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

/** 43.1, "43.1%", "40 % vol" → a number from 0 to 100, else null. */
export function cleanAbv(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(clean(value, 20).replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0] ?? NaN);
  return Number.isFinite(n) && n > 0 && n <= 100 ? Math.round(n * 10) / 10 : null;
}

/**
 * The model's reply, made safe to hand to the app: trimmed, capped, with
 * nameless bottles and repeats dropped. Anything not shaped right is skipped.
 */
export function cleanBottlesReading(raw: unknown): BottlesReading {
  const reply = (raw && typeof raw === "object" ? raw : {}) as { bottles?: unknown };
  const bottles: BottleReading[] = [];
  const seen = new Set<string>();
  for (const b of Array.isArray(reply.bottles) ? reply.bottles : []) {
    if (bottles.length >= MAX_BOTTLES) break;
    const bottle = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
    const name = clean(bottle.name, 100);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    bottles.push({ brand: clean(bottle.brand, 60) || null, name, kind: clean(bottle.kind, 60) || null, abv: cleanAbv(bottle.abv) });
  }
  return { bottles };
}

/**
 * What a local stack returns instead of calling the model: one bottle the
 * seeded catalog has, one it has two styles of, and one it doesn't have.
 */
export const MOCK_BOTTLE_REPLY = {
  bottles: [
    { brand: "Beefeater", name: "Beefeater London Dry Gin", kind: "London dry gin", abv: 40 },
    { brand: "Dolin", name: "Dolin Vermouth", kind: "Vermouth", abv: 17.5 },
    { brand: "Pocket Fox", name: "Pocket Fox Smoked Pear Brandy", kind: "Brandy", abv: 41 },
  ],
};
