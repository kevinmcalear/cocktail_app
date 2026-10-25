import { useRef, useState } from 'react';

import { useMakingKit } from '@/hooks/useBarKit';
import { useCatalogRecipe } from '@/hooks/usePrepCard';
import { FROM_TECHNIQUE, guessKind, keepLines, KIND_WAYS, kitFirstWay, wayOf, openSlots, prepFromCatalog, prepFromTechnique, prepPhrase, sourceSite, startPrep, withMethod, type PrepDraft, type PrepKindId, type PrepPick } from '@/lib/prepKinds';
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
  /** The venue the drink is for, whose Kit the ways are checked against; null at home. */
  bar?: { id: string; name: string } | null;
}

/** A new prep's first draft: the technique picked, else the kind its name says, else the technique that most likely makes it, else blank. */
function firstDraft(name: string, picked: PrepStart['picked'], technique: string | null | undefined, kit: ReadonlySet<string> | null): PrepDraft {
  const chosen = techniqueById(technique);
  if (chosen) return prepFromTechnique(chosen, name, prepCardFor(chosen), picked);
  const kind = guessKind(name);
  // A kind made one of the library's ways (a clarified juice) starts from the way its name points to, else the first the kit covers.
  const way = kind && !FROM_TECHNIQUE.includes(kind) ? null : (waysToMake(name)[0] ?? techniqueById(kind ? kitFirstWay(kind, kit)?.technique : null));
  return way ? prepFromTechnique(way, name, prepCardFor(way), picked) : startPrep(kind ?? 'other', name);
}

/**
 * A house prep being written: its draft, started from the technique, the
 * name or the catalog's sourced recipe, and the kind and way picks. The
 * full-screen builder (PrepBuilder) and the card under a line on the
 * desktop page (PrepCard) both write it. `onSeeded` runs when the catalog's
 * recipe arrives, so the builder can move on to the recipe.
 */
export function usePrepDraft({ name: started, initial, picked, technique, combined, nameNow, bar = null }: PrepStart, onSeeded?: () => void) {
  const { kit } = useMakingKit(bar);
  const name = nameNow?.trim() || started;
  // A recipe already written (or lines just combined) keeps what goes in when another kind is picked.
  const keep = combined || !!initial;
  const [draft, setDraftState] = useState<PrepDraft>(() => initial ?? firstDraft(started, picked, technique, kit));
  // Amounts typed as they go in (make-anything-steps-2, step 5) for lines combined from the drink's own.
  const [view, setView] = useState<RecipeViewKind>(combined || initial?.kind === 'batch' ? 'amounts' : 'parts');
  // Goes up when the draft starts over (a kind, a technique, the catalog's recipe): steps that keep their own rows remount.
  const [version, setVersion] = useState(0);
  // A name the catalog has a sourced recipe for starts from it, until the maker changes anything.
  const [touched, setTouched] = useState(false);
  // The draft as last set, for leaving straight after a level below put its recipe on a line (the trail's higher levels).
  const latest = useRef<PrepDraft | null>(null);
  const setDraft = (d: PrepDraft) => {
    latest.current = d;
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
   * kind starts its own parts, except for lines that were combined. A wash,
   * a clarified juice or a distillate starts from its technique's parts: the
   * way picked, else the first one the kit covers.
   */
  const pickKind = (kind: PrepKindId, wayId?: string) => {
    const way = KIND_WAYS[kind]?.find((w) => w.id === wayId);
    const k = way?.kind ?? kind;
    const t = way?.fills ? techniqueById(way.technique) : null;
    const method = (d: PrepDraft) => (t && way ? withMethod(d, t, { ...prepCardFor(t), steps: methodOf(t) }, way.id) : d);
    // Its own parts: a wash, a clarified juice, a distillate (the way picked, else the kit's first), or an oil or tincture.
    const ownWay = keep ? null : FROM_TECHNIQUE.includes(k) ? (way ?? kitFirstWay(k, kit)) : way?.own ? way : null;
    const own = ownWay ? techniqueById(ownWay.technique) : null;
    if (own) return restart(prepFromTechnique(own, name, prepCardFor(own), picked));
    // The same kind made another way: what goes in stays, unless it was an oil's or a tincture's own.
    if (t && draft.kind === k && !wayOf(draft)?.own) return restart(method(draft));
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
    /** The draft as it is right now, even mid-event: what leaving keeps. */
    current: () => latest.current ?? draft,
    /** Anything changed since it opened, a level below's recipe put on a line included. */
    changed: () => latest.current !== null,
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
