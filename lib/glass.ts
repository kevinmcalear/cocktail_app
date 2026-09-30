/**
 * Glass and ice: does the serve fit the glass, how much ice a serve takes,
 * and the ice an event needs. Pure; the drink page's facts and the prep list
 * render it.
 */

/** Ice is about 0.92 g per ml, so the room the ice takes in a glass weighs this much. */
const ICE_G_PER_ML = 0.92;

export interface GlassSize {
  capacity_ml: number | null | undefined;
  iced_capacity_ml: number | null | undefined;
}

export interface GlassFit {
  /** The room the liquid has: the iced capacity with ice in the glass, else the capacity. */
  roomMl: number;
  fits: boolean;
  /** How far over the room the serve is, in ml; 0 when it fits. */
  overMl: number;
  /** "180 ml · fits", "200 ml with ice · over by 12 ml". */
  label: string;
}

const round = (n: number) => Math.round(n);

/** Whether a serve fits its glass. Null without a capacity to check against. */
export function glassFit(serveMl: number | null | undefined, glass: GlassSize, withIce: boolean): GlassFit | null {
  const room = withIce ? (glass.iced_capacity_ml ?? glass.capacity_ml) : glass.capacity_ml;
  if (!room || serveMl == null) return null;
  const over = Math.max(0, serveMl - room);
  const size = `${round(room)} ml${withIce && glass.iced_capacity_ml ? ' with ice' : ''}`;
  return { roomMl: room, fits: over === 0, overMl: over, label: over === 0 ? `${size} · fits` : `${size} · over by ${round(over)} ml` };
}

/** "180 ml", "350 ml (200 ml with ice)", or null with nothing set. */
export function glassSizeLabel(glass: GlassSize): string | null {
  if (!glass.capacity_ml) return null;
  const iced = glass.iced_capacity_ml && glass.iced_capacity_ml < glass.capacity_ml ? ` (${round(glass.iced_capacity_ml)} ml with ice)` : '';
  return `${round(glass.capacity_ml)} ml${iced}`;
}

/** The ice a serve takes when nobody has weighed it: the room the ice fills in the glass, as grams, to the nearest 5. */
export function defaultIcePerServe(glass: GlassSize, withIce: boolean): number | null {
  if (!withIce || !glass.capacity_ml || !glass.iced_capacity_ml) return null;
  const g = (glass.capacity_ml - glass.iced_capacity_ml) * ICE_G_PER_ML;
  return g > 0 ? Math.round(g / 5) * 5 : null;
}

/** "140 g", "38 kg". */
export function formatIce(grams: number): string {
  if (grams >= 1000) return `${Number((grams / 1000).toFixed(grams >= 10_000 ? 0 : 1))} kg`;
  return `${round(grams)} g`;
}

export interface IceNeed {
  /** The ice type's name ("Cubes"), or "Ice" when the drink has none set. */
  type: string;
  grams: number;
  forDrinks: string[];
}

/** The ice an event needs, by type: each drink's ice per serve times its serves. */
export function iceForEvent(drinks: { name: string; iceType: string | null; icePerServeG: number | null }[], servesPerDrink: number): IceNeed[] {
  const byType = new Map<string, IceNeed>();
  for (const d of drinks) {
    if (!d.icePerServeG || d.icePerServeG <= 0) continue;
    const type = d.iceType ?? 'Ice';
    const need = byType.get(type) ?? { type, grams: 0, forDrinks: [] };
    need.grams += d.icePerServeG * servesPerDrink;
    need.forDrinks.push(d.name);
    byType.set(type, need);
  }
  return [...byType.values()].sort((a, b) => b.grams - a.grams);
}
