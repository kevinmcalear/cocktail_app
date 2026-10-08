import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, PressableScale, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { ListNote } from '@/components/screens/rankings/RankingLists';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { drinkCount, type DiscoverBar, type DiscoverDrink } from '@/lib/discoverDrinks';
import { itemHref } from '@/lib/itemRoutes';

const place = (b: DiscoverBar) => [b.locality, b.city].filter(Boolean).join(', ');

/** How many more drinks each "Show more" adds: "anywhere" can be thousands, too many to lay out at once. */
const MORE = 40;

/** Drinks, each with the bar that makes it; the first `limit`, then more a page at a time. */
export function DrinkAtBarList({ drinks, barsById, limit = 8 }: { drinks: DiscoverDrink[]; barsById: ReadonlyMap<string, DiscoverBar>; limit?: number }) {
  const [count, setCount] = useState(limit);
  const shown = drinks.slice(0, count);
  const next = Math.min(MORE, drinks.length - shown.length);
  return (
    <View role="list">
      {shown.map((d) => {
        const bar = barsById.get(d.barId);
        return (
          <DrinkRow
            key={d.id}
            name={d.name}
            href={itemHref('Cocktail', d.id)}
            itemId={d.id}
            imageUrl={d.imageUrl}
            glass={null}
            caption={bar ? [bar.name, place(bar), d.menu?.onNow ? 'on now' : null].filter(Boolean).join(' · ') : undefined}
            logo={bar ? { uri: bar.logo, name: bar.name } : undefined}
            tag={d.menu?.past ?? undefined}
            note={d.description ?? undefined}
          />
        );
      })}
      {next > 0 ? (
        <View style={styles.more}>
          <Button label={`Show ${next} more of ${drinks.length}`} variant="ghost" onPress={() => setCount(shown.length + next)} />
        </View>
      ) : null}
    </View>
  );
}

/** Bars, with their logo and where they are, opening the bar's page. */
export function BarList({ bars }: { bars: DiscoverBar[] }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <View role="list">
      {bars.map((b) => (
        <PressableScale
          key={b.id}
          role="link"
          accessibilityLabel={`${b.name}${place(b) ? `, ${place(b)}` : ''}`}
          onPress={() => router.push(`/p/${b.handle || b.id}`)}
          style={[styles.bar, { borderBottomColor: ds.c.line }]}
        >
          <UserAvatar uri={b.logo} name={b.name} size={40} />
          <View style={styles.flex}>
            <Headline numberOfLines={1}>{b.name}</Headline>
            {place(b) ? <Caption tone="muted">{place(b)}</Caption> : null}
          </View>
        </PressableScale>
      ))}
    </View>
  );
}

interface DrinksHereProps {
  title: string;
  drinks: DiscoverDrink[];
  barsById: ReadonlyMap<string, DiscoverBar>;
  isLoading: boolean;
  signedIn: boolean;
  /** What to say when nothing matches. */
  empty: string;
}

/** "Martinis near you": the drinks at bars that match, with how many bars pour them. */
export function DrinksHere({ title, drinks, barsById, isLoading, signedIn, empty }: DrinksHereProps) {
  const barCount = new Set(drinks.map((d) => d.barId)).size;
  let body;
  if (!signedIn) body = <ListNote>Sign in to see the drinks bars pour.</ListNote>;
  else if (isLoading) body = <ListNote>Loading…</ListNote>;
  else if (!drinks.length) body = <ListNote>{empty}</ListNote>;
  else body = <DrinkAtBarList drinks={drinks} barsById={barsById} />;
  return (
    <View style={styles.section}>
      <Caption tone="muted">{drinks.length ? `${drinkCount(drinks.length)} at ${barCount} ${barCount === 1 ? 'bar' : 'bars'}` : 'At bars'}</Caption>
      <Headline role="heading">{title}</Headline>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  more: { alignItems: 'flex-start', paddingTop: space.sm },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
});
