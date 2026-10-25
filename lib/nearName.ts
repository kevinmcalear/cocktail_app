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

interface Typed {
  word: string;
  slips: number;
  sound: string;
}

/** How close one typed word is to one word of the name, or null. */
function wordScore(t: Typed, word: string): number | null {
  if (word === t.word) return 0;
  if (t.word.length < 3) return null;
  if (word.startsWith(t.word)) return 1;
  if (t.word.length > 64 || word.length > 64) return null;
  if ((t.word.length > 3 || t.word[0] === word[0]) && distance(t.word, word, t.slips) <= t.slips) return 2;
  return t.sound && t.sound === sound(word) ? 3 : null;
}

/**
 * The rule for one query, to run over many names: lower is closer, null when
 * the name isn't close. Every typed word lands on a word of the name: the same
 * word (0), its start (1), a letter or two off (2) or the same sound (3),
 * added up. Failing that, the whole name a letter off for every four typed:
 * 10 plus the distance ("jungel bird"). Lengths count characters, as SQL does.
 */
export function nearMatcher(query: string): (name: string) => number | null {
  const q = [...nearFold(query)];
  const typed: Typed[] = words(q.join('')).map((word) => ({
    word,
    slips: word.length >= 8 ? 2 : 1,
    sound: word.length >= 3 && word.length <= 64 ? sound(word) : '',
  }));
  const slips = Math.max(1, Math.floor(q.length / 4));
  return (name) => {
    if (!typed.length) return null;
    const n = nearFold(name);
    const named = words(n);
    let total = 0;
    for (const t of typed) {
      let best: number | null = null;
      for (const w of named) {
        const s = wordScore(t, w);
        if (s !== null && (best === null || s < best)) best = s;
      }
      if (best === null) return whole(q, [...n], slips);
      total += best;
    }
    return total;
  };
}

function whole(q: string[], n: string[], slips: number): number | null {
  if (q.length > 255 || n.length > 255) return null;
  const d = distance(q, n, slips);
  return d <= slips ? 10 + d : null;
}

/** nearMatcher for one name. */
export function nearScore(query: string, name: string): number | null {
  return nearMatcher(query)(name);
}

/** The closest names first (then the shortest), leaving out those that aren't close. */
export function nearest<T>(query: string, rows: readonly T[], nameOf: (row: T) => string, limit = 5): T[] {
  const score = nearMatcher(query);
  return rows
    .map((row) => {
      const name = nameOf(row);
      return { row, name, score: score(name) };
    })
    .filter((r): r is { row: T; name: string; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((r) => r.row);
}
