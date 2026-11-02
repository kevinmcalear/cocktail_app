import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AllergenSection } from '@/components/allergens/AllergenSection';
import { space } from '@/constants/tokens';
import { useBatchLogs } from '@/hooks/useBatches';
import type { PrepUsedIn } from '@/hooks/usePrepCard';
import { useStockOnHand } from '@/hooks/useStockCounts';
import { formatQuantity, toQuantity } from '@/lib/quantity';
import { onHandLine, withBatches } from '@/lib/stock';

import { AllergyLine } from '../drink/AllergyLine';
import { RowGroup, type GroupRow } from '../drink/RowGroup';
import { MenuSheet } from '../menus/MenuSheet';

interface BehindTheBarProps {
  item: { id: string; name: string; bar_id: string | null };
  /** The recipe's names, for vegan on the allergen line. */
  names: readonly (string | null)[];
  drinks: { id: string; name: string }[];
  used: PrepUsedIn | undefined;
  /** The house-made this page was opened from, listed first under Used in. */
  from: string | null;
  canEditItem: boolean;
  /** Has recipe lines, so its allergens roll up from them. */
  houseMade: boolean;
}

const FIRST = 3;

/**
 * A house-made's page for the bar's team (boards Item-page, Desk-page,
 * And-page, house-made creator and staff): the allergen line with vegan on
 * it, which opens the full list, then Behind the bar: what's on hand and when
 * it was last made (opens the prep list), and what it goes into, a drink by
 * name or a house-made with how much a batch takes.
 */
export function BehindTheBar({ item, names, drinks, used, from, canEditItem, houseMade }: BehindTheBarProps) {
  const router = useRouter();
  const [allergens, setAllergens] = useState(false);
  const [all, setAll] = useState(false);
  const { data: batches = [] } = useBatchLogs(item.bar_id);
  const { data: counts = [] } = useStockOnHand(item.bar_id);
  const last = batches.find((b) => b.itemId === item.id);
  const onHand = onHandLine(
    last,
    withBatches(
      counts.filter((c) => c.item_id === item.id),
      batches.filter((b) => b.itemId === item.id),
    )[item.id],
  );

  const preps = [...(used?.preps ?? [])].sort((a, b) => Number(b.id === from) - Number(a.id === from));
  const uses = [
    ...preps.map((p) => {
      const q = toQuantity(p.amount, p.unit);
      return { key: p.id, value: q ? `${p.name}, ${formatQuantity(q)}` : p.name, href: `/ingredient/${p.id}` };
    }),
    ...drinks.map((d) => ({ key: d.id, value: d.name, href: `/cocktail/${d.id}` })),
  ];
  const shown = all || uses.length <= FIRST + 1 ? uses : uses.slice(0, FIRST);
  const rows: GroupRow[] = [
    ...(item.bar_id ? [{ key: 'on-hand', label: 'On hand', value: onHand ?? 'Not counted yet', onPress: () => router.push('/prep' as never) }] : []),
    ...shown.map((u, i) => ({ key: u.key, label: i ? '' : 'Used in', value: u.value, onPress: () => router.push(u.href as never) })),
    ...(shown.length < uses.length ? [{ key: 'all', label: '', value: `See all ${uses.length}`, onPress: () => setAll(true) }] : []),
  ];

  return (
    <View style={styles.section}>
      <AllergyLine itemId={item.id} guest={false} ingredients={names} onPress={() => setAllergens(true)} />
      <RowGroup title="Behind the bar" rows={rows} />
      {allergens ? (
        <MenuSheet visible onClose={() => setAllergens(false)} title="Allergens" subtitle={item.name}>
          <AllergenSection itemId={item.id} houseMade={houseMade} canEditItem={canEditItem} />
        </MenuSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xl },
});
