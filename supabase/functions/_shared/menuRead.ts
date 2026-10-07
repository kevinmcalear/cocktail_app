// Reading a photographed drinks menu. Plain TypeScript (no Deno APIs) so
// scripts/menuRead.check.ts can run it under Node too.

/**
 * What read-menu returns: the same sections and lines the paste matcher
 * (lib/paste.ts parseMenuPaste) works with, plus the ingredients a menu
 * lists under each drink.
 */
export interface MenuReadLine {
  name: string;
  /** Digits as printed without the currency ("18", "19.50"), "MP", or null. */
  price: string | null;
  ingredients: string[];
}

export interface MenuReadSection {
  /** Null: drinks printed before the first heading. */
  name: string | null;
  lines: MenuReadLine[];
}

export interface MenuReading {
  /** The menu's own title, when one is printed. */
  title: string | null;
  sections: MenuReadSection[];
}

const MAX_SECTIONS = 20;
const MAX_LINES = 120;
const MAX_INGREDIENTS = 12;

export const MENU_READ_PROMPT = `You are reading photos of a printed bar or restaurant drinks menu. The photos are pages of one menu, in order.

List every drink on it, in the order printed, grouped under the menu's own section headings (for example "Signatures", "Classics", "Low & no"). Leave out food, and any heading with no drinks under it.

For each drink:
- name: as printed, in title case if it is all caps.
- price: the price as printed, digits only without the currency (e.g. "18" or "19.50"). "MP" for market price. null if no price is printed. If there are several (glass and bottle), the first.
- ingredients: the ingredients or description words listed for it, one ingredient per entry, as printed (e.g. ["Gin", "Campari", "Sweet vermouth"]). Empty if none are listed. Leave out tasting notes and glassware.

title: the menu's name if one is printed at the top, else null.
A section with no printed heading has name null. Never invent drinks or ingredients that are not printed.`;

/** The reply shape, as a Gemini response schema. */
export const MENU_READ_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", nullable: true },
    sections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING", nullable: true },
          drinks: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                price: { type: "STRING", nullable: true },
                ingredients: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: ["name", "ingredients"],
            },
          },
        },
        required: ["drinks"],
      },
    },
  },
  required: ["sections"],
};

/** One line of text: no line breaks, single spaces, at most `max` characters. */
function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max).trim();
}

/** A name the paste matcher can't mistake for a heading or a price: no trailing colon or dash. */
function cleanName(value: unknown, max: number): string {
  return clean(value, max).replace(/[\s:–—-]+$/, "");
}

/** "$18", "18.00", "£12.5", "18 / 90", "¥1,200" → "18", "18.00", "12.5", "18", "1200". "Market price" → "MP". */
export function cleanPrice(value: unknown): string | null {
  const text = clean(value, 40);
  if (!text) return null;
  if (/^(mp|m\.p\.|market( price)?)$/i.test(text)) return "MP";
  // A comma before three digits groups thousands (¥1,200); before one or two it's a decimal (12,50 €).
  const number = text.replace(/(\d),(\d{3})(?!\d)/g, "$1$2").match(/\d+(?:[.,]\d{1,2})?/);
  return number ? number[0].replace(",", ".") : null;
}

/**
 * The model's reply, made safe to hand to the app: trimmed, capped, with
 * empty drinks and sections dropped. Anything not shaped right is skipped.
 */
export function cleanMenuReading(raw: unknown): MenuReading {
  const reply = (raw && typeof raw === "object" ? raw : {}) as { title?: unknown; sections?: unknown };
  const sections: MenuReadSection[] = [];
  let lines = 0;
  for (const s of Array.isArray(reply.sections) ? reply.sections : []) {
    if (sections.length >= MAX_SECTIONS || lines >= MAX_LINES) break;
    const section = (s && typeof s === "object" ? s : {}) as { name?: unknown; drinks?: unknown };
    const out: MenuReadLine[] = [];
    for (const d of Array.isArray(section.drinks) ? section.drinks : []) {
      if (lines >= MAX_LINES) break;
      const drink = (d && typeof d === "object" ? d : {}) as { name?: unknown; price?: unknown; ingredients?: unknown };
      const name = cleanName(drink.name, 80);
      if (!name) continue;
      const ingredients = (Array.isArray(drink.ingredients) ? drink.ingredients : [])
        .map((i) => clean(i, 60))
        .filter(Boolean)
        .slice(0, MAX_INGREDIENTS);
      out.push({ name, price: cleanPrice(drink.price), ingredients });
      lines += 1;
    }
    if (!out.length) continue;
    const heading = cleanName(section.name, 60) || null;
    const last = sections[sections.length - 1];
    // Two pages of one section come back as two sections with the same heading.
    if (last && last.name === heading) last.lines.push(...out);
    else sections.push({ name: heading, lines: out });
  }
  return { title: cleanName(reply.title, 80) || null, sections };
}

/**
 * What a local stack returns instead of calling the model: a short menu with
 * drinks the demo venues have (House Martini, Penicillin) and some they don't.
 */
export const MOCK_MENU_REPLY = {
  title: "Spring Menu",
  sections: [
    {
      name: "Signatures",
      drinks: [
        { name: "House Martini", price: "$19", ingredients: ["Gin", "Dry vermouth", "Lemon twist"] },
        { name: "Garden Gimlet", price: "$17", ingredients: ["Gin", "Cucumber", "Lime", "Basil"] },
        { name: "Paper Plane", price: "18.00", ingredients: ["Bourbon", "Aperol", "Amaro Nonino", "Lemon"] },
      ],
    },
    {
      name: "Classics",
      drinks: [
        { name: "Penicillin", price: "18", ingredients: ["Blended Scotch", "Lemon", "Honey ginger", "Islay Scotch"] },
        { name: "Negroni", price: "16", ingredients: ["Gin", "Campari", "Sweet vermouth"] },
      ],
    },
  ],
};
