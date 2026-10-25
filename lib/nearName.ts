/**
 * How close a name is to what was typed, for "Did you mean" in every search:
 * "salty boy" is close to Salti Boi, "negorni" to Negroni. The same rule as
 * public.near_score (supabase/migrations/20261109100000_near_names.sql), for
 * lists the app already holds; supabase/tests/near-names.test.mjs runs both
 * over every local drink and fails on any difference. Pure; checked by
 * lib/nearName.check.ts.
 */
import { doubleMetaphone } from 'double-metaphone';

import { distance } from './ingredientNames';

// public.discover_fold's translate(): Latin accents off, letter for letter.
const FROM = 'ÀÁÂÃÄÅĀĂĄàáâãäåāăąÇĆĈĊČçćĉċčĎďÈÉÊËĒĔĖĘĚèéêëēĕėęěĜĞĠĢĝğġģĤĥÌÍÎÏĨĪĬĮİìíîïĩīĭįĴĵĶķĹĻĽĺļľÑŃŅŇñńņňÒÓÔÕÖŌŎŐòóôõöōŏőŔŖŘŕŗřŚŜŞŠśŝşšŢŤţťÙÚÛÜŨŪŬŮŰŲùúûüũūŭůűųŴŵÝŸŶýÿŷŹŻŽźżž';
const TO = 'AAAAAAAAAaaaaaaaaaCCCCCcccccDdEEEEEEEEEeeeeeeeeeGGGGggggHhIIIIIIIIIiiiiiiiiJjKkLLLlllNNNNnnnnOOOOOOOOooooooooRRRrrrSSSSssssTTttUUUUUUUUUUuuuuuuuuuuWwYYYyyyZZZzzz';
const ACCENTS = new Map([...FROM].map((c, i) => [c, TO[i]]));

/** As the database folds a name: accents off, lower case, one space between words. */
export function nearFold(text: string | null | undefined): string {
  return [...(text ?? '')]
    .map((c) => ACCENTS.get(c) ?? c)
    .join('')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const words = (folded: string) => folded.split(/[^a-z0-9]+/).filter(Boolean);

// dmetaphone keeps four letters.
const sound = (word: string) => doubleMetaphone(word)[0].slice(0, 4);

/** How close one typed word is to one word of the name, or null. */
function wordScore(typed: string, word: string): number | null {
  if (word === typed) return 0;
  if (typed.length < 3) return null;
  if (word.startsWith(typed)) return 1;
  if (typed.length > 64 || word.length > 64) return null;
  const slips = typed.length >= 8 ? 2 : 1;
  if ((typed.length > 3 || typed[0] === word[0]) && distance(typed, word, slips) <= slips) return 2;
  const s = sound(typed);
  return s && s === sound(word) ? 3 : null;
}

/**
 * Lower is closer; null when the name isn't close. Every typed word lands on
 * a word of the name: the same word (0), its start (1), a letter or two off
 * (2) or the same sound (3), added up. Failing that, the whole name a letter
 * off for every four typed: 10 plus the distance ("jungel bird").
 */
export function nearScore(query: string, name: string): number | null {
  const q = nearFold(query);
  const n = nearFold(name);
  const typed = words(q);
  if (!typed.length) return null;
  const named = words(n);
  let total = 0;
  for (const t of typed) {
    let best: number | null = null;
    for (const w of named) {
      const s = wordScore(t, w);
      if (s !== null && (best === null || s < best)) best = s;
    }
    if (best === null) {
      total = -1;
      break;
    }
    total += best;
  }
  if (total >= 0) return total;
  if (q.length > 255 || n.length > 255) return null;
  const slips = Math.max(1, Math.floor(q.length / 4));
  const d = distance(q, n, slips);
  return d <= slips ? 10 + d : null;
}

/** The closest names first (then the shortest), leaving out those that aren't close. */
export function nearest<T>(query: string, rows: readonly T[], nameOf: (row: T) => string, limit = 5): T[] {
  return rows
    .map((row) => ({ row, name: nameOf(row), score: nearScore(query, nameOf(row)) }))
    .filter((r): r is { row: T; name: string; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((r) => r.row);
}
