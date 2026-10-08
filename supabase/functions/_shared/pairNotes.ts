/**
 * "Why it works": one plain sentence for a strong pairing, in our own words,
 * from what we already know (each ingredient's taste from the flavor rules,
 * how many drinks pair them, a few of those drinks). No chemistry claims and
 * nobody else's pairing text. Pure TypeScript, so the app's checks import it.
 */
import { ruleFor, TASTE_DIMENSIONS } from "./flavor.ts";

export interface PairToNote {
  a_id: string;
  b_id: string;
  a_name: string;
  b_name: string;
  together: number;
  drinks: string[];
}

/** "smoky, strong" from the rules, or "" when they don't know it. */
export function tasteWords(name: string): string {
  const rule = ruleFor({ name });
  if (!rule) return "";
  const top = TASTE_DIMENSIONS.map((d) => [d, rule.taste[d] ?? 0] as const)
    .filter(([, v]) => v >= 0.4)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 2)
    .map(([d]) => d);
  return [...top, rule.abv >= 0.3 ? "strong" : null].filter(Boolean).join(", ");
}

export function notesPrompt(pairs: readonly PairToNote[]): string {
  const lines = pairs.map((p, i) => {
    const a = tasteWords(p.a_name);
    const b = tasteWords(p.b_name);
    return `${i + 1}. id ${p.a_id}|${p.b_id}: ${p.a_name}${a ? ` (${a})` : ""} with ${p.b_name}${b ? ` (${b})` : ""}; together in ${p.together} drinks, e.g. ${p.drinks.slice(0, 3).join(", ") || "none listed"}.`;
  });
  return [
    "You write short notes for bartenders on why two cocktail ingredients work together.",
    "For each pair, write one plain sentence of 8 to 20 words about how they taste together in a drink:",
    "what one brings to the other (balance, contrast, a shared note). Write it yourself.",
    "Rules: no chemistry or molecule claims, no brand names, no quotes from books, no em dashes, no exclamation marks.",
    "Do not invent history. If you are unsure, say what each brings in plain terms.",
    "",
    ...lines,
    "",
    'Answer as JSON: {"notes": [{"id": "<a_id>|<b_id>", "note": "<sentence>"}]}, one per pair, same ids.',
  ].join("\n");
}

export const notesSchema = {
  type: "object",
  properties: {
    notes: {
      type: "array",
      items: { type: "object", properties: { id: { type: "string" }, note: { type: "string" } }, required: ["id", "note"] },
    },
  },
  required: ["notes"],
};

const BANNED = /\b(molecule|molecular|compound|chemical|ester|terpene|flavor bible)\b/i;

/** One sentence, 6 to 24 words, at most 160 characters, plain. Null when it isn't. */
export function cleanNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let note = raw.replace(/\s+/g, " ").trim().replace(/^["'“”]+|["'“”]+$/g, "");
  note = note.replace(/\s*[\u2014\u2013]\s*/g, ", ").replace(/!/g, ".");
  if (!/[.]$/.test(note)) note = `${note}.`;
  const words = note.split(" ").length;
  if (words < 6 || words > 24 || note.length > 160 || BANNED.test(note)) return null;
  if ((note.match(/[.?]/g) ?? []).length > 1) return null;
  return note;
}

/** The model's answer, kept to the pairs asked about and notes that pass cleanNote. */
export function parseNotes(text: string, asked: readonly PairToNote[]): { a_id: string; b_id: string; note: string }[] {
  const wanted = new Map(asked.map((p) => [`${p.a_id}|${p.b_id}`, p]));
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const notes = (data as { notes?: unknown })?.notes;
  if (!Array.isArray(notes)) return [];
  const out: { a_id: string; b_id: string; note: string }[] = [];
  for (const n of notes) {
    const pair = wanted.get(String((n as { id?: unknown })?.id ?? ""));
    const note = cleanNote((n as { note?: unknown })?.note);
    if (pair && note) {
      out.push({ a_id: pair.a_id, b_id: pair.b_id, note });
      wanted.delete(`${pair.a_id}|${pair.b_id}`);
    }
  }
  return out;
}
