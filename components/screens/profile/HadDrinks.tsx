import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, DrinkImage, DsText, PressableScale, Spec } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { favourites, sortHad, whereLine, type BarTally, type HadDrink, type HadSort } from '@/lib/hadDrinks';
import { itemHref } from '@/lib/itemRoutes';
import { plural } from '@/lib/menus';
import { dayOf, formatScore } from '@/lib/ranking';

import { RankRow } from '../rankings/RankingLists';

const MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });
const href = (d: HadDrink) => itemHref('Cocktail', d.itemId);

/** The drinks they loved most, as tiles: the picture, the score, and where. */
export function Favourites({ drinks, columns }: { drinks: HadDrink[]; columns: number }) {
  const router = useRouter();
  // Two rows on a phone, one on wider screens.
  const top = favourites(drinks, columns === 2 ? 4 : columns);
  if (!top.length) return null;
  return (
    <View role="list" style={styles.grid}>
      {top.map((d) => (
        <PressableScale
          key={d.id}
          role="link"
          accessibilityLabel={`${d.name}, ${whereLine(d)}. Score ${formatScore(d.score)}`}
          onPress={() => router.push(href(d) as Href)}
          style={[styles.tile, { width: `${100 / columns}%` }]}
        >
          <DrinkImage thumb source={d.imageUrl} generated={d.isSketch} itemId={d.itemId} accessibilityLabel={d.name} />
          <DsText variant="headline" numberOfLines={2}>
            {d.name}
          </DsText>
          <View style={styles.tileScore}>
            <Spec>{formatScore(d.score)}</Spec>
            <Caption tone="muted" numberOfLines={1} style={styles.flex}>
              {whereLine(d)}
            </Caption>
          </View>
        </PressableScale>
      ))}
    </View>
  );
}

const SORTS: { value: HadSort; label: string }[] = [
  { value: 'score', label: 'Top scored' },
  { value: 'recent', label: 'Latest' },
];

/** Every drink they've had, each with its score: best first, or latest first. */
export function HadList({ drinks }: { drinks: HadDrink[] }) {
  const [sort, setSort] = useState<HadSort>('score');
  return (
    <View style={styles.section}>
      <View role="radiogroup" accessibilityLabel="Order" style={styles.chips}>
        {SORTS.map((s) => (
          <Chip key={s.value} label={s.label} selected={sort === s.value} onPress={() => setSort(s.value)} />
        ))}
      </View>
      <View role="list">
        {sortHad(drinks, sort).map((d) => {
          const caption = [d.listName, whereLine(d), d.hadOn ? MONTH_YEAR.format(dayOf(d.hadOn)) : null].filter(Boolean).join(' · ');
          return (
            <View role="listitem" key={d.id}>
              <DrinkRow
                name={d.name}
                href={href(d)}
                itemId={d.itemId}
                imageUrl={d.imageUrl}
                glass={null}
                caption={caption}
                label={`${d.name}. ${caption}. Score ${formatScore(d.score)}`}
                trailing={<Spec>{formatScore(d.score)}</Spec>}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Each bar they've had drinks at, with the average of their scores there. Best first. */
export function BarTallies({ bars, whose }: { bars: BarTally[]; whose: string }) {
  const router = useRouter();
  return (
    <View style={styles.section}>
      <Caption tone="muted">{`${whose} average across the drinks had at each bar.`}</Caption>
      <View>
        {bars.map((b, i) => {
          const venue = b.venue;
          return (
            <RankRow
              key={b.key}
              position={i + 1}
              title={venue?.name ?? 'At home'}
              detail={b.best ? `${plural(b.drinks, 'drink')} · best: ${b.best.name}` : plural(b.drinks, 'drink')}
              score={b.average}
              scoreDetail={b.drinks > 1 ? 'average' : undefined}
              logo={venue?.avatarUrl ?? null}
              onPress={venue ? () => router.push(`/p/${venue.handle || venue.id}` as Href) : undefined}
            />
          );
        })}
      </View>
    </View>
  );
}

interface SharedDrinksProps {
  /** Whose profile: "Jo". */
  name: string;
  tab: 'had' | 'bars';
  /** They've chosen to show this tab. When they haven't, only they get it. */
  shared: boolean;
  signedIn: boolean;
  drinks: HadDrink[] | undefined;
  bars: BarTally[] | undefined;
  failed: boolean;
}

const KEPT: Record<SharedDrinksProps['tab'], string> = {
  had: 'Only you can see the drinks you’ve had. You can show them here, with your scores, from your profile settings.',
  bars: 'Only you can see the bars you’ve had drinks at. You can show them here, with your average at each, from your profile settings.',
};

/** The Had and Bars tabs on a person's public profile: what they show, or (to them) a line saying why not. */
export function SharedDrinks({ name, tab, shared, signedIn, drinks, bars, failed }: SharedDrinksProps) {
  const router = useRouter();
  if (!shared) {
    return (
      <View style={styles.section}>
        <Body tone="muted">{KEPT[tab]}</Body>
        <View style={styles.chips}>
          <Button label="See them on You" variant="secondary" onPress={() => router.push('/you')} />
          <Button label="Profile settings" variant="ghost" onPress={() => router.push('/settings/profile')} />
        </View>
      </View>
    );
  }
  if (!signedIn) return <Body tone="muted">{`Sign in to see ${tab === 'had' ? 'the drinks' : 'the bars'} ${name} has had.`}</Body>;
  if (failed) return <Body tone="muted">Couldn’t load them. Check your connection and try again.</Body>;
  if (tab === 'had') {
    if (!drinks) return <Caption tone="muted">Loading drinks…</Caption>;
    if (!drinks.length) return <Body tone="muted">{`${name} hasn’t ranked a drink yet.`}</Body>;
    return <HadList drinks={drinks} />;
  }
  if (!bars) return <Caption tone="muted">Loading bars…</Caption>;
  if (!bars.length) return <Body tone="muted">{`${name} hasn’t ranked a drink at a bar yet.`}</Body>;
  return <BarTallies bars={bars} whose="Their" />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.sm / 2, rowGap: space.lg },
  tile: { paddingHorizontal: space.sm / 2, gap: space.xs },
  tileScore: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
});
