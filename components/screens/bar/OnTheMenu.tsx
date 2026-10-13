import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, RowScore } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import { useItemScores } from '@/hooks/useFlavor';
import { useMenuEditionDrinks, useMenuEditions } from '@/hooks/useProfiles';
import { itemHref } from '@/lib/itemRoutes';
import { editionMenuDrinks, shortDate } from '@/lib/menuEditions';

/** How many rows show before "Show all". */
const SHOWN = 7;

/**
 * "On the menu · 18" on a bar's page (disc-search-bar, b12): the menu it's
 * pouring now, "Autumn, since Sep 2026", each drink with its ingredients and
 * score, then "Show all 18". Nothing when no menu is on.
 */
export function OnTheMenu({ profileId }: { profileId: string }) {
  const [all, setAll] = useState(false);
  const current = (useMenuEditions(profileId).data ?? []).find((e) => e.is_current);
  const loaded = useMenuEditionDrinks(current?.drinks ?? []).data ?? [];
  const drinks = current ? editionMenuDrinks(current.drinks, loaded) : [];
  // A bar's drink kept to its team doesn't open for an outsider: it shows by name.
  const readable = new Set(loaded.map((d) => d.id));
  const scores = useItemScores(drinks.map((d) => d.id)).data ?? {};
  if (!current || !drinks.length) return null;
  const shown = all ? drinks : drinks.slice(0, SHOWN);
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Headline role="heading">{`On the menu · ${drinks.length}`}</Headline>
        <Caption tone="muted">{`${current.name}, since ${shortDate(current.year, current.month)}`}</Caption>
      </View>
      <View role="list">
        {shown.map((d) => (
          <DrinkRow key={d.id} name={d.name} itemId={d.id} href={readable.has(d.id) ? itemHref('Cocktail', d.id) : undefined} imageUrl={d.imageUrl} glass={d.glass} caption={d.line || undefined} trailing={<RowScore score={scores[d.id]} />} />
        ))}
      </View>
      {drinks.length > shown.length ? (
        <View style={styles.start}>
          <Button label={`Show all ${drinks.length}`} variant="ghost" onPress={() => setAll(true)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  head: { gap: space.xs },
  start: { alignItems: 'flex-start' },
});
