import { useRouter } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Body, Button, Caption, Headline, IngredientThumb, Segmented, Surface } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import type { BarItem } from '@/hooks/useHomeBar';
import { itemHref } from '@/lib/itemRoutes';
import type { MakeTab } from '@/lib/myBarRows';

/** Drinks under each bottle before "and N more". */
const PER_BOTTLE = 3;

/** Drinks one or two bottles away, under what to buy. */
export interface AwayGroup {
  bottles: BarItem[];
  drinks: BarItem[];
}

/** "92% match", once the person's taste is known. */
type MatchFor = (id: string) => string | undefined;
/** A small palate flower at the end of the row, when the drink's flavor is known. */
type GlyphFor = (id: string) => ReactNode;

/**
 * What the shelf makes now, and what one or two more bottles would open,
 * grouped by what to buy. Only drinks the shelf gets close to: everything
 * else is in Search. This is the heading and the tabs; the drinks and groups
 * are rows of My Bar's list (MakeDrink, BottleGroup), then MakeFoot.
 */
export function MakeHead({ tab, onTab, counts }: { tab: MakeTab; onTab: (tab: MakeTab) => void; counts: { ready: number; first: number; one: number; two: number; projects?: number } }) {
  const options: { value: MakeTab; label: string }[] = [{ value: 'ready', label: `Ready · ${counts.ready}` }];
  if (counts.first) options.push({ value: 'first', label: `Make first · ${counts.first}` });
  options.push(
    { value: 'one', label: `One away · ${counts.one}` },
    { value: 'two', label: `Two away · ${counts.two}` },
  );
  // Projects only once there's kit or a lab shelf: a beginner's tabs stay three.
  if (counts.projects !== undefined) options.push({ value: 'projects', label: `Projects · ${counts.projects}` });
  return (
    <View style={styles.section}>
      <Headline role="heading">What to make</Headline>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Segmented accessibilityLabel="What to make" value={tab} onChange={onTab} options={options} />
      </ScrollView>
    </View>
  );
}

/** A drink you can make. Memoized like the other list rows: every change to the list re-renders its rows. */
export const MakeDrink = memo(function MakeDrink({ drink, matchFor, glyphFor }: { drink: BarItem; matchFor: MatchFor; glyphFor?: GlyphFor }) {
  return <DrinkRow name={drink.name} itemId={drink.id} href={itemHref('Cocktail', drink.id)} imageUrl={drink.imageUrl} glass={drink.glass} caption={matchFor(drink.id)} trailing={glyphFor?.(drink.id)} />;
});

/** A tab with nothing in it, and where to look instead. */
export function MakeEmpty({ tab, oneAway }: { tab: MakeTab; oneAway: number }) {
  return (
    <Body tone="muted">
      {tab === 'ready'
        ? `Nothing yet. ${oneAway ? 'See what one more bottle would open.' : 'Add a few bottles and what’s in your kitchen.'}`
        : tab === 'one'
          ? 'No drink is one bottle away yet.'
          : tab === 'two'
            ? 'No drink is two bottles away yet.'
            : tab === 'first'
              ? 'Nothing to make first: every drink you can make uses what’s on your bar.'
              : 'No technique fits your kit and lab shelf yet. Add what you have.'}
    </Body>
  );
}

/** "Show more" while there are, then the way to every other drink. */
export function MakeFoot({ more, onMore }: { more: number; onMore: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.foot}>
      {more > 0 ? <Button label={`Show more (${more})`} variant="ghost" onPress={onMore} /> : null}
      <View style={styles.more}>
        <Caption tone="muted">Looking for a drink you can’t make yet?</Caption>
        <Button label="Search every drink" icon="magnifyingglass" variant="secondary" onPress={() => router.push('/search')} />
      </View>
    </View>
  );
}

/** The bottles to buy, what they open (three, then all on a tap), and Add. Memoized, as a list row. */
export const BottleGroup = memo(function BottleGroup({ id, group, open, onOpen, matchFor, glyphFor, onAdd, style }: { id: string; group: AwayGroup; open: boolean; onOpen: (id: string) => void; matchFor: MatchFor; glyphFor?: GlyphFor; onAdd: (ingredientIds: string[]) => void; style?: StyleProp<ViewStyle> }) {
  const { bottles, drinks } = group;
  const names = bottles.map((b) => b.name).join(' + ');
  const rest = drinks.length - PER_BOTTLE;
  return (
    <Surface style={[styles.group, style]}>
      <View style={styles.groupHead}>
        <View style={styles.thumbs}>
          {bottles.map((b) => (
            <IngredientThumb key={b.id} id={b.id} name={b.name} size={bottles.length > 1 ? 36 : 44} />
          ))}
        </View>
        <View style={styles.groupText}>
          <Headline>{names}</Headline>
          <View style={styles.opens}>
            <Caption tone="muted" style={styles.grow}>
              Opens {drinks.length} {drinks.length === 1 ? 'drink' : 'drinks'}
            </Caption>
            <Button
              label={bottles.length > 1 ? 'Add both' : 'Add'}
              variant="secondary"
              accessibilityLabel={`Add ${names} to your shelf`}
              onPress={() => onAdd(bottles.map((b) => b.id))}
            />
          </View>
        </View>
      </View>
      {(open ? drinks : drinks.slice(0, PER_BOTTLE)).map((d) => (
        <MakeDrink key={d.id} drink={d} matchFor={matchFor} glyphFor={glyphFor} />
      ))}
      {rest > 0 && !open ? <Button label={`and ${rest} more`} variant="ghost" onPress={() => onOpen(id)} /> : null}
    </Surface>
  );
});

const styles = StyleSheet.create({
  section: { gap: space.md, paddingBottom: space.md },
  group: { gap: space.xs },
  groupHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  thumbs: { flexDirection: 'row', gap: space.xs },
  groupText: { flex: 1, gap: 2 },
  opens: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
  foot: { gap: space.md, paddingTop: space.md },
  more: { gap: space.sm, alignItems: 'flex-start', paddingTop: space.md },
});
