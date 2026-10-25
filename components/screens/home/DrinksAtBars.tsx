import { getLocales } from 'expo-localization';
import { createContext, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Headline, PressableScale, RowScore, scoreWords as rowScoreWords, useDs, type MatchTextProps } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { DiscoverShelves } from '@/components/screens/home/DiscoverShelves';
import type { MapLayer } from '@/components/screens/home/DiscoverControls';
import { TopBarsShelf } from '@/components/screens/home/TopBars';
import { ListNote } from '@/components/screens/rankings/RankingLists';
import { space } from '@/constants/tokens';
import { useBestDrink, useRowScores } from '@/hooks/useBestDrink';
import { useDiscoverList } from '@/hooks/useDiscoverDrinks';
import { useDiscoverShelves } from '@/hooks/useDiscoverShelves';
import { useVersionLabel } from '@/hooks/useSpecMatches';
import { byScore, drinkReason, type BarScore, type DiscoverDrink, type DrinkFilter } from '@/lib/discoverDrinks';
import { isStrong } from '@/lib/discoverMatch';
import { itemHref } from '@/lib/itemRoutes';
import { formatDistance, usesMiles } from '@/lib/nearMe';
import { formatScore } from '@/lib/ranking';

const place = (b: DiscoverDrink['bar']) => [b.locality, b.city].filter(Boolean).join(', ');

/** How many more drinks each "Show more" adds: "anywhere" can be thousands, too many to lay out at once. */
const MORE = 30;

/** The server's side of a list: how many in all, and the next page. */
export interface MoreDrinks {
  total: number | null;
  hasMore: boolean;
  loadMore: () => void;
  loading: boolean;
}

/** "Best Martini" scores: each drink's own, and each bar's for the drink. A drink or bar nobody has scored has none. */
export interface DrinkScores {
  drinks: Readonly<Record<string, number>>;
  bars: Readonly<Record<string, BarScore>>;
}

/** The scores at the end of a drink row: the drink's, then its bar's under it ("Bar 9.1"). Nothing when neither is scored. */
export function DrinkScore({ drink, bar }: { drink?: number; bar?: number }) {
  return <RowScore score={drink} detail={bar !== undefined ? `Bar ${formatScore(bar)}` : null} />;
}

/** What a screen reader hears for those scores. */
export function scoreWords(drink?: number, bar?: number): string | null {
  return rowScoreWords(drink, bar !== undefined ? `bar scores ${formatScore(bar)}` : null);
}

/**
 * How far each bar is from the person ("400 m"), for the rows' sub line;
 * Discover provides it from its bars' coordinates once it knows where the
 * person is. Null when it doesn't.
 */
export const BarAway = createContext<(barId: string) => string | null>(() => null);

/**
 * One drink at its bar, the sub line plain as drawn (disc-list): the bar's
 * small logo, the bar, how far it is (else where), and what it is to its
 * classic ("the classic spec", or what its variation changes); the scores
 * (when given) at the end, and the searched word lit (tint on Discover).
 * No "on now": Discover lists only what's on now unless Past menus is on,
 * and a past drink carries its "Past · 2024 to 2025" tag (Kevin, 14 Oct).
 * A mixed list's row may carry one reason instead: "New" or "Zero-proof" (15 Oct).
 * `atBar`: a tapped bar's own drinks (disc-map-bar), so the bar and its logo
 * aren't repeated. `everywhere`: search's Everywhere, which puts why it
 * matched ("Riff on a Negroni") on its own line, the word lit (nav-search-everywhere).
 */
export function DrinkAtBarRow({ drink: d, scores, query, matchLook = 'tint', atBar = false, everywhere = false, onPress, onShowBar }: { drink: DiscoverDrink; scores?: DrinkScores; query?: string; matchLook?: MatchTextProps['look']; atBar?: boolean; everywhere?: boolean; onPress?: () => void; /** Hovering opens this bar on the map. */ onShowBar?: (barId: string | null) => void }) {
  const bar = d.bar;
  const version = useVersionLabel(d.id);
  const near = useContext(BarAway)(d.barId);
  const away = d.distance === null || d.distance === undefined ? near : formatDistance(d.distance / 1000, usesMiles(getLocales()[0]));
  // A tapped bar's rows say what the drink is instead (ponytail: its description; the ingredient line needs discover_list to return the spec's lines).
  const reason = d.menu.past ? null : d.pos != null ? drinkReason(d, new Date()) : null;
  const what = atBar ? (d.why ?? version ?? d.description) : everywhere ? version : (d.why ?? version);
  const caption = (atBar ? [what] : [bar.name, away ?? place(bar), what]).filter(Boolean).join(' · ');
  const drinkScore = scores?.drinks[d.id];
  const barScore = atBar ? undefined : scores?.bars[d.barId]?.score;
  const said = scoreWords(drinkScore, barScore);
  return (
    <DrinkRow
      name={d.name}
      href={itemHref('Cocktail', d.id)}
      onPress={onPress}
      itemId={d.id}
      imageUrl={d.imageUrl}
      glass={null}
      dense
      caption={caption}
      logo={atBar ? undefined : { uri: bar.logo, name: bar.name, profileId: d.barId }}
      note={everywhere ? (d.why ?? undefined) : undefined}
      tag={d.menu.past ?? reason ?? undefined}
      tagTone={reason ? 'accent' : undefined}
      trailing={<DrinkScore drink={drinkScore} bar={barScore} />}
      query={query}
      matchLook={matchLook}
      label={said ? [d.name, caption, everywhere ? d.why : null, d.menu.past, said].filter(Boolean).join('. ') : undefined}
      onHoverIn={onShowBar ? () => onShowBar(d.barId) : undefined}
      onHoverOut={onShowBar ? () => onShowBar(null) : undefined}
    />
  );
}

/** "Also mentions “martini”" over the first drink that matched by its lines, description or bar rather than its name. */
export function AlsoMentions({ drinks, index, search }: { drinks: readonly DiscoverDrink[]; index: number; search: string }) {
  const weak = !isStrong(drinks[index].match);
  if (!weak || (index > 0 && !isStrong(drinks[index - 1].match))) return null;
  return (
    <Caption tone="muted" role="heading" style={styles.also}>
      {`Also mentions “${search.trim()}”`}
    </Caption>
  );
}

/**
 * Drinks, each with the bar that makes it (and their scores, when given);
 * the first `limit`, then more a page at a time: from what's loaded, then
 * the server's next page (`more`). Phones' Discover sheet virtualizes its
 * rows instead (DiscoverMapPane, with DrinkAtBarRow).
 */
export function DrinkAtBarList({ drinks, limit = 8, scores, more, query, onOpen, onShowBar }: { drinks: DiscoverDrink[]; limit?: number; scores?: DrinkScores; more?: MoreDrinks; /** The searched words, lit in each row. */ query?: string; /** A row opens here instead of its page (wide Discover's search). */ onOpen?: (d: DiscoverDrink) => void; /** Hovering a row opens its bar on the map. */ onShowBar?: (barId: string | null) => void }) {
  const ds = useDs();
  const [count, setCount] = useState(limit);
  const shown = drinks.slice(0, count);
  const total = Math.max(more?.total ?? drinks.length, drinks.length);
  const next = Math.min(MORE, total - shown.length);
  const showMore = () => {
    setCount(shown.length + next);
    // The next page before it's needed, so the rows after these are there too.
    if (more?.hasMore && shown.length + next + MORE > drinks.length) more.loadMore();
  };
  return (
    <View role="list">
      {shown.map((d) => (
        <DrinkAtBarRow key={d.id} drink={d} scores={scores} query={query} onPress={onOpen ? () => onOpen(d) : undefined} onShowBar={onShowBar} />
      ))}
      {next > 0 ? (
        <PressableScale hitSlop={12} onPress={showMore} style={styles.more}>
          <DsText variant="caption" color={ds.accentText}>
            {more?.loading && shown.length >= drinks.length ? 'Loading…' : `Show ${next} more of ${total}`}
          </DsText>
        </PressableScale>
      ) : null}
    </View>
  );
}

/**
 * Discover's shelves with nothing picked (disc-map-browse, approved 24 Oct):
 * For your taste, Top bars here, Top-rated, the style most bars pour, Low &
 * no. The phone sheet and the wide list both open with them. `around`: the
 * mixed list they're picked from; signed out, only Top bars shows.
 */
export function BrowseShelves({ filter, around, enabled, onKind, onTopBars, onShowBar }: { filter: DrinkFilter; around: DiscoverDrink[]; enabled: boolean; onKind?: (kind: string) => void; onTopBars: () => void; onShowBar?: (barId: string | null) => void }) {
  const shelves = useDiscoverShelves(filter, around, enabled);
  return <DiscoverShelves shelves={shelves} second={<TopBarsShelf area={filter.area} onSeeAll={onTopBars} onShowBar={onShowBar} />} onKind={onKind} onShowBar={onShowBar} />;
}

interface DrinksHereProps {
  title: string;
  drinks: DiscoverDrink[];
  more: MoreDrinks;
  isLoading: boolean;
  signedIn: boolean;
  /** What to say when nothing matches. */
  empty: string;
  /** Discover's filter, with its area. Browsing on now with no filter, the shelves come first. */
  filter: DrinkFilter;
  onNow: boolean;
  /** A style picked: its best first, or nearest (OptionChips); `drink` is its classic, for each bar's own score. */
  order: { layer: MapLayer; drink: { id: string; name: string } | null; from: { latitude: number; longitude: number } | null };
  /** A shelf's See all: list just that kind. */
  onKind?: (kind: string) => void;
  /** Top bars' See all. */
  onTopBars: () => void;
  /** A shelf card under the pointer: open that bar on the map. */
  onShowBar?: (barId: string | null) => void;
}

/**
 * The wide list (disc-desk-browse, approved 24 Oct), as the phone sheet: with
 * nothing picked, the shelves, then "All drinks near you" mixed a bar at a
 * time (option A, Kevin 15 Oct). A style picked: "Martinis near you", best
 * first or nearest, as the options row orders it.
 */
export function DrinksHere({ title, drinks: mixed, more: mixedMore, isLoading: mixedLoading, signedIn, empty, filter, onNow, order, onKind, onTopBars, onShowBar }: DrinksHereProps) {
  const picked = filter.kinds.length > 0;
  const nearest = picked && order.layer === 'nearest' && !!order.from;
  const bestFirst = picked && !nearest;
  const best = useBestDrink(order.drink, filter, { load: bestFirst, active: bestFirst });
  const closest = useDiscoverList(filter, { from: order.from, onNow, enabled: nearest });
  const drinks = best.scores ? byScore(best.picked, best.scores.drinks) : nearest ? closest.drinks : mixed;
  const more = bestFirst ? undefined : nearest ? { total: closest.totals?.drinks ?? null, hasMore: closest.hasMore, loadMore: closest.loadMore, loading: closest.isLoadingMore } : mixedMore;
  const isLoading = bestFirst ? best.isLoading : nearest ? closest.isLoading : mixedLoading;
  const rows = useRowScores(drinks, filter.area, signedIn && !best.scores);
  const scores = best.scores ?? rows;
  const browsing = !picked && onNow && !filter.notHad;
  let body;
  if (!signedIn) body = <ListNote>Sign in to see the drinks bars pour.</ListNote>;
  else if (isLoading) body = <ListNote>Loading…</ListNote>;
  else if (!drinks.length) body = <ListNote>{empty}</ListNote>;
  else body = <DrinkAtBarList key={order.layer} drinks={drinks} more={more} scores={scores} onShowBar={onShowBar} />;
  return (
    <>
      {browsing ? <BrowseShelves filter={filter} around={mixed} enabled={signedIn && !mixedLoading} onKind={onKind} onTopBars={onTopBars} onShowBar={onShowBar} /> : null}
      <View style={styles.section}>
        <Headline role="heading">{browsing ? title.replace(/^Drinks/, 'All drinks') : title}</Headline>
        {body}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  more: { alignItems: 'flex-start', paddingTop: space.sm },
  also: { paddingTop: space.lg },
});
