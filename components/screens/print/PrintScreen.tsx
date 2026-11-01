import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
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

// Two sheets side by side on wide web (Bet-print-desk): the first in a 560 pane, the second centred in the rest.
const PANE_W = 560;
const FIRST_W = PANE_W - 2 * space.xl;
const SECOND_W = 560;

/**
 * Print (Bet-print): everything that prints for a menu, in the bar's colour
 * and face. The list on now prints in one tap; the others open their sheets
 * to look at first. On wide web two sheets sit side by side, the list on now
 * and the run sheet to start, each name a choice of sheet, with Print in the
 * top bar printing both (Bet-print-desk).
 */
export function PrintScreen({ menuId }: { menuId: string }) {
  return <BackbarTheme>{useIsWideWeb() ? <WidePrint menuId={menuId} /> : <PhonePrint menuId={menuId} />}</BackbarTheme>;
}

function Rows({ set, onOpen, onPrintList }: { set: PrintSet; onOpen: (k: SheetKind) => void; onPrintList: () => void }) {
  return (
    <View style={styles.rows}>
      <Surface style={styles.card}>
        {SHEET_KINDS.map((k, i) => (
          <View key={k}>
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
  const open = (k: SheetKind, print = false) => router.push(`/print/sheet?kind=${k}&menu=${menuId}${print ? '&print=1' : ''}` as Href);
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
  const [kinds, setKinds] = useState<[SheetKind, SheetKind]>(['list', 'run']);
  const first = usePrintSheet(menuId, kinds[0]);
  const second = usePrintSheet(menuId, kinds[1]);
  const set = first.set;
  const names = `${SHEETS[kinds[0]].label.toLowerCase()} and ${SHEETS[kinds[1]].label.toLowerCase()}`;
  // Print prints what's on the desk: both sheets, in one go.
  const print = () => void first.print(second.views() ?? [], SHEETS[kinds[1]].label.toLowerCase());
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <View style={[styles.deskBar, { borderBottomColor: ds.c.line }]}>
        <Crumbs trail={[{ label: set.bar?.name ?? 'Menu', href: `/menus/${menuId}` as Href }, { label: 'Print', href: `/print?menu=${menuId}` as Href }]} />
        <Button label="Print" icon="printer" size="sm" accessibilityLabel={`Print ${names}`} disabled={!first.canPrint || !second.canPrint} onPress={print} />
      </View>
      {set.bar && !set.loading ? (
        <View style={styles.desk}>
          <ScrollView style={[styles.pane, { borderRightColor: ds.c.line }]} contentContainerStyle={styles.deskPad}>
            <PrintPagesView kind={kinds[0]} sheet={first} width={FIRST_W} onPick={(k) => setKinds([k, kinds[1]])} />
          </ScrollView>
          <ScrollView style={styles.flex} contentContainerStyle={[styles.deskPad, styles.center]}>
            <View style={{ width: SECOND_W }}>
              <PrintPagesView kind={kinds[1]} sheet={second} width={SECOND_W} onPick={(k) => setKinds([kinds[0], k])} />
            </View>
          </ScrollView>
        </View>
      ) : (
        <View style={styles.deskPad}>
          <Waiting set={set} />
        </View>
      )}
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
  pane: { width: PANE_W, flexGrow: 0, borderRightWidth: StyleSheet.hairlineWidth },
  deskPad: { padding: space.xl, gap: space.lg },
  center: { alignItems: 'center' },
});
