import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

import { useBarGlassware } from '@/hooks/useBarGlassware';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCreateDrink } from '@/hooks/useCreateDrink';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useShelf } from '@/hooks/useHomeBar';
import { useMyProfile } from '@/hooks/useMyProfile';
import { suggestClassic } from '@/lib/classics';
import { plainDbMessage } from '@/lib/dbError';
import {
  canSave, choiceList, COMMON_GLASSES, COMMON_ICE, COMMON_METHODS, EMPTY_DRAFT, hasContent, samePick, sketchLook, STEP_COPY, WIZARD_STEPS,
  type WizardDraft, type WizardPick, type WizardStep,
} from '@/lib/drinkWizard';
import { draftSketchInputs } from '@/lib/sketch/draft';
import { iceWhy, serveGuess } from '@/lib/specDefaults';
import { toastDone } from '@/lib/toast';
import { useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';

import { CreditsStep } from './CreditsStep';
import { GlassStep } from './GlassStep';
import { IngredientsStep } from './IngredientsStep';
import { FinishStep } from './FinishStep';
import { FoamerHint } from './FoamerHint';
import { MethodStep } from './MethodStep';
import { PickStep } from './PickStep';
import { PublishStep } from './PublishStep';
import { ReviewStep } from './ReviewStep';
import { NameStep, NotesStep } from './TextSteps';
import { ServeGuessCard } from './ServeGuessCard';
import { SketchHeader } from './SketchHeader';
import { StartFromClassic } from './StartFromClassic';
import { useStartFromClassic } from '@/hooks/useStartFromClassic';
import { WizardFooter } from './WizardChrome';
import { WizardFrame } from './WizardFrame';

export interface AddDrinkWizardProps {
  /** The venue it's added at; null or missing for a drink at home. */
  barId?: string | null;
  menuSectionId?: string | null;
  initialName?: string | null;
  /** "Riff on this" on a drink page: a fresh draft starts from that drink's spec, credited as a version of it. */
  startFrom?: string | null;
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

function Wizard({ barId = null, menuSectionId, initialName, startFrom, embedded, onClose, onSaved }: AddDrinkWizardProps) {
  const place = wizardPlace(barId);
  const kept = useDrinkWizardStore((s) => s.kept[place]);
  const patch = useDrinkWizardStore((s) => s.patch);
  const setStoredStep = useDrinkWizardStore((s) => s.setStep);
  const clear = useDrinkWizardStore((s) => s.clear);
  // Filled out with today's fields: a draft kept by an older version of the app may lack some.
  const draft: WizardDraft = { ...EMPTY_DRAFT, ...kept?.draft };
  const step: WizardStep = kept?.step ?? 'name';
  const [resumed, setResumed] = useState(() => hasContent(draft));
  const [direction, setDirection] = useState<1 | -1>(1);
  const dropdowns = useDropdowns({ ingredients: true }).data;
  const me = useMyProfile().data ?? null;
  const create = useCreateDrink();
  const barGlasses = useBarGlassware(barId).data;
  const barVariants = (barGlasses ?? []).filter((g) => g.is_default && g.variant).map((g) => g.variant as string);
  const shelfIds = useShelf().data;
  const venueName = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? 'the venue';

  const set = (change: Partial<WizardDraft>) => patch(place, change);
  const at = WIZARD_STEPS.indexOf(step);
  const go = (to: WizardStep) => {
    setDirection(WIZARD_STEPS.indexOf(to) >= at ? 1 : -1);
    setStoredStep(place, to);
  };
  const back = () => (at > 0 ? go(WIZARD_STEPS[at - 1]) : onClose());

  // A name passed in ("Add 'Paloma'" from search) starts a fresh draft.
  useEffect(() => {
    const kept = useDrinkWizardStore.getState().kept[place]?.draft;
    if (initialName?.trim() && !(kept && hasContent(kept))) patch(place, { name: initialName.trim() });
  }, [initialName, place, patch]);

  // Riff on this: the drink's spec fills a fresh draft; one already in progress is never overwritten.
  const startFromSpec = useStartFromClassic();
  const startSpec = startFromSpec.mutate;
  useEffect(() => {
    const kept = useDrinkWizardStore.getState().kept[place]?.draft;
    if (!startFrom || (kept && hasContent(kept))) return;
    startSpec(startFrom, { onSuccess: (change) => patch(place, change) });
  }, [startFrom, place, patch, startSpec]);

  const save = () =>
    create.mutate(
      { draft, barId, myProfileId: me?.id ?? null, menuSectionId, sketch: draftSketchInputs(sketchLook(draft, barVariants)) },
      {
        onSuccess: ({ id, warnings, later = [] }) => {
          clear(place);
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
  const ices = choiceList(COMMON_ICE, dropdowns?.iceTypes ?? []);
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
  const classic = step === 'name' && !draft.lines.length ? suggestClassic(draft.name, classics) : null;
  const body = (() => {
    switch (step) {
      case 'name':
        return (
          <>
            <NameStep draft={draft} set={set} onDone={() => canSave(draft) && next()} resumed={resumed} onStartOver={startOver} />
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
        return <GlassStep draft={draft} set={set} options={glasses} barGlasses={barGlasses} barVariants={barVariants} suggested={guess.glass} />;
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
        return <ReviewStep draft={draft} set={set} onJump={go} barId={barId} venueName={venueName} hasProfile={!!me} barVariants={barVariants} />;
    }
  })();

  const following = WIZARD_STEPS[at + 1];
  return (
    <WizardFrame
      testID="add-drink"
      pageTitle="Add a drink"
      embedded={embedded}
      band={(place) => <SketchHeader draft={draft} step={step} onBack={back} barVariants={barVariants} {...place} />}
      stepKey={step}
      direction={direction}
      eyebrow={draft.name.trim() || 'New drink'}
      title={copy.title}
      intro={copy.intro}
      // Android's back button steps back through the wizard before leaving it.
      onHardwareBack={() => {
        if (at === 0) return false;
        back();
        return true;
      }}
      footer={
        <WizardFooter
          nextLabel={step === 'review' ? (create.isPending ? 'Saving…' : 'Save drink') : `Next: ${STEP_COPY[following].short.toLowerCase()}`}
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
