import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, Surface, useDs } from '@/components/ds';
import { Monogram } from '@/components/screens/onboarding/SetupParts';
import { fontFamilies, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useVenueSuppliers, type VenueSupplier } from '@/hooks/useVenueSuppliers';
import { supplierLine } from '@/lib/venueKit';

import { SupplierSheet } from './SupplierSheet';
import { SupplierSuggestions } from './SupplierSuggestions';
import { VenueSubPage } from './VenueSubPage';

/** Buying: Suppliers. Who the venue orders from, private to people with Prep or Costs, who change them too. */
export function SuppliersScreen({ barId }: { barId: string }) {
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const caps = useCapabilities(barId).data;
  const allowed = !!caps && (caps.includes('prep') || caps.includes('costs'));
  const { data: suppliers = [], isLoading, error } = useVenueSuppliers(allowed ? barId : null);
  // The supplier open in the sheet: its id, 'new', or null.
  const [open, setOpen] = useState<string | null>(null);
  const opened = open && open !== 'new' ? (suppliers.find((s) => s.id === open) ?? null) : null;

  return (
    <VenueSubPage
      barId={barId}
      title="Suppliers"
      intro={`Who ${venue?.name ?? 'the venue'} orders from. Prep’s order list groups by them. Only people with Prep or Costs see this, and the public never does.`}
    >
      {caps && !allowed ? <Body tone="muted">Suppliers are for people with Prep or Costs at this venue.</Body> : null}
      {allowed && isLoading ? <Caption tone="muted">Loading…</Caption> : null}
      {error ? <Body tone="muted">Couldn’t load the suppliers. Check your connection and try again.</Body> : null}
      {suppliers.length ? (
        <Surface style={styles.list}>
          <View role="list">
            {suppliers.map((s, i) => (
              <SupplierRow key={s.id} supplier={s} first={i === 0} onOpen={() => setOpen(s.id)} />
            ))}
          </View>
        </Surface>
      ) : allowed && !isLoading && !error ? (
        <Body tone="muted">No suppliers yet. Add the companies you order bottles, ice, produce and glassware from.</Body>
      ) : null}
      {allowed ? <Button label="Add a supplier" icon="plus" onPress={() => setOpen('new')} style={styles.add} /> : null}
      {allowed && !isLoading ? <SupplierSuggestions barId={barId} suppliers={suppliers} /> : null}
      <SupplierSheet barId={barId} supplier={opened} isNew={open === 'new'} onClose={() => setOpen(null)} />
    </VenueSubPage>
  );
}

function SupplierRow({ supplier, first, onOpen }: { supplier: VenueSupplier; first: boolean; onOpen: () => void }) {
  const ds = useDs();
  const line = supplierLine(supplier);
  return (
    <View role="listitem" style={first ? null : { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }}>
      <PressableScale
        role="button"
        accessibilityLabel={[supplier.name, line, `${supplier.items} ${supplier.items === 1 ? 'ingredient' : 'ingredients'}`].filter(Boolean).join(', ')}
        onPress={onOpen}
        style={styles.row}
      >
        <Monogram name={supplier.name} size={40} />
        <View style={styles.flex}>
          <Body numberOfLines={1}>{supplier.name}</Body>
          {line ? (
            <Caption tone="muted" numberOfLines={2}>
              {line}
            </Caption>
          ) : null}
        </View>
        {supplier.items ? (
          <Caption tone="muted" style={styles.count}>
            {supplier.items}
          </Caption>
        ) : null}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm },
  flex: { flex: 1, minWidth: 0 },
  count: { fontFamily: fontFamilies.mono },
  add: { alignSelf: 'flex-start' },
});
