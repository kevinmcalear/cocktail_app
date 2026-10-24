import type { ReactElement } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, dragDismissesKeyboard, DsText, PressableScale, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { layout, radius, space } from '@/constants/tokens';
import type { ShelfSection } from '@/lib/myBarRows';
import { shelfCountsLine } from '@/lib/myBarText';

import { SectionCards, type SectionCardData } from './SectionCards';

/** What to make's drinks a portrait tablet shows before See all. */
export const TABLET_DRINKS = 4;

interface TabletProps<R extends { key: string }> {
  portrait: boolean;
  counts: Record<ShelfSection, number>;
  cards: SectionCardData[];
  /** What to make's rows, from its heading to its foot. */
  makeRows: R[];
  renderRow: (row: R, prev?: R) => ReactElement | null;
  onOpen: (section: ShelfSection) => void;
  onAdd: (section: ShelfSection) => void;
  /** Clear of the tab bar. */
  bottom: number;
}

/**
 * My Bar on a tablet with no section picked (mybar-tablet-proposal, option
 * C): every section as a card and What to make in a panel, so the whole bar
 * is one screen. Landscape puts the panel down the right; portrait puts it on
 * top with the best few drinks, then the cards. A card opens its section as
 * the phone list.
 */
export function TabletOverview<R extends { key: string }>({ portrait, counts, cards, makeRows, renderRow, onOpen, onAdd, bottom }: TabletProps<R>) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const head = (
    <View style={styles.head}>
      <ScreenHeaderSpacer title="My Bar" />
      <Caption tone="muted">{shelfCountsLine(counts)}</Caption>
    </View>
  );
  const sections = <SectionCards cards={cards} onOpen={onOpen} onAdd={onAdd} />;

  if (!portrait) {
    return (
      <View style={styles.columns}>
        {/* The flex sits on a View: react-native-web's ScrollView keeps only flex 1. */}
        <View style={styles.shelf}>
          <ScrollView contentContainerStyle={[styles.shelfBody, { paddingLeft: gutter, paddingBottom: bottom + space.xl }]}>
            {head}
            {sections}
          </ScrollView>
        </View>
        <View style={[styles.panel, styles.side, { borderColor: ds.c.line, marginTop: insets.top + space.lg, marginRight: gutter, marginBottom: bottom + space.lg }]}>
          <FlatList
            data={makeRows}
            keyExtractor={(r) => r.key}
            renderItem={({ item, index }) => renderRow(item, makeRows[index - 1])}
            windowSize={5}
            {...dragDismissesKeyboard}
            contentContainerStyle={styles.panelBody}
          />
        </View>
      </View>
    );
  }

  // One list: the heading, the panel's rows (each drawing its share of the panel's border), then the cards.
  type Item = { key: 'head' } | { key: 'cards' } | { key: string; row: R; at: number };
  const data: Item[] = [{ key: 'head' }, ...makeRows.map((row, at) => ({ key: row.key, row, at })), { key: 'cards' }];
  const last = makeRows.length - 1;
  return (
    <FlatList
      data={data}
      keyExtractor={(r) => r.key}
      renderItem={({ item }) => {
        if (!('row' in item)) return item.key === 'head' ? head : <View style={styles.cards}>{sections}</View>;
        return (
          <View style={[styles.panelRow, { borderColor: ds.c.line }, item.at === 0 ? styles.panelTop : null, item.at === last ? styles.panelEnd : null]}>
            {renderRow(item.row, makeRows[item.at - 1])}
          </View>
        );
      }}
      windowSize={5}
      {...dragDismissesKeyboard}
      contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom + space.xl }}
    />
  );
}

/** See all, beside What to make's heading: a link in the accent, as drawn. */
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale role="button" onPress={onPress} style={styles.link}>
      <DsText variant="label" tone="accent">
        {label}
      </DsText>
    </PressableScale>
  );
}

const line = StyleSheet.hairlineWidth;

const styles = StyleSheet.create({
  head: { gap: 2, paddingBottom: space.lg },
  columns: { flex: 1, flexDirection: 'row' },
  // The board's split: the cards take about two thirds, the panel the rest.
  shelf: { flex: 9, flexBasis: 0, minWidth: 0 },
  shelfBody: { paddingRight: space.md },
  side: { flex: 5, flexBasis: 0, minWidth: 0 },
  panel: { borderWidth: line, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  panelBody: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  panelRow: { paddingHorizontal: space.lg, borderLeftWidth: line, borderRightWidth: line },
  panelTop: { borderTopWidth: line, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  panelEnd: { borderBottomWidth: line, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card, paddingBottom: space.lg },
  cards: { paddingTop: space.lg },
  link: { minHeight: layout.minTapTarget, justifyContent: 'center' },
});
