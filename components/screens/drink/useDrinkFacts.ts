import { useDropdowns } from '@/hooks/useDropdowns';
import { glassModelSize, useDrinkGlassModel, type GlassModel } from '@/hooks/useGlassModels';
import { classifyMethod, isGarnishUnit, type BatchMethod } from '@/lib/batch';
import { methodIcon, orderedMethodIds } from '@/lib/drinkMethods';
import { glassIcon } from '@/lib/glasswareIcons';
import { grated, iceLine } from '@/lib/drinkWizard';
import { iceBuildLine, readIceBuild, saysMore } from '@/lib/iceBuild';
import { drinkStrength, formatAbv, formatAmount, type DilutionDefaults, type Strength } from '@/lib/drinkMath';
import type { SpecLine } from '@/lib/spec';
import type { DatabaseItem } from '@/types/types';

import type { Fact } from './DrinkFacts';
import type { GlassSheetGlass } from './GlassSheet';
import type { SpecMark } from './SpecMarks';

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
/** The drink's glass and ice as the Glass sheet reads them: the drink page's facts and the editor's Glass and ice row. */
export function useDrinkGlass(item: Pick<DatabaseItem, 'id' | 'glassware_id' | 'ice_id'> & { /** A preview's glass as edited (lib/editPreview): no read of the saved one. */ glass_model?: GlassModel | null }) {
  const { data: dropdowns } = useDropdowns();
  const find = (list: Named[] | undefined, id: string | null | undefined) => (id ? list?.find((x) => x.id === id) : undefined);
  const glassItem = find(dropdowns?.glassware as Named[], item.glassware_id);
  const saved = useDrinkGlassModel('glass_model' in item ? null : item.id).data;
  const model = 'glass_model' in item ? item.glass_model : saved;
  const shape: GlassSheetGlass | null = glassItem
    ? { id: glassItem.id, name: glassItem.name, icon_key: glassItem.icon_key, bar_id: glassItem.bar_id ?? null, capacity_ml: glassItem.capacity_ml ?? null, iced_capacity_ml: glassItem.iced_capacity_ml ?? null }
    : null;
  // A real glass names itself and brings its maker's size (to the brim; the iced size is the venue's to weigh).
  const glass: GlassSheetGlass | null = model
    ? { ...(shape ?? { id: model.id, icon_key: null, bar_id: null }), name: model.name, capacity_ml: model.capacity_ml ?? shape?.capacity_ml ?? null, iced_capacity_ml: model.capacity_ml ? null : (shape?.iced_capacity_ml ?? null), model }
    : shape;
  const ice = find(dropdowns?.iceTypes as Named[], item.ice_id) ?? null;
  return { glass, ice, model };
}

export function useDrinkFacts(item: DatabaseItem, { lines, amounts, dilutionDefaults, openStrength, openGlass, specLocked, measures, makers = [] }: Options) {
  const { data: dropdowns } = useDropdowns();
  const find = (list: Named[] | undefined, id: string | null | undefined) => (id ? list?.find((x) => x.id === id) : undefined);
  const { glass, ice, model } = useDrinkGlass(item);
  const methodIce = find(dropdowns?.iceTypes as Named[], item.method_ice_id) ?? null;
  // How the ice sits (20261029500000), by each layer's ice (its name, and its kind when it says); a layer whose ice is gone drops out.
  const build = (readIceBuild(item.ice_build) ?? []).flatMap((l) => {
    const row = dropdowns?.iceTypes.find((x) => x.id === l.ice);
    return row?.name ? [{ ...l, ice: { name: row.name, kind: row.ice_kind } }] : [];
  });
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
  const glassBy = madeBy('glassware') ?? model?.maker?.display_name;

  // The finish: every count-unit line (a twist, a sprig, grated nutmeg), in spec order. Eddie tf-064: a mint sprig went missing beside the nutmeg.
  const garnishes = lines.filter((l) => l.ingredient && isGarnishUnit(l.unit) && !/\begg/i.test(l.ingredient)).map((l) => garnishLabel(l.ingredient!, l.unit));
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
      // A drink made in parts lists its methods part by part under the spec (DrinkParts).
      methods.length && !item.madeInParts?.length ? { label: 'Method', value: methods.join(', ') } : null,
      glass && { label: 'Glass', value: glass.name, sub: glassSub(glass, glassBy),  onPress: measures ? openGlass : undefined, accessibilityHint: glassHint },
      saysMore(build)
        ? { label: 'Ice', value: iceBuildLine(build), sub: [methodIce ? iceLine(null, methodIce.name, methods) : null, iceBy ? `cut by ${iceBy}` : null].filter(Boolean).join(' · ') || undefined, onPress: measures ? openGlass : undefined, accessibilityHint: glassHint }
        : (ice || methodIce) && { label: 'Ice', value: iceLine(ice?.name ?? null, methodIce?.name ?? null, methods)!, sub: iceBy ? `cut by ${iceBy}` : undefined, onPress: measures ? openGlass : undefined, accessibilityHint: glassHint },
      garnishes.length ? { label: 'Garnish', value: garnishes.join(', ') } : null,
    ] as (Fact | null | undefined)[]
  ).filter((f): f is Fact => !!f);
  // Beside the Spec heading (Eddie E43): each method's icon, then the glass's, which opens the glass sheet like its make line cell.
  const glassMark = glass ? glassIcon(glass) : null;
  const marks: SpecMark[] = [
    ...methods.flatMap((name) => {
      const icon = methodIcon(name);
      return icon ? [{ key: `method-${name}`, label: `Method: ${name}`, icon }] : [];
    }),
    ...(glass && glassMark ? [{ key: 'glass', label: `Glass: ${glass.name}`, icon: glassMark, onPress: measures ? openGlass : undefined, accessibilityHint: glassHint }] : []),
  ];
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
  return { make, marks, facts, tags, glass, ice: ice ? { name: ice.name } : null, method, methods, strength };
}

/** Under the glass's name: who made it, and a real glass's size. */
function glassSub(glass: GlassSheetGlass, by: string | undefined) {
  const size = glass.model ? glassModelSize(glass.model) : null;
  return [by ? `by ${by}` : null, size].filter(Boolean).join(' · ') || undefined;
}

/** The garnish fact: a discard says what happened to the peel ("Lemon peel, expressed and discarded"), grated says so ("Grated nutmeg"). */
export function garnishLabel(name: string, unit: string | null | undefined): string {
  const u = (unit ?? '').toLowerCase();
  return u === 'discard' ? `${name} peel, expressed and discarded` : u === 'grated' ? grated(name) : name;
}
