import { BAR_COLOURS } from '@/constants/barColours';
import type { Ground } from '@/lib/palette';

// Apart from lib/palette (which useDs reads) so the bar colours (constants/barColours) load with the Brand and Theme screens, not with every page.

export interface Palette {
  name: string;
  accent: string;
  ground: Ground;
}

/** The six bar colours a venue starts from when it has no logo, each with A hint. */
export const PALETTES: Palette[] = BAR_COLOURS.map((c) => ({ name: c.name, accent: c.hex, ground: 'hint' }));

/**
 * The palettes to offer: the logo's colours first, each with A hint, then
 * the bar colours until there are six. `name` names a colour (lib/brandColours).
 */
export function palettesFor(logoColours: string[], name: (hex: string) => string): Palette[] {
  const seen = new Set<string>();
  const out: Palette[] = [];
  for (const p of [...logoColours.map((hex) => ({ name: name(hex), accent: hex.toUpperCase(), ground: 'hint' as const })), ...PALETTES]) {
    if (seen.has(p.accent) || out.length === 6) continue;
    seen.add(p.accent);
    out.push(p);
  }
  return out;
}
