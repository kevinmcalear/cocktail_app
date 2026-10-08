import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, BackHandler, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { space, springs } from '@/constants/tokens';
import { useBarGlassware } from '@/hooks/useBarGlassware';
import { useCreateDrink } from '@/hooks/useCreateDrink';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useMyProfile } from '@/hooks/useMyProfile';
import { suggestClassic } from '@/lib/classics';
import { plainDbMessage } from '@/lib/dbError';
import {
  canSave, choiceList, COMMON_GLASSES, COMMON_ICE, COMMON_METHODS, EMPTY_DRAFT, hasContent, samePick, sketchLook, STEP_COPY, WIZARD_STEPS,
  type WizardDraft, type WizardPick, type WizardStep,
} from '@/lib/drinkWizard';
import { serveGuess } from '@/lib/specDefaults';
import { toastDone } from '@/lib/toast';
import { useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';

import { CreditsStep } from './CreditsStep';
import { GarnishStep } from './GarnishStep';
import { GlassStep } from './GlassStep';
import { IngredientsStep } from './IngredientsStep';
import { PickStep } from './PickStep';
import { PublishStep } from './PublishStep';
import { ReviewStep } from './ReviewStep';
import { NameStep, NotesStep } from './TextSteps';
import { ServeGuessCard } from './ServeGuessCard';
import { SketchHeader } from './SketchHeader';
import { StartFromClassic } from './StartFromClassic';
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
  const breakpoint = useBreakpoint();
  const wide = breakpoint !== 'phone';
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

  const windowHeight = useWindowDimensions().height;
  const [height, setHeight] = useState(0);
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
        return <IngredientsStep draft={draft} set={set} ingredients={ingredients} loading={!dropdowns?.ingredients} aliases={dropdowns?.ingredientAliases} coreIds={coreIds} />;
      case 'method':
        return (
          <>
            {serveCard ? <ServeGuessCard guess={guess} onUse={takeGuess} /> : null}
            <PickStep label="Method" ownLabel="Your own method" multi options={methods} selected={draft.methods} onChange={(methods) => set({ methods })} suggested={guess.method} why={serveCard ? null : guess.why} />
          </>
        );
      case 'glass':
        return <GlassStep draft={draft} set={set} options={glasses} barGlasses={barGlasses} barVariants={barVariants} suggested={guess.glass} />;
      case 'ice':
        return <PickStep label="Ice" ownLabel="Other ice" options={ices} selected={draft.ice ? [draft.ice] : []} onChange={([ice]) => set({ ice: ice ?? null })} suggested={guess.ice} />;
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
  const sideBySide = breakpoint === 'desktop' && !embedded;
  // On iOS the screen is a page sheet that starts below the status bar. Its gap
  // to the window's top is both the inset it doesn't need and what
  // KeyboardAvoidingView (which assumes it starts at the top) must add.
  const sheetGap = Platform.OS === 'ios' && !embedded && height ? Math.max(0, windowHeight - height) : 0;
  const statusBar = sheetGap > 0 ? 0 : insets.top;
  const side = column ? 0 : gutter;
  const bottom = embedded ? space.lg : Math.max(insets.bottom, space.lg);

  return (
    <KeyboardAvoidingView
      // Android draws edge to edge, so the window doesn't shrink for the keyboard: the screen does.
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={sheetGap}
      testID="add-drink"
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={[styles.screen, { backgroundColor: ds.c.ground }]}
    >
      <WebHead>
        <title>Add a drink</title>
      </WebHead>
      {/* iOS: after the first layout, so the name field's autofocus meets the right keyboard offset. */}
      {Platform.OS === 'ios' && !height ? null : (
        <View
          style={[
            styles.column,
            sideBySide && styles.wideColumn,
            column && { paddingTop: embedded ? space.lg : statusBar + space.lg, paddingHorizontal: gutter },
            { paddingBottom: bottom },
          ]}
        >
          {/* A desktop browser keeps the drawing beside the step, big; elsewhere it's a band on top. */}
          <View style={sideBySide ? styles.row : styles.flex}>
            <View style={sideBySide && styles.aside}>
              <SketchHeader
                draft={draft}
                step={step}
                onBack={back}
                top={column ? space.lg : statusBar + space.sm}
                side={column ? space.lg : gutter}
                rounded={column}
                folded={typing && !column}
                barVariants={barVariants}
                size={sideBySide ? 300 : undefined}
              />
            </View>
            <View style={styles.flex}>
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.flex} contentContainerStyle={[styles.scroll, { paddingHorizontal: side }, sideBySide && styles.sideScroll]}>
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
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  wideColumn: { maxWidth: 1080 },
  row: { flex: 1, flexDirection: 'row', gap: space.xxl },
  aside: { width: 380 },
  sideScroll: { paddingTop: 0 },
  flex: { flex: 1 },
  scroll: { paddingTop: space.lg, paddingBottom: space.xl },
  body: { gap: space.lg },
  heading: { gap: space.xs },
});
