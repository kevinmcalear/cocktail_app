import { useCallback, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Caption, Field, PencilState, useDs, useToast } from '@/components/ds';
import { PaperStack } from '@/components/paper/PaperStack';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { RowDivider, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useItemSketches } from '@/hooks/useItemSketch';
import { usePrintSet, type PrintSet } from '@/hooks/usePrintSet';
import { showMessage } from '@/lib/dialogs';
import { PAPER, type PaperPage } from '@/lib/paper/page';
import { menuPoster } from '@/lib/paper/poster';
import { listOnNow, parseTables, runSheet, specSheet, studySheets, tableCards } from '@/lib/paper/print';
import { printPages } from '@/lib/paper/printOut';

import { SHEET_KINDS, SHEETS, type SheetKind } from './sheets';

type PageView = ComponentRef<typeof View>;

/** One row of the print set, ready to show and print: its pages, and Print once they've painted. */
export function usePrintSheet(menuId: string, kind: SheetKind) {
  const set = usePrintSet(menuId);
  const ids = kind === 'poster' ? set.drinks.map((d) => d.id) : [];
  const sketches = useItemSketches(ids);
  // Table cards: which tables, typed when printing ("12" is tables 1 to 12).
  const [tablesText, setTables] = useState('1-12');
  const tables = useMemo(() => parseTables(tablesText), [tablesText]);
  const pages = useMemo(() => (sketches.ready ? sheetPages(kind, set, (id) => !!sketches.byId[id], tables) : []), [kind, set, sketches, tables]);
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
  /** Prints this sheet's pages, then `more` (the desk's second sheet) in the same go. */
  const print = async (more: PageView[] = [], also?: string) => {
    if (!views.current || busy) return;
    setBusy(true);
    try {
      const result = await printPages([...views.current, ...more], set.paper, also ? `${title} and ${also}` : title);
      if (result === 'shared') toast.show({ title: 'Printing needs the latest app. Shared a picture instead.' });
    } catch {
      showMessage('Couldn’t print', 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };
  return { kind, set, pages, sketches: sketches.byId, onReady, ready, canPrint: ready === kind && !busy, print, views: () => views.current, tablesText, setTables };
}

/**
 * What a row prints: its name and paper over the pages, or why there are
 * none. `onPick` (the desk's two sheets) makes the name a choice of sheet.
 */
export function PrintPagesView({ kind, sheet, width, onPick }: { kind: SheetKind; sheet: ReturnType<typeof usePrintSheet>; width: number; onPick?: (k: SheetKind) => void }) {
  const { set, pages } = sheet;
  const state = stateOf(set, kind, pages.length);
  const caption = `${SHEETS[kind].label} · ${PAPER[set.paper].name}${pages.length > 1 && !state ? ` · ${pages.length} pages` : ''}`;
  const head = onPick ? <SheetChoice caption={caption} set={set} onPick={onPick} /> : state ? null : <Caption tone="muted">{caption}</Caption>;
  return (
    <View style={styles.view}>
      {kind === 'table' && set.pageUrl ? (
        <Field label="Tables" hint="One card a table: 12 prints 1 to 12, or list them (1-8, 12)." value={sheet.tablesText} onChangeText={sheet.setTables} keyboardType="numbers-and-punctuation" autoCorrect={false} maxLength={60} />
      ) : null}
      {head}
      {state ? <PencilState {...state} /> : <PaperStack key={kind} pages={pages} paper={set.paper} width={width} sketches={sheet.sketches} onReady={sheet.onReady} />}
    </View>
  );
}

/** The desk's sheet name: tap it to show another of the six in its place. */
function SheetChoice({ caption, set, onPick }: { caption: string; set: PrintSet; onPick: (k: SheetKind) => void }) {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable role="button" aria-label={`${caption}. Show another sheet`} onPress={() => setOpen(true)} style={styles.choice}>
        <Caption tone="muted">{caption}</Caption>
        <IconSymbol name="chevron.down" size={12} color={ds.c.muted} />
      </Pressable>
      <MenuSheet visible={open} onClose={() => setOpen(false)} title="Show" plain>
        {SHEET_KINDS.map((k, i) => (
          <View key={k}>
            {i ? <RowDivider /> : null}
            <SettingsRow
              icon={SHEETS[k].icon}
              label={SHEETS[k].label}
              detail={SHEETS[k].detail(set)}
              onPress={() => {
                setOpen(false);
                onPick(k);
              }}
            />
          </View>
        ))}
      </MenuSheet>
    </>
  );
}

function stateOf(set: PrintSet, kind: SheetKind, pages: number): Parameters<typeof PencilState>[0] | null {
  // The list on now still prints with nothing on it (it says so); the others are a page per drink.
  if (set.bar && !set.loading && kind === 'table') {
    // The code opens the bar's page with the table: no page, nothing for it to open.
    if (!set.pageUrl) return { kind: 'empty', title: 'Table cards open your bar’s page.', detail: 'Set it up in Publishing, then print them here.' };
    if (!pages) return { kind: 'empty', title: 'Type the tables to print, like 1-12.' };
  } else if (set.bar && !set.loading && !set.drinks.length && kind !== 'list' && kind !== 'table') return { kind: 'empty', title: 'No drinks on this menu yet.' };
  if (set.failed) return { kind: 'error', title: 'Couldn’t set the sheets', detail: 'Check your connection and try again.', action: { label: 'Try again', onPress: set.retry } };
  if (set.missing) return { kind: 'empty', title: 'This menu isn’t there any more, or it isn’t yours to see.' };
  if (set.loading || (set.bar && !pages)) return { kind: 'loading', title: 'Setting the sheets…' };
  if (!set.bar) return { kind: 'empty', title: 'The print set is for a bar’s menus.', detail: 'Share a home menu from its page instead.' };
  return null;
}

/** The pages one row prints. `drawn` says which drinks have a drawing, for the poster. */
export function sheetPages(kind: SheetKind, set: PrintSet, drawn: (id: string) => boolean, tables: number[] = []): PaperPage[] {
  const { bar, drinks, menuName, date, paper } = set;
  if (!bar) return [];
  switch (kind) {
    case 'list':
      return listOnNow({ bar, menuName, drinks, date, team: set.team, paper });
    case 'run':
      return runSheet(bar, drinks, date, paper);
    case 'spec':
      return drinks.map((d) => specSheet(bar, d, date, paper));
    case 'study':
      return studySheets(bar, menuName, drinks, paper);
    case 'table':
      return set.pageUrl ? tableCards(bar, tables.map((n) => ({ n, url: `${set.pageUrl}?table=${n}` })), paper) : [];
    case 'poster':
      return [menuPoster({ name: menuName, eyebrow: bar.name, drinks: drinks.map((d) => ({ id: d.id, name: d.name, drawn: drawn(d.id) })), accent: bar.accent, face: bar.face, scheme: 'light' }, paper)];
  }
}

const styles = StyleSheet.create({
  view: { gap: space.sm },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start' },
});
