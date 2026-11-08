import { useNetInfo } from '@react-native-community/netinfo';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, Keyboard, StyleSheet, View } from 'react-native';

import { Caption, useDs, useToast } from '@/components/ds';
import { ListGroup, ListRow } from '@/components/ds/ListGroup';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, STATUS } from '@/constants/tokens';
import { useBeerWineWaiting, useCreateBeerWine } from '@/hooks/useCreateBeerWine';
import { useSameNameDrink } from '@/hooks/useSameNameDrink';
import { BEER_WINE_COPY, drawnSoFar, EMPTY_BEER_WINE, filledBeerWine, fullDescription, stepEyebrow, stepsFor, takenWords, type BeerWineDraft, type BeerWineStep } from '@/lib/beerWineWizard';
import { readableAccent } from '@/lib/color';
import { plainDbMessage } from '@/lib/dbError';
import { DRINK_KINDS, type DrinkKind } from '@/lib/drinkKinds';
import { nameKey, sameName } from '@/lib/sameName';
import { beerWinePlace, useBeerWineWizardStore } from '@/store/useBeerWineWizardStore';

import { Prompt } from '../addDrink/Prompt';
import { LeaveCard } from '../addDrink/prep/LeaveCard';
import { WizardFooter } from '../addDrink/WizardChrome';
import { WizardFrame } from '../addDrink/WizardFrame';
import { BeerWineBand } from './BeerWineBand';
import { GlassStep, MakerStep, NotesStep, PriceStep, StrengthStep, StyleStep } from './BeerWineSteps';
import { NameStep } from './NameStep';

export interface AddBeerWineWizardProps {
  kind: DrinkKind;
  /** The venue it's added at; null or missing for one at home. */
  barId?: string | null;
  initialName?: string | null;
  /** Inside the web's dialog or the desktop workspace: no safe-area padding. */
  embedded?: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
  /** The web's dialog closes through it (Escape, its scrim), asking Leave it for now like the X. */
  closeRef?: { current: (() => void) | null };
}

const hydrated = (cb: () => void) => useBeerWineWizardStore.persist.onFinishHydration(cb);
const isHydrated = () => useBeerWineWizardStore.persist.hasHydrated();

/** Adding a beer or a wine, one step per screen, drawn in its glass as it's filled in. Saved once, at the end. */
export function AddBeerWineWizard(props: AddBeerWineWizardProps) {
  // The kept draft loads from storage first, so nothing typed is lost to it.
  const ready = useSyncExternalStore(hydrated, isHydrated, () => true);
  return ready ? <Wizard {...props} /> : null;
}

/**
 * Boards Add-beer, Add-wine and Add-beerwine-notes: one question a screen,
 * the main button alone in the footer (Kevin, 8 Nov: no Later), the name
 * checked against what's already here, and Save on this phone when offline.
 */
function Wizard({ kind, barId = null, initialName, embedded, onClose, onSaved, closeRef }: AddBeerWineWizardProps) {
  const ds = useDs();
  const router = useRouter();
  const toast = useToast();
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
  const [direction, setDirection] = useState<1 | -1>(1);
  const [leaving, setLeaving] = useState(false);
  const create = useCreateBeerWine();
  const offline = useNetInfo().isConnected === false;
  const set = (change: Partial<BeerWineDraft>) => patch(place, change);

  // A save from here still waiting for signal: not a second time.
  const waiting = useBeerWineWaiting(place);

  // Already on the list (or your shelf at home) by this name, unless "It's a different one" was said for it.
  // Checked against the name as it is now, so the last name's answer doesn't linger while the new one is asked.
  const same = useSameNameDrink({ barId, mine: !barId, name: draft.name, kind });
  const taken = same.data && sameName(same.data.name, draft.name) && draft.differentFrom !== nameKey(draft.name) ? same.data : null;
  // A draft that is only this name has nothing worth keeping once the one that exists is open.
  const onlyName = JSON.stringify({ ...draft, name: '', differentFrom: null }) === JSON.stringify({ ...EMPTY_BEER_WINE, differentFrom: null });
  const openIt = () => {
    if (taken) {
      if (onlyName) clear(place);
      router.replace(`/${kind}/${taken.id}` as Href);
    }
  };
  const takenCard = taken ? (
    <Prompt
      warn
      icon="exclamationmark.triangle"
      {...takenWords(taken.name, !!barId, taken.savedAt, taken.menu)}
      actions={[
        { label: 'Open it', onPress: openIt, accessibilityLabel: `Open ${taken.name}${onlyName ? '' : '. Your draft is kept'}` },
        { label: 'It’s a different one', onPress: () => set({ differentFrom: nameKey(draft.name) }) },
      ]}
    />
  ) : null;

  const go = (to: BeerWineStep) => {
    setDirection(steps.indexOf(to) >= at ? 1 : -1);
    setStoredStep(place, to);
  };
  const close = () => {
    // Escape on the web dialog comes here again: it answers Keep going.
    if (leaving) return setLeaving(false);
    if (!filledBeerWine(draft)) return onClose();
    // The card sits at the bottom: on a phone the keyboard would hide it.
    Keyboard.dismiss();
    setLeaving(true);
  };
  useEffect(() => {
    if (closeRef) closeRef.current = close;
  });
  const named = draft.name.trim().length > 0 && !taken;

  // A name passed in ("Add 'Pliny'" from search) starts a fresh draft.
  useEffect(() => {
    const kept = useBeerWineWizardStore.getState().kept[place]?.draft;
    if (initialName?.trim() && !(kept && filledBeerWine(kept))) patch(place, { name: initialName.trim() });
  }, [initialName, place, patch]);

  const save = () => {
    // Offline it waits for signal (hooks/useCreateBeerWine) and the draft stays on the phone until it's in.
    const queued = offline;
    create.mutate(
      { kind, draft, barId, queued },
      {
        onSuccess: ({ id, warnings }) => {
          if (queued) return;
          // Menus are a bar's; at home the toast just says it's saved.
          toast.show(barId ? { title: `${config.label} saved`, detail: 'Add it to a menu from its page.', action: { label: 'Add to a menu', onPress: () => router.push('/menus' as Href) } } : { title: `${config.label} saved` });
          if (warnings.length) Alert.alert('Saved, with one thing to fix', warnings.join('\n\n'));
          onSaved(id);
        },
        onError: (e) => Alert.alert(`Couldn’t save the ${config.label.toLowerCase()}`, `${plainDbMessage(e) ?? e.message} Your draft is kept on this device.`),
      }
    );
    if (queued) {
      toast.show({ title: 'Kept on this phone', detail: `${draft.name.trim()} saves when you’re back.` });
      onClose();
    }
  };
  const next = () => (step === 'review' ? save() : go(steps[at + 1]));
  const props = { kind, draft, set, onDone: next };

  const body = (() => {
    switch (step) {
      case 'name':
        return <NameStep {...props} onDone={() => named && next()} onFilled={() => go('review')} taken={takenCard} />;
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
          style: draft.style ?? '',
          strength: draft.abv ? `${draft.abv}%` : '',
          glass: '',
          // A row's value is a few words (Add-beer: "Crisp, Bitter"); a catalog's paragraph is cut short.
          notes: draft.tasting.length ? draft.tasting.join(', ') : clip(fullDescription(draft)),
          price: draft.price.trim(),
          review: '',
        };
        const rows = steps.filter((s) => s !== 'review' && s !== 'glass');
        return (
          <View style={styles.review}>
            {/* Above the rows: with the name taken, Save is off and the reason must be in view. */}
            {takenCard}
            <ListGroup>
              {rows.map((s, i) => (
                <ListRow key={s} first={i === 0} title={copy[s].short} value={value[s] || 'Add'} warn={!value[s]} onPress={() => go(s)} />
              ))}
            </ListGroup>
            <View style={[styles.photoNote, { backgroundColor: ds.c.raised }]}>
              <IconSymbol name="camera.fill" size={16} color={ds.c.ink} />
              <Caption style={styles.flex}>{draft.photo ? 'Its photo is saved with it.' : 'You can add photos on its page.'}</Caption>
            </View>
          </View>
        );
      }
    }
  })();

  const label = step === 'review' ? (waiting && !create.isPending ? 'Saves when you’re back' : create.isPending ? 'Saving…' : offline ? 'Save on this phone' : `Save ${kind}`) : `Next: ${copy[steps[at + 1]].short.toLowerCase()}`;
  const inputs = drawnSoFar(kind, draft);
  return (
    <View style={styles.flex}>
      <WizardFrame
        testID={`add-${kind}`}
        pageTitle={`Add a ${kind}`}
        embedded={embedded}
        overNav
        band={(p) => <BeerWineBand place={p} title={config.label} inputs={inputs} seed={kind} onClose={close} onBack={at > 0 ? () => go(steps[at - 1]) : undefined} />}
        stepKey={step}
        direction={direction}
        eyebrow={stepEyebrow(kind, step, steps)}
        title={copy[step].title}
        intro={copy[step].intro}
        onHardwareBack={() => {
          if (leaving) setLeaving(false);
          else if (at > 0) go(steps[at - 1]);
          else close();
          return true;
        }}
        footer={
          <WizardFooter
            nextLabel={label}
            optional={false}
            canNext={step === 'name' || step === 'review' ? named && !(step === 'review' && (same.checking || waiting)) : true}
            saving={create.isPending}
            onSkip={next}
            onNext={next}
            notice={
              step === 'review' && offline ? (
                <Caption color={readableAccent(STATUS.warning, ds.c.ground)}>You’re offline. Your draft is kept on this phone and saves when you’re back.</Caption>
              ) : undefined
            }
          />
        }
      >
        {body}
      </WizardFrame>
      {leaving ? (
        <LeaveCard
          where={config.label}
          step={step === 'review' ? 'Review' : `${at + 1} of ${steps.length - 1}`}
          drink={draft.name.trim() || `this ${kind}`}
          body={`What you’ve done is kept. Add lists ${draft.name.trim() || `this ${kind}`} under Pick up where you left off, with the way back.`}
          onLeave={onClose}
          onStay={() => setLeaving(false)}
          onDrop={() => {
            clear(place);
            onClose();
          }}
        />
      ) : null}
    </View>
  );
}

const clip = (s: string) => (s.length > 28 ? `${s.slice(0, 27).trimEnd()}…` : s);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  review: { gap: space.md },
  photoNote: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.control },
});
