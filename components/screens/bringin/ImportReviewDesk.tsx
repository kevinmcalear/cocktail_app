import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { fontFamilies, radius, space, type as typeScale } from '@/constants/tokens';
import { openPickLine } from '@/lib/bringInDraft';
import type { MatchData } from '@/lib/bringInMatch';
import { canCheck, tally, tallyLine } from '@/lib/importReview';
import type { ReadPlace } from '@/supabase/functions/_shared/anythingRead';

import { MonoLabel, PageLook } from './CheckParts';
import { markNote } from './ImportReview';
import { chooseLine, RecipeSpec } from './RecipeSpec';
import { DrinkListRow, EditLink, FilePart, ProgressLine } from './ReviewParts';
import { useImportReview } from './useImportReview';
import { useSteadySketch } from './useRecipeMaker';

/** The list shows this many before "and 36 more", or up to a few past the drink on screen. */
const LIST_START = 10;

const typing = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

/**
 * A big import on a laptop (board eddie-oct22-wave2, Fix 11, "Desktop ·
 * where big imports happen"): one page, the drinks down the left with what
 * was approved and skipped, the drink in the middle, the bit of the file on
 * the right, and the keyboard moves you on (A approves, S skips, arrows move).
 */
export function ImportReviewDesk({ id, data, onFinishLater }: { id: string; data: MatchData; onFinishLater: () => void }) {
  const ds = useDs();
  const { review, usual, toMake, error, go, approve, skip, setChoices, editDrink } = useImportReview(id, data);
  const [look, setLook] = useState<{ at?: ReadPlace | null; title: string } | null>(null);
  const [all, setAll] = useState(false);
  const at = review?.at ?? 0;
  const recipe = review?.recipes[at];
  const choices = review?.choices[at];
  const sketch = useSteadySketch(recipe && choices ? toMake(recipe, choices).sketch : undefined);

  // A approves, S skips, the arrows move: not while typing, or with a sheet open over the page.
  const keys = useRef({ approve: () => {}, skip: () => {}, move: (_by: number) => {} });
  useEffect(() => {
    keys.current = { approve: () => approve(at), skip: () => skip(at), move: (by) => go(at + by) };
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      if (k === 'a') keys.current.approve();
      else if (k === 's') keys.current.skip();
      else if (k === 'arrowdown' || k === 'arrowright') keys.current.move(1);
      else if (k === 'arrowup' || k === 'arrowleft') keys.current.move(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  if (!review || !recipe || !choices) return null;
  const t = tally(review);
  const open = canCheck(review, at);
  const files = review.files;
  const file = (x: { at?: ReadPlace | null } | null) => (x?.at ? (files[x.at.page] ?? null) : null);
  const shown = all ? t.total : Math.min(t.total, Math.max(LIST_START, at + 4));
  const note = markNote(review.marks[at], review.unsure.includes(at));
  const pickNote = open ? openPickLine(recipe, choices, data) : null;
  const how = [recipe.method, recipe.glass?.toLowerCase(), 'drawn from the spec'].filter(Boolean).join(' · ');

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <View style={[styles.header, { borderBottomColor: ds.c.line }]}>
        <View>
          <Caption tone="muted">Bring in</Caption>
          <DsText variant="headline" color={ds.c.ink} numberOfLines={1} style={styles.bold}>
            {review.name}
          </DsText>
        </View>
        <View style={styles.flex}>
          <ProgressLine t={t} words={tallyLine(t)} />
        </View>
        <Button label="Finish later" size="lg" variant="secondary" accessibilityLabel="Finish later. What’s left waits on this device" onPress={onFinishLater} />
      </View>
      <View style={styles.columns}>
        <ScrollView style={[styles.list, { borderRightColor: ds.c.line }]} contentContainerStyle={styles.listBody}>
          <View role="navigation" aria-label="Drinks in this file">
            <MonoLabel style={styles.listLabel}>{`${t.total} DRINKS`}</MonoLabel>
            {review.recipes.slice(0, shown).map((r, i) => (
              <DrinkListRow key={i} name={review.choices[i]?.name || r.name} mark={review.marks[i]} current={i === at} onPress={() => go(i)} />
            ))}
            {shown < t.total ? (
              <PressableScale role="button" accessibilityLabel={`Show ${t.total - shown} more`} onPress={() => setAll(true)} style={styles.more}>
                <Caption tone="muted">{`and ${t.total - shown} more`}</Caption>
              </PressableScale>
            ) : null}
          </View>
        </ScrollView>
        <ScrollView style={styles.flex} contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
          <View style={styles.drinkTop}>
            <View role="img" aria-label={`Drawing of ${choices.name || 'the drink'}, drawn from the spec`} style={[styles.paper, { backgroundColor: ds.c.paper }]}>
              <View style={styles.drawing}>
                <SketchDrawing inputs={sketch} seed={recipe.name} detail="full" />
              </View>
            </View>
            <View style={[styles.flex, styles.titles]}>
              <Caption tone="muted" style={styles.mono}>{`Drink ${at + 1} of ${t.total}`}</Caption>
              <TextInput accessibilityLabel="Drink name" editable={open} value={choices.name} onChangeText={(name) => setChoices(at, (c) => ({ ...c, name }))} style={[styles.name, { color: ds.c.ink, fontFamily: fontFamilies.instrument }]} />
              <Caption tone="muted">{how}</Caption>
            </View>
          </View>
          <RecipeSpec recipe={recipe} choices={choices} data={data} files={files} usual={usual} label={false} onChoose={(i, c) => setChoices(at, (prev) => chooseLine(prev, i, c))} onLook={(where, title) => setLook({ at: where, title })} />
          {open ? <EditLink onPress={() => editDrink(at)} /> : null}
          {pickNote ? <Caption tone="muted">{pickNote}</Caption> : null}
          {note ? <Caption tone="muted">{note}</Caption> : null}
          {error ? <Caption tone="accent">{error}</Caption> : null}
          <View style={styles.actions}>
            <Button label="Skip" size="lg" variant="secondary" disabled={!open} onPress={() => skip(at)} />
            <Button label="Approve and next" size="lg" disabled={!open || !choices.name.trim()} onPress={() => approve(at)} />
            <Caption tone="muted" style={styles.hint}>
              A approves · S skips · arrow keys move
            </Caption>
          </View>
        </ScrollView>
        <ScrollView style={[styles.aside, { borderLeftColor: ds.c.line }]} contentContainerStyle={styles.asideBody}>
          <View role="complementary" aria-label="From your file">
            <FilePart recipe={recipe} files={files} usual={usual} onLook={() => setLook({ at: recipe.at, title: choices.name })} />
          </View>
        </ScrollView>
      </View>
      <PageLook file={file(look)} at={look?.at ?? null} title={look?.title ?? ''} onClose={() => setLook(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg + 4, paddingHorizontal: space.xl, paddingVertical: space.lg + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  bold: { fontFamily: fontFamilies.bodySemiBold },
  flex: { flex: 1 },
  columns: { flex: 1, flexDirection: 'row' },
  list: { width: 280, flexGrow: 0, borderRightWidth: StyleSheet.hairlineWidth },
  listBody: { paddingVertical: space.md + 2, paddingHorizontal: space.md },
  listLabel: { paddingHorizontal: space.sm + 2, paddingBottom: space.sm },
  more: { paddingVertical: space.sm - 2, paddingHorizontal: space.sm + 2, minHeight: 32, justifyContent: 'center' },
  main: { flexGrow: 1, paddingVertical: space.xl - 2, paddingHorizontal: space.xl + 4, gap: space.md + 2 },
  drinkTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg + 4 },
  paper: { width: 150, height: 170, borderRadius: radius.card - 4, alignItems: 'center', justifyContent: 'center' },
  drawing: { width: 130, height: 150 },
  titles: { gap: space.xs + 2 },
  mono: { fontFamily: fontFamilies.mono },
  name: { ...typeScale.title, paddingVertical: 0 },
  actions: { marginTop: 'auto', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md },
  // Beside the buttons when there's room, under them when there isn't.
  hint: { marginLeft: space.sm, flexShrink: 0 },
  aside: { width: 360, flexGrow: 0, borderLeftWidth: StyleSheet.hairlineWidth },
  asideBody: { paddingVertical: space.xl - 2, paddingHorizontal: space.lg + 4 },
});
