import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, Surface, useDs } from '@/components/ds';
import { SectionHeading } from '@/components/screens/settings/SettingsParts';
import { Monogram } from '@/components/screens/onboarding/SetupParts';
import { space } from '@/constants/tokens';
import { useSaveSupplier, useSupplierSuggestionData, type SupplierPage, type VenueSupplier } from '@/hooks/useVenueSuppliers';
import { regionHeading, suggestSuppliers, SUPPLIES } from '@/lib/suppliers';

const SHOWN = 5;

/**
 * "Carry your bottles in Victoria": supplier pages that carry the makers of
 * the venue's bottles where it is, most bottles first. Add puts one on the
 * venue's list, linked to its page (or links the venue's own row of that name).
 */
export function SupplierSuggestions({ barId, suppliers }: { barId: string; suppliers: readonly VenueSupplier[] }) {
  const ds = useDs();
  const router = useRouter();
  const { data } = useSupplierSuggestionData(barId);
  const save = useSaveSupplier(barId);
  if (!data) return null;
  const have = new Set(suppliers.flatMap((s) => (s.page ? [s.page.id] : [])));
  const list = suggestSuppliers(data.bottles, data.lines, data.regions, have).slice(0, SHOWN);
  if (!list.length) return null;
  const where = regionHeading(data.regions[0]);

  const add = (page: SupplierPage) => {
    const same = suppliers.find((s) => s.name.trim().toLowerCase() === page.display_name.trim().toLowerCase());
    save.mutate(
      same
        ? { id: same.id, name: same.name, supplies: same.supplies, website: same.website, order_notes: same.order_notes, order_by: same.order_by, delivers: same.delivers, profile_id: page.id }
        : { name: page.display_name, supplies: SUPPLIES.filter((k) => page.supplies.includes(k)), profile_id: page.id }
    );
  };

  return (
    <View style={styles.group}>
      <SectionHeading>{`Carry your bottles ${where.charAt(0).toLowerCase()}${where.slice(1)}`}</SectionHeading>
      <Surface style={styles.list}>
        <View role="list">
          {list.map(({ page, bottles }, i) => (
            <View key={page.id} role="listitem" style={[styles.row, i ? { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
              <PressableScale role="link" accessibilityLabel={`${page.display_name}, carries ${bottles} of your bottles`} onPress={() => router.push(`/p/${page.handle}` as Href)} style={[styles.row, styles.flex]}>
                <Monogram name={page.display_name} size={40} />
                <View style={styles.flex}>
                  <Body numberOfLines={1}>{page.display_name}</Body>
                  <Caption tone="muted">{`Carries ${bottles} of your ${bottles === 1 ? 'bottle' : 'bottles'}`}</Caption>
                </View>
              </PressableScale>
              <Button label="Add" variant="secondary" size="sm" accessibilityLabel={`Add ${page.display_name}`} disabled={save.isPending} onPress={() => add(page)} />
            </View>
          ))}
        </View>
      </Surface>
      {save.error ? <Caption tone="accent">Couldn’t add that. Check your connection and try again.</Caption> : null}
      <Caption tone="muted">From supplier pages: who carries the makers of your bottles where you are.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  list: { paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
