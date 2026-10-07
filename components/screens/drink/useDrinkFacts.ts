import { useDropdowns } from '@/hooks/useDropdowns';
import { classifyMethod, type BatchMethod } from '@/lib/batch';
import { drinkStrength, formatAbv, formatAmount, type DilutionDefaults, type Strength } from '@/lib/drinkMath';
import { formatIce, glassFit } from '@/lib/glass';
import type { SpecLine } from '@/lib/spec';
import type { DatabaseItem } from '@/types/types';

import type { Fact } from './DrinkFacts';
import { hasIce, type GlassSheetGlass } from './GlassSheet';

interface Named {
  id: string;
  name: string;
  icon_key?: string | null;
  bar_id?: string | null;
  capacity_ml?: number | null;
  iced_capacity_ml?: number | null;
}

// Stored spelling in older rows; shown correctly.
const ORIGIN_LABEL: Record<string, string> = { Varient: 'Variant' };

interface Options {
  lines: SpecLine[];
  /** This role sees the amounts, so the strength can be worked out line by line. */
  amounts: boolean;
  dilutionDefaults: DilutionDefaults | undefined;
  openStrength: () => void;
  openGlass?: () => void;
  /** The bar keeps the spec back, so the figures worked out from it stay back too. */
  specLocked?: boolean;
}

/**
 * The facts you check before you reach for a glass (glass, ice, family,
 * strength, serve) and the tags above the name, from the drink and the
 * dropdown items. Strength comes from the server's figures for every role;
 * the line-by-line sheet needs the amounts.
 */
export function useDrinkFacts(item: DatabaseItem, { lines, amounts, dilutionDefaults, openStrength, openGlass, specLocked }: Options) {
  const { data: dropdowns } = useDropdowns();
  const find = (list: Named[] | undefined, id: string | null | undefined) => (id ? list?.find((x) => x.id === id) : undefined);
  const glassItem = find(dropdowns?.glassware as Named[], item.glassware_id);
  const glass: GlassSheetGlass | null = glassItem
    ? { id: glassItem.id, name: glassItem.name, icon_key: glassItem.icon_key, bar_id: glassItem.bar_id ?? null, capacity_ml: glassItem.capacity_ml ?? null, iced_capacity_ml: glassItem.iced_capacity_ml ?? null }
    : null;
  const ice = find(dropdowns?.iceTypes as Named[], item.ice_id) ?? null;
  const family = find(dropdowns?.families as Named[], item.family_id);
  const methods = (item.item_methods ?? []).map((m) => find(dropdowns?.methods as Named[], m.method_item_id)?.name).filter((n): n is string => !!n);
  const method: BatchMethod = classifyMethod(methods);
  const strength: Strength | null = amounts ? drinkStrength(lines, method, { dilutionPct: item.dilution_pct, defaults: dilutionDefaults }) : null;
  const abv = specLocked ? null : formatAbv(item.abv);
  const strengthPress = strength ? openStrength : undefined;
  const strengthHint = strength ? 'Opens the ethanol in each line and the dilution' : undefined;
  const fit = glass ? glassFit(item.serve_ml, glass, hasIce(ice?.name)) : null;
  const glassHint = openGlass ? 'Opens the glass size and the ice per serve' : undefined;

  const facts = (
    [
      glass && { label: 'Glass', value: glass.name, sub: fit?.label, onPress: openGlass, accessibilityHint: glassHint },
      ice && { label: 'Ice', value: ice.name, sub: item.ice_per_serve_g ? `${formatIce(item.ice_per_serve_g)} per serve` : undefined, onPress: openGlass, accessibilityHint: glassHint },
      family && { label: 'Family', value: family.name },
      abv ? { label: 'ABV', value: abv, sub: item.abv_source === 'calculated' ? 'from the spec' : 'typed in', onPress: strengthPress, accessibilityHint: strengthHint } : null,
      item.serve_ml != null && !specLocked
        ? { label: 'Serve', value: formatAmount(item.serve_ml, 'ml'), sub: strength ? `after ${Number(strength.dilutionPct.toFixed(1))}% water` : 'after dilution', onPress: strengthPress, accessibilityHint: strengthHint }
        : null,
      item.serve_abv != null && !specLocked ? { label: 'Serve ABV', value: formatAbv(item.serve_abv)!, sub: 'in the glass', onPress: strengthPress, accessibilityHint: strengthHint } : null,
    ] as (Fact | null | undefined)[]
  ).filter((f): f is Fact => !!f);
  const tags = [item.origin ? (ORIGIN_LABEL[item.origin] ?? item.origin) : null, ...methods].filter((t): t is string => !!t);
  return { facts, tags, glass, ice: ice ? { name: ice.name } : null, method, strength };
}
