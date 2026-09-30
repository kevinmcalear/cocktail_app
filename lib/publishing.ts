/**
 * Who can see a drink outside the venue, as the database works it out
 * (private.effective_publish_mode): the drink's own setting, else the most
 * open of its bar's menus that set one, else the bar's default, else private.
 * Mirrored here so the app can say where a drink's setting comes from.
 */

export type PublishMode = 'private' | 'description' | 'spec';
export type PublishSource = 'drink' | 'menu' | 'bar' | 'none';

const OPENNESS: Record<PublishMode, number> = { private: 0, description: 1, spec: 2 };

export function mostOpen(modes: (PublishMode | null | undefined)[]): PublishMode | null {
  let best: PublishMode | null = null;
  for (const m of modes) if (m && (best === null || OPENNESS[m] > OPENNESS[best])) best = m;
  return best;
}

export interface PublishInputs {
  /** The drink's own setting; null inherits. */
  own: PublishMode | null;
  /** Settings of its own bar's menus that it's on (nulls are ignored). */
  menuModes: (PublishMode | null)[];
  /** The bar's default; null for a drink with no bar. */
  barDefault: PublishMode | null;
}

export function effectivePublish({ own, menuModes, barDefault }: PublishInputs): { mode: PublishMode; source: PublishSource } {
  if (own) return { mode: own, source: 'drink' };
  const menu = mostOpen(menuModes);
  if (menu) return { mode: menu, source: 'menu' };
  if (barDefault) return { mode: barDefault, source: 'bar' };
  return { mode: 'private', source: 'none' };
}

/** What each mode shows the public, in words. */
export const PUBLISH_COPY: Record<PublishMode, { label: string; detail: string }> = {
  private: { label: 'Private', detail: "Not public: only you, or the venue's staff by their role." },
  description: {
    label: 'Menu card',
    detail: 'Anyone can see the name, description, glass and picture, and collect it. Not the spec.',
  },
  spec: {
    label: 'Full spec',
    detail: 'Anyone can also see the spec: ingredients, amounts and units. Brands and prep notes stay with the venue.',
  },
};

/** "Full spec, from the bar's default" */
export function describePublish(mode: PublishMode, source: PublishSource): string {
  const from =
    source === 'drink' ? 'set here' : source === 'menu' ? 'from a published menu' : source === 'bar' ? "from the bar's default" : 'by default';
  return `${PUBLISH_COPY[mode].label}, ${from}`;
}
