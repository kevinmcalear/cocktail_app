import { useState } from 'react';

import { useCatalogRecipe } from '@/hooks/usePrepCard';
import { guessKind, keepLines, KIND_WAYS, openSlots, prepFromCatalog, prepFromTechnique, prepPhrase, sourceSite, startPrep, withMethod, type PrepDraft, type PrepKindId, type PrepPick } from '@/lib/prepKinds';
import { methodOf, prepCardFor, waysToMake } from '@/lib/techniques/makeIt';
import { techniqueById } from '@/lib/techniques';

import type { RecipeViewKind } from './PrepRecipeStep';

export interface PrepStart {
  name: string;
  /** Editing one already in the drink, or two lines just combined. */
  initial?: PrepDraft | null;
  /** Make it house from a line: the bottle it changes, and the "with what" if known. */
  picked?: { base?: PrepPick | null; adjunct?: PrepPick | null };
  /** Make it house: the technique picked for the line. */
  technique?: string | null;
  /** Two lines just combined: a kind picked keeps them, and their amounts show as measured. */
  combined?: boolean;
  /** The name as it's typed now, for a kind picked after it changed; `name` is the one it started with. */
  nameNow?: string;
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
 * name or the catalog's sourced recipe, and the kind and way picks. The
 * full-screen builder (PrepBuilder) and the card under a line on the
 * desktop page (PrepCard) both write it. `onSeeded` runs when the catalog's
 * recipe arrives, so the builder can move on to the recipe.
 */
export function usePrepDraft({ name: started, initial, picked, technique, combined, nameNow }: PrepStart, onSeeded?: () => void) {
  const name = nameNow?.trim() || started;
  // A recipe already written (or lines just combined) keeps what goes in when another kind is picked.
  const keep = combined || !!initial;
  const [draft, setDraftState] = useState<PrepDraft>(() => initial ?? firstDraft(started, picked, technique));
  // Amounts typed as they go in (make-anything-steps-2, step 5) for lines combined from the drink's own.
  const [view, setView] = useState<RecipeViewKind>(combined || initial?.kind === 'batch' ? 'amounts' : 'parts');
  // Goes up when the draft starts over (a kind, a technique, the catalog's recipe): steps that keep their own rows remount.
  const [version, setVersion] = useState(0);
  // A name the catalog has a sourced recipe for starts from it, until the maker changes anything.
  const [touched, setTouched] = useState(false);
  const setDraft = (d: PrepDraft) => {
    setTouched(true);
    setDraftState(d);
  };
  const restart = (d: PrepDraft) => {
    setDraft(d);
    setVersion(version + 1);
  };
  const { data: catalog } = useCatalogRecipe(initial || technique ? null : started);
  const [seeded, setSeeded] = useState<string | null>(null);
  if (catalog && !touched && seeded !== catalog.id) {
    setSeeded(catalog.id);
    setDraftState(prepFromCatalog(started, catalog));
    setVersion(version + 1);
    onSeeded?.();
  }
  const fromCatalog = seeded && catalog ? `Started from the catalog recipe${catalog.checkedOn.length ? `, checked on ${catalog.checkedOn.map(sourceSite).join(' and ')}` : ''}. Change anything.` : undefined;
  /**
   * A kind, or one of its ways. A way that fills the method (an infusion,
   * sous vide) keeps what goes in and takes the technique's steps; a new
   * kind starts its own parts, except for lines that were combined. A wash
   * starts from its technique's parts.
   */
  const pickKind = (kind: PrepKindId, wayId?: string) => {
    const way = KIND_WAYS[kind]?.find((w) => w.id === wayId);
    const k = way?.kind ?? kind;
    const t = way?.fills ? techniqueById(way.technique) : null;
    const method = (d: PrepDraft) => (t && way ? withMethod(d, t, { ...prepCardFor(t), steps: methodOf(t) }, way.id) : d);
    const wash = k === 'wash' && !keep ? techniqueById((way ?? KIND_WAYS.wash?.[0])?.technique) : null;
    if (wash) return restart(prepFromTechnique(wash, name, prepCardFor(wash), picked));
    // The same kind made another way: what goes in stays.
    if (t && draft.kind === k) return restart(method(draft));
    const fresh = startPrep(k, name, way?.id);
    restart(method(keep ? keepLines(fresh, draft) : fresh));
  };
  const pickTechnique = (id: string) => {
    const t = techniqueById(id);
    if (!t) return;
    const fresh = prepFromTechnique(t, name, prepCardFor(t), picked);
    restart(keep ? keepLines(fresh, draft) : fresh);
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
