import { useState } from 'react';

import { useCatalogRecipe } from '@/hooks/usePrepCard';
import { guessKind, openSlots, prepFromCatalog, prepFromTechnique, prepPhrase, sourceSite, startPrep, type PrepDraft, type PrepKindId, type PrepPick } from '@/lib/prepKinds';
import { prepCardFor, waysToMake } from '@/lib/techniques/makeIt';
import { techniqueById } from '@/lib/techniques';

import type { RecipeViewKind } from './PrepRecipeStep';

export interface PrepStart {
  name: string;
  /** Editing one already in the drink. */
  initial?: PrepDraft | null;
  /** Make it house from a line: the bottle it changes, and the "with what" if known. */
  picked?: { base?: PrepPick | null; adjunct?: PrepPick | null };
  /** Make it house: the technique picked for the line. */
  technique?: string | null;
}

/** A new prep's first draft: the technique picked, else the kind its name says, else the technique that most likely makes it, else blank. */
function firstDraft(name: string, picked: PrepStart['picked'], technique: string | null | undefined): PrepDraft {
  const chosen = techniqueById(technique);
  if (chosen) return prepFromTechnique(chosen, name, prepCardFor(chosen), picked);
  const kind = guessKind(name);
  const way = kind ? null : waysToMake(name)[0];
  return way ? prepFromTechnique(way, name, prepCardFor(way), picked) : startPrep(kind ?? 'other', name);
}

/**
 * A house prep being written: its draft, started from the technique, the
 * name or the catalog's sourced recipe, and the kind and technique picks.
 * The full-screen builder (PrepBuilder) and the card under a line on the
 * desktop page (PrepCard) both write it. `onSeeded` runs when the catalog's
 * recipe arrives, so the builder can move on to the recipe.
 */
export function usePrepDraft({ name, initial, picked, technique }: PrepStart, onSeeded?: () => void) {
  const [draft, setDraftState] = useState<PrepDraft>(() => initial ?? firstDraft(name, picked, technique));
  const [view, setView] = useState<RecipeViewKind>('parts');
  // Goes up when the draft starts over (a kind, a technique, the catalog's recipe): steps that keep their own rows remount.
  const [version, setVersion] = useState(0);
  // A name the catalog has a sourced recipe for starts from it, until the maker changes anything.
  const [touched, setTouched] = useState(false);
  const setDraft = (d: PrepDraft) => {
    setTouched(true);
    setDraftState(d);
  };
  const { data: catalog } = useCatalogRecipe(initial || technique ? null : name);
  const [seeded, setSeeded] = useState<string | null>(null);
  if (catalog && !touched && seeded !== catalog.id) {
    setSeeded(catalog.id);
    setDraftState(prepFromCatalog(name, catalog));
    setVersion(version + 1);
    onSeeded?.();
  }
  const fromCatalog = seeded && catalog ? `Started from the catalog recipe${catalog.checkedOn.length ? `, checked on ${catalog.checkedOn.map(sourceSite).join(' and ')}` : ''}. Change anything.` : undefined;
  const pickKind = (kind: PrepKindId, way?: string) => {
    setDraft(startPrep(kind, name, way));
    setVersion(version + 1);
  };
  const pickTechnique = (id: string) => {
    const t = techniqueById(id);
    if (!t) return;
    setDraft(prepFromTechnique(t, name, prepCardFor(t), picked));
    setVersion(version + 1);
  };
  return {
    draft,
    setDraft,
    view,
    setView,
    fromCatalog,
    pickKind,
    pickTechnique,
    version,
    phrase: prepPhrase(draft),
    // A stand-in line ("Spirit") is never saved: pick it or take it out first.
    named: draft.lines.some((l) => l.name.trim()),
    slotsOpen: openSlots(draft).length > 0,
  };
}
