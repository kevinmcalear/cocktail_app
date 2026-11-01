import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';
import { useBackBarIds } from '@/hooks/useBackBar';
import type { PrepUsedIn } from '@/hooks/usePrepCard';
import { useStockOnHand } from '@/hooks/useStockCounts';
import { isGarnishUnit } from '@/lib/batch';
import { onHandWords, usedInWords } from '@/lib/pour';
import { onHandByItem } from '@/lib/stock';

import { RowGroup, type GroupRow } from '../drink/RowGroup';

const NONE: readonly { id: string }[] = [];
const FIRST = 4;

interface BottleAtBarProps {
  item: { id: string; name: string; ingredient_role?: string | null };
  /** The bottles that are a kind of it (Islay scotch: the bar's Laphroaig, Ardbeg...). */
  bottles: readonly { id: string; name: string }[];
  used: PrepUsedIn | undefined;
  /** The bar you're working at. */
  bar: { id: string; name: string };
}

/**
 * A bottle's page for the team at the bar you're at (board Item-page, bottle
 * staff): "At <bar>", the bar's own bottles of it with what's on hand from
 * the last count, and Used in, the bar's drinks that pour it with how
 * ("Float, 7.5 ml"). Each row opens what it names; the page's own bottle
 * opens the count.
 */
export function BottleAtBar({ item, bottles, used, bar }: BottleAtBarProps) {
  const router = useRouter();
  const [all, setAll] = useState(false);
  const { data: counts = [] } = useStockOnHand(bar.id);
  // On the back bar: its stock list, its spots, and what its specs already pour.
  const backBar = useBackBarIds(bar.id, NONE);
  const onHand = onHandByItem(counts);
  const own = item.ingredient_role === 'product' ? [{ id: item.id, name: item.name }] : [];
  const kept = [...own, ...bottles].filter((b) => backBar.has(b.id) || b.id in onHand);
  const atBar: GroupRow[] = kept.map((b) => ({
    key: b.id,
    label: b.name,
    value: onHandWords(onHand[b.id]),
    onPress: () => router.push((b.id === item.id ? '/prep' : `/ingredient/${b.id}`) as never),
  }));

  const pours = Object.entries(used?.pours ?? {})
    .filter(([, p]) => p.barId === bar.id)
    .sort(([, a], [, b]) => (a.name ?? '').localeCompare(b.name ?? ''));
  const shown = all || pours.length <= FIRST + 1 ? pours : pours.slice(0, FIRST);
  const usedIn: GroupRow[] = [
    ...shown.map(([id, p]) => ({ key: id, label: p.name ?? '', value: usedInWords(p, isGarnishUnit(p.unit)) || null, onPress: () => router.push(`/cocktail/${id}` as never) })),
    ...(shown.length < pours.length ? [{ key: 'all', label: `See all ${pours.length}`, onPress: () => setAll(true) }] : []),
  ];

  if (!atBar.length && !usedIn.length) return null;
  return (
    <View style={styles.section}>
      <RowGroup title={`At ${bar.name}`} rows={atBar} />
      <RowGroup title="Used in" rows={usedIn} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xl },
});
