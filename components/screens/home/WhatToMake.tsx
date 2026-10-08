import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, IngredientThumb, Segmented, Surface } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { space } from '@/constants/tokens';
import type { BarItem } from '@/hooks/useHomeBar';
import { itemHref } from '@/lib/itemRoutes';

type Tab = 'ready' | 'one' | 'two';
/** Drinks and bottles listed before "Show more"; a big shelf can make hundreds. */
const PAGE = 25;
/** Drinks under each bottle before "and N more". */
const PER_BOTTLE = 3;

/** Drinks one or two bottles away, under what to buy. */
interface AwayGroup {
  bottles: BarItem[];
  drinks: BarItem[];
}

interface WhatToMakeProps {
  canMake: BarItem[];
  oneAway: AwayGroup[];
  twoAway: AwayGroup[];
  /** "92% match", once the person's taste is known. */
  matchFor: (id: string) => string | undefined;
  onAdd: (ingredientIds: string[]) => void;
}

/**
 * What the shelf makes now, and what one or two more bottles would open,
 * grouped by what to buy. Only drinks the shelf gets close to: everything
 * else is in Search.
 */
export function WhatToMake({ canMake, oneAway, twoAway, matchFor, onAdd }: WhatToMakeProps) {
  const router = useRouter();
  const [picked, setPicked] = useState<Tab | null>(null);
  const [shown, setShown] = useState(PAGE);
  // Until the person picks, open on what they can make, or on what's closest when that's nothing.
  const tab = picked ?? (canMake.length ? 'ready' : oneAway.length ? 'one' : twoAway.length ? 'two' : 'ready');
  const groups = tab === 'one' ? oneAway : twoAway;
  const total = tab === 'ready' ? canMake.length : groups.length;
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
          { value: 'one', label: `One away · ${oneAway.length}` },
          { value: 'two', label: `Two away · ${twoAway.length}` },
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
      ) : groups.length ? (
        <View style={styles.groups}>
          {groups.slice(0, shown).map((g) => (
            <BottleGroup key={g.bottles.map((b) => b.id).join('+')} group={g} matchFor={matchFor} onAdd={onAdd} />
          ))}
        </View>
      ) : (
        <Body tone="muted">{tab === 'one' ? 'No drink is one bottle away yet.' : 'No drink is two bottles away yet.'}</Body>
      )}
      {total > shown ? <Button label={`Show more (${total - shown})`} variant="ghost" onPress={() => setShown(shown + PAGE)} /> : null}
      <View style={styles.more}>
        <Caption tone="muted">Looking for a drink you can’t make yet?</Caption>
        <Button label="Search every drink" icon="magnifyingglass" variant="secondary" onPress={() => router.push('/search')} />
      </View>
    </View>
  );
}

function BottleGroup({ group, matchFor, onAdd }: { group: AwayGroup; matchFor: WhatToMakeProps['matchFor']; onAdd: WhatToMakeProps['onAdd'] }) {
  const [open, setOpen] = useState(false);
  const { bottles, drinks } = group;
  const names = bottles.map((b) => b.name).join(' + ');
  const rest = drinks.length - PER_BOTTLE;
  return (
    <Surface style={styles.group}>
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
  groupHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  thumbs: { flexDirection: 'row', gap: space.xs },
  groupText: { flex: 1, gap: 2 },
  opens: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
  more: { gap: space.sm, alignItems: 'flex-start', paddingTop: space.md },
});
