// A classic's first printing beside this page's spec (board drink-phone-classic,
// First in print's "Then and now"): each printed line with today's ml.

export interface ThenLine {
  ingredient_text: string;
  amount_text: string | null;
}

export interface NowLine {
  ingredient: string | null;
  ml: number | null;
}

export interface ThenAndNowRow {
  name: string;
  then: string;
  /** Today's ml, or null when nothing on this page matches. */
  now: number | null;
}

const WORDS = /[a-z]+/g;
// Words that say how, not what: they never decide a match.
const NOISE = new Set(['fresh', 'juice', 'of', 'the', 'a', 'dry', 'liqueur', 'syrup', 'dash', 'dashes', 'or', 'and', 'with', 'squeezed']);
const words = (s: string) => (s.toLowerCase().match(WORDS) ?? []).filter((w) => !NOISE.has(w));

/** The page's line that shares the most telling words with a printed one; null when none share any. */
function match(printed: string, lines: NowLine[]): NowLine | null {
  const want = new Set(words(printed));
  let best: NowLine | null = null;
  let score = 0;
  for (const l of lines) {
    if (!l.ingredient) continue;
    const hits = words(l.ingredient).filter((w) => want.has(w) || [...want].some((x) => x.length > 3 && (w.startsWith(x) || x.startsWith(w)))).length;
    if (hits > score) {
      best = l;
      score = hits;
    }
  }
  return best;
}

/** Each printed line with the ml it is on this page. Empty without printed amounts or page amounts. */
export function thenAndNow(printed: ThenLine[], lines: NowLine[]): ThenAndNowRow[] {
  if (!printed.some((p) => p.amount_text) || !lines.some((l) => l.ml != null)) return [];
  return printed.map((p) => ({ name: p.ingredient_text, then: p.amount_text ?? '', now: match(p.ingredient_text, lines)?.ml ?? null }));
}

/** "Still equal parts." when both were and are equal; null otherwise. */
export function stillEqual(rows: ThenAndNowRow[]): string | null {
  if (rows.length < 2 || rows.some((r) => r.now == null)) return null;
  const same = (xs: (string | number | null)[]) => xs.every((x) => x === xs[0]);
  return same(rows.map((r) => r.then)) && same(rows.map((r) => r.now)) ? 'Still equal parts.' : null;
}
