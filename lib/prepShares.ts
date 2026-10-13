// Each line's share of a house prep's recipe, for the recipe step's
// proportion bar (canvas make-create-prep-recipe): grams count as ml, other
// units by how much they add, and every line gets at least a sliver, so two
// chillies, or chilli to taste, still show. Coloured in the bar's tones
// (prepTones) by the colour the sketch draws that ingredient.
import { prepTones } from '../constants/tokens';
import { partWeight } from '../supabase/functions/_shared/flavor';
import { colorRuleFor } from '../supabase/functions/_shared/sketchRules';

import { parseHex } from './color';
import { prepAmounts, type PrepDraft } from './prepKinds';

export interface PrepShare {
  key: string;
  name: string;
  /** 0 to 1; the shares add up to 1. */
  share: number;
  /** The line's tone in the bar. */
  hex: string;
}

/** The smallest share a line is drawn at. */
const SLIVER = 0.04;
/** Vinegars, oils and fats draw tan whatever the sketch says (the sketch draws vinegar pale, a clear oil not at all). */
const TAN = /vinegar|\boil\b|\bfat\b|butter|ghee|lard|tallow/i;
/** How far a sketch colour may be from a tone and still take it; further, it keeps its own (a green herb). */
const SNAP = 90;
const TONES = Object.values(prepTones).map((hex) => ({ hex, rgb: parseHex(hex) }));

/** The bar's tone for an ingredient: tan for a vinegar or fat, else its sketch colour's nearest tone, paper when the sketch doesn't know it. */
export function prepTone(name: string): string {
  if (TAN.test(name)) return prepTones.tan;
  const hex = colorRuleFor({ name, genericName: null })?.hex;
  if (!hex) return prepTones.paper;
  const rgb = parseHex(hex);
  const near = TONES.map((t) => ({ hex: t.hex, d: Math.hypot(...t.rgb.map((v, i) => v - rgb[i])) })).sort((a, b) => a.d - b.d)[0];
  return near.d <= SNAP ? near.hex : hex;
}

export function prepShares(d: PrepDraft): PrepShare[] {
  const rows = prepAmounts(d).flatMap(({ line, amount }) => {
    if (line.slot || !line.name.trim()) return [];
    const unit = line.unit.trim().toLowerCase();
    let weight = 0;
    if (amount !== null && amount > 0) {
      const w = unit === 'g' || unit === 'ml' ? amount : partWeight({ name: line.name, amount, unit: unit || 'each' });
      weight = typeof w === 'number' ? w : w.volume || w.flavor;
    }
    return [{ key: line.key, name: line.name, weight }];
  });
  const total = rows.reduce((sum, r) => sum + r.weight, 0);
  if (!total) return [];
  const raised = rows.map((r) => ({ ...r, share: Math.max(SLIVER, r.weight / total) }));
  const sum = raised.reduce((s, r) => s + r.share, 0);
  return raised.map(({ key, name, share }) => ({ key, name, share: share / sum, hex: prepTone(name) }));
}
