// A bring-in, recorded (public.bring_in_batches, 20261013800000) so Brought
// in can list what it made, Bring in can offer "Last time", and Undo all can
// take it back until tomorrow. Pure: the hooks are hooks/useBringInBatches.

export type BatchKind = 'menu' | 'recipes' | 'bottles';

/** What Brought in lists. Plain JSON: it's stored as is and cached. */
export interface BatchSummary {
  kind: BatchKind;
  /** Drinks it made, and drinks it found you already had. */
  drinksNew: number;
  drinksHad: number;
  /** Names of the house preps and the bought ingredients it made. */
  preps: string[];
  ingredients: string[];
  /** Bottles it put on a shelf (or into a venue's ingredients). */
  bottles: number;
  /** New drinks with no amounts yet (read from a menu), for "Snap the specs". */
  noAmounts: number;
  /** New preps without a recipe, for "Add". */
  prepsNoRecipe: { id: string; name: string }[];
}

export interface BringInBatch {
  id: string;
  barId: string | null;
  source: string;
  title: string;
  menuId: string | null;
  itemIds: string[];
  summary: BatchSummary;
  createdAt: string;
  undoneAt: string | null;
}

/** The row to insert. */
export interface BatchInput {
  barId: string | null;
  source: string;
  title: string;
  menuId: string | null;
  itemIds: string[];
  shelfIds: string[];
  prices: { id: string; price: string }[];
  summary: BatchSummary;
}

export const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

export const emptySummary = (kind: BatchKind): BatchSummary => ({ kind, drinksNew: 0, drinksHad: 0, preps: [], ingredients: [], bottles: 0, noAmounts: 0, prepsNoRecipe: [] });

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);

/** A stored summary, made safe to read (older or hand-edited rows fill with zeros). */
export function readSummary(raw: unknown): BatchSummary {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const kind: BatchKind = s.kind === 'menu' || s.kind === 'bottles' ? s.kind : 'recipes';
  const prepsNoRecipe = Array.isArray(s.prepsNoRecipe)
    ? s.prepsNoRecipe.flatMap((p) => (p && typeof p === 'object' && typeof (p as { id?: unknown }).id === 'string' && typeof (p as { name?: unknown }).name === 'string' ? [{ id: (p as { id: string }).id, name: (p as { name: string }).name }] : []))
    : [];
  return { kind, drinksNew: count(s.drinksNew), drinksHad: count(s.drinksHad), preps: strings(s.preps), ingredients: strings(s.ingredients), bottles: count(s.bottles), noAmounts: count(s.noAmounts), prepsNoRecipe };
}

/** A database row as a batch. */
export function toBatch(row: Record<string, unknown>): BringInBatch {
  return {
    id: String(row.id),
    barId: typeof row.bar_id === 'string' ? row.bar_id : null,
    source: typeof row.source === 'string' ? row.source : '',
    title: typeof row.title === 'string' ? row.title : '',
    menuId: typeof row.menu_id === 'string' ? row.menu_id : null,
    itemIds: strings(row.item_ids),
    summary: readSummary(row.summary),
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    undoneAt: typeof row.undone_at === 'string' ? row.undone_at : null,
  };
}

/** Can Undo all still take it back? */
export function canUndo(batch: Pick<BringInBatch, 'createdAt' | 'undoneAt'>, now: number = Date.now()): boolean {
  return !batch.undoneAt && now - Date.parse(batch.createdAt) < UNDO_WINDOW_MS;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "8 drinks", "4 bottles": the size of it, for Last time. */
export function batchSize(summary: BatchSummary): string {
  if (summary.kind === 'bottles') return plural(summary.bottles, 'bottle');
  return plural(summary.drinksNew + summary.drinksHad, 'drink');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2 Oct", in the viewer's own time zone. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Bring in's "Last time" row: "Spring menu, 8 drinks · 2 Oct". */
export function lastTimeLine(batch: Pick<BringInBatch, 'title' | 'summary' | 'createdAt'>): string {
  return `${batch.title}, ${batchSize(batch.summary)} · ${shortDate(batch.createdAt)}`;
}

/** "From 2 menu photos, 8 Oct." */
export function fromLine(batch: Pick<BringInBatch, 'source' | 'createdAt'>): string {
  return `From ${batch.source}, ${shortDate(batch.createdAt)}.`;
}

/** What it came from: "a menu photo", "2 menu photos", "a link", "pasted text". */
export function sourceLabel(kind: BatchKind, input: { files: number; pdfs?: number; link?: boolean }): string {
  if (input.link) return 'a link';
  if (!input.files) return 'pasted text';
  const noun = kind === 'menu' ? 'menu' : kind === 'bottles' ? 'shelf' : 'spec';
  if (input.pdfs && input.pdfs === input.files) return input.files === 1 ? `a ${noun} PDF` : `${input.files} ${noun} PDFs`;
  return input.files === 1 ? `a ${noun} photo` : `${input.files} ${noun} photos`;
}
