import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Button, Caption, GlassButton, Headline, PencilState, Surface, useDs, useGutter } from '@/components/ds';
import { Crumbs } from '@/components/nav/PageFrame';
import { RowDivider, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { layout, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { usePrintSet, type PrintSet } from '@/hooks/usePrintSet';

import { PrintPagesView, usePrintSheet } from './PrintPages';
import { SHEET_KINDS, SHEETS, type SheetKind } from './sheets';

// The list beside the sheet on wide web (Bet-print-desk).
const LIST_W = 560;
const SHEET_W = 600;

/**
 * Print (Bet-print): everything that prints for a menu, in the bar's colour
 * and face. The list on now prints in one tap; the others open their sheets
 * to look at first. On wide web the list sits beside the chosen sheet, with
 * Print in the top bar (Bet-print-desk).
 */
export function PrintScreen({ menuId }: { menuId: string }) {
  return <BackbarTheme>{useIsWideWeb() ? <WidePrint menuId={menuId} /> : <PhonePrint menuId={menuId} />}</BackbarTheme>;
}

function Rows({ set, chosen, onOpen, onPrintList }: { set: PrintSet; chosen?: SheetKind; onOpen: (k: SheetKind) => void; onPrintList: () => void }) {
  const ds = useDs();
  return (
    <View style={styles.rows}>
      <Surface style={styles.card}>
        {SHEET_KINDS.map((k, i) => (
          <View key={k} style={chosen === k ? { backgroundColor: ds.c.raised } : null}>
            {i ? <RowDivider /> : null}
            <SettingsRow
              icon={SHEETS[k].icon}
              label={SHEETS[k].label}
              detail={SHEETS[k].detail(set)}
              onPress={() => onOpen(k)}
              trailing={k === 'list' ? <Button label="Print" size="sm" variant="secondary" accessibilityLabel="Print the list on now" onPress={onPrintList} /> : undefined}
            />
          </View>
        ))}
      </Surface>
      {set.bar ? <Caption tone="muted">{`Everything prints in ${set.bar.name}’s colour and face.`}</Caption> : null}
    </View>
  );
}

function Waiting({ set }: { set: PrintSet }) {
  if (set.failed) return <PencilState kind="error" title="Couldn’t load the menu" detail="Check your connection and try again." action={{ label: 'Try again', onPress: set.retry }} />;
  if (set.missing) return <PencilState kind="empty" title="This menu isn’t there any more, or it isn’t yours to see." />;
  if (set.loading) return <PencilState kind="loading" title="Opening Print…" />;
  return <PencilState kind="empty" title="The print set is for a bar’s menus." detail="Share a home menu from its page instead." />;
}

function PhonePrint({ menuId }: { menuId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const set = usePrintSet(menuId);
  const open = (k: SheetKind, print = false) => router.push(`/print/${k}?menu=${menuId}${print ? '&print=1' : ''}` as Href);
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/menus/${menuId}` as Href));
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm }]}>
      <View style={[styles.head, { paddingHorizontal: gutter }]}>
        <GlassButton icon="xmark" accessibilityLabel="Close" onPress={close} />
        <Headline role="heading" style={styles.title}>
          Print
        </Headline>
        <View style={styles.balance} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: space.lg, paddingBottom: insets.bottom + space.xxl }}>
        {set.bar && !set.loading ? <Rows set={set} onOpen={open} onPrintList={() => open('list', true)} /> : <Waiting set={set} />}
      </ScrollView>
    </View>
  );
}

function WidePrint({ menuId }: { menuId: string }) {
  const ds = useDs();
  const [kind, setKind] = useState<SheetKind>('list');
  const sheet = usePrintSheet(menuId, kind);
  const set = sheet.set;
  // The list's own Print: show the list and print it once the list's own pages have painted.
  const pending = useRef(false);
  const listReady = kind === 'list' && sheet.canPrint;
  useEffect(() => {
    if (!pending.current || !listReady) return;
    pending.current = false;
    void sheet.print();
  }, [listReady, sheet]);
  const printList = () => {
    if (listReady) return void sheet.print();
    pending.current = true;
    setKind('list');
  };
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <View style={[styles.deskBar, { borderBottomColor: ds.c.line }]}>
        <Crumbs trail={[{ label: set.bar?.name ?? 'Menu', href: `/menus/${menuId}` as Href }, { label: 'Print', href: `/print?menu=${menuId}` as Href }]} />
        <Button label="Print" icon="printer" size="sm" accessibilityLabel={`Print ${SHEETS[kind].label.toLowerCase()}`} disabled={!sheet.canPrint} onPress={() => void sheet.print()} />
      </View>
      <View style={styles.desk}>
        <ScrollView style={[styles.list, { borderRightColor: ds.c.line }]} contentContainerStyle={styles.deskPad}>
          {set.bar && !set.loading ? <Rows set={set} chosen={kind} onOpen={setKind} onPrintList={printList} /> : <Waiting set={set} />}
        </ScrollView>
        <ScrollView style={styles.flex} contentContainerStyle={[styles.deskPad, styles.center]}>
          <View style={{ width: SHEET_W }}>{set.bar ? <PrintPagesView kind={kind} sheet={sheet} width={SHEET_W} /> : null}</View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, textAlign: 'center' },
  balance: { width: layout.minTapTarget },
  rows: { gap: space.md },
  card: { padding: 0, overflow: 'hidden' },
  deskBar: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xxxl, borderBottomWidth: StyleSheet.hairlineWidth },
  desk: { flex: 1, flexDirection: 'row' },
  list: { width: LIST_W, flexGrow: 0, borderRightWidth: StyleSheet.hairlineWidth },
  deskPad: { padding: space.xxxl, gap: space.lg },
  center: { alignItems: 'center' },
});
