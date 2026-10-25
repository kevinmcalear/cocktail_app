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
import { useVenueIce } from '@/hooks/useVenueIce';
import { suggestClassic } from '@/lib/classics';
import { stepWaits, versionHeading } from '@/lib/sameName';
import { plainDbMessage } from '@/lib/dbError';
import {
  canSave, choiceList, COMMON_GLASSES, COMMON_ICE, COMMON_METHODS, EMPTY_DRAFT, hasContent, samePick, savedNotice, sketchLook, STEP_COPY, WIZARD_STEPS,
  type WizardDraft, type WizardPick, type WizardStep,
} from '@/lib/drinkWizard';
import { draftSketchInputs } from '@/lib/sketch/draft';
import { iceWhy, serveGuess } from '@/lib/specDefaults';
import { toastDone } from '@/lib/toast';
import { venueIceKinds, venueIceNames } from '@/lib/venueKit';
import { draftSlot, useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';

import { CreditsStep } from './CreditsStep';
import { DrinkDesk } from './DrinkDesk';
import { GlassStep } from './GlassStep';
import { IngredientsStep } from './IngredientsStep';
import { FinishStep } from './FinishStep';
import { FoamerHint } from './FoamerHint';
import { MethodStep } from './MethodStep';
import { PublishStep } from './PublishStep';
import { ReviewStep } from './ReviewStep';
import { IceStep } from './IceStep';
import { NameStepBody } from './NameStepBody';
import { NotesStep } from './TextSteps';
import { ServeGuessCard } from './ServeGuessCard';
import { SketchHeader } from './SketchHeader';
import { useDrinkTrail } from './Trail';
import { useLineStock } from './StockToggle';
import { useClassicPreview, useStartFromClassic } from '@/hooks/useStartFromClassic';
import { WizardFooter } from './WizardChrome';
import { WizardFrame } from './WizardFrame';
import { RoundStrip } from '@/components/screens/firstRound/RoundElsewhere';
import { useFirstRound } from '@/hooks/useFirstRound';

export interface AddDrinkWizardProps {
  /** The venue it's added at; null or missing for a drink at home. */
  barId?: string | null;
  menuSectionId?: string | null;
  initialName?: string | null;
  /** "Riff on this" on a drink page: a fresh draft starts from that drink's spec, credited as a version of it. */
  startFrom?: string | null;
  /** The first round's "Make the Old Fashioned yours": straight to Review, with the round's strip. */
  firstRound?: boolean;
  /** Inside the desktop workspace: no safe-area padding. */
  embedded?: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}

const hydrated = (cb: () => void) => useDrinkWizardStore.persist.onFinishHydration(cb);
const isHydrated = () => useDrinkWizardStore.persist.hasHydrated();

/** Adding a drink, one step per screen, with its sketch drawn live at the top. Saved once, at the end. */
export function AddDrinkWizard(props: AddDrinkWizardProps) {
  // The kept draft loads from storage first, so nothing typed is lost to it.
  const ready = useSyncExternalStore(hydrated, isHydrated, () => true);
  return ready ? <Wizard {...props} /> : null;
}

function Wizard({ barId = null, menuSectionId, initialName, startFrom, firstRound, embedded, onClose, onSaved }: AddDrinkWizardProps) {
  const place = draftSlot(wizardPlace(barId), { menuSectionId, name: initialName, from: startFrom });
  const kept = useDrinkWizardStore((s) => s.kept[place]);
  const patch = useDrinkWizardStore((s) => s.patch);
  const setStoredStep = useDrinkWizardStore((s) => s.setStep);
  const clear = useDrinkWizardStore((s) => s.clear);
  useHoldUpdates();
  // Filled out with today's fields: a draft kept by an older version of the app may lack some.
  const draft: WizardDraft = { ...EMPTY_DRAFT, ...kept?.draft };
  const step: WizardStep = kept?.step ?? 'name';
  // On the web the page can draw before the kept draft has loaded (AsyncStorage is async there):
  // once it has, say it was picked up. Set while rendering, like any value derived from a change.
  const loaded = useSyncExternalStore(hydrated, isHydrated, () => false);
  const [seenLoad, setSeenLoad] = useState(loaded);
  const [resumed, setResumed] = useState(() => loaded && hasContent(draft));
  if (loaded && !seenLoad) {
    setSeenLoad(true);
    setResumed(hasContent(draft));
  }
  const [direction, setDirection] = useState<1 | -1>(1);
  const dropdowns = useDropdowns({ ingredients: true }).data;
  const me = useMyProfile().data ?? null;
  const create = useCreateDrink();
  const roundDone = useFirstRound().done;
  const barGlasses = useBarGlassware(barId).data;
  const venueIce = useVenueIce(barId).data ?? [];
  const barIce = venueIceNames(venueIce);
  const barIceKinds = venueIceKinds(venueIce);
  const barVariants = (barGlasses ?? []).filter((g) => g.is_default && g.variant).map((g) => g.variant as string);
  const shelfIds = useShelf().data;
  const venueName = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? 'the venue';
  // A desktop browser writes the drink on one page (DrinkDesk); the first round keeps its steps.
  const breakpoint = useBreakpoint();
  const desk = Platform.OS === 'web' && breakpoint === 'desktop' && !embedded && !firstRound;

  const set = (change: Partial<WizardDraft>) => patch(place, change);
  const at = WIZARD_STEPS.indexOf(step);
  const go = (to: WizardStep) => {
    setDirection(WIZARD_STEPS.indexOf(to) >= at ? 1 : -1);
    setStoredStep(place, to);
  };
  const back = () => (at > 0 ? go(WIZARD_STEPS[at - 1]) : onClose());
  const { trail, menu } = useDrinkTrail(draft.name, { menuSectionId, venueName: barId ? venueName : null, onClose });

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
        if (firstRound) setStoredStep(place, 'review');
      },
    });
  }, [startFrom, initialName, place, patch, startSpec, firstRound, setStoredStep]);

  const save = () =>
    create.mutate(
      { draft, barId, myProfileId: me?.id ?? null, menuSectionId, sketch: draftSketchInputs(sketchLook(draft, barVariants)) },
      {
        onSuccess: ({ id, warnings, later = [] }) => {
          clear(place);
          if (firstRound) roundDone('house_spec', id);
          toastDone('Drink saved', draft.name.trim());
          const notice = savedNotice(warnings, later);
          if (notice) Alert.alert(notice.title, notice.body);
          onSaved(id);
        },
        onError: (e) => Alert.alert('Couldn’t save the drink', `${plainDbMessage(e) ?? e.message} Your draft is kept on this device.`),
      }
    );
  const next = () => (step === 'review' ? save() : go(WIZARD_STEPS[at + 1]));
  const startOver = () => {
    clear(place);
    setResumed(false);
  };

  const ingredients = dropdowns?.ingredients ?? [];
  const tellUsAbout = { drinkName: draft.name, barId, barName: barId ? venueName : null, draftId: draft.id ?? null };
  const coreIds = new Set(dropdowns?.coreIngredientIds ?? []);
  const stock = useLineStock({ barId, venueName, drinkName: draft.name.trim(), ingredients, lines: draft.lines, pinned: !desk });
  const copy = STEP_COPY[step];
  const methods = choiceList(COMMON_METHODS, dropdowns?.methods ?? []);
  const glasses = choiceList(COMMON_GLASSES, dropdowns?.glassware ?? []);
  const ices = choiceList([...COMMON_ICE, ...barIce], dropdowns?.iceTypes ?? []);
  // How it's probably served, from the spec: offered on the method, glass and ice steps.
  const guess = serveGuess(sketchLook(draft, barVariants));
  const guessed = (name: string, options: WizardPick[]) => options.find((o) => samePick(o, { id: null, name })) ?? { id: null, name };
  const serveCard = !draft.methods.length && !draft.glass && !draft.ice && !!guess.method && !!guess.glass && !!guess.ice;
  const takeGuess = () => {
    if (!guess.method || !guess.glass || !guess.ice) return;
    set({ methods: [guessed(guess.method, methods)], glass: guessed(guess.glass, glasses), glassVariant: null, ice: guessed(guess.ice, ices) });
    go('garnish');
  };
  // A name that is a classic ("House Negroni") offers its spec, until there's one.
  const classics = useDrinkLists().data ?? [];
  const classic = (desk || step === 'name') && !draft.lines.length ? suggestClassic(draft.name, classics) : null;
  // Until its spec is used, the sketch already draws that classic (a Negroni's red).
  const preview = useClassicPreview(classic?.classic.id ?? null).data;
  const drawn = preview ? { ...draft, ...preview, name: draft.name } : draft;
  // The bar already has a drink by this name, or the bar it's credited to does (board dup-drink-warning): Next waits on a pick.
  const onBar = useSameNameDrink({ barId, name: draft.name });
  const onPlace = useSameNameDrink({ creditedTo: !barId || draft.elsewhere ? draft.place?.id : null, name: draft.name });
  const atBar = onBar.data ?? null;
  const atPlace = onPlace.data ?? null;
  // Still asking about the name as typed (a failed or offline ask doesn't hold anything up).
  const checking = !!onBar.checking || !!onPlace.checking;
  const waits = desk ? stepWaits('name', draft, atBar, null, checking) || stepWaits('credits', draft, null, atPlace) : stepWaits(step, draft, atBar, atPlace, checking);
  if (desk) {
    return (
      <DrinkDesk
        {...{ draft, drawn, set, barId, venueName, menuSectionId, ingredients, coreIds, methods, glasses, ices, guess, barGlasses, barVariants, barIce, barIceKinds, venueIce, classic, resumed, atBar, atPlace }}
        loading={!dropdowns?.ingredients}
        aliases={dropdowns?.ingredientAliases}
        shelf={barId ? undefined : new Set(shelfIds ?? [])}
        backBar={barId ? stock.backBar : undefined}
        stock={stock}
        onStartOver={startOver}
        saving={create.isPending}
        canSave={canSave(draft) && !waits}
        onSave={save}
        onClose={onClose}
      />
    );
  }

  const body = (() => {
    switch (step) {
      case 'name':
        return <NameStepBody {...{ draft, set, barId, venueName, classic, resumed }} match={atBar} onStartOver={startOver} onDone={() => canSave(draft) && !waits && next()} onStarted={() => go('ingredients')} />;
      case 'ingredients':
        return (
          <IngredientsStep
            draft={draft}
            set={set}
            ingredients={ingredients}
            loading={!dropdowns?.ingredients}
            aliases={dropdowns?.ingredientAliases}
            coreIds={coreIds}
            shelf={barId ? undefined : new Set(shelfIds ?? [])}
            backBar={barId ? stock.backBar : undefined} stock={stock}
            bar={barId ? { id: barId, name: venueName } : null} trail={trail}
          />
        );
      case 'method':
        return (
          <>
            {serveCard ? <ServeGuessCard guess={guess} onUse={takeGuess} /> : null}
            <MethodStep
              options={methods}
              selected={draft.methods}
              onChange={(methods) => set({ methods })}
              suggested={guess.method}
              why={serveCard ? null : guess.why}
              hint={<FoamerHint draft={draft} set={set} ingredients={ingredients} />}
              tellUs={tellUsAbout}
            />
          </>
        );
      case 'glass':
        return <GlassStep draft={draft} set={set} options={glasses} barId={barId} barGlasses={barGlasses} barVariants={barVariants} suggested={guess.glass} />;
      case 'ice':
        return <IceStep {...{ draft, set, ices, barIce, barGlasses, barVariants }} kit={venueIce} venueName={barId ? venueName : null} suggested={guess.ice} why={iceWhy(sketchLook(draft, barVariants))} tellUs={tellUsAbout} />;
      case 'garnish':
        return <FinishStep draft={draft} set={set} ingredients={ingredients} loading={!dropdowns?.ingredients} aliases={dropdowns?.ingredientAliases} coreIds={coreIds} />;
      case 'credits':
        return <CreditsStep draft={draft} set={set} venueName={barId ? venueName : null} ingredients={ingredients} match={atPlace} onRename={() => go('name')} />;
      case 'notes':
        return <NotesStep draft={draft} set={set} />;
      case 'publish':
        return <PublishStep draft={draft} set={set} barId={barId} />;
      case 'review':
        return (
          <>
            {firstRound ? <RoundStrip onSkip={onClose} /> : null}
            <ReviewStep draft={draft} set={set} onJump={go} barId={barId} venueName={venueName} hasProfile={!!me} barVariants={barVariants} barIce={barIceKinds} />
          </>
        );
    }
  })();

  const following = WIZARD_STEPS[at + 1];
  const heading = step === 'name' ? versionHeading(draft) : null;
  return (
    <WizardFrame
      testID="add-drink"
      pageTitle="Add a drink"
      embedded={embedded}
      band={(place) => <SketchHeader draft={drawn} step={step} onBack={back} barVariants={barVariants} barIce={barIceKinds} onTint={(tint) => set({ tint })} trail={trail} forMenu={menu} {...place} />}
      stepKey={step}
      direction={direction}
      // Naming a new drink it's "New drink"; a kept draft picked up again goes by its name.
      eyebrow={heading?.eyebrow ?? ((step !== 'name' || resumed ? draft.name.trim() : '') || 'New drink')}
      title={heading?.title ?? (firstRound && step === 'review' ? 'Make it yours' : copy.title)}
      intro={copy.intro}
      // Android's back button steps back through the wizard before leaving it.
      onHardwareBack={() => {
        if (at === 0) return false;
        back();
        return true;
      }}
      footer={
        <WizardFooter
          nextLabel={step === 'review' ? (create.isPending ? 'Saving…' : firstRound ? 'Save as our house spec' : 'Save drink') : `Next: ${STEP_COPY[following].short.toLowerCase()}`}
          optional={copy.optional && !waits}
          canNext={(step === 'name' || step === 'review' ? canSave(draft) : true) && !waits}
          saving={create.isPending}
          onSkip={next}
          onNext={next}
          notice={step === 'ingredients' ? stock.note : null}
        />
      }
    >
      {body}
    </WizardFrame>
  );
}
