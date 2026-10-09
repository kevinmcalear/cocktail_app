import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, IngredientThumb, Surface } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { BarItem } from '@/hooks/useHomeBar';
import { itemHref } from '@/lib/itemRoutes';

/** Drinks named on a card before "and N more". */
const NAMED = 3;

export interface PrepToMake {
  id: string;
  name: string;
  /** The ready drinks that need it, in What to make's order. */
  drinks: BarItem[];
}

/**
 * What to make first: house preps your shelf covers but you haven't made,
 * the ones that open the most drinks first. "I made it" puts it on the
 * shelf, where it counts like a bottle. One row of My Bar's list.
 */
export function MakeFirst({ preps, onMade }: { preps: PrepToMake[]; onMade: (id: string) => void }) {
  const router = useRouter();
  return (
    <View style={styles.list}>
      <Caption tone="muted">Preps you can make from what’s on your bar, and the drinks each one opens up.</Caption>
      {preps.map((p) => {
        const named = p.drinks.slice(0, NAMED).map((d) => d.name);
        const more = p.drinks.length - named.length;
        return (
          <Surface key={p.id} style={styles.card}>
            <View style={styles.top}>
              <IngredientThumb id={p.id} name={p.name} size={44} />
              <View style={styles.flex}>
                <Headline role="heading">{p.name}</Headline>
                <Caption tone="accent">You have everything for it</Caption>
              </View>
            </View>
            <Body>
              <Body tone="accent">{`Opens up ${p.drinks.length} ${p.drinks.length === 1 ? 'drink' : 'drinks'}: `}</Body>
              {more > 0 ? `${named.join(', ')} and ${more} more` : named.join(', ')}
            </Body>
            <View style={styles.actions}>
              <Button label="Recipe" variant="secondary" onPress={() => router.push(itemHref('Ingredient', p.id) as never)} style={styles.flex} />
              <Button label="I made it" variant="secondary" accessibilityHint="Puts it with your house preps" onPress={() => onMade(p.id)} style={styles.flex} />
            </View>
          </Surface>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md, paddingTop: space.md },
  card: { gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.sm },
});
