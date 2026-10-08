import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, IngredientThumb, Segmented, Surface } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import type { BarItem } from '@/hooks/useHomeBar';
import { itemHref } from '@/lib/itemRoutes';

type Tab = 'ready' | 'one';
/** Drinks and bottles listed before "Show more"; a big shelf can make hundreds. */
const PAGE = 25;
/** Drinks under each bottle before "and N more". */
const PER_BOTTLE = 3;

interface WhatToMakeProps {
  canMake: BarItem[];
  oneAway: { ingredient: BarItem; drinks: BarItem[] }[];
  /** "92% match", once the person's taste is known. */
  matchFor: (id: string) => string | undefined;
  onAdd: (ingredientId: string) => void;
}

/**
 * What the shelf makes now, and what one more bottle would open, grouped by
 * the bottle. Only drinks the shelf gets close to: everything else is in Search.
 */
export function WhatToMake({ canMake, oneAway, matchFor, onAdd }: WhatToMakeProps) {
  const router = useRouter();
  const [picked, setPicked] = useState<Tab | null>(null);
  const [shown, setShown] = useState(PAGE);
  // Until the person picks, open on what they can make, or on what's close when that's nothing.
  const tab = picked ?? (canMake.length || !oneAway.length ? 'ready' : 'one');
  const total = tab === 'ready' ? canMake.length : oneAway.length;
  const pick = (t: Tab) => {
    setPicked(t);
    setShown(PAGE);
  };

  return (
    <View style={styles.section}>
      <Headline role="heading">What to make</Headline>
      <Segmented
        accessibilityLabel="What to make"
        value={tab}
        onChange={pick}
        options={[
          { value: 'ready', label: `Ready · ${canMake.length}` },
          { value: 'one', label: `One bottle away · ${oneAway.length}` },
        ]}
      />
      {tab === 'ready' ? (
        canMake.length ? (
          <View>
            {canMake.slice(0, shown).map((d) => (
              <DrinkRow key={d.id} name={d.name} itemId={d.id} href={itemHref('Cocktail', d.id)} imageUrl={d.imageUrl} glass={d.glass} caption={matchFor(d.id)} />
            ))}
          </View>
        ) : (
          <Body tone="muted">Nothing yet. {oneAway.length ? 'See what one more bottle would open.' : 'Add a few bottles and what’s in your kitchen.'}</Body>
        )
      ) : oneAway.length ? (
        <View style={styles.groups}>
          {oneAway.slice(0, shown).map((g) => (
            <BottleGroup key={g.ingredient.id} group={g} matchFor={matchFor} onAdd={onAdd} />
          ))}
        </View>
      ) : (
        <Body tone="muted">No drink is one bottle away yet.</Body>
      )}
      {total > shown ? <Button label={`Show more (${total - shown})`} variant="ghost" onPress={() => setShown(shown + PAGE)} /> : null}
      <View style={styles.more}>
        <Caption tone="muted">Looking for a drink you can’t make yet?</Caption>
        <Button label="Search every drink" icon="magnifyingglass" variant="secondary" onPress={() => router.push('/search')} />
      </View>
    </View>
  );
}

function BottleGroup({ group, matchFor, onAdd }: { group: WhatToMakeProps['oneAway'][number]; matchFor: WhatToMakeProps['matchFor']; onAdd: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const { ingredient, drinks } = group;
  const rest = drinks.length - PER_BOTTLE;
  return (
    <Surface style={styles.group}>
      <View style={styles.groupHead}>
        <IngredientThumb id={ingredient.id} name={ingredient.name} size={44} />
        <View style={styles.groupText}>
          <Headline numberOfLines={1}>{ingredient.name}</Headline>
          <Caption tone="muted">
            Opens {drinks.length} {drinks.length === 1 ? 'drink' : 'drinks'}
          </Caption>
        </View>
        <Button label="Add" variant="secondary" accessibilityLabel={`Add ${ingredient.name} to your shelf`} onPress={() => onAdd(ingredient.id)} />
      </View>
      {(open ? drinks : drinks.slice(0, PER_BOTTLE)).map((d) => (
        <DrinkRow key={d.id} name={d.name} itemId={d.id} href={itemHref('Cocktail', d.id)} imageUrl={d.imageUrl} glass={d.glass} caption={matchFor(d.id)} />
      ))}
      {rest > 0 && !open ? <Button label={`and ${rest} more`} variant="ghost" onPress={() => setOpen(true)} /> : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  groups: { gap: space.md },
  group: { gap: space.xs },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  groupText: { flex: 1, gap: 2 },
  more: { gap: space.sm, alignItems: 'flex-start', paddingTop: space.md },
});
