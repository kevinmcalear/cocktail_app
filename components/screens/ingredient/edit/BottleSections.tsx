import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Chip, Field, Headline, TextLink } from '@/components/ds';
import { Choice } from '@/components/screens/batch/BatchParts';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import type { IngredientForm } from '@/hooks/useIngredientEditor';
import { useMode } from '@/hooks/useMode';
import { useItemPurchase, usePricingSettings, useSaveItemPurchase, type ItemPurchase } from '@/hooks/usePricing';
import { formatMoney, moneyFieldValue, parseMoney } from '@/lib/money';
import { capitalize, handleCapitalizedChange } from '@/lib/stringUtils';

import type { PendingEdits } from '../../drink/edit/VenueSections';
import { KindOf } from './EditSections';

/**
 * A bottle's What it is (ingredient-edit-proposal): what it's a kind of, who
 * makes it and its ABV. Saved with Done.
 */
export function WhatItIs({ form, set, onKind }: { form: IngredientForm; set: (patch: Partial<IngredientForm>) => void; onKind: () => void }) {
  return (
    <View style={styles.section}>
      <Headline role="heading">What it is</Headline>
      <KindOf name={form.generic?.name ?? null} onPick={onKind} onClear={() => set({ generic: null })} />
      <View style={styles.row}>
        <View style={styles.grow}>
          <Field label="Maker" value={form.brandMaker} onChangeText={(v) => handleCapitalizedChange(v, form.brandMaker, (brandMaker) => set({ brandMaker }))} onBlur={() => set({ brandMaker: capitalize(form.brandMaker) })} placeholder="e.g. Campari" maxLength={80} />
        </View>
        <View style={styles.abv}>
          <Field label="ABV %" value={form.abv} onChangeText={(abv) => set({ abv: abv.replace(/[^0-9.,]/g, '') })} keyboardType="decimal-pad" placeholder="40" maxLength={5} />
        </View>
      </View>
    </View>
  );
}

/** Spirit tags: the ones it has as chips (tap to take one off), and + Add for the rest. */
export function SpiritTags({ tags, selected, onToggle, onAdd }: { tags: { id: string; name: string }[]; selected: string[]; onToggle: (id: string) => void; onAdd: () => void }) {
  const picked = tags.filter((t) => selected.includes(t.id));
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Headline role="heading">Spirit tags</Headline>
        <TextLink label="+ Add" onPress={onAdd} accessibilityHint="Choose spirit tags" />
      </View>
      {picked.length ? (
        <View style={styles.chips}>
          {picked.map((t) => (
            <Chip key={t.id} label={t.name} selected multi onPress={() => onToggle(t.id)} accessibilityLabel={`${t.name}, remove`} />
          ))}
        </View>
      ) : (
        <Caption tone="muted">No tags yet</Caption>
      )}
    </View>
  );
}

const SIZE_UNITS = [
  { value: 'ml', label: 'ml' },
  { value: 'L', label: 'L' },
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'each', label: 'each' },
] as const;
type SizeUnit = (typeof SIZE_UNITS)[number]['value'];

/**
 * A bottle's Cost at the venue you're at: what a bottle costs and its size,
 * and what a 30 ml pour comes to, which every drink with it uses. The pack
 * and its size open with prep or costs, the price with costs. Saved with
 * Done (`onPending`), with who sells it (kept from the old Price editor).
 */
export function BottlePrice({ itemId, name, onPending }: { itemId: string; name: string; onPending: (p: PendingEdits) => void }) {
  const { active } = useActiveVenue();
  const barId = useMode().mode === 'home' ? null : (active?.id ?? null);
  const { data: caps } = useCapabilities(barId);
  const canCost = !!caps?.includes('costs');
  const canPack = canCost || !!caps?.includes('prep');
  const { data: settings } = usePricingSettings(canPack ? barId : null);
  const { data } = useItemPurchase(canPack ? itemId : null, barId);
  if (!barId || !canPack || !data || !settings) return null;
  return <Price itemId={itemId} barId={barId} name={name} data={data} currency={settings.currency} canCost={canCost} onPending={onPending} />;
}

function Price({ itemId, barId, name, data, currency, canCost, onPending }: { itemId: string; barId: string; name: string; data: ItemPurchase; currency: string | null; canCost: boolean; onPending: (p: PendingEdits) => void }) {
  const save = useSaveItemPurchase(itemId, barId);
  const savedSize = data.pack?.pack_size_amount ? String(data.pack.pack_size_amount) : '';
  const savedUnit = (SIZE_UNITS.find((u) => u.value === data.pack?.pack_size_unit)?.value ?? 'ml') as SizeUnit;
  const savedPrice = currency ? moneyFieldValue(data.cost?.pack_cost_minor, currency) : '';
  const [size, setSize] = useState(savedSize);
  const [unit, setUnit] = useState<SizeUnit>(savedUnit);
  const [price, setPrice] = useState(savedPrice);
  const savedSupplier = data.pack?.supplier_id ?? null;
  const [supplierId, setSupplierId] = useState(savedSupplier);
  const [newSupplier, setNewSupplier] = useState('');
  const sizeN = size.trim() ? Number(size.replace(',', '.')) : null;
  const priceMinor = currency && price.trim() ? parseMoney(price, currency) : null;
  const problem = sizeN !== null && !(sizeN > 0) ? 'The bottle size is more than 0.' : price.trim() && priceMinor === null ? 'Enter the price as a number.' : null;
  const dirty = size !== savedSize || unit !== savedUnit || price !== savedPrice || supplierId !== savedSupplier || !!newSupplier.trim();

  useEffect(() => {
    onPending({
      dirty,
      save: async () => {
        if (problem) return false;
        try {
          await save.mutateAsync({ packAmount: sizeN, packUnit: unit, supplier: newSupplier.trim() ? { name: newSupplier } : supplierId ? { id: supplierId } : null, packCostMinor: canCost && currency ? priceMinor : null, clearCost: canCost && !!currency && !price.trim() });
          return true;
        } catch {
          return false;
        }
      },
    });
  });

  // A 30 ml pour, when the bottle is measured in ml or L.
  const ml = sizeN && unit === 'ml' ? sizeN : sizeN && unit === 'L' ? sizeN * 1000 : null;
  const pour = priceMinor != null && ml ? formatMoney(Math.round((priceMinor / ml) * 30), currency) : null;
  return (
    <View style={styles.section}>
      <Headline role="heading">Cost</Headline>
      <View style={styles.row}>
        {canCost && currency ? (
          <View style={styles.grow}>
            <Field label={`Price a bottle (${currency})`} value={price} onChangeText={setPrice} placeholder="32.00" keyboardType="decimal-pad" />
          </View>
        ) : null}
        <View style={styles.size}>
          <Field label="Size" value={size} onChangeText={setSize} placeholder="700" keyboardType="decimal-pad" />
        </View>
      </View>
      <Choice label="Size unit" options={SIZE_UNITS} value={unit} onChange={setUnit} />
      {canCost && !currency ? <Caption tone="accent">Set the venue’s currency in Pricing before adding a price.</Caption> : null}
      {data.suppliers.length ? (
        <View role="radiogroup" accessibilityLabel="Who sells it" style={styles.chips}>
          {data.suppliers.map((sup) => (
            <Chip key={sup.id} label={sup.name} selected={supplierId === sup.id} onPress={() => setSupplierId(supplierId === sup.id ? null : sup.id)} />
          ))}
        </View>
      ) : null}
      <Field label={data.suppliers.length ? 'Or a new supplier' : 'Who sells it'} value={newSupplier} onChangeText={setNewSupplier} placeholder="Northside Liquor" />
      {pour ? <Caption tone="muted">{`${pour} a 30 ml pour · used for the cost of every drink with ${name}`}</Caption> : null}
      {problem ? <Caption tone="accent">{problem}</Caption> : null}
      {save.error ? <Caption tone="accent">{"Couldn't save the price. Check your connection and try again."}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  grow: { flex: 1, minWidth: 0 },
  abv: { width: 96 },
  size: { width: 112 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
