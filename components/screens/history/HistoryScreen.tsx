import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Caption, Sheet, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useDrinkTree } from '@/hooks/useDrinkTree';
import { axisFamilies, historyEyebrow } from '@/lib/timeTree';

import { DrinkStory } from './DrinkStory';
import { HistorySearch } from './HistorySearch';
import { HistoryTopBar, type HistoryView } from './HistoryTopBar';
import { TimelineView } from './timeline/TimelineView';
import { TimeTree, type Jump } from './tree/TimeTree';
import { TreeControls } from './tree/TreeControls';

/** Every classic's history: the tree (every family on a time axis) and the timeline. Opened with ?focus=<drink id> from a drink page. */
export function HistoryScreen() {
  return (
    <BackbarTheme>
      <HistoryPage />
    </BackbarTheme>
  );
}

function HistoryPage() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() === 'desktop';
  const params = useLocalSearchParams<{ focus?: string; view?: string }>();
  const [view, setView] = useState<HistoryView>(params.view === 'timeline' ? 'timeline' : 'tree');
  const { data: nodes = [], isLoading, isError } = useDrinkTree();
  const [modernOnly, setModernOnly] = useState(false);
  // undefined: the drink in ?focus=, until something else is picked.
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const [sheet, setSheet] = useState(false);
  const [picks, setJump] = useState<Jump>(null);

  const arrival = nodes.find((n) => n.id === params.focus || n.key === params.focus)?.key ?? null;
  const focusKey = picked !== undefined ? picked : arrival;
  const focused = focusKey ? (nodes.find((n) => n.key === focusKey) ?? null) : null;
  const families = axisFamilies(nodes, { modernOnly });
  const go = (key: string) => setJump((j) => ({ key, n: (j?.n ?? 0) + 1 }));
  // Arriving with ?focus=: the tree brings that drink into view once it's in (jump 0), until something else is picked.
  const jump: Jump = picks ?? (arrival && view === 'tree' ? { key: arrival, n: 0 } : null);

  const select = (key: string) => {
    setPicked(key);
    if (!wide) setSheet(true);
  };
  const jumpTo = (key: string) => {
    setPicked(key);
    go(key);
  };
  const toTimeline = () => {
    setView('timeline');
    if (focusKey) go(focusKey);
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // Desktop: search sits in the content row (the tree's controls, the timeline's header), not the page header.
  const search = <HistorySearch nodes={nodes} onJump={jumpTo} compact />;
  const status = isLoading ? (
    <Caption tone="muted">Loading the history…</Caption>
  ) : isError ? (
    <Caption tone="muted">{"The history didn't load. Go back and try again."}</Caption>
  ) : null;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <View style={[styles.frame, { maxWidth: wide ? 1440 : undefined }]}>
        <HistoryTopBar view={view} onView={setView} wide={wide} eyebrow={historyEyebrow(nodes)} nodes={nodes} onJump={jumpTo} onBack={back} />
        {view === 'timeline' ? (
          <TimelineView nodes={nodes} header={status} search={wide ? search : null} focusKey={focusKey} onSelect={(k) => setPicked(k)} arriveAt={params.focus ?? null} threadFromFocus={params.view === 'timeline' && !!params.focus} reveal={jump} />
        ) : (
          <View style={styles.cols}>
            <View style={styles.flex}>
              <TimeTree
                families={families}
                selectedKey={focusKey}
                onSelect={select}
                jump={jump}
                bottomPad={insets.bottom + space.xxxl}
                header={
                  <View style={[styles.controls, { paddingHorizontal: gutter }]}>
                    <TreeControls families={axisFamilies(nodes)} modernOnly={modernOnly} onModernOnly={setModernOnly} onFamily={(k) => go(`f:${k}`)} wide={wide} search={search} />
                    {status}
                  </View>
                }
              />
            </View>
            {wide ? (
              <ScrollView style={styles.aside} contentContainerStyle={styles.asideBody}>
                {/* The picked drink as a raised panel beside the chart (board prep-hist-tree-desktop). */}
                <View style={[styles.panel, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
                  {focused ? (
                    <DrinkStory node={focused} nodes={nodes} onSelect={jumpTo} onTimeline={toTimeline} onClose={() => setPicked(null)} />
                  ) : (
                    <Caption tone="muted">Pick a drink for its whole story: where it came from, what changed, and what came from it.</Caption>
                  )}
                </View>
              </ScrollView>
            ) : null}
          </View>
        )}
      </View>
      {!wide && sheet && focused ? (
        <Sheet visible onClose={() => setSheet(false)} accessibilityLabel={focused.name} style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            <DrinkStory node={focused} nodes={nodes} onSelect={jumpTo} />
          </ScrollView>
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  frame: { flex: 1, width: '100%' },
  cols: { flex: 1, flexDirection: 'row' },
  flex: { flex: 1, minWidth: 0 },
  controls: { paddingTop: space.lg, gap: space.sm },
  aside: { flexGrow: 0, flexBasis: 400 },
  asideBody: { paddingRight: space.xl, paddingTop: space.lg, paddingBottom: space.xxxl },
  panel: { padding: space.xl - 2, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  sheet: { maxHeight: '85%' },
  sheetBody: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
});
