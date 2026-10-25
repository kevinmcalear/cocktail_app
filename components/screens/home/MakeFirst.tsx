import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, IngredientThumb, PressableScale, Surface, useDs } from '@/components/ds';
import { Eyebrow } from '@/components/screens/addDrink/WizardChrome';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { BarItem } from '@/hooks/useHomeBar';
import { itemHref } from '@/lib/itemRoutes';

import { CheckList } from './CheckList';

/** Drinks named on a card before "and N more". */
const NAMED = 3;

export interface PrepToMake {
  id: string;
  name: string;
  /** The ready drinks that need it, in What to make's order. */
  drinks: BarItem[];
  /** "Overnight · keeps about a week", when its card or technique says. */
  meta: string | null;
  /** What of yours goes in it: every line is covered, or it wouldn't be here. */
  has: string[];
}

/** A prep one ingredient short, what that is, and the drinks one away for it that use the prep. */
export interface PrepShort {
  id: string;
  name: string;
  missing: { id: string; name: string };
  drinks: BarItem[];
}

const opens = (n: number) => `Opens up ${n} ${n === 1 ? 'drink' : 'drinks'}`;

/**
 * What to make first: house preps your shelf covers but you haven't made,
 * the ones that open the most drinks first. "I made it" puts it on the
 * shelf, where it counts like a bottle. Then One thing short: preps one
 * ingredient away, with Add. One row of My Bar's list.
 */
export function MakeFirst({ preps, short, onMade, onAdd }: { preps: PrepToMake[]; short: PrepShort[]; onMade: (id: string) => void; onAdd: (ids: string[]) => void }) {
  const router = useRouter();
  const ds = useDs();
  return (
    <View style={styles.list}>
      <Caption tone="muted">What you can make in-house from what’s on your bar, and the drinks each one opens up. Most drinks first.</Caption>
      {preps.map((p) => {
        const named = p.drinks.slice(0, NAMED).map((d) => d.name);
        const more = p.drinks.length - named.length;
        return (
          <Surface key={p.id} style={styles.card}>
            <View style={styles.top}>
              <IngredientThumb id={p.id} name={p.name} size={44} />
              <View style={styles.flex}>
                <Headline role="heading">{p.name}</Headline>
                {p.meta ? <Caption tone="muted">{p.meta}</Caption> : null}
              </View>
            </View>
            <CheckList names={p.has} chips />
            <Body>
              <Body style={styles.strong}>{`${opens(p.drinks.length)}: `}</Body>
              <Body tone="muted">{more > 0 ? `${named.join(', ')} and ${more} more` : named.join(', ')}</Body>
            </Body>
            <View style={styles.actions}>
              <Button label="Recipe" variant="ink" onPress={() => router.push(itemHref('Ingredient', p.id) as never)} style={styles.flex} />
              <Button label="I made it" variant="secondary" accessibilityHint="Puts it with what you make in-house" onPress={() => onMade(p.id)} style={styles.flex} />
            </View>
          </Surface>
        );
      })}
      {short.length ? (
        <View style={styles.short}>
          <Eyebrow>One thing short</Eyebrow>
          {short.map((p) => (
            <Surface key={p.id} style={styles.card}>
              <PressableScale role="link" accessibilityLabel={`${p.name}, ${opens(p.drinks.length)}, needs ${p.missing.name}`} onPress={() => router.push(itemHref('Ingredient', p.id) as never)} style={styles.top}>
                <IngredientThumb id={p.id} name={p.name} size={44} />
                <View style={styles.flex}>
                  <Body style={styles.strong}>{p.name}</Body>
                  <Caption tone="muted">{opens(p.drinks.length)}</Caption>
                </View>
              </PressableScale>
              <View style={styles.needRow}>
                <View style={[styles.need, { borderColor: ds.c.lineStrong }]}>
                  <Caption>{`Needs ${p.missing.name.toLowerCase()}`}</Caption>
                </View>
                <Button label={`Add ${p.missing.name}`} variant="secondary" onPress={() => onAdd([p.missing.id])} />
              </View>
            </Surface>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Desktop Ready: the preps to make first as small cards above the drinks. */
export function MakeFirstStrip({ preps }: { preps: PrepToMake[] }) {
  const router = useRouter();
  if (!preps.length) return null;
  return (
    <View style={styles.strip}>
      <Body style={styles.strong}>Make one of these first and open up more</Body>
      <View style={styles.stripCards}>
        {preps.slice(0, 3).map((p) => (
          <PressableScale key={p.id} role="link" accessibilityLabel={[p.name, p.meta, opens(p.drinks.length)].filter(Boolean).join(', ')} onPress={() => router.push(itemHref('Ingredient', p.id) as never)} style={styles.stripCard}>
            <Surface style={styles.stripInner}>
              <Body numberOfLines={1} style={styles.strong}>
                {p.name}
              </Body>
              <Caption tone="muted" numberOfLines={2}>
                {[p.meta, p.has.join(', ')].filter(Boolean).join(' · ')}
              </Caption>
              <Caption style={styles.strong}>{opens(p.drinks.length)}</Caption>
            </Surface>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md, paddingTop: space.md },
  card: { gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.sm },
  short: { gap: space.md, paddingTop: space.lg },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  needRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  need: { minHeight: 32, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center' },
  strip: { gap: space.sm, paddingTop: space.xs },
  stripCards: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stripCard: { flexGrow: 1, flexBasis: 220 },
  stripInner: { gap: space.xs },
});
