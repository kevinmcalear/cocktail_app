import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, Surface, Tag } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { Choice } from '@/components/screens/batch/BatchParts';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useMode } from '@/hooks/useMode';
import { useItemPurchase, usePricingSettings, useSaveItemPurchase } from '@/hooks/usePricing';
import { formatMoney, moneyFieldValue, parseMoney } from '@/lib/money';
import { roleLabel } from '@/lib/roles';

const PACK_UNITS = [
  { value: 'ml', label: 'ml' },
  { value: 'L', label: 'L' },
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'each', label: 'each' },
] as const;

/**
 * How the venue buys an ingredient: the pack, who sells it, and what a pack
 * costs. Pack and supplier open with prep or costs; the price only with
 * costs, which is also what the database enforces. The first pass is quick:
 * the Library's "Needs a price" filter lists what's left.
 */
export function PriceSection({ itemId }: { itemId: string }) {
  const { active } = useActiveVenue();
  const barId = useMode().mode === 'home' ? null : (active?.id ?? null);
  if (!barId) return null;
  return (
    <VenueBrandProvider>
      <Surface style={styles.card}>
        <Caption tone="muted" role="heading" style={styles.eyebrow}>
          PRICE AT {(active?.name ?? 'THE VENUE').toUpperCase()}
        </Caption>
        <PriceBody itemId={itemId} barId={barId} />
      </Surface>
    </VenueBrandProvider>
  );
}

function PriceBody({ itemId, barId }: { itemId: string; barId: string }) {
  const router = useRouter();
  const { data: capabilities } = useCapabilities(barId);
  const { data: costsOpenAt } = useCapabilityOpensAt(barId, 'costs');
  const canCost = !!capabilities?.includes('costs');
  const canPack = canCost || !!capabilities?.includes('prep');
  const { data: settings } = usePricingSettings(barId);
  const { data, isPending } = useItemPurchase(canPack ? itemId : null, barId);
  const save = useSaveItemPurchase(itemId, barId);
  const [editing, setEditing] = useState(false);
  const currency = settings?.currency ?? null;

  if (!canPack) return <Caption tone="muted">Pack and price open at {costsOpenAt ? roleLabel(costsOpenAt) : 'Admin'}.</Caption>;
  if (isPending || !data) return <Caption tone="muted">Loading.</Caption>;
  if (editing) return <Editor itemId={itemId} barId={barId} data={data} currency={currency} canCost={canCost} onDone={() => setEditing(false)} />;

  const pack = data.pack?.pack_size_amount ? `${data.pack.pack_size_amount} ${data.pack.pack_size_unit}` : null;
  const supplier = data.suppliers.find((s) => s.id === data.pack?.supplier_id)?.name ?? null;
  const price = formatMoney(data.cost?.pack_cost_minor, currency);
  const line = [pack ? `Pack of ${pack}` : null, supplier, price ? `${price} a pack` : null].filter(Boolean).join(' · ');
  return (
    <View style={styles.list}>
      {canCost && !price ? <Tag label="Needs a price" tone="warning" /> : null}
      <Caption tone="muted">{line || (canCost ? 'No pack, supplier or price yet.' : 'No pack or supplier yet.')}</Caption>
      {canCost && !currency ? (
        <Caption tone="accent" role="link" onPress={() => router.push(`/settings/bar/${barId}/pricing` as Href)}>
          Set the venue’s currency in Pricing before adding prices.
        </Caption>
      ) : null}
      <Button label={line ? 'Edit' : canCost ? 'Add pack and price' : 'Add pack'} variant="secondary" onPress={() => setEditing(true)} style={styles.button} />
      {save.isSuccess ? <Caption tone="muted">Saved.</Caption> : null}
    </View>
  );
}

function Editor({ itemId, barId, data, currency, canCost, onDone }: { itemId: string; barId: string; data: NonNullable<ReturnType<typeof useItemPurchase>['data']>; currency: string | null; canCost: boolean; onDone: () => void }) {
  const save = useSaveItemPurchase(itemId, barId);
  const [amount, setAmount] = useState(data.pack?.pack_size_amount ? String(data.pack.pack_size_amount) : '');
  const [unit, setUnit] = useState<(typeof PACK_UNITS)[number]['value']>((PACK_UNITS.find((u) => u.value === data.pack?.pack_size_unit)?.value ?? 'ml') as never);
  const [supplierId, setSupplierId] = useState<string | null>(data.pack?.supplier_id ?? null);
  const [newSupplier, setNewSupplier] = useState('');
  const [price, setPrice] = useState(currency ? moneyFieldValue(data.cost?.pack_cost_minor, currency) : '');
  const amountN = amount.trim() ? Number(amount) : null;
  const priceMinor = currency && price.trim() ? parseMoney(price, currency) : null;
  const problem = amountN !== null && !(amountN > 0) ? 'The pack size is more than 0.' : price.trim() && priceMinor === null ? 'Enter the price as a number.' : null;

  return (
    <View style={styles.list}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field label="Pack size" value={amount} onChangeText={setAmount} placeholder="700" keyboardType="decimal-pad" />
        </View>
        <Choice label="Pack unit" options={PACK_UNITS} value={unit} onChange={setUnit} />
      </View>
      <Caption tone="muted">Supplier</Caption>
      <View role="radiogroup" accessibilityLabel="Supplier" style={styles.chips}>
        {data.suppliers.map((s) => (
          <Chip key={s.id} label={s.name} selected={supplierId === s.id} onPress={() => setSupplierId(supplierId === s.id ? null : s.id)} />
        ))}
      </View>
      <Field label="Or a new supplier" value={newSupplier} onChangeText={setNewSupplier} placeholder="Northside Liquor" />
      {canCost ? (
        currency ? (
          <Field label={`Price of one pack (${currency})`} value={price} onChangeText={setPrice} placeholder="22.00" keyboardType="decimal-pad" hint="Leave blank to clear the price." />
        ) : (
          <Caption tone="accent">Set the venue’s currency in Pricing before adding a price.</Caption>
        )
      ) : null}
      {problem ? <Caption tone="accent">{problem}</Caption> : null}
      {save.error ? <Caption tone="accent">{"Couldn't save. Check your connection and try again."}</Caption> : null}
      <View style={styles.actions}>
        <Button
          label={save.isPending ? 'Saving…' : 'Save'}
          disabled={save.isPending || !!problem}
          onPress={() =>
            save
              .mutateAsync({
                packAmount: amountN,
                packUnit: unit,
                supplier: newSupplier.trim() ? { name: newSupplier } : supplierId ? { id: supplierId } : null,
                packCostMinor: canCost && currency ? priceMinor : null,
                clearCost: canCost && !!currency && !price.trim(),
              })
              .then(onDone, () => {})
          }
        />
        <Button label="Cancel" variant="ghost" onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  eyebrow: { letterSpacing: 1 },
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, flexWrap: 'wrap' },
  flex: { flexGrow: 1, minWidth: 120 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  button: { alignSelf: 'flex-start' },
});
