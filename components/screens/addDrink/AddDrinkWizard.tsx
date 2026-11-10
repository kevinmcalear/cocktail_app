import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';

import { useBreakpoint } from '@/components/ds';
import { useBarGlassware } from '@/hooks/useBarGlassware';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCreateDrink } from '@/hooks/useCreateDrink';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useShelf } from '@/hooks/useHomeBar';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useHoldUpdates } from '@/hooks/useOtaUpdates';
import { useSameNameDrink } from '@/hooks/useSameNameDrink';
import { linesOnKeptHouseMades } from '@/hooks/specLineSave';
import { useVenueIce } from '@/hooks/useVenueIce';
import { suggestClassic } from '@/lib/classics';
import { stepWaits } from '@/lib/sameName';
import { plainDbMessage } from '@/lib/dbError';
import { canSave, choiceList, COMMON_GLASSES, COMMON_ICE, COMMON_METHODS, EMPTY_DRAFT, hasContent, savedNotice, sketchLook, withMethodIce, type WizardDraft } from '@/lib/drinkWizard';
import { draftSketchInputs } from '@/lib/sketch/draft';
import { serveGuess } from '@/lib/specDefaults';
import { toastDone } from '@/lib/toast';
import { venueIceKinds, venueIceNames } from '@/lib/venueKit';
import { draftSlot, useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';

import { DraftPage } from './DraftPage';
import { DrinkDesk } from './DrinkDesk';
import { useLineStock } from './StockToggle';
import { useClassicPreview, useStartFromClassic } from '@/hooks/useStartFromClassic';
import { RoundStrip } from '@/components/screens/firstRound/RoundElsewhere';
import { useFirstRound } from '@/hooks/useFirstRound';

export interface AddDrinkWizardProps {
  /** The venue it's added at; null or missing for a drink at home. */
  barId?: string | null;
  menuSectionId?: string | null;
  initialName?: string | null;
  /** "Riff on this" on a drink page: a fresh draft starts from that drink's spec, credited as a version of it. */
  startFrom?: string | null;
  /** The first round's "Add your first cocktail": from a classic straight to Review, or from scratch at the name, with the round's strip. */
  firstRound?: boolean;
  /** Opened from an import's Edit this drink: the draft is the import, not one left off, so no "Picked up where you left off". `review` ("<review id>#<drink>") is its own slot, never the plain New drink. */
  imported?: boolean;
  review?: string | null;
  /** Inside the desktop workspace: no safe-area padding. */
  embedded?: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}

const hydrated = (cb: () => void) => useDrinkWizardStore.persist.onFinishHydration(cb);
const isHydrated = () => useDrinkWizardStore.persist.hasHydrated();

/** Adding a drink: the draft page in pencil (DraftPage), or DrinkDesk on a desktop browser. Kept on the device as it's written, saved once, with Save. */
export function AddDrinkWizard(props: AddDrinkWizardProps) {
  // The kept draft loads from storage first, so nothing typed is lost to it.
  const ready = useSyncExternalStore(hydrated, isHydrated, () => true);
  return ready ? <Wizard {...props} /> : null;
}

function Wizard({ barId = null, menuSectionId, initialName, startFrom, firstRound, imported, review, embedded, onClose, onSaved }: AddDrinkWizardProps) {
  const place = draftSlot(wizardPlace(barId), { menuSectionId, name: initialName, from: startFrom, review });
  const kept = useDrinkWizardStore((s) => s.kept[place]);
  const patch = useDrinkWizardStore((s) => s.patch);
  useHoldUpdates();
  const venueIce = useVenueIce(barId).data ?? [];
  const barIce = venueIceNames(venueIce);
  // Filled out with today's fields (a draft kept by an older version of the app may lack some), and what it's shaken with until picked.
  const draft: WizardDraft = withMethodIce({ ...EMPTY_DRAFT, ...kept?.draft }, barIce);
  // On the web the page can draw before the kept draft loads (AsyncStorage is async there): once it has, say it was picked up. Set while rendering, like any value derived from a change.
  const loaded = useSyncExternalStore(hydrated, isHydrated, () => false);
  const [seenLoad, setSeenLoad] = useState(loaded);
  const [resumed, setResumed] = useState(() => loaded && hasContent(draft) && !imported);
  if (loaded && !seenLoad) {
    setSeenLoad(true);
    setResumed(hasContent(draft) && !imported);
  }
  const dropdowns = useDropdowns({ ingredients: true }).data;
  const me = useMyProfile().data ?? null;
  const create = useCreateDrink();
  const roundDone = useFirstRound().done;
  const barGlasses = useBarGlassware(barId).data;
  const barIceKinds = venueIceKinds(venueIce);
  const barVariants = (barGlasses ?? []).filter((g) => g.is_default && g.variant).map((g) => g.variant as string);
  const shelfIds = useShelf().data;
  const venueName = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? 'the venue';
  // A desktop browser writes the drink beside its phone preview (DrinkDesk); everywhere else, the draft page.
  const breakpoint = useBreakpoint();
  const desk = Platform.OS === 'web' && breakpoint === 'desktop' && !embedded && !firstRound;

  const set = (change: Partial<WizardDraft>) => patch(place, change);

  // A name passed in ("Make 'Paloma'" from search) names its own fresh draft. With a drink to start from, it names that draft (below).
  useEffect(() => {
    const kept = useDrinkWizardStore.getState().kept[place]?.draft;
    if (!startFrom && initialName?.trim() && !(kept && hasContent(kept))) patch(place, { name: initialName.trim() });
  }, [initialName, startFrom, place, patch]);

  // Riff on this: the drink's spec fills a fresh draft; one already in progress is never overwritten.
  const { mutate: startSpec } = useStartFromClassic();
  useEffect(() => {
    const kept = useDrinkWizardStore.getState().kept[place]?.draft;
    if (!startFrom || (kept && hasContent(kept))) return;
    startSpec(startFrom, {
      onSuccess: (change) => {
        patch(place, initialName?.trim() ? { ...change, name: initialName.trim() } : change);
      },
    });
  }, [startFrom, initialName, place, patch, startSpec]);

  const save = () => {
    // As it is now, not as this render had it: a house-made's check finishes its line just before it saves the drink (Add-inside).
    const now: WizardDraft = withMethodIce({ ...EMPTY_DRAFT, ...useDrinkWizardStore.getState().kept[place]?.draft }, barIce);
    create.mutate(
      { draft: now, barId, myProfileId: me?.id ?? null, menuSectionId, sketch: draftSketchInputs(sketchLook(now, barVariants)) },
      {
        onSuccess: ({ id, warnings, later = [] }) => {
          useDrinkWizardStore.getState().clear(place);
          if (firstRound) roundDone('house_spec', id);
          toastDone('Drink saved', now.name.trim());
          const notice = savedNotice(warnings, later);
          if (notice) Alert.alert(notice.title, notice.body);
          onSaved(id);
        },
        onError: (e) => {
          // House-mades the save left saved (a dropped connection): the lines use them now, so trying again isn't refused by their names.
          const on = linesOnKeptHouseMades(e, now);
          if (on) patch(place, on);
          Alert.alert('Couldn’t save the drink', `${plainDbMessage(e) ?? e.message} Your draft is kept on this device.`);
        },
      }
    );
  };
  const startOver = () => {
    useDrinkWizardStore.getState().restart(place);
    setResumed(false);
  };

  const ingredients = dropdowns?.ingredients ?? [];
  const coreIds = new Set(dropdowns?.coreIngredientIds ?? []);
  const stock = useLineStock({ barId, venueName, drinkName: draft.name.trim(), ingredients, lines: draft.lines });
  const methods = choiceList(COMMON_METHODS, dropdowns?.methods ?? []);
  const glasses = choiceList(COMMON_GLASSES, dropdowns?.glassware ?? []);
  const ices = choiceList([...COMMON_ICE, ...barIce], dropdowns?.iceTypes ?? []);
  // How it's probably served, from the spec: offered on the method, glass and ice steps.
  const guess = serveGuess(sketchLook(draft, barVariants));
  // A name that is a classic ("House Negroni") offers its spec, until there's one.
  const classics = useDrinkLists().data ?? [];
  const classic = !draft.lines.length ? suggestClassic(draft.name, classics) : null;
  // Until its spec is used, the sketch already draws that classic (a Negroni's red).
  const preview = useClassicPreview(classic?.classic.id ?? null).data;
  const drawn = preview ? { ...draft, ...preview, name: draft.name } : draft;
  // The bar already has a drink by this name (at home, you do: Q14b), or the bar it's credited to does (board dup-drink-warning): Next waits on a pick.
  const onBar = useSameNameDrink({ barId, mine: !barId, name: draft.name });
  const onPlace = useSameNameDrink({ creditedTo: !barId || draft.elsewhere ? draft.place?.id : null, name: draft.name });
  const atBar = onBar.data ?? null;
  const atPlace = onPlace.data ?? null;
  // Still asking about the name as typed (a failed or offline ask doesn't hold anything up).
  const checking = !!onBar.checking || !!onPlace.checking;
  const waits = stepWaits('name', draft, atBar, null, checking) || stepWaits('credits', draft, null, atPlace);
  const page = {
    ...{ draft, drawn, set, barId, venueName, menuSectionId, ingredients, coreIds, methods, glasses, ices, guess, barGlasses, barVariants, barIce, barIceKinds, venueIce, classic, resumed, atBar, atPlace },
    loading: !dropdowns?.ingredients,
    aliases: dropdowns?.ingredientAliases,
    shelf: barId ? undefined : new Set(shelfIds ?? []),
    backBar: barId ? stock.backBar : undefined,
    stock,
    onStartOver: startOver,
    saving: create.isPending,
    canSave: canSave(draft) && !waits,
    onSave: save,
    onClose,
  };
  if (desk) return <DrinkDesk {...page} />;
  // The first round's strip, with its Skip, over the name.
  return <DraftPage {...page} lead={firstRound ? <RoundStrip scratch={!startFrom} onSkip={onClose} /> : null} />;
}
