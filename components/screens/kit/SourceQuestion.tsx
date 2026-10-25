import { StyleSheet, View } from 'react-native';

import { Caption, Chip, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { VenueSupplier } from '@/hooks/useVenueSuppliers';

import { KitChipGroup, KitChoice } from './KitAddSheet';

/** Where a glass, ice or tool comes from, as the sheet holds it. */
export interface KitSource {
  source: string | null;
  supplier_id: string | null;
  machine?: string;
  note?: string;
}

const CHOICES = {
  bought: { icon: 'tag.fill', title: 'Bought', detail: 'From one of your suppliers.' },
  ours: { icon: 'checkmark', title: 'Already ours', detail: 'We have it; nobody to order from.' },
  machine: { icon: 'snowflake', title: 'From our machine', detail: 'An ice machine, like a Hoshizaki, a Kold-Draft or a clear ice maker.' },
  made: { icon: 'hammer.fill', title: 'We make it', detail: 'Freeze it, cut it, smash it or stamp it here.' },
} as const;

/** At home (Kit and ice, step 13): no suppliers, a shop; the machine and the making in a home bar's words. */
const HOME_DETAIL: Partial<Record<keyof typeof CHOICES, string>> = {
  bought: 'From a shop.',
  machine: 'A clear ice maker like a Klaris, or the freezer’s ice maker.',
  made: 'Freeze it in a cooler, a mould or a tray kit.',
};

/**
 * Question 2 of the Add sheet: where does it come from? Glassware and tools
 * are bought or already ours; ice is bought, from our machine, or made here
 * (Kit and ice, step 5). Bought picks one of the venue's suppliers and says
 * which cut ice to order. A note, when it helps ("bagged").
 */
export function SourceQuestion({ kind, value, onChange, suppliers, home }: { kind: 'ice' | 'glass' | 'tool'; value: KitSource; onChange: (v: KitSource) => void; suppliers: readonly VenueSupplier[]; home?: boolean }) {
  const options = kind === 'ice' ? (['bought', 'machine', 'made'] as const) : (['bought', 'ours'] as const);
  const cutters = suppliers.filter((s) => s.cuts_to_order).map((s) => s.name);
  const set = (patch: Partial<KitSource>) => onChange({ ...value, ...patch });
  return (
    <View style={styles.stack}>
      <View role="radiogroup" aria-label="Where it comes from" style={styles.stack}>
        {options.map((o) => {
          const c = CHOICES[o];
          const detail = home ? (HOME_DETAIL[o] ?? c.detail) : o === 'bought' && kind === 'ice' && cutters.length ? `${c.detail} ${cutters.join(', ')} ${cutters.length > 1 ? 'cut' : 'cuts'} to order.` : c.detail;
          return (
            <KitChoice
              key={o}
              icon={c.icon}
              title={c.title}
              detail={detail}
              selected={value.source === o}
              onPress={() => onChange({ source: value.source === o ? null : o, supplier_id: null, machine: '', note: value.note })}
            />
          );
        })}
      </View>
      {value.source === 'bought' && !home ? (
        suppliers.length ? (
          <KitChipGroup label="From which supplier">
            {suppliers.map((s) => (
              <Chip key={s.id} label={s.name} selected={value.supplier_id === s.id} onPress={() => set({ supplier_id: value.supplier_id === s.id ? null : s.id })} />
            ))}
          </KitChipGroup>
        ) : (
          <Caption tone="muted">No suppliers listed yet. Add one under Buying › Suppliers and pick it here later.</Caption>
        )
      ) : null}
      {value.source === 'machine' ? (
        <Field label="Which machine" value={value.machine ?? ''} onChangeText={(machine) => set({ machine })} placeholder="Hoshizaki under the well" maxLength={60} />
      ) : null}
      {kind !== 'glass' ? <Field label="A note, if it helps" value={value.note ?? ''} onChangeText={(note) => set({ note })} placeholder={kind === 'ice' ? 'Bagged, cut from their 300 lb block' : 'Made for us, with our logo'} maxLength={120} /> : null}
      {kind === 'ice' ? <Caption tone="muted">Not sure yet? Skip it. Drinks are still drawn with this ice.</Caption> : null}
    </View>
  );
}

/** Text as the database keeps it: trimmed, or null. */
export const trimmed = (s: string | undefined | null) => s?.trim() || null;

const styles = StyleSheet.create({
  stack: { gap: space.sm },
});
