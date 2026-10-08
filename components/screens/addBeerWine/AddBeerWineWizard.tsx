import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { useCreateBeerWine } from '@/hooks/useCreateBeerWine';
import { BEER_WINE_COPY, beerWineSketch, EMPTY_BEER_WINE, fullDescription, stepsFor, type BeerWineDraft, type BeerWineStep } from '@/lib/beerWineWizard';
import { plainDbMessage } from '@/lib/dbError';
import { DRINK_KINDS, type DrinkKind } from '@/lib/drinkKinds';
import { toastDone } from '@/lib/toast';
import { beerWinePlace, useBeerWineWizardStore } from '@/store/useBeerWineWizardStore';

import { PaperBand } from '../addDrink/PaperBand';
import { ReviewList } from '../addDrink/ReviewStep';
import { WizardFooter } from '../addDrink/WizardChrome';
import { WizardFrame } from '../addDrink/WizardFrame';
import { GlassStep, MakerStep, NotesStep, PriceStep, StrengthStep, StyleStep } from './BeerWineSteps';
import { NameStep } from './NameStep';

export interface AddBeerWineWizardProps {
  kind: DrinkKind;
  /** The venue it's added at; null or missing for one at home. */
  barId?: string | null;
  initialName?: string | null;
  /** Inside the desktop workspace: no safe-area padding. */
  embedded?: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}

const hydrated = (cb: () => void) => useBeerWineWizardStore.persist.onFinishHydration(cb);
const isHydrated = () => useBeerWineWizardStore.persist.hasHydrated();

/** Adding a beer or a wine, one step per screen, drawn in its glass as it's filled in. Saved once, at the end. */
export function AddBeerWineWizard(props: AddBeerWineWizardProps) {
  // The kept draft loads from storage first, so nothing typed is lost to it.
  const ready = useSyncExternalStore(hydrated, isHydrated, () => true);
  return ready ? <Wizard {...props} /> : null;
}

const filled = (d: BeerWineDraft) => !!(d.name.trim() || d.maker.trim() || d.style || d.abv || d.photo);

function Wizard({ kind, barId = null, initialName, embedded, onClose, onSaved }: AddBeerWineWizardProps) {
  const config = DRINK_KINDS[kind];
  const place = beerWinePlace(kind, barId);
  const kept = useBeerWineWizardStore((s) => s.kept[place]);
  const patch = useBeerWineWizardStore((s) => s.patch);
  const setStoredStep = useBeerWineWizardStore((s) => s.setStep);
  const clear = useBeerWineWizardStore((s) => s.clear);
  const draft: BeerWineDraft = { ...EMPTY_BEER_WINE, ...kept?.draft };
  const steps = stepsFor(!!barId);
  const stored = kept?.step ?? 'name';
  const step: BeerWineStep = steps.includes(stored) ? stored : 'name';
  const at = steps.indexOf(step);
  const copy = BEER_WINE_COPY[kind];
  const [resumed, setResumed] = useState(() => filled(draft));
  const [direction, setDirection] = useState<1 | -1>(1);
  const create = useCreateBeerWine();

  const set = (change: Partial<BeerWineDraft>) => patch(place, change);
  const go = (to: BeerWineStep) => {
    setDirection(steps.indexOf(to) >= at ? 1 : -1);
    setStoredStep(place, to);
  };
  const back = () => (at > 0 ? go(steps[at - 1]) : onClose());
  const canSave = draft.name.trim().length > 0;

  // A name passed in ("Add 'Pliny'" from search) starts a fresh draft.
  useEffect(() => {
    const kept = useBeerWineWizardStore.getState().kept[place]?.draft;
    if (initialName?.trim() && !(kept && filled(kept))) patch(place, { name: initialName.trim() });
  }, [initialName, place, patch]);

  const save = () =>
    create.mutate(
      { kind, draft, barId },
      {
        onSuccess: ({ id, warnings }) => {
          clear(place);
          toastDone(`${config.label} saved`, draft.name.trim());
          if (warnings.length) Alert.alert('Saved, with one thing to fix', warnings.join('\n\n'));
          onSaved(id);
        },
        onError: (e) => Alert.alert(`Couldn’t save the ${config.label.toLowerCase()}`, `${plainDbMessage(e) ?? e.message} Your draft is kept on this device.`),
      }
    );
  const next = () => (step === 'review' ? save() : go(steps[at + 1]));
  const props = { kind, draft, set, onDone: next };

  const body = (() => {
    switch (step) {
      case 'name':
        return (
          <NameStep
            {...props}
            onDone={() => canSave && next()}
            onFilled={() => go('review')}
            resumed={resumed}
            onStartOver={() => {
              clear(place);
              setResumed(false);
            }}
          />
        );
      case 'maker':
        return <MakerStep {...props} />;
      case 'style':
        return <StyleStep {...props} />;
      case 'strength':
        return <StrengthStep {...props} />;
      case 'glass':
        return <GlassStep {...props} />;
      case 'notes':
        return <NotesStep {...props} />;
      case 'price':
        return <PriceStep {...props} />;
      case 'review': {
        const value: Record<BeerWineStep, string> = {
          name: draft.name.trim(),
          maker: draft.maker.trim(),
          style: [draft.style, draft.region].filter(Boolean).join(', '),
          strength: draft.abv ? `${draft.abv}% ABV` : '',
          glass: '',
          notes: fullDescription(draft),
          price: draft.price,
          review: '',
        };
        return (
          <ReviewList
            rows={steps.filter((s) => s !== 'review' && s !== 'glass').map((s) => ({ key: s, label: copy[s].short, value: value[s] }))}
            onJump={(s) => go(s as BeerWineStep)}
            after={draft.photo ? 'Its photo is saved with it.' : 'You can add photos on its page.'}
          />
        );
      }
    }
  })();

  const inputs = beerWineSketch(kind, draft);
  const following = steps[at + 1];
  return (
    <WizardFrame
      testID={`add-${kind}`}
      pageTitle={`Add a ${kind}`}
      embedded={embedded}
      band={(p) => (
        <PaperBand
          {...p}
          first={at === 0}
          onBack={back}
          progress={{ now: Math.min(at + 1, steps.length - 1), of: steps.length - 1, label: step === 'review' ? 'Review' : `${at + 1} of ${steps.length - 1}` }}
          art={<SketchDrawing inputs={inputs} seed={kind} detail="full" />}
          artKey={JSON.stringify(inputs)}
          artLabel={`Sketch of the ${kind}`}
        />
      )}
      stepKey={step}
      direction={direction}
      eyebrow={draft.name.trim() || `New ${kind}`}
      title={copy[step].title}
      intro={copy[step].intro}
      onHardwareBack={() => {
        if (at === 0) return false;
        back();
        return true;
      }}
      footer={
        <WizardFooter
          nextLabel={step === 'review' ? (create.isPending ? 'Saving…' : `Save ${kind}`) : `Next: ${copy[following].short.toLowerCase()}`}
          optional={copy[step].optional}
          canNext={step === 'name' || step === 'review' ? canSave : true}
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
