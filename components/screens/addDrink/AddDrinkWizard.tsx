import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';

import { useBreakpoint } from '@/components/ds';

import { useBarGlassware } from '@/hooks/useBarGlassware';
import { useBarKit } from '@/hooks/useBarKit';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCreateDrink } from '@/hooks/useCreateDrink';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useShelf } from '@/hooks/useHomeBar';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useHoldUpdates } from '@/hooks/useOtaUpdates';
import { suggestClassic } from '@/lib/classics';
import { plainDbMessage } from '@/lib/dbError';
import {
  canSave, choiceList, COMMON_GLASSES, COMMON_ICE, COMMON_METHODS, EMPTY_DRAFT, hasContent, samePick, sketchLook, STEP_COPY, WIZARD_STEPS,
  type WizardDraft, type WizardPick, type WizardStep,
} from '@/lib/drinkWizard';
import { draftSketchInputs } from '@/lib/sketch/draft';
import { iceWhy, serveGuess } from '@/lib/specDefaults';
import { toastDone } from '@/lib/toast';
import { isVenueIce, venueIceNames } from '@/lib/venueKit';
import { useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';

import { CreditsStep } from './CreditsStep';
import { DrinkDesk } from './DrinkDesk';
import { GlassStep } from './GlassStep';
import { IngredientsStep } from './IngredientsStep';
import { FinishStep } from './FinishStep';
import { FoamerHint } from './FoamerHint';
import { MethodStep } from './MethodStep';
import { PickStep } from './PickStep';
import { PublishStep } from './PublishStep';
import { ReviewStep } from './ReviewStep';
import { StartPhotos } from './ReviewPhotos';
import { NameStep, NotesStep } from './TextSteps';
import { ServeGuessCard } from './ServeGuessCard';
import { SketchHeader } from './SketchHeader';
import { StartFromClassic } from './StartFromClassic';
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
  const place = wizardPlace(barId);
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
  const barKit = useBarKit(barId).data ?? [];
  const barIce = venueIceNames(barKit);
  const barIceKinds = barKit.filter((r) => r.kind === 'ice').map((r) => r.key);
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

  // A name passed in ("Add 'Paloma'" from search) starts a fresh draft. With a drink to start from, it names that draft (below).
  useEffect(() => {
    const kept = useDrinkWizardStore.getState().kept[place]?.draft;
    if (!startFrom && initialName?.trim() && !(kept && hasContent(kept))) patch(place, { name: initialName.trim() });
  }, [initialName, startFrom, place, patch]);

  // Riff on this: the drink's spec fills a fresh draft; one already in progress is never overwritten.
  const startFromSpec = useStartFromClassic();
  const startSpec = startFromSpec.mutate;
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
          // The reminder "Just add the name" promised: the preps whose recipes are still to write.
          const one = later.length === 1;
          const remind = later.length ? `${later.join(', ')} ${one ? 'has' : 'have'} no recipe yet. Write ${one ? 'it on its page' : 'them on their pages'} when you’re ready.` : null;
          if (warnings.length || remind) Alert.alert(warnings.length ? 'Saved, with one thing to fix' : 'A recipe to write', [...warnings, ...(remind ? [remind] : [])].join('\n\n'));
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
  const coreIds = new Set(dropdowns?.coreIngredientIds ?? []);
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
  if (desk) {
    return (
      <DrinkDesk
        {...{ draft, drawn, set, barId, venueName, menuSectionId, ingredients, coreIds, methods, glasses, ices, guess, barGlasses, barVariants, barIce, barIceKinds, classic, resumed }}
        loading={!dropdowns?.ingredients}
        aliases={dropdowns?.ingredientAliases}
        shelf={barId ? undefined : new Set(shelfIds ?? [])}
        onStartOver={startOver}
        saving={create.isPending}
        canSave={canSave(draft)}
        onSave={save}
        onClose={onClose}
      />
    );
  }

  const body = (() => {
    switch (step) {
      case 'name':
        return (
          <>
            <NameStep draft={draft} set={set} onDone={() => canSave(draft) && next()} resumed={resumed} onStartOver={startOver} />
            <StartPhotos photos={draft.photos ?? {}} onChange={(photos) => set({ photos })} barId={barId} />
            {classic ? <StartFromClassic set={set} match={classic} onStarted={() => go('ingredients')} /> : null}
          </>
        );
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
            />
          </>
        );
      case 'glass':
        return <GlassStep draft={draft} set={set} options={glasses} barId={barId} barGlasses={barGlasses} barVariants={barVariants} suggested={guess.glass} />;
      case 'ice':
        return (
          <PickStep
            label="Ice"
            ownLabel="Other ice"
            options={ices}
            selected={draft.ice ? [draft.ice] : []}
            onChange={([ice]) => set({ ice: ice ?? null })}
            suggested={guess.ice}
            why={iceWhy(sketchLook(draft, barVariants))}
            mine={barIce.length ? { has: (p) => isVenueIce(barIce, p.name), label: 'Your ice', restLabel: 'Other ice' } : undefined}
          />
        );
      case 'garnish':
        return <FinishStep draft={draft} set={set} ingredients={ingredients} loading={!dropdowns?.ingredients} aliases={dropdowns?.ingredientAliases} coreIds={coreIds} />;
      case 'credits':
        return <CreditsStep draft={draft} set={set} venueName={barId ? venueName : null} ingredients={ingredients} />;
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
  return (
    <WizardFrame
      testID="add-drink"
      pageTitle="Add a drink"
      embedded={embedded}
      band={(place) => <SketchHeader draft={drawn} step={step} onBack={back} barVariants={barVariants} barIce={barIceKinds} {...place} />}
      stepKey={step}
      direction={direction}
      // Naming a new drink it's "New drink"; a kept draft picked up again goes by its name.
      eyebrow={(step !== 'name' || resumed ? draft.name.trim() : '') || 'New drink'}
      title={firstRound && step === 'review' ? 'Make it yours' : copy.title}
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
          optional={copy.optional}
          canNext={step === 'name' || step === 'review' ? canSave(draft) : true}
          saving={create.isPending}
          onSkip={next}
          onNext={next}
        />
      }
    >
      {body}
    </WizardFrame>
  );
}
