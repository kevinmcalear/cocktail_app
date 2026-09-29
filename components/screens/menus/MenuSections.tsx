import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, Headline, PressableScale, Spec, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { itemHref, type ItemCategory } from '@/lib/itemRoutes';
import { formatPrice } from '@/lib/menus';
import type { MenuDrink, MenuSectionDetail } from '@/types/menus';

const CATEGORY: Record<MenuDrink['kind'], ItemCategory> = { cocktail: 'Cocktail', beer: 'Beer', wine: 'Wine' };

function DrinkLine({ drink, centered }: { drink: MenuDrink; centered: boolean }) {
  const price = formatPrice(drink.price);
  return (
    <View style={centered ? styles.centered : styles.flex}>
      <View style={[styles.nameRow, centered && styles.nameRowCentered]}>
        <Headline style={centered ? undefined : styles.flex}>{drink.name}</Headline>
        {price ? <Spec>{price}</Spec> : null}
      </View>
      {drink.line ? (
        <Caption tone="muted" align={centered ? 'center' : undefined}>
          {drink.line}
        </Caption>
      ) : null}
    </View>
  );
}

/**
 * A menu's sections, set like the printed menu. `page`: rows that open each
 * drink. `card`: centred and still, for the share card and print.
 */
export function MenuSections({ sections, variant }: { sections: MenuSectionDetail[]; variant: 'page' | 'card' }) {
  const ds = useDs();
  const router = useRouter();
  const card = variant === 'card';
  return (
    <View style={styles.sections}>
      {sections
        .filter((s) => s.drinks.length > 0)
        .map((s) => (
          <View key={s.id} style={styles.section}>
            <View style={[styles.sectionHead, card && styles.sectionHeadCentered]}>
              <Caption tone="muted" role="heading" style={styles.sectionTitle}>
                {s.name.toUpperCase()}
              </Caption>
              {card ? null : <Caption tone="muted">{s.drinks.length}</Caption>}
            </View>
            {s.drinks.map((d) =>
              card ? (
                <View key={d.id} style={styles.cardRow}>
                  <DrinkLine drink={d} centered />
                </View>
              ) : (
                <PressableScale
                  key={d.id}
                  role="link"
                  accessibilityLabel={[d.name, formatPrice(d.price), d.line].filter(Boolean).join(', ')}
                  onPress={() => router.push(itemHref(CATEGORY[d.kind], d.id) as never)}
                  style={[styles.row, { borderBottomColor: ds.c.line }]}
                >
                  <DrinkLine drink={d} centered={false} />
                </PressableScale>
              )
            )}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.xl },
  section: { gap: space.xs },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionHeadCentered: { justifyContent: 'center' },
  sectionTitle: { letterSpacing: 1.5 },
  row: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  cardRow: { paddingVertical: space.xs },
  flex: { flex: 1, gap: 2 },
  centered: { alignItems: 'center', gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  nameRowCentered: { justifyContent: 'center', flexWrap: 'wrap' },
});
