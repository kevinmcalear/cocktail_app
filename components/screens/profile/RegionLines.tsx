import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { SupplierLine } from '@/hooks/useSuppliers';
import { byRegion } from '@/lib/suppliers';

import { BarMark } from '../home/BarMark';

/**
 * Supplier lines grouped by where they apply ("In Victoria", "Across
 * Australia"), each a page you can open: the makers a supplier carries, or
 * the suppliers that carry a maker (ppl-supplier, ppl-maker).
 */
export function RegionLines({ lines, detail }: { lines: SupplierLine[]; detail: (what: string[]) => string }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <View style={styles.groups}>
      {byRegion(lines).map((g) => (
        <View key={g.region}>
          <Caption tone="muted" role="heading" aria-level={3} style={styles.caps}>
            {g.heading}
          </Caption>
          <View role="list">
            {g.lines.map((l) => {
              const line = detail(l.page.what);
              return (
                <PressableScale
                  key={l.id}
                  role="link"
                  accessibilityLabel={`${l.page.display_name}, ${line}`}
                  onPress={() => router.push(`/p/${l.page.handle}` as Href)}
                  style={[styles.row, { borderBottomColor: ds.c.line }]}
                >
                  <BarMark name={l.page.display_name} logoUrl={l.page.avatar_url} profileId={l.page.id} size={40} neutral />
                  <View style={styles.flex}>
                    <Body numberOfLines={1}>{l.page.display_name}</Body>
                    <Caption tone="muted" numberOfLines={1}>
                      {line}
                    </Caption>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: space.md },
  caps: { textTransform: 'uppercase', letterSpacing: 0.4, marginTop: space.sm },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
