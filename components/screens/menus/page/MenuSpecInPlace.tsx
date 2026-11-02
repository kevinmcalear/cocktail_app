import { StyleSheet, View } from 'react-native';

import { Caption, PressableScale, useDs } from '@/components/ds';
import { SpecCard } from '@/components/screens/drink/spec/SpecCard';
import { font, radius, space } from '@/constants/tokens';
import { useCocktail } from '@/hooks/useCocktails';
import { specLines } from '@/lib/spec';
import { methodVerb } from '@/lib/specView';
import type { PresentationRecipe } from '@/lib/spec';

/**
 * A bartender's spec, opened in place under its row on a menu (Menu-who-
 * bartender): the drink page's spec card, one drink at a time, and Open the
 * drink for the whole page.
 */
export function MenuSpecInPlace({ itemId, barId, onOpen }: { itemId: string; barId: string | null; onOpen: () => void }) {
  const ds = useDs();
  const { data: drink, isPending } = useCocktail(itemId);
  const lines = specLines(drink?.recipes as PresentationRecipe[] | undefined);
  const methods = (drink?.item_methods ?? []).map((m) => m.method?.name).filter((n): n is string => !!n);
  return (
    <View style={[styles.card, { backgroundColor: ds.c.raised }]}>
      {isPending && !drink ? (
        <Caption tone="muted">Opening the spec…</Caption>
      ) : !lines.length ? (
        <Caption tone="muted">No spec written yet.</Caption>
      ) : (
        <SpecCard itemId={itemId} barId={barId} lines={lines} maker verb={methodVerb(methods)} />
      )}
      <PressableScale role="link" accessibilityLabel="Open the drink" onPress={onOpen} style={styles.open}>
        <Caption style={font.semiBold}>Open the drink ›</Caption>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.control, padding: space.md, marginBottom: space.md, gap: space.sm, borderCurve: 'continuous' },
  open: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.lg },
});
