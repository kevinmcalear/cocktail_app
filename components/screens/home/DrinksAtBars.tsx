import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, Spec } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { ListNote } from '@/components/screens/rankings/RankingLists';
import { space } from '@/constants/tokens';
import { useVersionLabel } from '@/hooks/useSpecMatches';
import { drinkCount, type BarScore, type DiscoverDrink } from '@/lib/discoverDrinks';
import { itemHref } from '@/lib/itemRoutes';
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

/** The scores at the end of a drink row: the drink's, then its bar's under it. Nothing when neither is scored. */
export function DrinkScore({ drink, bar }: { drink?: number; bar?: number }) {
  if (drink === undefined && bar === undefined) return null;
  return (
    <View style={styles.score}>
      {drink !== undefined ? <Spec>{formatScore(drink)}</Spec> : null}
      {bar !== undefined ? <Caption tone="muted">{`Bar ${formatScore(bar)}`}</Caption> : null}
    </View>
  );
}

/** What a screen reader hears for those scores. */
export function scoreWords(drink?: number, bar?: number): string | null {
  const words = [drink !== undefined ? `score ${formatScore(drink)}` : null, bar !== undefined ? `bar scores ${formatScore(bar)}` : null].filter(Boolean);
  return words.length ? words.join(', ') : null;
}

/**
 * One drink at its bar: the bar and where it is under the name, what it is to
 * its classic ("the classic spec", or what its variation changes), the scores
 * (when given) at the end.
 */
export function DrinkAtBarRow({ drink: d, scores }: { drink: DiscoverDrink; scores?: DrinkScores }) {
  const bar = d.bar;
  const version = useVersionLabel(d.id);
  const caption = [bar.name, place(bar), version, d.menu.onNow ? 'on now' : null].filter(Boolean).join(' · ');
  const drinkScore = scores?.drinks[d.id];
  const barScore = scores?.bars[d.barId]?.score;
  const said = scoreWords(drinkScore, barScore);
  return (
    <DrinkRow
      name={d.name}
      href={itemHref('Cocktail', d.id)}
      itemId={d.id}
      imageUrl={d.imageUrl}
      glass={null}
      caption={caption}
      logo={{ uri: bar.logo, name: bar.name }}
      tag={d.menu.past ?? undefined}
      note={d.description ?? undefined}
      trailing={<DrinkScore drink={drinkScore} bar={barScore} />}
      label={said ? [d.name, caption, d.menu.past, said, d.description].filter(Boolean).join('. ') : undefined}
    />
  );
}

/**
 * Drinks, each with the bar that makes it (and their scores, when given);
 * the first `limit`, then more a page at a time: from what's loaded, then
 * the server's next page (`more`). Phones' Discover sheet virtualizes its
 * rows instead (DiscoverMapPane, with DrinkAtBarRow).
 */
export function DrinkAtBarList({ drinks, limit = 8, scores, more }: { drinks: DiscoverDrink[]; limit?: number; scores?: DrinkScores; more?: MoreDrinks }) {
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
        <DrinkAtBarRow key={d.id} drink={d} scores={scores} />
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
}

/** "Martinis near you": the drinks at bars that match, with how many bars pour them. */
export function DrinksHere({ title, drinks, totals, more, isLoading, signedIn, empty }: DrinksHereProps) {
  let body;
  if (!signedIn) body = <ListNote>Sign in to see the drinks bars pour.</ListNote>;
  else if (isLoading) body = <ListNote>Loading…</ListNote>;
  else if (!drinks.length) body = <ListNote>{empty}</ListNote>;
  else body = <DrinkAtBarList drinks={drinks} more={more} />;
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
  score: { alignItems: 'flex-end' },
});
