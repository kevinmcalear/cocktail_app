import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, SectionList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import type { TreeNode } from '@/lib/drinkTree';
import { decadeCounts, eraOf, foldThread, locate, locateKey, thread, timelineSections, undatedCount, type TimelineFilter, type TimelineRow, type TimelineSection } from '@/lib/timeline';

import type { Jump } from '../tree/TimeTree';

import { DrinkDetail, PeekSheet } from './DrinkPeek';
import { EraBar } from './EraBar';
import { OverviewStrip } from './OverviewStrip';
import { Riffs, ThreadCard, ThreadPick } from './ThreadBar';
import { TimelineFilters } from './TimelineFilters';
import { EraHeader, FoldRow, TimelineRowView } from './TimelineRow';

type Loc = { sectionIndex: number; itemIndex: number };
/** Room above a row we jump to; the list already clears the sticky era header. */
const JUMP_OFFSET = space.sm;
const BAR_SPACE = 120;
/** The thread's pick sheet, for leaving room under the list. */
const PICK_H = 240;
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
  search,
  focusKey,
  onSelect,
  arriveAt,
  threadFromFocus,
  reveal,
}: {
  nodes: TreeNode[];
  /** The loading or error line, then desktop's search at the end of the filters' row. */
  header: ReactNode;
  search?: ReactNode;
  focusKey: string | null;
  onSelect: (key: string) => void;
  /** The ?focus= drink id the screen was opened with: scrolled to once on arrival. */
  arriveAt: string | null;
  /** Opened from a drink's "See it on the timeline": light its thread. */
  threadFromFocus: boolean;
  /** A drink picked in the top bar's search: scroll to it. */
  reveal: Jump;
}) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone'; // Wide from 768, like the drink pages (i05, 24 Oct 2026).
  const [filter, setFilter] = useState<TimelineFilter>({ family: null, styles: true, spirit: null, place: null });
  // undefined: untouched, so a drink opened from its page shows its thread.
  const [threadChoice, setThreadKey] = useState<string | null | undefined>(undefined);
  const [peekKey, setPeekKey] = useState<string | null>(null);
  const [unfolded, setUnfolded] = useState<string | null>(null);
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
  const line = threadKey ? thread(nodes, threadKey) : [];
  const lit = new Set(line.map((n) => n.key));
  const folding = !!threadKey && unfolded !== threadKey;
  // Every row (and era header) is laid out once, so a jump through time lands exactly:
  // VirtualizedList keeps a cell's measured size after it unmounts. Then only a few
  // screens stay mounted. The keys carry what the heights depend on, so a filter or a
  // new width mounts and measures every row again.
  const layoutKey = `${filter.family}|${filter.styles}|${filter.spirit}|${filter.place}|${nodes.length}|${width}|${threadKey}|${folding}`;
  const every = timelineSections(nodes, filter);
  const sections = (folding ? foldThread(every, lit) : every).map((s) => ({ ...s, key: `${layoutKey}:${s.key}` }));
  const counts = decadeCounts(nodes, filter);
  const rowCount = sections.reduce((n, s) => n + s.data.length + 1, 0);
  const cellLaidOut = (cell: string) => {
    if (laid.current.key !== layoutKey) laid.current = { key: layoutKey, cells: new Set() };
    laid.current.cells.add(cell);
    if (laid.current.cells.size >= rowCount && settled !== layoutKey) setSettled(layoutKey);
  };
  // The year at the top of the list; before the first scroll, the first row's.
  const year = seen ?? sections[0]?.data[0]?.node.year ?? null;
  // The accent line runs down the spine from the thread's first row in the list to its last (board prep-hist-timeline-thread).
  const order = new Map(every.flatMap((sec) => sec.data).map((r, i) => [r.node.key, i]));
  const litOrder = [...lit].map((k) => order.get(k)).filter((i): i is number => i != null);
  const [firstLit, lastLit] = [Math.min(...litOrder), Math.max(...litOrder)];
  const spineOf = (key: string): 'down' | 'up' | 'through' | null => {
    const i = order.get(key);
    if (i == null || litOrder.length < 2 || i < firstLit || i > lastLit) return null;
    return i === firstLit ? 'down' : i === lastLit ? 'up' : 'through';
  };
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const kidsOf = (key: string) => nodes.filter((n) => n.parentKey === key && n.kind === 'drink').length;
  const byMaker = (key: string, maker = byKey.get(key)?.creatorId) => (maker ? nodes.filter((n) => n.creatorId === maker).length : 0);
  const focused = focusKey ? (byKey.get(focusKey) ?? null) : null;
  const peek = peekKey ? byKey.get(peekKey) : undefined;
  // Desktop's inspector always shows the picked drink's thread and riffs.
  const focusLine = wide && focused ? thread(nodes, focused.key) : [];
  const riffs = wide && focused ? nodes.filter((n) => n.parentKey === focused.key && n.kind === 'drink').sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)) : [];
  const pick = !wide && line.length && focused ? focused : null;

  // Where a thread opens: on its step before this drink when that's in the same era, so both show.
  const threadTarget = (key: string) => {
    const steps = thread(nodes, key);
    const here = steps.at(-1);
    const before = steps.at(-2);
    return before?.year != null && here?.year != null && eraOf(before.year).key === eraOf(here.year).key ? before.key : key;
  };
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
    // Arriving to follow its thread, the list opens on the thread's last steps (board prep-hist-timeline-thread).
    const t = setTimeout(() => scrollTo(locateKey(sections, threadFromFocus ? threadTarget(arrival) : arrival), false), 120);
    return () => clearTimeout(t);
    // Once, on arrival; later focus changes come from taps that scroll themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrival]);
  // A search match from the top bar (the screen has already picked it): clear the filters that would hide it, then go.
  const [revealed, setRevealed] = useState(reveal?.n);
  if (reveal && reveal.n !== revealed) {
    setRevealed(reveal.n);
    setFilter({ family: null, spirit: null, place: null, styles: filter.styles || byKey.get(reveal.key)?.kind === 'style' });
  }
  useEffect(() => {
    if (!reveal) return;
    const t = setTimeout(() => scrollTo(locateKey(sections, reveal.key)), 120);
    return () => clearTimeout(t);
    // Only a new search pick scrolls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.n]);
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
    // Following a thread, a phone shows the pick at the bottom instead of a sheet.
    if (!wide && !threadKey) setPeekKey(key);
  };
  const toggleThread = (key: string) => {
    const on = threadKey !== key;
    setThreadKey(on ? key : null);
    if (on) setFilter((f) => ({ ...f, family: null, spirit: null, place: null }));
    setPeekKey(null);
    if (!on) return;
    const shown = timelineSections(nodes, { ...filter, family: null, spirit: null, place: null });
    setTimeout(() => scrollTo(locateKey(foldThread(shown, new Set(thread(nodes, key).map((n) => n.key))), threadTarget(key))), 200);
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      {header}
      <View style={styles.filterRow}>
        <View style={styles.flex}>
          <TimelineFilters nodes={nodes} filter={filter} onChange={setFilter} />
        </View>
        {search}
      </View>
      {wide ? <OverviewStrip nodes={nodes} thread={line.length ? lit : new Set(focusLine.map((n) => n.key))} year={year} onTravel={(y) => scrollTo(locate(sections, y))} /> : null}
    </View>
  );

  const undated = undatedCount(nodes, filter);
  return (
    <View style={styles.screen}>
      {!wide && line.length ? (
        <View style={{ paddingHorizontal: gutter, paddingBottom: space.sm }}>
          <ThreadCard line={line} focusKey={focusKey} onStep={step} onClose={() => setThreadKey(null)} />
        </View>
      ) : null}
      <View style={[styles.cols, { maxWidth: wide ? 1280 : 820 }]}>
        <SectionList<TimelineRow, TimelineSection>
          ref={list}
          style={styles.flex}
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
              <EraHeader section={section} wide={wide} compact={!!threadKey} />
            </View>
          )}
          renderItem={({ item }) => (
            <View onLayout={() => cellLaidOut(item.node.key)}>
              {item.folded ? (
                <FoldRow count={item.folded} onPress={() => setUnfolded(threadKey)} />
              ) : (
                <TimelineRowView
                  row={item}
                  selected={item.node.key === focusKey}
                  inThread={lit.has(item.node.key)}
                  dimmed={!!threadKey && !lit.has(item.node.key)}
                  threadSpine={threadKey ? spineOf(item.node.key) : null}
                  wide={wide}
                  compact={!!threadKey && !wide}
                  onPress={() => press(item.node.key)}
                />
              )}
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
          contentContainerStyle={{ paddingTop: space.sm, paddingHorizontal: gutter, paddingBottom: insets.bottom + (wide ? space.xxxl : pick ? PICK_H : BAR_SPACE) }}
        />
        {wide ? (
          <ScrollView style={[styles.inspector, { borderLeftColor: ds.c.line }]} contentContainerStyle={styles.inspectorBody}>
            {focused ? (
              <DrinkDetail node={focused} from={focused.parentKey ? (byKey.get(focused.parentKey) ?? null) : null} kids={kidsOf(focused.key)} byMaker={byMaker(focused.key)} threadOn={false} />
            ) : null}
            {focusLine.length > 1 || riffs.length ? (
              <View style={[styles.threadCard, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
                {focusLine.length > 1 ? <ThreadCard line={focusLine} focusKey={focusKey} onStep={step} inspector /> : null}
                <Riffs key={focusKey} kids={riffs} onStep={step} />
              </View>
            ) : null}
            {focused ? null : (
              <Caption tone="muted">Pick a drink to see what changed, who made it and where, and its thread back to the punch bowl.</Caption>
            )}
          </ScrollView>
        ) : null}
      </View>
      {/* Following a thread, the pick is a sheet at the bottom in place of the era bar (board prep-hist-timeline-thread). */}
      {pick ? <ThreadPick node={pick} bottom={insets.bottom + space.sm} /> : null}
      {!wide && !pick ? <EraBar counts={counts} year={year} bottom={insets.bottom + space.lg} onTravel={(y) => scrollTo(locate(sections, y), false)} /> : null}
      {!wide && peek ? (
        // Keyed: each drink's peek starts open, whatever the last one did.
        <PeekSheet key={peek.key} node={peek} from={peek.parentKey ? (byKey.get(peek.parentKey) ?? null) : null} kids={kidsOf(peek.key)} byMaker={byMaker(peek.key)} threadOn={threadKey === peek.key} onThread={() => toggleThread(peek.key)} onClose={() => setPeekKey(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  cols: { flex: 1, width: '100%', alignSelf: 'center', flexDirection: 'row' },
  flex: { flex: 1, minWidth: 0 },
  headerBlock: { gap: space.lg, paddingBottom: space.sm },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, zIndex: 2 },
  inspector: { flexGrow: 0, flexBasis: 380, borderLeftWidth: StyleSheet.hairlineWidth },
  inspectorBody: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xxxl, gap: space.lg },
  footer: { paddingVertical: space.xl },
  threadCard: { gap: space.lg, padding: space.md + 2, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
});
