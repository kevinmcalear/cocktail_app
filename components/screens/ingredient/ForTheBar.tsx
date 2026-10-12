import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AllergenSection } from '@/components/allergens/AllergenSection';
import { useWhereItLives, WhereItLives } from '@/components/backbar/WhereItLives';
import { PriceSection } from '@/components/costs/PriceSection';
import { Headline, Surface } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { PublishSection } from '@/components/screens/publishing/PublishSection';
import { RowDivider, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDrinkAllergens, useItemAllergens } from '@/hooks/useAllergens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDrinkCost } from '@/hooks/useDrinkCost';
import { useMode } from '@/hooks/useMode';
import { useItemPurchase, usePricingSettings } from '@/hooks/usePricing';
import { useItemPublishing } from '@/hooks/usePublishing';
import { allergenLabel } from '@/lib/allergens';
import { formatMoney } from '@/lib/money';
import { PUBLISH_COPY } from '@/lib/publishing';

interface ForTheBarProps {
  item: { id: string; name: string; bar_id: string | null };
  /** Has a recipe of its own: allergens roll up from it and the cost is a batch's. */
  houseMade: boolean;
  canEditItem: boolean;
  /** A house prep keeps Where it lives here as a row (a bottle shows it as its own section). */
  whereRow: boolean;
}

type Open = 'allergens' | 'where' | 'cost' | 'publish' | null;

/**
 * "For the bar" on an ingredient's page: one group of rows, each with its
 * value and a chevron, each opening a sheet with the full section (allergens,
 * where it lives, cost, who can see it). A row shows only when its section has
 * something for this person.
 */
export function ForTheBar({ item, houseMade, canEditItem, whereRow }: ForTheBarProps) {
  const [open, setOpen] = useState<Open>(null);
  const allergens = useAllergenValue(item.id, houseMade);
  const where = useWhereItLives(item.id);
  const cost = useCostValue(item.id, houseMade);
  const publish = usePublishValue(item.id, item.bar_id);
  const close = () => setOpen(null);

  const rows: { key: Exclude<Open, null>; label: string; value: string; body: ReactNode }[] = [
    { key: 'allergens', label: 'Allergens', value: allergens, body: <AllergenSection itemId={item.id} houseMade={houseMade} canEditItem={canEditItem} /> },
    ...(whereRow && where.shown
      ? [{ key: 'where' as const, label: 'Where it lives', value: !where.canRead ? 'Locked' : (where.lines[0] ?? 'No spot yet'), body: <WhereItLives itemId={item.id} itemName={item.name} bare onRecipe={houseMade ? close : undefined} /> }]
      : []),
    ...(cost ? [{ key: 'cost' as const, label: 'Cost', value: cost, body: <PriceSection itemId={item.id} /> }] : []),
    ...(publish ? [{ key: 'publish' as const, label: 'Who can see it', value: publish, body: <PublishSection itemId={item.id} barId={item.bar_id} noun="ingredient" /> }] : []),
  ];
  const shown = rows.find((r) => r.key === open);

  return (
    <View style={styles.section}>
      <Headline role="heading">For the bar</Headline>
      <Surface style={styles.card}>
        {rows.map((r, i) => (
          <View key={r.key}>
            {i > 0 ? <RowDivider /> : null}
            <SettingsRow label={r.label} value={r.value} onPress={() => setOpen(r.key)} />
          </View>
        ))}
      </Surface>
      {shown ? (
        <MenuSheet visible onClose={close} title={shown.key === 'where' ? item.name : shown.label} subtitle={shown.key === 'where' ? `Where it lives${where.active ? ` · ${where.active.name}` : ''}` : item.name}>
          {shown.body}
        </MenuSheet>
      ) : null}
    </View>
  );
}

const names = (keys: string[]) => keys.map((k) => allergenLabel(k)).join(', ');

/** "None", "Milk, Egg", "Not checked": the row's value, never "none" for unchecked. */
function useAllergenValue(itemId: string, houseMade: boolean): string {
  const { active } = useActiveVenue();
  const venueId = useMode().mode === 'home' ? null : (active?.id ?? null);
  const rolled = useDrinkAllergens(houseMade ? itemId : null);
  const declared = useItemAllergens(houseMade ? null : itemId, venueId);
  if (houseMade) {
    const found = rolled.data?.allergens.map((a) => a.allergen) ?? null;
    return found === null ? '' : found.length ? names(found) : rolled.data?.unchecked ? 'Not all checked' : 'None';
  }
  const shown = declared.data?.bar ?? declared.data?.catalogue ?? null;
  return !declared.data ? '' : !shown ? 'Not checked' : shown.allergens.length ? names(shown.allergens) : 'None listed';
}

/** "€4.20 a batch", "€32 a pack": null when there's no venue (the Price section shows nothing then). */
function useCostValue(itemId: string, houseMade: boolean): string | null {
  const { active } = useActiveVenue();
  const barId = useMode().mode === 'home' ? null : (active?.id ?? null);
  const { data: caps } = useCapabilities(barId);
  const canCost = !!caps?.includes('costs');
  const canPack = canCost || !!caps?.includes('prep');
  const { data: settings } = usePricingSettings(barId);
  const batch = useDrinkCost(itemId, barId, houseMade && canCost);
  const pack = useItemPurchase(!houseMade && canPack ? itemId : null, barId);
  if (!barId) return null;
  if (!canPack) return 'Locked';
  const money = formatMoney(houseMade ? batch.data?.total_minor : pack.data?.cost?.pack_cost_minor, settings?.currency);
  return money ? `${money} a ${houseMade ? 'batch' : 'pack'}` : canCost ? 'Needs a price' : 'Pack';
}

/** "Full spec": who sees it, for people who can change it (as PublishSection decides). */
function usePublishValue(itemId: string, barId: string | null): string | null {
  const userId = useUserId();
  const { data: caps = [] } = useCapabilities(barId);
  const { data } = useItemPublishing(itemId, barId);
  if (!data || !(barId ? caps.includes('publish') : !!userId && data.createdBy === userId)) return null;
  return PUBLISH_COPY[data.mode].label;
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  card: { paddingVertical: 0 },
});
