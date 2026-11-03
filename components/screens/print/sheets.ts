import type { IconName } from '@/components/ds';
import type { PrintSet } from '@/hooks/usePrintSet';

export const SHEET_KINDS = ['list', 'run', 'spec', 'study', 'table', 'poster'] as const;
export type SheetKind = (typeof SHEET_KINDS)[number];

export const isSheetKind = (v: unknown): v is SheetKind => SHEET_KINDS.includes(v as SheetKind);

/** The print set's six rows (Bet-print "Print"), in its order, with what each prints. */
export const SHEETS: Record<SheetKind, { label: string; icon: IconName; detail: (set: PrintSet) => string }> = {
  list: { label: 'The list on now', icon: 'place.menus', detail: (s) => `${s.menuName}, with today’s date and who’s on` },
  run: { label: 'Run sheet', icon: 'doc.text', detail: (s) => `Tonight’s ${s.drinks.length} ${s.drinks.length === 1 ? 'drink' : 'drinks'}` },
  spec: { label: 'Spec sheets', icon: 'flask', detail: () => 'One drink a page' },
  study: { label: 'Study sheets', icon: 'book', detail: (s) => `${s.menuName}, for Learn` },
  table: { label: 'Table cards', icon: 'qrcode', detail: () => 'A code to each drink' },
  poster: { label: 'Menu poster', icon: 'sparkles', detail: () => 'Drawn, in your bar’s look' },
};
