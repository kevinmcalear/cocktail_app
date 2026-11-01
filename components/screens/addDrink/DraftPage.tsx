import { useRef, type ComponentRef, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, GlassButton, PencilDrawing, PressableScale, TextLink, useDs, useGutter } from '@/components/ds';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WebHead } from '@/components/WebHead';
import { layout, radius, space } from '@/constants/tokens';
import { useMenuSectionPlace } from '@/hooks/useDrinkDesk';
import { sketchLook } from '@/lib/drinkWizard';
import { creditWaits, nameWaits, theirs } from '@/lib/sameName';
import { draftSketchInputs } from '@/lib/sketch/draft';
import { withAlpha } from '@/lib/color';

import type { DrinkDeskProps } from './DrinkDesk';
import { DraftRows } from './DraftRows';
import { IngredientsStep } from './IngredientsStep';
import { ApartHint, TakenWord } from './NameStepBody';
import { NearNameCard } from './NearNameCard';
import { ReviewPhotos } from './ReviewPhotos';
import { BracketField, SameNameCard, useSameNamePicks } from './SameNameCard';
import { StartFromClassic } from './StartFromClassic';
import { BigName } from './TextSteps';
import { Eyebrow } from './WizardChrome';

const HERO = 200;

/**
 * Add B's draft page (Prod-add-flow step 3, Kept-add-helpers): the drink in
 * pencil until it's saved, with what the wizard used to ask on its own
 * screens as prompts where the gap is: Did you mean, Start from a classic,
 * Make it a riff?, balance, saline, a house-made inside the drink, Goes with
 * and the foamer. The spec is written in place; how it's made, the glass and
 * the credit are rows that open small sheets. Nothing saves until Save.
 * Phones and tablets; a desktop browser has DrinkDesk.
 */
export function DraftPage({ lead, ...p }: DrinkDeskProps & { lead?: ReactNode }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { draft, set, barId } = p;
  const menu = useMenuSectionPlace(p.menuSectionId).data?.menu ?? null;
  const picks = useSameNamePicks(set);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const same = draft.sameAs ?? null;
  const asking = !!p.atBar && same?.id !== p.atBar.id;
  const bar = barId ? p.venueName : '';
  const rename = () => {
    const el = nameRef.current as unknown as { focus: () => void; setSelectionRange?: (a: number, b: number) => void } | null;
    el?.focus();
    el?.setSelectionRange?.(draft.name.length, draft.name.length);
  };
  const waitNote = nameWaits(draft, p.atBar) ? 'Pick one for the name first' : creditWaits(draft, p.atPlace) ? 'Pick one under Credit first' : null;
  const inputs = draftSketchInputs(sketchLook(p.drawn, p.barVariants, p.barIceKinds));
  // The modal starts below the status bar on iOS (as the drink editor).
  const top = Platform.OS === 'ios' ? space.md : insets.top + space.sm;
  const eyebrow = ['Draft', menu ? `for ${menu}` : 'in pencil until you save'].join(' · ');

  return (
    <View testID="add-drink" style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Add a drink</title>
      </WebHead>
      <FormScrollContainer keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        <View style={[styles.hero, { paddingTop: top + layout.minTapTarget, backgroundColor: withAlpha(ds.accentText, 0.06) }]}>
          <PencilDrawing inputs={inputs} seed={draft.id ?? 'new-drink'} size={HERO} />
        </View>
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          {lead}
          <Eyebrow>{eyebrow}</Eyebrow>
          {same?.as === 'version' ? (
            <View style={styles.version}>
              <BracketField name={same.name} value={same.word ?? ''} onChange={(w) => picks.word(draft, w)} label={`What’s different about this ${same.name}`} autoFocus={!same.word} />
              {p.atBar && p.atBar.id !== same.id ? <TakenWord bar={same.bar} name={draft.name} /> : null}
              <View style={styles.start}>
                <TextLink label="Not a version" tone="ink" onPress={() => picks.undo(draft)} />
              </View>
            </View>
          ) : (
            <BigName hint={false} inputRef={nameRef} value={draft.name} onChange={(name) => set({ name })} onDone={() => {}} resumed={p.resumed} onStartOver={p.onStartOver} />
          )}
          {same?.as === 'different' ? <ApartHint done={!nameWaits(draft, null)} words={`Give it a name that tells it apart from ${theirs(same.bar, same.name)}.`} /> : null}
          {p.atBar && asking ? (
            <SameNameCard
              bar={bar}
              drink={p.atBar}
              caption="A version is the same drink with a different spec."
              busy={picks.busy}
              onOpen={() => picks.open(p.atBar!)}
              onVersion={() => picks.version(p.atBar!, bar, true)}
              onDifferent={() => picks.different(p.atBar!, bar, rename)}
            />
          ) : null}
          <NearNameCard draft={draft} set={set} barId={barId} venueName={p.venueName} hidden={!!p.atBar || !!p.classic} />
          {p.classic && !asking && !(same?.as === 'different' && nameWaits(draft, null)) ? <StartFromClassic set={set} match={p.classic} /> : null}
          <IngredientsStep
            draft={draft}
            set={set}
            ingredients={p.ingredients}
            loading={p.loading}
            aliases={p.aliases}
            coreIds={p.coreIds}
            shelf={p.shelf}
            backBar={p.backBar}
            stock={p.stock}
            bar={barId ? { id: barId, name: p.venueName } : null}
            classicShown={!!p.classic}
          />
          <DraftRows {...p} onRename={rename} />
          <ReviewPhotos photos={draft.photos ?? {}} onChange={(photos) => set({ photos })} sketch={inputs} seed={draft.id ?? 'new-drink'} />
          {waitNote ? <Caption tone="muted">{waitNote}</Caption> : null}
        </View>
      </FormScrollContainer>
      <View style={[styles.bar, { top, left: gutter, right: gutter }]}>
        <GlassButton icon="chevron.left" accessibilityLabel={`Back to ${menu ?? 'where you were'}. Your draft is kept`} onPress={p.onClose} />
        <PressableScale
          role="button"
          accessibilityLabel={p.saving ? 'Saving' : menu ? `Save and add to ${menu}` : 'Save drink'}
          disabled={!p.canSave || p.saving}
          onPress={p.onSave}
          style={[styles.save, { backgroundColor: ds.accentFill.fill, opacity: !p.canSave || p.saving ? 0.45 : 1 }]}
        >
          <IconSymbol name="checkmark" size={20} color={ds.accentFill.text} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { alignItems: 'center', paddingBottom: space.md },
  body: { gap: space.lg, paddingTop: space.md, maxWidth: layout.page.text, width: '100%', alignSelf: 'center' },
  version: { gap: space.sm },
  start: { alignSelf: 'flex-start' },
  bar: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  save: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
