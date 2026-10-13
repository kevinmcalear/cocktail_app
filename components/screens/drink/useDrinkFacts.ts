import { useDropdowns } from '@/hooks/useDropdowns';
import { classifyMethod, isGarnishUnit, type BatchMethod } from '@/lib/batch';
import { orderedMethodIds } from '@/lib/drinkMethods';
import { drinkStrength, formatAbv, formatAmount, type DilutionDefaults, type Strength } from '@/lib/drinkMath';
import type { SpecLine } from '@/lib/spec';
import type { DatabaseItem } from '@/types/types';

import type { Fact } from './DrinkFacts';
import type { GlassSheetGlass } from './GlassSheet';

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
  /** This viewer may see the spec's amounts. Without them no ml or grams show (serve, ice, glass room). */
  measures: boolean;
  /** Who cut the ice and made the glass, once the maker has confirmed it. */
  makers?: { makes: string; confirmed_at: string | null; maker: { display_name: string } | null }[];
}

/**
 * The facts you need to make it (method, glass, ice, garnish), the ones for
 * later (strength, serve, family) and the drink's origin tag, from the drink and the
 * dropdown items. Strength comes from the server's figures for every role;
 * the line-by-line sheet needs the amounts.
 */
export function useDrinkFacts(item: DatabaseItem, { lines, amounts, dilutionDefaults, openStrength, openGlass, specLocked, measures, makers = [] }: Options) {
  const { data: dropdowns } = useDropdowns();
  const find = (list: Named[] | undefined, id: string | null | undefined) => (id ? list?.find((x) => x.id === id) : undefined);
  const glassItem = find(dropdowns?.glassware as Named[], item.glassware_id);
  const glass: GlassSheetGlass | null = glassItem
    ? { id: glassItem.id, name: glassItem.name, icon_key: glassItem.icon_key, bar_id: glassItem.bar_id ?? null, capacity_ml: glassItem.capacity_ml ?? null, iced_capacity_ml: glassItem.iced_capacity_ml ?? null }
    : null;
  const ice = find(dropdowns?.iceTypes as Named[], item.ice_id) ?? null;
  const family = find(dropdowns?.families as Named[], item.family_id);
  const methods = orderedMethodIds(item.item_methods).map((id) => find(dropdowns?.methods as Named[], id)?.name).filter((n): n is string => !!n);
  const method: BatchMethod = classifyMethod(methods);
  const strength: Strength | null = amounts ? drinkStrength(lines, method, { dilutionPct: item.dilution_pct, defaults: dilutionDefaults }) : null;
  const abv = specLocked ? null : formatAbv(item.abv);
  const strengthPress = strength ? openStrength : undefined;
  const strengthHint = strength ? 'Opens the ethanol in each line and the dilution' : undefined;
  const glassHint = openGlass && measures ? 'Opens the glass size and the ice per serve' : undefined;
  const madeBy = (makes: string) => makers.find((c) => c.makes === makes && c.confirmed_at)?.maker?.display_name;
  const iceBy = madeBy('ice');
  const glassBy = madeBy('glassware');

  // The finish: the last count-unit line (a twist, a pick, a pinch).
  const garnish = [...lines].reverse().find((l) => l.ingredient && isGarnishUnit(l.unit) && !/\begg/i.test(l.ingredient));
  const serveAbv = item.serve_abv != null && !specLocked ? formatAbv(item.serve_abv) : null;
  const serve =
    item.serve_ml != null && measures
      ? {
          label: 'Serve',
          value: formatAmount(item.serve_ml, 'ml'),
          sub: [strength ? `after ${Number(strength.dilutionPct.toFixed(1))}% water` : 'after dilution', serveAbv ? `${serveAbv} in the glass` : null].filter(Boolean).join(' · '),
          onPress: strengthPress,
          accessibilityHint: strengthHint,
        }
      : null;

  // What you need to make it, beside the spec (13 Oct, the dive-bar test): how, what glass, what ice, what on top.
  // How full the glass is and the ice per serve wait behind a tap (the glass sheet); the garnish's note is on its spec line.
  const make = (
    [
      methods.length ? { label: 'Method', value: methods.join(', ') } : null,
      glass && { label: 'Glass', value: glass.name, sub: glassBy ? `by ${glassBy}` : undefined, onPress: measures ? openGlass : undefined, accessibilityHint: glassHint },
      ice && { label: 'Ice', value: ice.name, sub: iceBy ? `cut by ${iceBy}` : undefined, onPress: measures ? openGlass : undefined, accessibilityHint: glassHint },
      garnish ? { label: 'Garnish', value: garnish.ingredient! } : null,
    ] as (Fact | null | undefined)[]
  ).filter((f): f is Fact => !!f);
  // Under More: strength and serve; family only where the serve isn't shown.
  const facts = (
    [
      abv
        ? {
            label: 'ABV',
            value: abv,
            sub: [item.abv_source === 'calculated' ? 'from the spec' : 'typed in', !serve && serveAbv ? `${serveAbv} in the glass` : null].filter(Boolean).join(' · '),
            onPress: strengthPress,
            accessibilityHint: strengthHint,
          }
        : null,
      serve,
      family && !serve ? { label: 'Family', value: family.name } : null,
    ] as (Fact | null | undefined)[]
  ).filter((f): f is Fact => !!f);
  // The method is in the make line now, so the tags are only where the drink comes from.
  const tags = item.origin ? [ORIGIN_LABEL[item.origin] ?? item.origin] : [];
  return { make, facts, tags, glass, ice: ice ? { name: ice.name } : null, method, methods, strength };
}
