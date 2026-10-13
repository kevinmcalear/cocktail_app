// Each line's share of a house prep's recipe, for the recipe step's
// proportion bar (canvas make-create-prep-recipe): grams count as ml, other
// units by how much they add, and every line with an amount gets a sliver
// so two chillies still show. Coloured as the sketch colours that ingredient.
import { partWeight } from '../supabase/functions/_shared/flavor';
import { colorRuleFor } from '../supabase/functions/_shared/sketchRules';

import { prepAmounts, type PrepDraft } from './prepKinds';

export interface PrepShare {
  key: string;
  name: string;
  /** 0 to 1; the shares add up to 1. */
  share: number;
  /** The ingredient's colour in a drawing, when the rules know it. */
  hex: string | null;
}

/** The smallest share a line with an amount is drawn at. */
const SLIVER = 0.02;

export function prepShares(d: PrepDraft): PrepShare[] {
  const rows = prepAmounts(d).flatMap(({ line, amount }) => {
    if (line.slot || !line.name.trim() || amount === null || amount <= 0) return [];
    const unit = line.unit.trim().toLowerCase();
    const w = unit === 'g' || unit === 'ml' ? amount : partWeight({ name: line.name, amount, unit: unit || 'each' });
    const weight = typeof w === 'number' ? w : w.volume || w.flavor;
    return [{ key: line.key, name: line.name, weight, hex: colorRuleFor({ name: line.name, genericName: null })?.hex ?? null }];
  });
  const total = rows.reduce((sum, r) => sum + r.weight, 0);
  if (!total) return [];
  const raised = rows.map((r) => ({ ...r, share: Math.max(SLIVER, r.weight / total) }));
  const sum = raised.reduce((s, r) => s + r.share, 0);
  return raised.map(({ key, name, share, hex }) => ({ key, name, share: share / sum, hex }));
}
