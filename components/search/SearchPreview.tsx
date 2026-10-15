import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DrinkImage, DsText, useDs } from '@/components/ds';
import { displayFaces, fontFamilies, radius, space } from '@/constants/tokens';
import { useCocktail } from '@/hooks/useCocktails';
import { itemHref } from '@/lib/itemRoutes';
import { amountText } from '@/lib/units';

import type { SearchPreviewItem } from './searchNav';

const LINES = 6;

type Line = { id: string; amount?: number | string | null; unit?: string | null; ingredient?: { name?: string | null } | null };

/**
 * The ⌘K palette's right side: the highlighted drink's drawing, name, why it's
 * here and its spec, so a spec reads without leaving the page you're on
 * (nav-search-desk-preview). Open is Return, as on the row.
 */
export function SearchPreview({ item, onOpen }: { item: SearchPreviewItem | null; onOpen: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const { data } = useCocktail(item?.itemId);
  if (!item) {
    return (
      <View style={styles.empty}>
        <Caption tone="muted">Move to a drink with ↑↓ to read its spec here.</Caption>
      </View>
    );
  }
  const lines = ((data?.id === item.itemId ? data.recipes : null) ?? []) as Line[];
  const shown = lines.filter((l) => l.ingredient?.name).slice(0, LINES);
  return (
    <View style={styles.pane}>
      <View style={[styles.art, { backgroundColor: ds.c.paper }]}>
        <DrinkImage source={item.imageUrl} glass={item.glass} itemId={item.itemId} accessibilityLabel={item.name} radius={0} aspectRatio={0} style={styles.fill} />
      </View>
      <View style={styles.title}>
        <DsText variant="title" numberOfLines={2} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {item.name}
        </DsText>
        {item.caption ? <Caption tone="muted">{item.caption}</Caption> : null}
      </View>
      {shown.length ? (
        <View role="list" accessibilityLabel="Spec">
          {shown.map((l, i) => (
            <View key={l.id ?? i} style={[styles.line, i < shown.length - 1 && { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <DsText variant="label" color={ds.accentText} style={styles.amount} numberOfLines={1}>
                {l.amount != null && l.amount !== '' ? amountText(String(Number(l.amount)), l.unit) : ''}
              </DsText>
              <DsText variant="label" style={styles.flex} numberOfLines={1}>
                {l.ingredient?.name}
              </DsText>
            </View>
          ))}
          {lines.length > LINES ? <Caption tone="muted">{`and ${lines.length - LINES} more`}</Caption> : null}
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button label="Open  ↵" size="sm" onPress={onOpen} />
        <Button label="Batch" size="sm" variant="secondary" onPress={() => router.push(`${itemHref('Cocktail', item.itemId)}/batch` as never)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1, gap: space.md },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.lg },
  art: { height: 190, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  title: { gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs + 2 },
  amount: { width: 72, fontFamily: fontFamilies.monoMedium },
  flex: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: 'auto' },
});
