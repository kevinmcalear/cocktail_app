import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, Headline, Sheet, SheetScrollView, Title, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useRemoveSupplier, useSaveSupplier, useSupplierItems, type VenueSupplier } from '@/hooks/useVenueSuppliers';
import { confirmAsync } from '@/lib/dialogs';
import { SUPPLIES, SUPPLY_LABEL } from '@/lib/venueKit';

const FIRST = 4;

/** A supplier, opened (or a new one): what they bring, order by, delivers, order notes, and what the venue buys from them. */
export function SupplierSheet({ barId, supplier, isNew, onClose }: { barId: string; supplier: VenueSupplier | null; isNew: boolean; onClose: () => void }) {
  const visible = isNew || !!supplier;
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel={supplier?.name ?? 'New supplier'} keyboard>
      {visible ? <SupplierForm key={supplier?.id ?? 'new'} barId={barId} supplier={supplier} onDone={onClose} /> : null}
    </Sheet>
  );
}

function SupplierForm({ barId, supplier, onDone }: { barId: string; supplier: VenueSupplier | null; onDone: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const save = useSaveSupplier(barId);
  const remove = useRemoveSupplier(barId);
  const items = useSupplierItems(barId, supplier?.id ?? null).data ?? [];
  const [all, setAll] = useState(false);
  const [name, setName] = useState(supplier?.name ?? '');
  const [supplies, setSupplies] = useState<string[]>(supplier?.supplies ?? []);
  const [orderBy, setOrderBy] = useState(supplier?.order_by ?? '');
  const [delivers, setDelivers] = useState(supplier?.delivers ?? '');
  const [notes, setNotes] = useState(supplier?.order_notes ?? '');
  const busy = save.isPending || remove.isPending;
  const page = supplier?.page;

  const toggle = (k: string) => setSupplies((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const onSave = () =>
    save.mutate(
      { id: supplier?.id, name, supplies: SUPPLIES.filter((k) => supplies.includes(k)), order_by: orderBy, delivers, order_notes: notes, website: supplier?.website },
      { onSuccess: onDone }
    );
  const onRemove = async () => {
    if (!supplier) return;
    const ok = await confirmAsync({ title: `Remove ${supplier.name}?`, message: 'Its ingredients and kit stay, with no supplier.', confirmText: 'Remove', destructive: true });
    if (ok) remove.mutate(supplier.id, { onSuccess: onDone });
  };

  return (
    <SheetScrollView contentContainerStyle={styles.sheet}>
      <View style={styles.head}>
        <Title>{supplier?.name ?? 'New supplier'}</Title>
        {page ? <Button label="Their page" variant="ghost" size="sm" onPress={() => router.push(`/p/${page.handle ?? page.id}` as Href)} style={styles.start} /> : null}
      </View>
      {supplier ? null : <Field label="Name" value={name} onChangeText={setName} placeholder="Bluestone Trade Co." maxLength={80} autoFocus />}
      <View style={styles.group}>
        <Caption tone="muted">What they bring</Caption>
        <View role="group" accessibilityLabel="What they bring" style={styles.chips}>
          {SUPPLIES.map((k) => (
            <Chip key={k} label={SUPPLY_LABEL[k]} multi selected={supplies.includes(k)} onPress={() => toggle(k)} />
          ))}
        </View>
      </View>
      <View style={styles.pair}>
        <View style={styles.flex}>
          <Field label="Order by" value={orderBy} onChangeText={setOrderBy} placeholder="Tue 2 pm" maxLength={60} />
        </View>
        <View style={styles.flex}>
          <Field label="Delivers" value={delivers} onChangeText={setDelivers} placeholder="Wed and Fri" maxLength={60} />
        </View>
      </View>
      <Field label="Order notes" value={notes} onChangeText={setNotes} placeholder="Account number, portal, where deliveries go" minLines={2} multiline maxLength={1000} />

      {supplier ? (
        <View style={styles.group}>
          <View style={styles.between}>
            <Headline>What you buy from them</Headline>
            <Caption tone="muted" style={styles.mono}>
              {items.length}
            </Caption>
          </View>
          {items.length ? (
            <View role="list" style={[styles.items, { backgroundColor: ds.c.ground }]}>
              {(all ? items : items.slice(0, FIRST)).map((it, i) => (
                <View key={it.item_id} role="listitem" style={[styles.item, i ? { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
                  <Body numberOfLines={1} style={styles.flex}>
                    {it.name}
                  </Body>
                  {it.pack ? <Caption tone="muted">{it.pack}</Caption> : null}
                </View>
              ))}
            </View>
          ) : (
            <Caption tone="muted">Nothing yet. Pick this supplier in an ingredient’s price and it shows here.</Caption>
          )}
          {items.length > FIRST ? <Button label={all ? 'Fewer' : `See all ${items.length}`} variant="ghost" size="sm" onPress={() => setAll(!all)} style={styles.start} /> : null}
        </View>
      ) : null}

      {save.error || remove.error ? <Caption tone="accent">Couldn’t save that. Check your connection and try again.</Caption> : null}
      <View style={styles.actions}>
        <Button label={save.isPending ? 'Saving…' : 'Save'} disabled={busy || !name.trim()} onPress={onSave} />
        {supplier ? <Button label="Remove" variant="ghost" disabled={busy} onPress={() => void onRemove()} /> : null}
      </View>
    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: space.lg, padding: space.lg },
  head: { gap: space.xs },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  between: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  mono: { fontFamily: fontFamilies.mono },
  items: { borderRadius: radius.card, paddingHorizontal: space.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  start: { alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
