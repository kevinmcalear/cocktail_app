import { useRef, useState } from 'react';

import { useMakingKit } from '@/hooks/useBarKit';
import { useDebounced } from '@/hooks/useDiscover';
import { useCatalogRecipe } from '@/hooks/usePrepCard';
import { FROM_TECHNIQUE, guessKind, keepLines, KIND_WAYS, kitFirstWay, wayOf, openSlots, prepFromCatalog, prepFromTechnique, prepPhrase, sameStart, sourceSite, startPrep, tileOf, withFacts, withMethod, type PrepDraft, type PrepKindId, type PrepPick, type PrepStartLines } from '@/lib/prepKinds';
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
  /** What goes in opens As measured (board Add-house, 2), not as parts. */
  measured?: boolean;
  /** A part (Add-parts, 3): a name that says nothing about how it's made starts with no lines, none guessed from its words. */
  blank?: boolean;
}

/** A new prep's first draft: the technique picked, else the kind its name says, else the technique that most likely makes it, else blank. */
function firstDraft(name: string, picked: PrepStart['picked'], technique: string | null | undefined, kit: ReadonlySet<string> | null, blank?: boolean): PrepDraft {
  const chosen = techniqueById(technique);
  if (chosen) return prepFromTechnique(chosen, name, prepCardFor(chosen), picked);
  const kind = guessKind(name);
  // A kind made one of the library's ways (a clarified juice) starts from the way its name points to, else the first the kit covers.
  const way = kind && !FROM_TECHNIQUE.includes(kind) ? null : (waysToMake(name)[0] ?? techniqueById(kind ? kitFirstWay(kind, kit)?.technique : null));
  if (way) return prepFromTechnique(way, name, prepCardFor(way), picked);
  const start = startPrep(kind ?? 'other', name);
  return blank && !kind ? { ...start, lines: [], baseKey: '' } : start;
}

/** The start a draft picked up again still has: its kind's (way's, technique's) for its name, or null when its lines were written. */
function startOf(d: PrepDraft, name: string, picked: PrepStart['picked']): PrepStartLines | null {
  const t = techniqueById(d.technique);
  const starts = [startPrep(d.kind, name, d.way), ...(t ? [prepFromTechnique(t, name, prepCardFor(t), picked)] : [])];
  // ponytail: a catalog recipe picked up again reads as written (its lines are kept on a kind change); the draft doesn't say which recipe it came from.
  return starts.find((s) => sameStart(d, s)) ?? null;
}

const nameKey = (s: string) => s.trim().toLowerCase();

/**
 * A house prep being written: its draft, started from the technique, the
 * name or the catalog's sourced recipe, and the kind and way picks. The
 * full-screen builder (PrepBuilder) and the card under a line on the
 * desktop page (PrepCard) both write it. `onSeeded` runs when the catalog's
 * recipe arrives, so the builder can move on to the recipe.
 */
export function usePrepDraft({ name: started, initial, picked, technique, combined, nameNow, bar = null, measured, blank }: PrepStart, onSeeded?: () => void) {
  const { kit } = useMakingKit(bar);
  const name = nameNow?.trim() || started;
  const [first] = useState(() => {
    const d = initial ?? firstDraft(started, picked, technique, kit, blank);
    return { d, start: initial ? startOf(initial, started, picked) : d };
  });
  const [draft, setDraftState] = useState<PrepDraft>(first.d);
  // What it last started from (a kind, a way, a technique, the catalog's recipe): lines still as it set them are its guess,
  // not the maker's, so another kind starts its own (review of #1183). Null for lines picked up already written.
  const [start, setStart] = useState<PrepStartLines | null>(first.start);
  // Amounts typed as they go in (make-anything-steps-2, step 5) for lines combined from the drink's own.
  const [view, setView] = useState<RecipeViewKind>(measured || combined || initial?.kind === 'batch' ? 'amounts' : 'parts');
  // Goes up when the draft starts over (a kind, a technique, the catalog's recipe): steps that keep their own rows remount.
  const [version, setVersion] = useState(0);
  // A name the catalog has a sourced recipe for starts from it, until the maker changes anything.
  const [touched, setTouched] = useState(false);
  // The draft as last set, for leaving straight after a level below put its recipe on a line (the trail's higher levels).
  const latest = useRef<PrepDraft | null>(null);
  // What it contains follows its lines: a line taken out takes its allergen with it (hand-set allergens stay).
  const setDraft = (d: PrepDraft) => {
    latest.current = d;
    setTouched(true);
    setDraftState(withFacts(d));
  };
  // The catalog's recipe it started from, while it still does, and where it was checked.
  const [seeded, setSeeded] = useState<{ id: string; checkedOn: string[] } | null>(null);
  /**
   * Starts it over from `from` (by default `d` itself; the start as it was
   * when lines are kept). A kind the name says (`byName`) is a guess, not a
   * change: the catalog's recipe for the name can still come.
   */
  const restart = (d: PrepDraft, byName = false, from: PrepStartLines | null = d) => {
    latest.current = d;
    if (!byName) setTouched(true);
    setDraftState(withFacts(d));
    setStart(from);
    setSeeded(null);
    setVersion(version + 1);
  };
  // The name as it's typed, once typing pauses: on its own page the name is typed there, not passed in (review of #1183).
  const asked = useDebounced(name, 300);
  const { data: catalog } = useCatalogRecipe(initial || technique ? null : asked);
  // Renamed since it opened: a recipe found for the name typed leaves the maker where they're typing.
  const [renamed, setRenamed] = useState(false);
  const isRenamed = renamed || nameKey(name) !== nameKey(started);
  if (isRenamed && !renamed) setRenamed(true);
  if (catalog && !touched && seeded?.id !== catalog.id && nameKey(asked) === nameKey(name)) {
    const d = prepFromCatalog(asked, catalog);
    setSeeded({ id: catalog.id, checkedOn: catalog.checkedOn });
    setDraftState(d);
    setStart(d);
    setVersion(version + 1);
    // A name passed in opens on its recipe.
    if (!isRenamed) onSeeded?.();
  }
  const fromCatalog = seeded ? `Started from the catalog recipe${seeded.checkedOn.length ? `, checked on ${seeded.checkedOn.map(sourceSite).join(' and ')}` : ''}. Change anything.` : undefined;
  // Lines the maker wrote, or combined: not still the start it was given.
  const wrote = () => !!combined || (draft.lines.length > 0 && !(start && sameStart(draft, start)));
  /**
   * A kind, or one of its ways. Another way of the same kind keeps what goes
   * in and takes the way's steps (a syrup sous vide is still sugar and water);
   * a new kind starts its own parts, except for lines the maker wrote or
   * combined. A wash, a clarified juice or a distillate starts from its
   * technique's parts: the way picked, else the first one the kit covers.
   * `typed` is the name as just typed, for a kind the name says before the
   * next render has it.
   */
  const pickKind = (kind: PrepKindId, wayId?: string, typed?: string) => {
    const as = typed?.trim() || name;
    const keep = wrote();
    const byName = typed !== undefined;
    const way = KIND_WAYS[kind]?.find((w) => w.id === wayId);
    // A way picked under the kind it is keeps it: a rich syrup made sous vide is still rich.
    const k = way?.kind ?? (way && tileOf(draft.kind) === kind ? draft.kind : kind);
    const t = way?.fills ? techniqueById(way.technique) : null;
    const method = (d: PrepDraft) => (t && way ? withMethod(d, t, { ...prepCardFor(t), steps: methodOf(t) }, way.id) : d);
    // Its own parts: a wash, a clarified juice, a distillate (the way picked, else the kit's first), or an oil or tincture.
    const ownWay = keep ? null : FROM_TECHNIQUE.includes(k) ? (way ?? kitFirstWay(k, kit)) : way?.own ? way : null;
    const own = ownWay ? techniqueById(ownWay.technique) : null;
    if (own) return restart(prepFromTechnique(own, as, prepCardFor(own), picked), byName);
    const fresh = startPrep(k, as, way?.id);
    // The same kind made another way: what goes in stays, unless it was an oil's or a tincture's own. A syrup's or a shrub's
    // ways fill no method from the library: only the way's steps and lead time change (review of #1183).
    if (way && draft.kind === k && !wayOf(draft)?.own) return restart(t ? method(draft) : { ...draft, way: fresh.way, hot: fresh.hot, steps: fresh.steps, leadMinutes: fresh.leadMinutes }, byName, start);
    // A part picked as Something else keeps its lines too: none are guessed from its name's words.
    const kept = keep || (blank && k === 'other');
    restart(method(kept ? keepLines(fresh, draft) : fresh), byName, kept ? start : undefined);
  };
  const pickTechnique = (id: string) => {
    const t = techniqueById(id);
    if (!t) return;
    const fresh = prepFromTechnique(t, name, prepCardFor(t), picked);
    if (wrote()) restart(keepLines(fresh, draft), false, start);
    else restart(fresh);
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
