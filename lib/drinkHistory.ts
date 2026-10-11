/**
 * A drink's printed history, in the shape the drink page and book pages read
 * (supabase/migrations/20261008120000_drink_history.sql).
 */

export interface Source {
  id: string;
  key: string;
  kind: 'book' | 'web' | 'bar';
  title: string;
  author: string | null;
  year: number | null;
  edition: string | null;
  city: string | null;
  rights: 'public_domain' | 'facts_only';
  euvs_url: string | null;
  archive_url: string | null;
  url: string | null;
}

export interface PrintedLine {
  sort_order: number;
  ingredient_text: string;
  amount_text: string | null;
  amount_ml: number | null;
  note: string | null;
}

export type Relation = 'first_print' | 'version' | 'ancestor';

export interface PrintedRecipe {
  id: string;
  item_id: string;
  printed_name: string | null;
  page_label: string | null;
  page_url: string | null;
  relation: Relation;
  method: string | null;
  quote: string | null;
  notes: string | null;
  source: Source;
  lines: PrintedLine[];
}

/** Oldest first; the first printing ahead of anything else from the same year. */
export function byYear(records: readonly PrintedRecipe[]): PrintedRecipe[] {
  const rank = (r: PrintedRecipe) => (r.relation === 'first_print' ? 0 : r.relation === 'ancestor' ? 1 : 2);
  return [...records].sort((a, b) => (a.source.year ?? 9999) - (b.source.year ?? 9999) || rank(a) - rank(b));
}

/**
 * The records to show for a drink: its own, else the nearest family member's
 * (`familyIds`, nearest first) that has any. Says whose they are.
 */
export function historyFor(records: readonly PrintedRecipe[], familyIds: readonly string[]): { itemId: string; records: PrintedRecipe[] } | null {
  for (const id of familyIds) {
    const own = records.filter((r) => r.item_id === id);
    if (own.length) return { itemId: id, records: byYear(own) };
  }
  return null;
}

/** The lead record: the first printing if there is one, else the oldest. */
export const leadRecord = (records: readonly PrintedRecipe[]) => records.find((r) => r.relation === 'first_print') ?? records[0] ?? null;

export const RELATION_LABEL: Record<Relation, string> = {
  first_print: 'First in print',
  version: 'A later version',
  ancestor: 'An ancestor',
};

/** "Jerry Thomas, New York, 1st edition" */
export function sourceByline(s: Pick<Source, 'author' | 'city' | 'edition'>): string {
  return [s.author, s.city, s.edition && /^\d+(st|nd|rd|th)$/.test(s.edition) ? `${s.edition} edition` : s.edition].filter(Boolean).join(', ');
}

/** Where to read the page: the exact page, else the book on EUVS, else a clean copy or the web source. */
export const readUrl = (r: Pick<PrintedRecipe, 'page_url' | 'source'>) => r.page_url ?? r.source.euvs_url ?? r.source.archive_url ?? r.source.url ?? null;

export const RIGHTS_LABEL: Record<Source['rights'], string> = {
  public_domain: 'Public domain',
  facts_only: 'Still in copyright: ingredients only',
};

const words = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2 && !['de', 'the', 'and', 'juice', 'fresh'].includes(w));

export interface ThenNow {
  name: string;
  then: string | null;
  now: string | null;
}

/**
 * "Then and now": each printed line beside today's amount for the same
 * ingredient ("El Bart Gin" meets "Gin", "Creme de Violette" meets "Crème
 * de violette"), matched on a shared word. Unmatched lines on either side
 * keep their own row with the other side empty.
 */
export function thenAndNow(printed: readonly Pick<PrintedLine, 'ingredient_text' | 'amount_text'>[], now: readonly { ingredient: string | null; amount: string | null }[]): ThenNow[] {
  const left = now.filter((n): n is { ingredient: string; amount: string | null } => !!n.ingredient);
  const used = new Set<number>();
  const rows: ThenNow[] = printed.map((p) => {
    const pw = words(p.ingredient_text);
    const i = left.findIndex((n, j) => !used.has(j) && words(n.ingredient).some((w) => pw.includes(w)));
    if (i < 0) return { name: p.ingredient_text, then: p.amount_text, now: null };
    used.add(i);
    return { name: left[i].ingredient, then: p.amount_text, now: left[i].amount };
  });
  left.forEach((n, j) => {
    if (!used.has(j)) rows.push({ name: n.ingredient, then: null, now: n.amount });
  });
  return rows;
}

/** "Through the years": one line per printing, oldest first; its notes say what changed. */
export function throughTheYears(records: readonly PrintedRecipe[]): { key: string; year: string; line: string }[] {
  return byYear(records).map((r) => {
    const who = r.source.author?.split(/[,(]/)[0].trim().split(' ').at(-1) ?? r.source.title;
    const line = r.notes?.trim() || (r.relation === 'first_print' ? `${who} prints it.` : `${RELATION_LABEL[r.relation]} in ${r.source.title}.`);
    return { key: r.id, year: r.source.year ? String(r.source.year) : '', line };
  });
}
