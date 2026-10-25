import { useState } from 'react';

import { linePrep, uncombine } from '@/lib/batchLines';
import type { WizardDraft, WizardLine, WizardPick } from '@/lib/drinkWizard';
import type { IngredientAlias } from '@/lib/ingredientNames';
import type { TypedPour } from '@/lib/paste';
import type { PrepDraft } from '@/lib/prepKinds';
import { capitalizeFirst } from '@/lib/stringUtils';

import type { CatalogIngredient } from './IngredientSearch';
import { PrepBuilder } from './prep/PrepBuilder';
import { PrepCard } from './prep/PrepCard';

interface MakePrepArgs {
  draft: WizardDraft;
  set: (change: Partial<WizardDraft>) => void;
  ingredients: readonly CatalogIngredient[];
  aliases: readonly IngredientAlias[];
  /** The desktop page: the prep is written under its own line, not over the page. */
  /** On the desktop page: the card opens under its line; `onOpen` says when one is open, for the page's kit box. */
  inlinePrep?: { venueName: string | null; onOpen?: (open: boolean) => void };
  add: (pick: WizardPick, prep?: PrepDraft, later?: boolean, pour?: TypedPour) => WizardLine;
  change: (key: string, c: Partial<WizardLine>) => void;
}

/** What's being made: a new line, the recipe of a line in the drink (its key), or a bottle line made in house (its key, `replace`). */
interface Making {
  name: string;
  key?: string;
  replace?: boolean;
  technique?: string;
  base?: WizardPick;
  pour?: TypedPour;
  /** Opens on What is it, not the recipe: two lines just combined, or a typed line to check. */
  first?: boolean;
}

/**
 * A house prep being made from the ingredient lines, in the one recipe flow
 * (make-anything-overview): a new one from the search, two lines combined,
 * the recipe of a line in the drink, or a bottle made in house. In the
 * steps it's the builder over the page; on the desktop page, a card under
 * its line. Done goes back to the line, which shows the prep.
 */
export function useMakePrep({ draft, set, ingredients, aliases, inlinePrep, add, change }: MakePrepArgs) {
  const [making, setMakingState] = useState<Making | null>(null);
  const setMaking = (m: Making | null) => {
    setMakingState(m);
    inlinePrep?.onOpen?.(!!m);
  };
  // Plain values: the React Compiler reads `making.key` eagerly for its memo deps, which throws while it's closed.
  const editingKey = making?.key ?? null;
  const makingName = making?.name ?? null;
  const replacing = !!making?.replace;
  const makingTechnique = making?.technique ?? null;
  const makingBase = making?.base ?? null;
  const makingPour = making?.pour;
  const first = !!making?.first;

  // Shown the way it saves ("coconut fat washed rum" is "Coconut fat washed rum").
  const make = (name: string, key?: string, pour?: TypedPour) => {
    // Under its own line on the desktop page: the line comes first, its recipe to write until the card adds it.
    if (inlinePrep && !key) {
      const line = add({ id: null, name: capitalizeFirst(name) }, undefined, true, pour);
      setMaking({ name: line.name, key: line.key });
    } else setMaking({ name: capitalizeFirst(name), key, replace: !!key, pour });
  };

  const line = editingKey ? draft.lines.find((l) => l.key === editingKey) : null;
  const editingPrep = line && !replacing ? linePrep(line) : null;
  const combined = !!line?.combined;
  const drinkName = draft.name.trim();
  const props = {
    initial: editingPrep,
    technique: makingTechnique,
    picked: makingBase ? { base: makingBase } : undefined,
    first,
    combinedFrom: line?.combined?.map((l) => l.name),
    // What the drink pours of it, for "In Salty Boy 22.5 ml" and how many a bottle makes.
    inDrink: line && !replacing ? { name: drinkName, amount: line.amount, unit: line.unit } : undefined,
    ingredients,
    aliases,
    // Backing out of two lines just combined puts them back.
    onClose: () => {
      if (combined && editingKey) set({ lines: uncombine(draft.lines, editingKey) });
      setMaking(null);
    },
    onDone: (prep: PrepDraft, name?: string) => {
      const named = name?.trim() || makingName || '';
      if (editingKey && replacing) change(editingKey, { id: null, name: named, prep, technique: prep.technique, later: undefined, bottle: undefined });
      else if (editingKey) change(editingKey, { name: named, prep, technique: prep.technique, later: undefined, batch: undefined, combined: undefined });
      else if (named) add({ id: null, name: named }, prep, false, makingPour);
      setMaking(null);
    },
    // A recipe already written isn't dropped for a name.
    onLater: editingPrep
      ? undefined
      : () => {
          if (editingKey) change(editingKey, { id: null, name: makingName ?? '', prep: undefined, technique: undefined, later: true, bottle: undefined });
          else if (makingName) add({ id: null, name: makingName }, undefined, true, makingPour);
          setMaking(null);
        },
  };

  return {
    make,
    /** Open a line's recipe again, or the steps for two lines just combined. Lines combined and left unfinished under another card go back. */
    edit: (l: WizardLine) => {
      if (combined && editingKey && editingKey !== l.key) set({ lines: uncombine(draft.lines, editingKey) });
      setMaking({ name: l.name, key: l.key, first: !!l.combined });
    },
    /** Make it house: the bottle line becomes a prep by this technique, the bottle its base; `ask` opens on What is it to check it first. */
    house: (l: WizardLine, name: string, technique: string, ask?: boolean) => setMaking({ name, key: l.key, replace: true, technique, base: { id: l.id, name: l.name }, first: ask }),
    /** The card under this line, when its prep is being written on the desktop page. */
    card: (key: string) => (inlinePrep && makingName && key === editingKey ? <PrepCard key={key} name={makingName} venueName={inlinePrep.venueName} {...props} /> : null),
    builder: inlinePrep ? null : <PrepBuilder name={makingName} drinkName={drinkName} {...props} />,
  };
}
