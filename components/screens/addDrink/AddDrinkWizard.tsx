import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, BackHandler, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { space, springs } from '@/constants/tokens';
import { useCreateDrink } from '@/hooks/useCreateDrink';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useMyProfile } from '@/hooks/useMyProfile';
import { plainDbMessage } from '@/lib/dbError';
import {
  canSave, choiceList, COMMON_GLASSES, COMMON_ICE, COMMON_METHODS, EMPTY_DRAFT, hasContent, STEP_COPY, WIZARD_STEPS,
  type WizardDraft, type WizardStep,
} from '@/lib/drinkWizard';
import { toastDone } from '@/lib/toast';
import { useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';

import { CreditsStep } from './CreditsStep';
import { GarnishStep } from './GarnishStep';
import { IngredientsStep } from './IngredientsStep';
import { PickStep } from './PickStep';
import { PublishStep } from './PublishStep';
import { ReviewStep } from './ReviewStep';
import { NameStep, NotesStep } from './TextSteps';
import { SketchHeader } from './SketchHeader';
import { Eyebrow, WizardFooter } from './WizardChrome';

export interface AddDrinkWizardProps {
  /** The venue it's added at; null or missing for a drink at home. */
  barId?: string | null;
  menuDraftId?: string | null;
  menuSectionId?: string | null;
  initialName?: string | null;
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

function Wizard({ barId = null, menuDraftId, menuSectionId, initialName, embedded, onClose, onSaved }: AddDrinkWizardProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const place = wizardPlace(barId);
  const kept = useDrinkWizardStore((s) => s.kept[place]);
  const patch = useDrinkWizardStore((s) => s.patch);
  const setStoredStep = useDrinkWizardStore((s) => s.setStep);
  const clear = useDrinkWizardStore((s) => s.clear);
  const draft: WizardDraft = kept?.draft ?? EMPTY_DRAFT;
  const step: WizardStep = kept?.step ?? 'name';
  const [resumed, setResumed] = useState(() => hasContent(draft));
  const [direction, setDirection] = useState<1 | -1>(1);
  const dropdowns = useDropdowns().data;
  const me = useMyProfile().data ?? null;
  const create = useCreateDrink();

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

  // Android's back button steps back through the wizard before leaving it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (at === 0) return false;
      back();
      return true;
    });
    return () => sub.remove();
  });

  // While typing on a phone the sketch folds away, so the field and the keyboard both fit.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setTyping(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setTyping(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const save = () =>
    create.mutate(
      { draft, barId, myProfileId: me?.id ?? null, menuDraftId, menuSectionId },
      {
        onSuccess: ({ id, warnings }) => {
          clear(place);
          toastDone('Drink saved', draft.name.trim());
          if (warnings.length) Alert.alert('Saved, with one thing to fix', warnings.join('\n\n'));
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
  const copy = STEP_COPY[step];
  const body = (() => {
    switch (step) {
      case 'name':
        return <NameStep draft={draft} set={set} onDone={() => canSave(draft) && next()} resumed={resumed} onStartOver={startOver} />;
      case 'ingredients':
        return <IngredientsStep draft={draft} set={set} ingredients={ingredients} />;
      case 'method':
        return <PickStep label="Method" ownLabel="Your own method" multi options={choiceList(COMMON_METHODS, dropdowns?.methods ?? [])} selected={draft.methods} onChange={(methods) => set({ methods })} />;
      case 'glass':
        return <PickStep label="Glass" ownLabel="Another glass" options={choiceList(COMMON_GLASSES, dropdowns?.glassware ?? [])} selected={draft.glass ? [draft.glass] : []} onChange={([glass]) => set({ glass: glass ?? null })} />;
      case 'ice':
        return <PickStep label="Ice" ownLabel="Other ice" options={choiceList(COMMON_ICE, dropdowns?.iceTypes ?? [])} selected={draft.ice ? [draft.ice] : []} onChange={([ice]) => set({ ice: ice ?? null })} />;
      case 'garnish':
        return <GarnishStep draft={draft} set={set} ingredients={ingredients} />;
      case 'credits':
        return <CreditsStep draft={draft} set={set} atVenue={!!barId} />;
      case 'notes':
        return <NotesStep draft={draft} set={set} />;
      case 'publish':
        return <PublishStep draft={draft} set={set} barId={barId} />;
      case 'review':
        return <ReviewStep draft={draft} onJump={go} atVenue={!!barId} hasProfile={!!me} />;
    }
  })();

  const entering = (direction > 0 ? FadeInRight : FadeInLeft).springify().damping(springs.glide.damping).stiffness(springs.glide.stiffness);
  // A phone gets the paper band edge to edge; wider screens and the workspace a centred column.
  const column = wide || !!embedded;
  const side = column ? 0 : gutter;
  const bottom = embedded ? space.lg : Math.max(insets.bottom, space.lg);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Add a drink</title>
      </WebHead>
      <View style={[styles.column, column && { paddingTop: embedded ? space.lg : insets.top + space.lg, paddingHorizontal: gutter }, { paddingBottom: bottom }]}>
        <SketchHeader
          draft={draft}
          step={step}
          onBack={back}
          top={column ? space.lg : insets.top + space.sm}
          side={column ? space.lg : gutter}
          rounded={column}
          folded={typing && !column}
        />
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.flex} contentContainerStyle={[styles.scroll, { paddingHorizontal: side }]}>
          <Animated.View key={step} entering={entering} style={styles.body}>
            <View style={styles.heading}>
              <Eyebrow>{draft.name.trim() || 'New drink'}</Eyebrow>
              <Title role="heading">{copy.title}</Title>
              {copy.intro ? <Body tone="muted">{copy.intro}</Body> : null}
            </View>
            {body}
          </Animated.View>
        </ScrollView>
        <View style={{ paddingHorizontal: side }}>
          <WizardFooter step={step} canNext={step === 'name' || step === 'review' ? canSave(draft) : true} saving={create.isPending} onSkip={next} onNext={next} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  flex: { flex: 1 },
  scroll: { paddingTop: space.lg, paddingBottom: space.xl },
  body: { gap: space.lg },
  heading: { gap: space.xs },
});
