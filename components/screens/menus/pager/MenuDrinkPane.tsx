import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { DrinkScreen } from '@/components/screens/drink/DrinkScreenLazy';
import { font, layout, space } from '@/constants/tokens';
import { useCocktail } from '@/hooks/useCocktails';
import { useItemEditAccess } from '@/hooks/useViewAs';
import type { PagerPlace } from '@/lib/menuPager';

/**
 * The desktop's menu page (2027 canvas, Menu-desk): the chosen drink beside
 * the menu, "4 of 8" and ‹ › over it to step through the menu without
 * leaving it. The drink page is the drink page, set in its pane.
 */
export function MenuDrinkPane({ itemId, place, onPick }: { itemId: string; place: PagerPlace | null; onPick: (id: string) => void }) {
  const ds = useDs();
  const router = useRouter();
  const query = useCocktail(itemId, { seeded: true });
  const drink = query.isPlaceholderData ? undefined : query.data;
  const access = useItemEditAccess(drink);
  return (
    <View style={[styles.pane, { borderLeftColor: ds.c.line, backgroundColor: ds.c.ground }]}>
      {place ? (
        <View style={styles.head} role="navigation" aria-label="Drinks on this menu">
          <Caption tone="muted" style={[styles.caps, styles.grow]}>
            {`${place.index + 1} of ${place.total}`.toUpperCase()}
          </Caption>
          <Step label="‹" name={place.prev?.name} onPress={place.prev ? () => onPick(place.prev!.id) : undefined} />
          <Step label="›" name={place.next?.name} onPress={place.next ? () => onPick(place.next!.id) : undefined} />
        </View>
      ) : null}
      <View style={styles.grow}>
        {drink ? (
          <DrinkScreen item={drink} pane canEdit={access === 'edit'} adminFix={access === 'admin'} onEdit={() => router.push(`/cocktail/${itemId}/edit` as Href)} />
        ) : (
          <Body tone="muted" style={styles.wait}>
            {query.error ? 'Couldn’t open this drink.' : ''}
          </Body>
        )}
      </View>
    </View>
  );
}

function Step({ label, name, onPress }: { label: string; name: string | undefined; onPress?: () => void }) {
  return (
    <PressableScale role="button" accessibilityLabel={name ? `${label === '‹' ? 'Before' : 'Next'}: ${name}` : undefined} disabled={!onPress} onPress={onPress} style={[styles.step, !onPress && styles.off]}>
      <DsText variant="label" style={font.semiBold}>
        {label}
      </DsText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pane: { width: layout.listPaneDesk + 60, flexShrink: 0, borderLeftWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xl, paddingTop: space.lg },
  caps: { letterSpacing: 1.5, ...font.medium },
  grow: { flex: 1 },
  step: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.3 },
  wait: { padding: space.xl },
});
