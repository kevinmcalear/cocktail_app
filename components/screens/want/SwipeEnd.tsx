import { StyleSheet, View } from 'react-native';

import { Body, Button, DsText, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useCollection } from '@/hooks/useCollection';
import { useOnNearYou, type DeckCard } from '@/hooks/useWant';
import type { Taste } from '@/lib/flavor';
import { endLine, onboardingLine, wantedLine } from '@/lib/want';

interface SwipeEndProps {
  /** Wanted in this round, in order. */
  wanted: DeckCard[];
  onboarding: boolean;
  taste: Taste | null;
  onDone: () => void;
}

/**
 * The end of the deck (Next-phone "swipe" step 3): "That's all for now",
 * how many are on your Want list, the ones just wanted with where each is on
 * near you, and Done. In onboarding: "That's ten", what your taste says, Start.
 */
export function SwipeEnd({ wanted, onboarding, taste, onDone }: SwipeEndProps) {
  const ds = useDs();
  const total = useCollection().data?.drinks.length;
  const near = useOnNearYou(wanted.map((w) => ({ itemId: w.itemId, name: w.name })));
  return (
    <View style={styles.end}>
      <View style={styles.head}>
        <DsText variant="title" role="heading" align="center">
          {onboarding ? 'That’s ten' : 'That’s all for now'}
        </DsText>
        <Body tone="muted" align="center">
          {onboarding ? onboardingLine(taste) : endLine(total ?? wanted.length)}
        </Body>
      </View>
      {wanted.length ? (
        <View role="list">
          {wanted.map((w) => (
            <DrinkRow
              key={w.itemId}
              name={w.name}
              itemId={w.itemId}
              imageUrl={null}
              glass={null}
              displayName
              href={`/cocktail/${w.itemId}`}
              caption={wantedLine(near.byItem[w.itemId]?.[0])}
              trailing={<IconSymbol name="chevron.right" size={14} color={ds.c.faint} />}
            />
          ))}
        </View>
      ) : null}
      <Button label={onboarding ? 'Start' : 'Done'} size="lg" onPress={onDone} style={styles.done} />
    </View>
  );
}

const styles = StyleSheet.create({
  end: { gap: space.lg },
  head: { gap: space.sm, paddingTop: space.xxl, paddingBottom: space.lg, alignItems: 'center' },
  done: { marginTop: space.md },
});
