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

/**
 * Which part of the rule matched, from closest to loosest: the same word, its
 * start, a slip of a letter or two, the same sound, or the whole name a few
 * letters off. A name's reason is its loosest word's.
 */
export type NearHow = 'same' | 'start' | 'slip' | 'sound' | 'whole';

const LOOSENESS: Record<NearHow, number> = { same: 0, start: 1, slip: 2, sound: 3, whole: 4 };

interface Near {
  score: number;
  how: NearHow;
}

/** How close one typed word is to one word of the name, or null. */
function wordScore(t: Typed, word: string): Near | null {
  if (word === t.word) return { score: 0, how: 'same' };
  if (t.word.length < 3) return null;
  if (word.startsWith(t.word)) return { score: 1, how: 'start' };
  if (t.word.length > 64 || word.length > 64) return null;
  if (t.word.length > 3 || t.word[0] === word[0]) {
    const d = distance(t.word, word, t.slips);
    if (d <= t.slips) return { score: d, how: 'slip' };
  }
  if (t.sound === '' || t.sound !== sound(word)) return null;
  // "tie" sounds like "tai", but "boy" sounds like "bee" too: a short word's sound counts for less.
  return { score: t.word.length >= 4 ? 3 : 4, how: 'sound' };
}

/** The rule for one query, with which part matched; nearMatcher's scores. */
function matcher(query: string): (name: string) => Near | null {
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
    let how: NearHow = 'same';
    for (const t of typed) {
      let best: Near | null = null;
      for (const w of named) {
        const s = wordScore(t, w);
        if (s !== null && (best === null || s.score < best.score)) best = s;
      }
      if (best === null) return whole(q, [...n], slips);
      total += best.score;
      if (LOOSENESS[best.how] > LOOSENESS[how]) how = best.how;
    }
    return { score: total, how };
  };
}

/**
 * The rule for one query, to run over many names: lower is closer, null when
 * the name isn't close. Every typed word lands on a word of the name: the same
 * word (0), its start (1), a letter or two off (1 or 2) or the same sound (3; 4 for a three-letter word),
 * added up. Failing that, the whole name a letter off for every four typed:
 * 10 plus the distance ("jungel bird"). Lengths count characters, as SQL does.
 */
export function nearMatcher(query: string): (name: string) => number | null {
  const match = matcher(query);
  return (name) => match(name)?.score ?? null;
}

/** Why a name is close to what was typed (NearHow), or null when it isn't. */
export function nearReason(query: string, name: string): NearHow | null {
  return matcher(query)(name)?.how ?? null;
}

function whole(q: string[], n: string[], slips: number): Near | null {
  if (q.length > 255 || n.length > 255) return null;
  const d = distance(q, n, slips);
  return d <= slips ? { score: 10 + d, how: 'whole' } : null;
}

/** nearMatcher for one name. */
export function nearScore(query: string, name: string): number | null {
  return nearMatcher(query)(name);
}

/**
 * nearScore for a person's name: also tries the first typed word cut to three
 * letters, so a short form finds the full name ("matt reisler" finds Mathew
 * Resler) while "mark resler" doesn't. Only with two or more words: the last
 * name does the narrowing. The same rule as public.person_near_score.
 */
export function personNearScore(query: string, name: string): number | null {
  const typed = words(nearFold(query));
  const plain = nearScore(query, name);
  if (typed.length < 2 || typed[0].length <= 3) return plain;
  const short = nearScore([typed[0].slice(0, 3), ...typed.slice(1)].join(' '), name);
  return plain === null ? short : short === null ? plain : Math.min(plain, short);
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

/** nearest() over the rows a search didn't already show: "Did you mean" after what matched. Nothing for an empty query. */
export function nearAfter<T>(query: string, rows: readonly T[], shown: readonly T[], nameOf: (row: T) => string, limit = 3): T[] {
  if (!query.trim()) return [];
  const seen = new Set(shown);
  return nearest(query, rows.filter((r) => !seen.has(r)), nameOf, limit);
}
