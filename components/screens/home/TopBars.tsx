import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, DsText, Headline, PressableScale, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { AreaRankList, EarlyList, ListNote } from '@/components/screens/rankings/RankingLists';
import { BarResultRow } from '@/components/search/ResultRows';
import { radius, space } from '@/constants/tokens';
import { useTopBars } from '@/hooks/useDiscover';
import { useDiscoverBars } from '@/hooks/useDiscoverDrinks';
import { barsMatching } from '@/lib/discoverDrinks';
import { areaLabel, earlyNote, type Area, type DiscoverRow } from '@/lib/nearMe';
import { formatScore, MIN_RANKERS } from '@/lib/ranking';

import { BarMark } from './BarMark';

/** How many bars the shelf shows; See all has the rest. */
const SHELF = 5;
const CARD = 112;
const LOGO = 56;

/**
 * "Top bars near you" as a shelf of cards (disc-map-browse, approved 24 Oct),
 * second among Discover's shelves: by bar score, the average of a bar's drink
 * scores weighted by how many people ranked each (see the discover
 * migration). With no scored bar yet, the early ones show without a score:
 * the viewer's loved bars first, then the most relevant (discover_top_bars).
 * See all lists them all (TopBarsList). Phones scroll it sideways; wide
 * screens wrap it.
 */
export function TopBarsShelf({ area, onSeeAll, onShowBar }: { area: Area; onSeeAll: () => void; /** Hovering a card opens that bar on the map. */ onShowBar?: (barId: string | null) => void }) {
  const ds = useDs();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const { data } = useTopBars(area);
  const ranked = data?.ranked ?? [];
  const rows = (ranked.length ? ranked : (data?.early ?? [])).slice(0, SHELF);
  const title = `Top bars ${areaLabel(area)}`;
  if (rows.length < 3) return null;
  const cards = rows.map((r) => (
    <View role="listitem" key={r.venue_profile_id}>
      <BarCard row={r} onShowBar={onShowBar} />
    </View>
  ));
  return (
    <View role="region" aria-label={title} style={styles.shelf}>
      <View>
        <View style={styles.head}>
          <Headline role="heading" style={styles.flex}>
            {title}
          </Headline>
          <PressableScale accessibilityLabel={`See all: ${title}`} hitSlop={12} onPress={onSeeAll}>
            <DsText variant="caption" color={ds.accentText}>
              See all
            </DsText>
          </PressableScale>
        </View>
        <Caption tone="muted">{ranked.length ? 'Bar score, from every drink ranked there' : 'Early: not enough people have ranked here yet'}</Caption>
      </View>
      {wide ? (
        <View role="list" style={styles.wrap}>
          {cards}
        </View>
      ) : (
        // Runs to the screen's edges, so a cut-off card says there's more.
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter }}>
          <View role="list" style={styles.row}>
            {cards}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/** One bar on the shelf: its mark, name and score ("9.1 · 212 ranked"), or where it is while early. */
function BarCard({ row: r, onShowBar }: { row: DiscoverRow; onShowBar?: (barId: string | null) => void }) {
  const ds = useDs();
  const router = useRouter();
  const scored = !r.is_early && r.score !== null;
  const line = scored ? `${formatScore(r.score!)} · ${r.rankers} ranked` : (r.locality ?? r.city ?? '');
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[r.display_name, scored ? `score ${formatScore(r.score!)}, ${r.rankers} ranked` : r.locality].filter(Boolean).join('. ')}
      onPress={() => router.push(`/p/${r.handle || r.venue_profile_id}`)}
      onHoverIn={onShowBar ? () => onShowBar(r.venue_profile_id) : undefined}
      onHoverOut={onShowBar ? () => onShowBar(null) : undefined}
      onFocus={onShowBar ? () => onShowBar(r.venue_profile_id) : undefined}
      onBlur={onShowBar ? () => onShowBar(null) : undefined}
      style={styles.card}
    >
      <View style={[styles.logo, { backgroundColor: ds.c.raised }]}>
        <BarMark name={r.display_name} logoUrl={r.avatar_url} profileId={r.venue_profile_id} size={LOGO} />
      </View>
      <DsText variant="label" numberOfLines={1}>
        {r.display_name}
      </DsText>
      {line ? (
        <Caption tone="muted" numberOfLines={1}>
          {line}
        </Caption>
      ) : null}
    </PressableScale>
  );
}

/**
 * Every top bar here, best first, with its heart: the shelf's See all (the
 * phone sheet's and wide list's "Top bars in this area"). Early bars, below
 * the minimum, are listed without a score when no bar has one yet.
 */
export function TopBarsList({ area, onShowBar }: { area: Area; onShowBar?: (barId: string | null) => void }) {
  const { data, isLoading, error } = useTopBars(area);
  const ranked = data?.ranked ?? [];
  const early = data?.early ?? [];
  if (error) return <ListNote>{`Couldn't load the bars: ${error.message}`}</ListNote>;
  if (isLoading) return <ListNote>Loading…</ListNote>;
  if (ranked.length) return <AreaRankList rows={ranked} scoreDetail={(r) => `${r.rankers} ranked`} love onShowBar={onShowBar} />;
  if (early.length) {
    return (
      <>
        <ListNote>{earlyNote(early, MIN_RANKERS)}</ListNote>
        <EarlyList rows={early} love onShowBar={onShowBar} />
      </>
    );
  }
  return <ListNote>{`No bars ${areaLabel(area)} on Cocktail yet.`}</ListNote>;
}

/** How many bars the list has, for the sheet's line: "24 ranked bars", or the early ones. */
export function useTopBarsCount(area: Area): string {
  const { data } = useTopBars(area);
  const ranked = data?.ranked.length ?? 0;
  if (ranked) return `${ranked} ranked ${ranked === 1 ? 'bar' : 'bars'}`;
  const early = data?.early.length ?? 0;
  return early ? `${early} early ${early === 1 ? 'bar' : 'bars'}` : '';
}

/**
 * Wide screens' search: the bars that match ("Matching “negroni”"). Nothing
 * at all when none do: the results above already say so, with Add a bar.
 */
export function MatchingBars({ area, search, kinds = [], onShowBar }: { area: Area; search: string; kinds?: readonly string[]; /** Hovering a row opens that bar on the map. */ onShowBar?: (barId: string | null) => void }) {
  const q = search.trim();
  const found = useDiscoverBars(area, { search: q, kinds }, !!q);
  const bars = barsMatching(found.data ?? [], q);
  if (!q || (!found.isLoading && !bars.length)) return null;
  return (
    <View style={styles.section}>
      <Caption tone="muted">{`Matching “${q}”`}</Caption>
      <Headline role="heading">{`Bars ${areaLabel(area)}`}</Headline>
      {found.isLoading ? <ListNote>Loading…</ListNote> : bars.map((b) => <BarResultRow key={b.id} bar={b} query={q} onShowBar={onShowBar} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  card: { width: CARD, gap: space.xs },
  logo: { height: CARD - space.xl, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  section: { gap: space.xs, marginTop: space.xl },
});
