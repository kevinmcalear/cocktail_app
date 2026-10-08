import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, SectionList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, Chip, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { FAMILIES, type TreeNode } from '@/lib/drinkTree';
import { decadeCounts, locate, locateKey, thread, timelineSections, undatedCount, type TimelineRow, type TimelineSection } from '@/lib/timeline';

import { DrinkDetail, PeekSheet } from './DrinkPeek';
import { EraBar } from './EraBar';
import { OverviewStrip } from './OverviewStrip';
import { ThreadBar } from './ThreadBar';
import { EraHeader, TimelineRowView } from './TimelineRow';

type Loc = { sectionIndex: number; itemIndex: number };
/** Room above a row we jump to; the list already clears the sticky era header. */
const JUMP_OFFSET = space.sm;
const BAR_SPACE = 120;
/** The phone's era bar and floating thread strip, for leaving room under the list. */
const ERA_BAR_H = 92;
const THREAD_H = 110;
/** Screens of rows kept mounted around the view once every row has been laid out. */
const SETTLED_WINDOW = 9;

/**
 * History's Timeline view: every dated classic and historic style in one
 * long scroll, oldest first, under sticky era headers. Phones travel with
 * the glass era bar and peek at a drink in a sheet; desktop gets an overview
 * of every era on top and the drink in an inspector. A thread lights one
 * drink's line back to the punch bowl.
 */
export function TimelineView({
  nodes,
  header,
  focusKey,
  onSelect,
  arriveAt,
  threadFromFocus,
}: {
  nodes: TreeNode[];
  /** The screen's title and Tree | Timeline tabs. */
  header: ReactNode;
  focusKey: string | null;
  onSelect: (key: string) => void;
  /** The ?focus= drink id the screen was opened with: scrolled to once on arrival. */
  arriveAt: string | null;
  /** Opened from a drink's "See it on the timeline": light its thread. */
  threadFromFocus: boolean;
}) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() === 'desktop';
  const [family, setFamily] = useState<string | null>(null);
  const [styles_, setStyles] = useState(true);
  // undefined: untouched, so a drink opened from its page shows its thread.
  const [threadChoice, setThreadKey] = useState<string | null | undefined>(undefined);
  const [peekKey, setPeekKey] = useState<string | null>(null);
  const [seen, setYear] = useState<number | null>(null);
  const list = useRef<SectionList<TimelineRow, TimelineSection>>(null);
  const pending = useRef<Loc | null>(null);
  const arrived = useRef(false);
  const tries = useRef(0);
  const laid = useRef({ key: '', cells: new Set<string>() });
  const [settled, setSettled] = useState('');
  const { width: screenWidth } = useWindowDimensions();
  const [width, setWidth] = useState(screenWidth);
  // A resize lays the rows out again (wrapping changes their heights), once it stops.
  useEffect(() => {
    const t = setTimeout(() => setWidth(screenWidth), 300);
    return () => clearTimeout(t);
  }, [screenWidth]);

  const threadKey = threadChoice !== undefined ? threadChoice : threadFromFocus ? focusKey : null;
  const filter = { family, styles: styles_ };
  // The list starts under the floating back button, so a stuck era header never slides beneath it.
  const top = insets.top + layout.minTapTarget + space.sm;
  // Every row (and era header) is laid out once, so a jump through time lands exactly:
  // VirtualizedList keeps a cell's measured size after it unmounts. Then only a few
  // screens stay mounted. The keys carry what the heights depend on, so a filter or a
  // new width mounts and measures every row again.
  const layoutKey = `${family}|${styles_}|${nodes.length}|${width}`;
  const sections = timelineSections(nodes, filter).map((s) => ({ ...s, key: `${layoutKey}:${s.key}` }));
  const counts = decadeCounts(nodes, filter);
  const rowCount = sections.reduce((n, s) => n + s.data.length + 1, 0);
  const cellLaidOut = (cell: string) => {
    if (laid.current.key !== layoutKey) laid.current = { key: layoutKey, cells: new Set() };
    laid.current.cells.add(cell);
    if (laid.current.cells.size >= rowCount && settled !== layoutKey) setSettled(layoutKey);
  };
  // The year at the top of the list; before the first scroll, the first row's.
  const year = seen ?? sections[0]?.data[0]?.node.year ?? null;
  const line = threadKey ? thread(nodes, threadKey) : [];
  const lit = new Set(line.map((n) => n.key));
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const kidsOf = (key: string) => nodes.filter((n) => n.parentKey === key && n.kind === 'drink').length;
  const focused = focusKey ? (byKey.get(focusKey) ?? null) : null;

  const scrollTo = (loc: Loc | null, animated = true) => {
    if (!loc) return;
    pending.current = loc;
    tries.current = 0;
    list.current?.scrollToLocation({ ...loc, viewOffset: JUMP_OFFSET, animated });
  };

  // Arriving with ?focus=: bring that drink into view once the rows are in.
  const arrival = arriveAt ? (nodes.find((n) => n.id === arriveAt || n.key === arriveAt)?.key ?? null) : null;
  useEffect(() => {
    if (arrived.current || !arrival) return;
    arrived.current = true;
    const t = setTimeout(() => scrollTo(locateKey(sections, arrival), false), 120);
    return () => clearTimeout(t);
    // Once, on arrival; later focus changes come from taps that scroll themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrival]);
  const step = (key: string) => {
    onSelect(key);
    scrollTo(locateKey(sections, key));
  };

  // Stable: a list can't swap onViewableItemsChanged after mounting.
  const onViewable = useCallback(({ viewableItems }: { viewableItems: { item?: TimelineRow | null }[] }) => {
    const first = viewableItems.find((v) => v.item?.node?.year != null);
    if (first?.item?.node) setYear(first.item.node.year);
  }, []);

  const press = (key: string) => {
    onSelect(key);
    if (!wide) setPeekKey(key);
  };
  const toggleThread = (key: string) => {
    const on = threadKey !== key;
    setThreadKey(on ? key : null);
    if (on) setFamily(null);
    setPeekKey(null);
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      {header}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <View role="radiogroup" accessibilityLabel="Family" style={styles.famRow}>
          <Chip label="All families" selected={!family} onPress={() => setFamily(null)} quiet />
          {FAMILIES.map((f) => (
            <Chip key={f.key} label={f.name} selected={family === f.key} onPress={() => setFamily(family === f.key ? null : f.key)} quiet />
          ))}
        </View>
        <Chip label="Historic styles" selected={styles_} onPress={() => setStyles(!styles_)} multi quiet />
      </ScrollView>
      {wide ? <OverviewStrip nodes={nodes} thread={lit} year={year} onTravel={(y) => scrollTo(locate(sections, y))} /> : null}
    </View>
  );

  const undated = undatedCount(nodes, filter);
  return (
    <View style={styles.screen}>
      <View style={[styles.cols, { maxWidth: wide ? 1280 : 820 }]}>
        <SectionList<TimelineRow, TimelineSection>
          ref={list}
          style={[styles.flex, { marginTop: top }]}
          sections={sections}
          keyExtractor={(r, i) => `${layoutKey}:${r?.node?.key ?? `row-${i}`}`}
          stickySectionHeadersEnabled
          // ponytail: paints 40 rows, then lays out the rest (about 420) in batches, so a jump through
          // time lands exactly (with estimated heights it fell decades short); once all are measured,
          // only SETTLED_WINDOW screens stay mounted. If layout never reports (RNW in a hidden pane),
          // they all stay, as before. Fixed heights and getItemLayout would skip the first pass.
          initialNumToRender={40}
          maxToRenderPerBatch={80}
          updateCellsBatchingPeriod={16}
          windowSize={settled === layoutKey ? SETTLED_WINDOW : Math.max(21, rowCount)}
          ListHeaderComponent={listHeader}
          renderSectionHeader={({ section }) => (
            <View onLayout={() => cellLaidOut(`era:${section.key}`)}>
              <EraHeader section={section} />
            </View>
          )}
          renderItem={({ item }) => (
            <View onLayout={() => cellLaidOut(item.node.key)}>
              <TimelineRowView
                row={item}
                selected={item.node.key === focusKey}
                inThread={lit.has(item.node.key)}
                dimmed={!!threadKey && !lit.has(item.node.key)}
                wide={wide}
                onPress={() => press(item.node.key)}
              />
            </View>
          )}
          ListFooterComponent={undated ? <Caption tone="muted" style={styles.footer}>{`${undated} more drink${undated === 1 ? ' has' : 's have'} no year yet. Find them in the Tree.`}</Caption> : undefined}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 20 }}
          onScrollToIndexFailed={(info) => {
            // Rows far off aren't laid out yet: jump near, let the next batch lay out, and try again (for about 4 seconds).
            if (tries.current++ > 30) return;
            list.current?.getScrollResponder()?.scrollTo({ y: info.averageItemLength * info.index, animated: false });
            setTimeout(() => pending.current && list.current?.scrollToLocation({ ...pending.current, viewOffset: JUMP_OFFSET, animated: false }), 150);
          }}
          contentContainerStyle={{ paddingTop: space.sm, paddingHorizontal: gutter, paddingBottom: insets.bottom + (wide ? space.xxxl : BAR_SPACE + (line.length ? THREAD_H : 0)) }}
        />
        {wide ? (
          <ScrollView style={[styles.inspector, { marginTop: top, borderLeftColor: ds.c.line }]} contentContainerStyle={styles.inspectorBody}>
            {focused ? (
              <DrinkDetail node={focused} from={focused.parentKey ? (byKey.get(focused.parentKey) ?? null) : null} kids={kidsOf(focused.key)} threadOn={threadKey === focused.key} onThread={() => toggleThread(focused.key)} />
            ) : null}
            {line.length ? <ThreadBar line={line} focusKey={focusKey} onStep={step} onClose={() => setThreadKey(null)} floating={false} /> : null}
            {focused ? null : (
              <Caption tone="muted">Pick a drink to see what changed, who made it and where, and its thread back to the punch bowl.</Caption>
            )}
          </ScrollView>
        ) : null}
      </View>
      {!wide && line.length ? (
        <ThreadBar line={line} focusKey={focusKey} onStep={step} onClose={() => setThreadKey(null)} floating bottom={insets.bottom + space.lg + ERA_BAR_H + space.sm} />
      ) : null}
      {!wide ? <EraBar counts={counts} year={year} bottom={insets.bottom + space.lg} onTravel={(y) => scrollTo(locate(sections, y), false)} /> : null}
      {!wide && peekKey && byKey.get(peekKey) ? (
        <PeekSheet
          node={byKey.get(peekKey)!}
          from={byKey.get(peekKey)!.parentKey ? (byKey.get(byKey.get(peekKey)!.parentKey!) ?? null) : null}
          kids={kidsOf(peekKey)}
          threadOn={threadKey === peekKey}
          onThread={() => toggleThread(peekKey)}
          onClose={() => setPeekKey(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  cols: { flex: 1, width: '100%', alignSelf: 'center', flexDirection: 'row' },
  flex: { flex: 1, minWidth: 0 },
  headerBlock: { gap: space.lg, paddingBottom: space.sm },
  chips: { flexDirection: 'row', gap: space.sm, paddingRight: space.lg },
  famRow: { flexDirection: 'row', gap: space.sm },
  inspector: { flexGrow: 0, flexBasis: 380, borderLeftWidth: StyleSheet.hairlineWidth },
  inspectorBody: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xxxl, gap: space.lg },
  footer: { paddingVertical: space.xl },
});
