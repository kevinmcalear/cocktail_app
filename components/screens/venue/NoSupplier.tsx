import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, PressableScale, Sheet, SheetScrollView, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useGiveToSupplier, useVenueIngredients } from '@/hooks/useVenueIngredients';
import type { VenueSupplier } from '@/hooks/useVenueSuppliers';
import { withoutSupplier, type VenueIngredient } from '@/lib/suppliers';

const FIRST = 8;

/** "23 ingredients with no supplier": opens the sheet that gives them one, a few at a time. Nothing when every one has a supplier. */
export function NoSupplierRow({ barId, suppliers }: { barId: string; suppliers: readonly VenueSupplier[] }) {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  const missing = withoutSupplier(useVenueIngredients(barId).data ?? []);
  if (!missing.length || !suppliers.length) return null;
  const label = `${missing.length} ${missing.length === 1 ? 'ingredient' : 'ingredients'} with no supplier`;
  return (
    <>
      <PressableScale role="button" accessibilityLabel={`${label}. Give them one, a few at a time`} onPress={() => setOpen(true)} style={[styles.row, { borderColor: ds.c.lineStrong }]}>
        <View style={styles.flex}>
          <Body>{label}</Body>
          <Caption tone="muted">Give them one, a few at a time</Caption>
        </View>
        <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
      </PressableScale>
      <Sheet visible={open} onClose={() => setOpen(false)} accessibilityLabel="No supplier yet">
        {open ? <GiveForm barId={barId} suppliers={suppliers} missing={missing} onDone={() => setOpen(false)} /> : null}
      </Sheet>
    </>
  );
}

function GiveForm({ barId, suppliers, missing, onDone }: { barId: string; suppliers: readonly VenueSupplier[]; missing: VenueIngredient[]; onDone: () => void }) {
  const give = useGiveToSupplier(barId);
  const [who, setWho] = useState(suppliers[0].id);
  const [ticked, setTicked] = useState<string[]>([]);
  const [all, setAll] = useState(false);
  const shown = all ? missing : missing.slice(0, FIRST);
  const name = suppliers.find((s) => s.id === who)?.name ?? '';
  const toggle = (id: string) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  const onGive = () =>
    give.mutate(
      { supplierId: who, itemIds: ticked },
      // The list refetches without them; the sheet closes once none are left.
      { onSuccess: () => (ticked.length >= missing.length ? onDone() : setTicked([])) }
    );

  return (
    <SheetScrollView contentContainerStyle={styles.sheet}>
      <View style={styles.group}>
        <Title>No supplier yet</Title>
        <Caption tone="muted">{`${missing.length} ${missing.length === 1 ? 'ingredient your drinks and house-made ingredients use has' : 'ingredients your drinks and house-made ingredients use have'} no supplier. Pick who brings them, tick a few, and give them over.`}</Caption>
      </View>
      <View style={styles.group}>
        <Caption tone="muted">Give to</Caption>
        <View role="radiogroup" accessibilityLabel="Give to" style={styles.chips}>
          {suppliers.map((s) => (
            <Chip key={s.id} label={s.name} selected={who === s.id} onPress={() => setWho(s.id)} />
          ))}
        </View>
      </View>
      <View role="list">
        {shown.map((i, n) => (
          <Tick key={i.id} name={i.name} on={ticked.includes(i.id)} first={n === 0} onPress={() => toggle(i.id)} />
        ))}
      </View>
      {!all && missing.length > FIRST ? <Button label={`Show ${missing.length - FIRST} more`} variant="ghost" size="sm" onPress={() => setAll(true)} style={styles.start} /> : null}
      {give.error ? <Caption tone="accent">Couldn’t save that. Check your connection and try again.</Caption> : null}
      <Button
        label={give.isPending ? 'Saving…' : ticked.length ? `Give ${ticked.length} to ${name}` : 'Tick what they bring'}
        disabled={!ticked.length || give.isPending}
        onPress={onGive}
      />
    </SheetScrollView>
  );
}

function Tick({ name, on, first, onPress }: { name: string; on: boolean; first: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="checkbox" aria-checked={on} accessibilityLabel={name} onPress={onPress} style={[styles.tick, first ? null : { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.box, { borderColor: on ? ds.c.ink : ds.c.lineStrong, backgroundColor: on ? ds.c.ink : 'transparent' }]}>
        {on ? <IconSymbol name="checkmark" size={14} color={ds.c.ground} /> : null}
      </View>
      <Body style={styles.flex}>{name}</Body>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, padding: space.md, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.card, borderCurve: 'continuous' },
  flex: { flex: 1, minWidth: 0 },
  sheet: { gap: space.lg, padding: space.lg },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tick: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  box: { width: 26, height: 26, borderRadius: radius.control, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  start: { alignSelf: 'flex-start' },
});
