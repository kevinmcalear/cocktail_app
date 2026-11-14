import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, GlassButton, PressableScale, TextLink, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { DragScrollView } from '@/components/ds/dragScroll';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WebHead } from '@/components/WebHead';
import { layout, radius, space } from '@/constants/tokens';
import { useMenuSectionPlace } from '@/hooks/useDrinkDesk';
import { sketchLook } from '@/lib/drinkWizard';
import { creditWaits, nameWaits, theirs } from '@/lib/sameName';
import { liquidOf } from '@/lib/sketch/types';
import { withAlpha } from '@/lib/color';

import type { DrinkDeskProps } from './DrinkDesk';
import { deskSketch } from './DrinkDeskRail';
import { DraftDrawing } from './DraftDrawing';
import { DraftLine } from './DraftLine';
import { DraftRows } from './DraftRows';
import { IngredientsStep } from './IngredientsStep';
import { ApartHint, TakenWord } from './NameStepBody';
import { NearNameCard } from './NearNameCard';
import { DraftPhotos, DrawingChoice } from './ReviewPhotos';
import { BracketField, SameNameCard, useSameNamePicks } from './SameNameCard';
import { StartFromClassic } from './StartFromClassic';
import { BigName } from './TextSteps';
import { useVenueLines } from './useDeskLines';
import { Eyebrow } from './WizardChrome';
import { KeyboardScreen, TakeoverProvider, useSearchTakeover } from './WizardFrame';

const HERO = 200;

/**
 * Add B's draft page (Prod-add-flow step 3, Kept-add-helpers): the drink in
 * pencil until it's saved, with what the wizard used to ask on its own
 * screens as prompts where the gap is: Did you mean, Start from a classic,
 * Make it a riff?, balance, saline, a house-made inside the drink, Goes with
 * and the foamer. The spec is written in place; how it's made, the glass and
 * the credit are rows that open small sheets. Nothing saves until Save.
 * Phones and tablets; a desktop browser has DrinkDesk. It stays above the
 * keyboard, and on a phone the spec's search or paste takes the screen (Q16):
 * the rest goes to null in place, so the field keeps its focus.
 */
export function DraftPage({ lead, ...p }: DrinkDeskProps & { lead?: ReactNode }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { draft, set, barId } = p;
  const menu = useMenuSectionPlace(p.menuSectionId).data?.menu ?? null;
  const picks = useSameNamePicks(set);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const { over, takeover, onScroll } = useSearchTakeover(scroller, useBreakpoint() === 'phone');
  // The name takes the cursor when the page opens, not again: the search's takeover drops it and
  // mounts it afresh after a pick, and its autoFocus pulled the keyboard up to an empty name.
  const [searched, setSearched] = useState(false);
  if (over && !searched) setSearched(true);
  const venue = useVenueLines({ draft, set, barId, venueName: p.venueName, ingredients: p.ingredients, coreIds: p.coreIds });
  const same = draft.sameAs ?? null;
  const asking = !!p.atBar && same?.id !== p.atBar.id;
  const bar = barId ? p.venueName : '';
  const rename = () => {
    const el = nameRef.current as unknown as { focus: () => void; setSelectionRange?: (a: number, b: number) => void } | null;
    el?.focus();
    el?.setSelectionRange?.(draft.name.length, draft.name.length);
  };
  const waitNote = nameWaits(draft, p.atBar) ? 'Pick one for the name first' : creditWaits(draft, p.atPlace) ? 'Pick one under Credit first' : null;
  const inputs = deskSketch(sketchLook(p.drawn, p.barVariants, p.barIceKinds));
  const sky = liquidOf(inputs).hex;
  const eyebrow = ['Draft', menu ? `for ${menu}` : 'in pencil until you save'].join(' · ');

  return (
    <>
      <WebHead>
        <title>Add a drink</title>
      </WebHead>
      <KeyboardScreen testID="add-drink">
        {(statusBar) => {
          const top = statusBar + space.md;
          return (
            <>
              <DragScrollView
                ref={scroller}
                keyboardShouldPersistTaps="handled"
                onScroll={onScroll}
                // On a phone the drag lists' container keeps onScroll for itself: where it stopped says the same.
                onScrollEndDrag={onScroll}
                onMomentumScrollEnd={onScroll}
                contentContainerStyle={{ paddingTop: over ? top : 0, paddingBottom: insets.bottom + space.xxl }}
              >
                {over ? null : (
                  <View style={[styles.hero, { paddingTop: top + layout.minTapTarget }]}>
                    {/* The sky (Prod-add-flow 3): the drink's own colour, fading into the page. */}
                    <LinearGradient colors={[withAlpha(sky, ds.scheme === 'dark' ? 0.3 : 0.2), withAlpha(sky, ds.scheme === 'dark' ? 0.16 : 0.1)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                    <LinearGradient colors={[withAlpha(ds.c.ground, 0), ds.c.ground]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
                    <DraftDrawing inputs={inputs} seed={draft.id ?? 'new-drink'} size={HERO} />
                  </View>
                )}
                <View style={[styles.body, { paddingHorizontal: gutter }, over ? styles.bodyOver : null]}>
                  {over ? null : (
                    <>
                      {lead}
                      <Eyebrow>{eyebrow}</Eyebrow>
                      {same?.as === 'version' ? (
                        <View style={styles.version}>
                          <BracketField name={same.name} value={same.word ?? ''} onChange={(w) => picks.word(draft, w)} label={`What’s different about this ${same.name}`} autoFocus={!searched && !same.word} />
                          {p.atBar && p.atBar.id !== same.id ? <TakenWord bar={same.bar} name={draft.name} /> : null}
                          <View style={styles.start}>
                            <TextLink label="Not a version" tone="ink" onPress={() => picks.undo(draft)} />
                          </View>
                        </View>
                      ) : (
                        <BigName hint={false} inputRef={nameRef} autoFocus={!searched && !draft.name} value={draft.name} onChange={(name) => set({ name })} onDone={() => {}} resumed={p.resumed} onStartOver={p.onStartOver} />
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
                    </>
                  )}
                  {/* Around the spec alone: the sheets' searches (Credit) stay in their sheet. */}
                  <TakeoverProvider value={takeover}>
                    <IngredientsStep
                      draft={draft}
                      set={set}
                      ingredients={p.ingredients}
                      loading={p.loading}
                      aliases={p.aliases}
                      coreIds={p.coreIds}
                      shelf={p.shelf}
                      backBar={p.backBar}
                      // The note and its Undo go under the lines; the hint, about a bottle only an open line shows, under that line.
                      stock={p.stock ? { ...p.stock, footer: p.stock.note } : undefined}
                      {...venue.lines}
                      bar={barId ? { id: barId, name: p.venueName } : null}
                      classicShown={!!p.classic}
                      inlinePrep={{ venueName: barId ? p.venueName : null, save: { onSave: p.onSave, saving: p.saving, canSave: p.canSave } }}
                      renderLine={(line, row, parts) => <DraftLine {...parts} line={line} row={row} hint={p.stock?.toggle(line) ? p.stock.hint : null} />}
                    />
                  </TakeoverProvider>
                  {over ? null : (
                    <>
                      <DraftRows {...p} onRename={rename} sketch={inputs} />
                      <DraftPhotos barId={barId} photos={draft.photos ?? {}} onChange={(photos) => set({ photos })} sketch={inputs} seed={draft.id ?? 'new-drink'} />
                      {draft.photos?.hero ? <DrawingChoice kept={!!draft.keepDrawing} onChange={(keepDrawing) => set({ keepDrawing })} /> : null}
                      {venue.cost}
                      {waitNote ? <Caption tone="muted">{waitNote}</Caption> : null}
                      {p.notice}
                    </>
                  )}
                </View>
              </DragScrollView>
              {over ? null : (
                <View style={[styles.bar, { top, left: gutter, right: gutter }]}>
                  <GlassButton icon="chevron.left" accessibilityLabel={`Back to ${menu ?? 'where you were'}. Your draft is kept`} onPress={p.onClose} />
                  <PressableScale
                    role="button"
                    accessibilityLabel={p.saveLabel ?? (p.saving ? 'Saving' : menu ? `Save and add to ${menu}` : 'Save drink')}
                    disabled={!p.canSave || p.saving}
                    onPress={p.onSave}
                    style={[styles.save, { backgroundColor: ds.accentFill.fill, opacity: !p.canSave || p.saving ? 0.45 : 1 }]}
                  >
                    <IconSymbol name="checkmark" size={20} color={ds.accentFill.text} />
                  </PressableScale>
                </View>
              )}
            </>
          );
        }}
      </KeyboardScreen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: space.md },
  body: { gap: space.lg, paddingTop: space.md, maxWidth: layout.page.text, width: '100%', alignSelf: 'center' },
  bodyOver: { paddingTop: 0 },
  version: { gap: space.sm },
  start: { alignSelf: 'flex-start' },
  bar: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  save: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
