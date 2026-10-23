import { useState } from 'react';

import { useExpiring } from '@/hooks/useExpiring';
import type { WizardDraft, WizardLine, WizardPick } from '@/lib/drinkWizard';
import type { IngredientAlias } from '@/lib/ingredientNames';
import type { TypedPour } from '@/lib/paste';
import { PREP_KINDS, type PrepDraft } from '@/lib/prepKinds';
import { capitalizeFirst } from '@/lib/stringUtils';
import { techniqueById } from '@/lib/techniques';

import type { CatalogIngredient } from './IngredientSearch';
import { PrepBuilder } from './prep/PrepBuilder';
import { PrepCard } from './prep/PrepCard';

/** How long "Shrub saved to your preps…" stays. */
const NOTICE_MS = 10000;

interface MakePrepArgs {
  draft: WizardDraft;
  ingredients: readonly CatalogIngredient[];
  aliases: readonly IngredientAlias[];
  /** The desktop page: the prep is written under its own line, not over the page. */
  inlinePrep?: { venueName: string | null };
  add: (pick: WizardPick, prep?: PrepDraft, later?: boolean, pour?: TypedPour) => WizardLine;
  change: (key: string, c: Partial<WizardLine>) => void;
}

// What the prep is, for "Shrub added": its kind, its technique, else its name.
const prepWord = (prep: PrepDraft, name: string) =>
  (prep.technique ? techniqueById(prep.technique)?.name : prep.kind !== 'other' ? PREP_KINDS.find((k) => k.id === prep.kind)?.name : null) ?? name;

/**
 * A house prep being made from the ingredient lines: a new one, the recipe of
 * a line in the drink, or a line swapped for one (Make it house). In the steps
 * it's the builder over the page; on the desktop page, a card under its line.
 */
export function useMakePrep({ draft, ingredients, aliases, inlinePrep, add, change }: MakePrepArgs) {
  /**
   * A new line, the recipe of a line in the drink (its key), or a line swapped
   * for one (its key, `replace`). Make it house on a bottle also brings the
   * technique and the bottle as its base.
   */
  const [making, setMaking] = useState<{ name: string; key?: string; replace?: boolean; technique?: string; base?: WizardPick; pour?: TypedPour } | null>(null);
  // Plain values: the React Compiler reads `making.key` eagerly for its memo deps, which throws while it's closed.
  const editingKey = making?.key ?? null;
  const makingName = making?.name ?? null;
  const replacing = !!making?.replace;
  const makingTechnique = making?.technique ?? null;
  const makingBase = making?.base ?? null;
  const makingPour = making?.pour;
  /** A prep just made: "Shrub saved to your preps…" for a moment. */
  const [made, setMade] = useExpiring<string>(NOTICE_MS);

  // Shown the way it saves ("coconut fat washed rum" is "Coconut fat washed rum").
  const make = (name: string, key?: string, pour?: TypedPour) => {
    // Under its own line on the desktop page: the line comes first, its recipe to write until the card adds it.
    if (inlinePrep && !key) {
      const line = add({ id: null, name: capitalizeFirst(name) }, undefined, true, pour);
      setMaking({ name: line.name, key: line.key });
    } else setMaking({ name: capitalizeFirst(name), key, replace: !!key, pour });
  };

  const editingPrep = editingKey && !replacing ? draft.lines.find((l) => l.key === editingKey)?.prep : null;
  const props = {
    initial: editingPrep,
    technique: makingTechnique,
    picked: makingBase ? { base: makingBase } : undefined,
    ingredients,
    aliases,
    onClose: () => setMaking(null),
    onDone: (prep: PrepDraft) => {
      if (editingKey && replacing) change(editingKey, { id: null, name: makingName ?? '', prep, technique: prep.technique, later: undefined });
      else if (editingKey) change(editingKey, { prep, technique: prep.technique, later: undefined });
      else if (makingName) add({ id: null, name: makingName }, prep, false, makingPour);
      setMaking(null);
      // The prep is saved with the drink, not before, so this says when rather than "saved" (canvas make-create-house-line).
      if (!editingKey) setMade(`${prepWord(prep, makingName ?? 'The prep')} saved to your preps when you save the drink. Its page is ready then.`);
      else if (replacing) setMade(`Saved to your bar’s preps when you save the drink. Next time, type “${(makingName ?? '').split(/[\s-]/)[0].toLowerCase()}”.`);
    },
    // A recipe already written isn't dropped for a name.
    onLater: editingPrep
      ? undefined
      : () => {
          if (editingKey) change(editingKey, { id: null, name: makingName ?? '', prep: undefined, technique: undefined, later: true });
          else if (makingName) add({ id: null, name: makingName }, undefined, true, makingPour);
          setMaking(null);
        },
  };

  return {
    make,
    /** Open a line's recipe again. */
    edit: (l: WizardLine) => setMaking({ name: l.name, key: l.key }),
    /** Make it house: the bottle line becomes a prep by this technique, the bottle its base. */
    house: (line: WizardLine, name: string, technique: string) => setMaking({ name, key: line.key, replace: true, technique, base: { id: line.id, name: line.name } }),
    made,
    /** The card under this line, when its prep is being written on the desktop page. */
    card: (key: string) => (inlinePrep && makingName && key === editingKey ? <PrepCard key={key} name={makingName} venueName={inlinePrep.venueName} {...props} /> : null),
    builder: inlinePrep ? null : <PrepBuilder name={makingName} drinkName={draft.name.trim()} {...props} />,
  };
}
