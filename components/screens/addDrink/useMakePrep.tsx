import { useEffect, useState } from 'react';

import { linePrep, uncombine } from '@/lib/batchLines';
import type { WizardDraft, WizardLine, WizardPick } from '@/lib/drinkWizard';
import type { IngredientAlias } from '@/lib/ingredientNames';
import type { TypedPour } from '@/lib/paste';
import { stepToFinish, type PrepDraft } from '@/lib/prepKinds';
import { capitalizeFirst } from '@/lib/stringUtils';

import type { CatalogIngredient } from './IngredientSearch';
import type { TrailItem } from './Trail';
import { DrinkHouseMade } from './prep/DrinkHouseMade';

interface MakePrepArgs {
  draft: WizardDraft;
  set: (change: Partial<WizardDraft>) => void;
  ingredients: readonly CatalogIngredient[];
  aliases: readonly IngredientAlias[];
  /** A new drink, kept as a draft (the draft page, the desktop page); `onOpen` says which house-made is open (null when none), for the page's rail. */
  inlinePrep?: { venueName: string | null; onOpen?: (making: string | null) => void };
  add: (pick: WizardPick, prep?: PrepDraft, later?: boolean, pour?: TypedPour) => WizardLine;
  change: (key: string, c: Partial<WizardLine>) => void;
  /** The venue the drink is for, whose Kit How? is checked against; null at home. */
  bar?: { id: string; name: string } | null;
  /** Where the drink is, from the menu down to it: the house-made's trail starts here. */
  trail?: readonly TrailItem[];
  /** A drink's lines; false for a house-made's own recipe (the ingredient editor), where it's a part. */
  forDrink?: boolean;
}

/** What's being made: the drink's line it's on (its key), and how it started. */
interface Making {
  name: string;
  key: string;
  /** A bottle line made in house: the bottle is its base, and the technique picked for it. */
  technique?: string;
  base?: WizardPick;
  /** Two lines just combined: backing out with nothing written puts them back. */
  combined?: boolean;
  /** Opened finished (its recipe done before): a change keeps it finished while it could be added as it is. */
  finished?: boolean;
}

/**
 * A house-made written inside the drink (board Add-inside): one flat page,
 * over the drink on a phone and beside it on the web's desktop page, for a
 * new one from the search, two lines combined, a line's recipe opened again,
 * or a bottle made in house. It has no save of its own: what's written goes
 * on the drink's line as it's written, a recipe to finish until Done, and it
 * saves with the drink.
 */
export function useMakePrep({ draft, set, ingredients, aliases, inlinePrep, add, change, bar = null, trail, forDrink = true }: MakePrepArgs) {
  const [making, setMaking] = useState<Making | null>(null);
  // Plain values: the React Compiler reads `making.key` eagerly for its memo deps, which throws while it's closed.
  const key = making?.key ?? null;
  const makingName = making?.name ?? null;
  const line = key ? draft.lines.find((l) => l.key === key) : null;
  // Open while its line is there (a line taken out takes its page with it): the desktop page's rail follows.
  const open = !!makingName && !!line;
  const onOpen = inlinePrep?.onOpen;
  const openName = open ? makingName : null;
  useEffect(() => onOpen?.(openName), [onOpen, openName]);

  // Shown the way it saves ("coconut fat washed rum" is "Coconut fat washed rum"). The line comes first, a recipe to write until it's done.
  const make = (name: string, lineKey?: string, pour?: TypedPour) => {
    const named = capitalizeFirst(name);
    if (lineKey) change(lineKey, { id: null, name: named, later: true, bottle: undefined, named: undefined });
    setMaking({ name: named, key: lineKey ?? add({ id: null, name: named }, undefined, true, pour).key });
  };
  // A bottle made in house starts from nothing written: its page opens on the technique, the bottle its base.
  const fresh = !!making?.base;
  const initial = line && !fresh ? (linePrep(line) ?? null) : null;
  const drinkName = draft.name.trim();

  const page =
    open && making && line ? (
      <DrinkHouseMade
        key={making.key}
        name={making.name}
        initial={initial}
        drinkName={drinkName || (forDrink ? 'Your drink' : 'Its recipe')}
        forDrink={forDrink}
        drafts={!!inlinePrep}
        above={trail ?? [{ label: drinkName || 'Your drink' }]}
        bar={bar}
        ingredients={ingredients}
        aliases={aliases}
        picked={making.base ? { base: making.base } : undefined}
        technique={making.technique ?? null}
        combined={making.combined}
        finished={!!making.finished}
        // On the line as it's written: a recipe to finish until Done (a finished one stays finished while it could be added as it is).
        onKeep={(prep, name, done) => change(making.key, { id: null, name, prep: { ...prep, at: done && making.finished ? undefined : stepToFinish(prep) }, technique: prep.technique, later: undefined, bottle: undefined, batch: undefined, combined: undefined })}
        onDone={(prep, name) => {
          change(making.key, { id: null, name, prep: { ...prep, at: undefined }, technique: prep.technique, later: undefined, bottle: undefined, batch: undefined, combined: undefined });
          setMaking(null);
        }}
        onClose={(kept) => {
          // Two lines just combined, left with nothing written, go back to two.
          if (making.combined && !kept) set({ lines: uncombine(draft.lines, making.key) });
          setMaking(null);
        }}
        onUse={(id, name) => {
          change(making.key, { id, name, prep: undefined, technique: undefined, later: undefined, bottle: undefined, batch: undefined, combined: undefined });
          setMaking(null);
        }}
      />
    ) : null;

  return {
    make,
    /** Open a line's recipe again, or the page for two lines just combined. Lines combined and left untouched under another page go back. */
    edit: (l: WizardLine) => setMaking({ name: l.name, key: l.key, combined: !!l.combined, finished: !!l.prep && !l.prep.at && !l.later }),
    /** Make it house: the bottle line becomes a house-made by this technique, the bottle its base. */
    house: (l: WizardLine, name: string, technique: string) => setMaking({ name, key: l.key, technique, base: { id: l.id, name: l.name } }),
    /** The house-made's page, while one is open. */
    builder: page,
  };
}
