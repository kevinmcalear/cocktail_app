import { getLocales } from 'expo-localization';
import { createContext, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, RowScore, scoreWords as rowScoreWords, type MatchTextProps } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { ListNote } from '@/components/screens/rankings/RankingLists';
import { space } from '@/constants/tokens';
import { useRowScores } from '@/hooks/useBestDrink';
import { useVersionLabel } from '@/hooks/useSpecMatches';
import { drinkCount, type BarScore, type DiscoverDrink } from '@/lib/discoverDrinks';
import { isStrong } from '@/lib/discoverMatch';
import { itemHref } from '@/lib/itemRoutes';
import { formatDistance, usesMiles, type Area } from '@/lib/nearMe';
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
 * One drink at its bar, the sub line plain as drawn (disc-list): the bar,
 * how far it is (else where), what it is to its classic ("the classic
 * spec", or what its variation changes) and "on now"; the scores (when
 * given) at the end, and the searched word lit (tint on Discover). `atBar`:
 * a tapped bar's own drinks (disc-map-bar), so the bar isn't repeated.
 * `everywhere`: search's Everywhere, which adds the bar's small logo before
 * the caption and puts why it matched ("Riff on a Negroni") on its own line,
 * the word lit (nav-search-everywhere).
 */
export function DrinkAtBarRow({ drink: d, scores, query, matchLook = 'tint', atBar = false, everywhere = false, onPress }: { drink: DiscoverDrink; scores?: DrinkScores; query?: string; matchLook?: MatchTextProps['look']; atBar?: boolean; everywhere?: boolean; onPress?: () => void }) {
  const bar = d.bar;
  const version = useVersionLabel(d.id);
  const near = useContext(BarAway)(d.barId);
  const away = d.distance === null || d.distance === undefined ? near : formatDistance(d.distance / 1000, usesMiles(getLocales()[0]));
  // A tapped bar's rows say what the drink is instead (ponytail: its description; the ingredient line needs discover_list to return the spec's lines).
  const what = atBar ? (d.why ?? version ?? d.description) : everywhere ? version : (d.why ?? version);
  const caption = (atBar ? [what, d.menu.onNow ? 'on now' : null] : [bar.name, away ?? place(bar), what, d.menu.onNow ? 'on now' : null]).filter(Boolean).join(' · ');
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
      logo={everywhere ? { uri: bar.logo, name: bar.name, profileId: d.barId } : undefined}
      note={everywhere ? (d.why ?? undefined) : undefined}
      tag={d.menu.past ?? undefined}
      trailing={<DrinkScore drink={drinkScore} bar={barScore} />}
      query={query}
      matchLook={matchLook}
      label={said ? [d.name, caption, everywhere ? d.why : null, d.menu.past, said].filter(Boolean).join('. ') : undefined}
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
export function DrinkAtBarList({ drinks, limit = 8, scores, more, query, onOpen }: { drinks: DiscoverDrink[]; limit?: number; scores?: DrinkScores; more?: MoreDrinks; /** The searched words, lit in each row. */ query?: string; /** A row opens here instead of its page (wide Discover's search). */ onOpen?: (d: DiscoverDrink) => void }) {
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
        <DrinkAtBarRow key={d.id} drink={d} scores={scores} query={query} onPress={onOpen ? () => onOpen(d) : undefined} />
      ))}
      {next > 0 ? (
        <View style={styles.more}>
          <Button label={more?.loading && shown.length >= drinks.length ? 'Loading…' : `Show ${next} more of ${total}`} variant="ghost" onPress={showMore} />
        </View>
      ) : null}
    </View>
  );
}

interface DrinksHereProps {
  title: string;
  drinks: DiscoverDrink[];
  /** How many in all, at how many bars (the first page says). */
  totals: { drinks: number; bars: number } | null;
  more: MoreDrinks;
  isLoading: boolean;
  signedIn: boolean;
  /** What to say when nothing matches. */
  empty: string;
  /** Where: the bars' scores under each drink come from its top bars. */
  area: Area;
}

/** "Martinis near you": the drinks at bars that match, with how many bars pour them. */
export function DrinksHere({ title, drinks, totals, more, isLoading, signedIn, empty, area }: DrinksHereProps) {
  const scores = useRowScores(drinks, area, signedIn);
  let body;
  if (!signedIn) body = <ListNote>Sign in to see the drinks bars pour.</ListNote>;
  else if (isLoading) body = <ListNote>Loading…</ListNote>;
  else if (!drinks.length) body = <ListNote>{empty}</ListNote>;
  else body = <DrinkAtBarList drinks={drinks} more={more} scores={scores} />;
  return (
    <View style={styles.section}>
      <Caption tone="muted">{totals?.drinks ? `${drinkCount(totals.drinks)} at ${totals.bars} ${totals.bars === 1 ? 'bar' : 'bars'}` : 'At bars'}</Caption>
      <Headline role="heading">{title}</Headline>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  more: { alignItems: 'flex-start', paddingTop: space.sm },
  also: { paddingTop: space.lg },
});
