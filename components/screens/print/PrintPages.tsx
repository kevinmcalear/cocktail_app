import { useCallback, useMemo, useRef, useState, type ComponentRef } from 'react';
import { View } from 'react-native';

import { Caption, PencilState, useToast } from '@/components/ds';
import { PaperStack } from '@/components/paper/PaperStack';
import { space } from '@/constants/tokens';
import { useItemSketches } from '@/hooks/useItemSketch';
import { usePrintSet, type PrintSet } from '@/hooks/usePrintSet';
import { showMessage } from '@/lib/dialogs';
import { PAPER } from '@/lib/paper/page';
import { printPages } from '@/lib/paper/printOut';

import { SHEETS, sheetPages, type SheetKind } from './sheets';

type PageView = ComponentRef<typeof View>;

/** One row of the print set, ready to show and print: its pages, and Print once they've painted. */
export function usePrintSheet(menuId: string, kind: SheetKind) {
  const set = usePrintSet(menuId);
  const ids = kind === 'poster' ? set.drinks.map((d) => d.id) : [];
  const sketches = useItemSketches(ids);
  const pages = useMemo(() => (sketches.ready ? sheetPages(kind, set, (id) => !!sketches.byId[id]) : []), [kind, set, sketches]);
  const views = useRef<PageView[] | null>(null);
  // Which sheet has painted, so a Print asked for while another sheet showed waits for its own pages.
  const [ready, setReady] = useState<SheetKind | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const onReady = useCallback(
    (v: PageView[] | null) => {
      views.current = v;
      setReady(v ? kind : null);
    },
    [kind],
  );
  const title = `${set.menuName} ${SHEETS[kind].label.toLowerCase()}`;
  const print = async () => {
    if (!views.current || busy) return;
    setBusy(true);
    try {
      const result = await printPages(views.current, 'letter', title);
      if (result === 'shared') toast.show({ title: 'Printing needs the latest app. Shared a picture instead.' });
    } catch {
      showMessage('Couldn’t print', 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };
  return { set, pages, sketches: sketches.byId, onReady, ready, canPrint: ready === kind && !busy, print };
}

/** What a row prints: its name and paper over the pages, or why there are none. */
export function PrintPagesView({ kind, sheet, width }: { kind: SheetKind; sheet: ReturnType<typeof usePrintSheet>; width: number }) {
  const { set, pages } = sheet;
  const state = stateOf(set, kind, pages.length);
  if (state) return <PencilState {...state} />;
  return (
    <View>
      <Caption tone="muted" style={{ marginBottom: space.sm }}>{`${SHEETS[kind].label} · ${PAPER.letter.name}${pages.length > 1 ? ` · ${pages.length} pages` : ''}`}</Caption>
      <PaperStack key={kind} pages={pages} paper="letter" width={width} sketches={sheet.sketches} onReady={sheet.onReady} />
    </View>
  );
}

function stateOf(set: PrintSet, kind: SheetKind, pages: number): Parameters<typeof PencilState>[0] | null {
  // The list on now still prints with nothing on it (it says so); the others are a page per drink.
  if (set.bar && !set.loading && !set.drinks.length && kind !== 'list') return { kind: 'empty', title: 'No drinks on this menu yet.' };
  if (set.failed) return { kind: 'error', title: 'Couldn’t set the sheets', detail: 'Check your connection and try again.', action: { label: 'Try again', onPress: set.retry } };
  if (set.missing) return { kind: 'empty', title: 'This menu isn’t there any more, or it isn’t yours to see.' };
  if (set.loading || (set.bar && !pages)) return { kind: 'loading', title: 'Setting the sheets…' };
  if (!set.bar) return { kind: 'empty', title: 'The print set is for a bar’s menus.', detail: 'Share a home menu from its page instead.' };
  return null;
}
