/**
 * Make mode's reading of a prep's steps: the scaled amounts written into the
 * step where it names an ingredient, a timer from the words when the step
 * has none saved, and the label's dates. Pure; components/screens/make uses it.
 */

export type StepPart = { text: string; amount?: undefined } | { text: string; amount: string };

export interface NamedAmount {
  name: string;
  /** Already scaled and formatted: "664 g". Empty lines are skipped. */
  amount: string;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The words a step might use for a line: its whole name, then its last word ("White sugar", "sugar"). */
function namesFor(name: string): string[] {
  const whole = name.trim().toLowerCase();
  const last = whole.split(/\s+/).pop() ?? '';
  return [...new Set([whole, last.length >= 4 ? last : ''].filter(Boolean))];
}

/**
 * "Combine the sugar and water" → "Combine the", [664 g sugar], "and",
 * [332 ml water]. Each line is marked once, at its first mention; the
 * longest name wins where two overlap.
 */
export function stepParts(body: string, lines: NamedAmount[]): StepPart[] {
  type Hit = { start: number; end: number; amount: string };
  const hits: Hit[] = [];
  for (const line of lines) {
    if (!line.amount) continue;
    for (const word of namesFor(line.name)) {
      const m = new RegExp(`\\b${escape(word)}(es|s)?\\b`, 'i').exec(body);
      if (m) {
        hits.push({ start: m.index, end: m.index + m[0].length, amount: line.amount });
        break;
      }
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const parts: StepPart[] = [];
  let at = 0;
  for (const h of hits) {
    if (h.start < at) continue;
    if (h.start > at) parts.push({ text: body.slice(at, h.start) });
    parts.push({ text: body.slice(h.start, h.end), amount: h.amount });
    at = h.end;
  }
  if (at < body.length) parts.push({ text: body.slice(at) });
  return parts;
}

const UNIT_SECONDS: [RegExp, number][] = [
  [/^(s|sec|secs|second|seconds)$/, 1],
  [/^(m|min|mins|minute|minutes)$/, 60],
  [/^(h|hr|hrs|hour|hours)$/, 3600],
  [/^(d|day|days)$/, 86400],
];

/** The first time a step mentions ("steep 10 minutes", "rest 2 days"), in seconds, up to a day. */
export function timerFromText(body: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(?:to\s*\d+\s*)?([a-z]+)/i.exec(body.replace(/(\d)\s*-\s*\d+/g, '$1'));
  if (!m) return null;
  const unit = UNIT_SECONDS.find(([re]) => re.test(m[2].toLowerCase()));
  if (!unit) return null;
  const seconds = Math.round(Number(m[1]) * unit[1]);
  return seconds > 0 && seconds <= 86400 ? seconds : null;
}

/** "Fri 9 Oct": how the label writes a date. */
export function labelDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** The use-by for a batch made at `made`, or null when the prep doesn't say how long it keeps. */
export function useByDate(made: Date, shelfLifeHours: number | null): Date | null {
  return shelfLifeHours ? new Date(made.getTime() + shelfLifeHours * 3600 * 1000) : null;
}

/** "KM" from "Kevin McAlear", for the label's made-by. */
export function initials(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
}
