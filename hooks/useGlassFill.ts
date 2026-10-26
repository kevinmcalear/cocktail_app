import { useMemo } from 'react';

import { barGlassFor, useBarGlassware, type BarGlass } from '@/hooks/useBarGlassware';
import { useDilutionDefaults } from '@/hooks/useDrinkMath';
import { useDropdowns } from '@/hooks/useDropdowns';
import { classifyMethod } from '@/lib/batch';
import { orderedMethodIds } from '@/lib/drinkMethods';
import { fitToWashLine, glassFill, washLine, type Fill, type FillLine, type Fitted, type WashLine } from '@/lib/glassFill';
import { readIceBuild } from '@/lib/iceBuild';
import { glassOf } from '@/lib/kitFromDrinks';
import type { SpecLine } from '@/lib/spec';
import type { DatabaseItem } from '@/types/types';

/** A drink as Fit it reads it: the saved drink on its page, or the editor's draft. */
export interface FillDrink {
  barId: string | null | undefined;
  glasswareId: string | null | undefined;
  methodIds: readonly string[];
  iceId: string | null | undefined;
  iceBuild: unknown;
  icePerServeG: number | null | undefined;
  dilutionPct: number | null | undefined;
  lines: readonly FillLine[];
}

export interface GlassFillResult {
  /** What the venue calls the glass: "Nick and Nora". */
  glassName: string;
  /** The venue's glass the drink is poured in: its main glass of the drink's type. */
  venueGlass: BarGlass;
  line: WashLine;
  fill: Fill;
  /** The spec scaled to the wash line; null when nothing scales. */
  fitted: Fitted | null;
}

const NO_ICE = /^(none|no ice)$/i;

/**
 * How full the venue's glass is with this drink (Fit it to the glass, QA
 * Q38): the venue's main glass of the drink's glass type, its wash line, the
 * serve with the method's dilution and any ice, and the spec fitted to the
 * line. Null for a drink with no venue, no glass the venue lists, no wash
 * line or capacity, or nothing the fill can say (lib/glassFill.ts).
 */
export function useGlassFill(drink: FillDrink | null): GlassFillResult | null {
  const { data: dropdowns } = useDropdowns();
  const barId = drink?.barId ?? null;
  const { data: glasses } = useBarGlassware(barId);
  const { data: defaults } = useDilutionDefaults(barId);
  return useMemo(() => {
    if (!drink || !glasses || !dropdowns) return null;
    const name = dropdowns.glassware.find((g) => g.id === drink.glasswareId)?.name;
    const shape = name ? glassOf(name) : null;
    const glass = shape ? barGlassFor(glasses, shape) : null;
    const line = glass ? washLine(glass) : null;
    if (!shape || !glass || !line) return null;
    const methods = drink.methodIds.map((id) => dropdowns.methods.find((m) => m.id === id)?.name).filter((n): n is string => !!n);
    const ice = dropdowns.iceTypes.find((i) => i.id === drink.iceId)?.name;
    const iced = (!!ice && !NO_ICE.test(ice.trim())) || !!readIceBuild(drink.iceBuild)?.length;
    const options = { method: classifyMethod(methods), dilutionPct: drink.dilutionPct, defaults, washLineMl: line.ml, iceG: iced ? (drink.icePerServeG ?? null) : 0 };
    const fill = glassFill(drink.lines, options);
    if (typeof fill === 'string') return null;
    return { glassName: glass.name ?? name!, venueGlass: glass, line, fill, fitted: fitToWashLine(drink.lines, options) };
  }, [drink, glasses, dropdowns, defaults]);
}

type FillItem = Pick<DatabaseItem, 'bar_id' | 'glassware_id' | 'item_methods' | 'ice_id' | 'ice_build' | 'ice_per_serve_g' | 'dilution_pct'>;

/** A saved drink's fill, from its page's spec lines. Pass null to skip. */
export function useItemGlassFill(item: FillItem | null, lines: readonly SpecLine[]): GlassFillResult | null {
  return useGlassFill(
    item
      ? {
          barId: item.bar_id,
          glasswareId: item.glassware_id,
          methodIds: orderedMethodIds(item.item_methods),
          iceId: item.ice_id,
          iceBuild: item.ice_build,
          icePerServeG: item.ice_per_serve_g,
          dilutionPct: item.dilution_pct,
          lines: lines.map((l) => ({ amount: l.value, unit: l.unit, ingredient: l.ingredient, density: l.density, atService: l.atService })),
        }
      : null
  );
}
