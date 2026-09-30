import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Chip, DrinkImage, DsText, PressableScale, Spec } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { favourites, sortHad, tallyBars, whereLine, type HadDrink, type HadSort } from '@/lib/hadDrinks';
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
          <DrinkImage source={d.imageUrl} generated={d.isSketch} accessibilityLabel={d.name} />
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
export function BarTallies({ drinks, whose }: { drinks: HadDrink[]; whose: string }) {
  const router = useRouter();
  return (
    <View style={styles.section}>
      <Caption tone="muted">{`${whose} average across the drinks had at each bar.`}</Caption>
      <View>
        {tallyBars(drinks).map((b, i) => {
          const venue = b.venue;
          return (
            <RankRow
              key={b.key}
              position={i + 1}
              title={venue?.name ?? 'At home'}
              detail={`${plural(b.drinks, 'drink')} · best: ${b.best.name}`}
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

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.sm / 2, rowGap: space.lg },
  tile: { paddingHorizontal: space.sm / 2, gap: space.xs },
  tileScore: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
});
