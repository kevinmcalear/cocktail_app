import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Caption, DsText, PressableScale, useDs, useGutter } from '@/components/ds';
import { fontFamilies, space, type as typeScale } from '@/constants/tokens';
import { openPickLine } from '@/lib/bringInDraft';
import type { MatchData } from '@/lib/bringInMatch';
import { canCheck, nextOpen, tally } from '@/lib/importReview';
import type { ReadPlace } from '@/supabase/functions/_shared/anythingRead';

import { CheckFooter, PageLook } from './CheckParts';
import { DrawnFromSpec, FromYourFile } from './RecipeSource';
import { amountShown, chooseLine, RecipeSpec } from './RecipeSpec';
import { EditLink, ProgressLine } from './ReviewParts';
import { useImportReview } from './useImportReview';
import { useSteadySketch } from './useRecipeMaker';

/** What a drink that can't be approved again says about itself. */
export function markNote(mark: string | null, unsure: boolean): string | null {
  if (unsure) return 'This one was saving when the app closed. Check your Library for it before adding it again.';
  if (mark === 'saving') return 'Saving to your Library…';
  if (mark === 'approved') return 'Approved. It’s in your Library.';
  return null;
}

/**
 * A big import on a phone (board eddie-oct22-wave2, Fix 11, "Phone · still
 * quick"): one drink at a time, Finish later, the count and the bar, the
 * drink drawn from its spec, Edit this drink, then Skip or Approve.
 */
export function ImportReview({ id, data, onFinishLater }: { id: string; data: MatchData; onFinishLater: () => void }) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const { review, usual, toMake, error, approve, skip, setChoices, editDrink } = useImportReview(id, data);
  const [look, setLook] = useState<{ at?: ReadPlace | null; title: string } | null>(null);
  // On a phone you only ever see a drink still to check.
  const at = review ? (canCheck(review, review.at) ? review.at : (nextOpen(review.marks, review.at) ?? review.at)) : 0;
  const recipe = review?.recipes[at];
  const choices = review?.choices[at];
  const sketch = useSteadySketch(recipe && choices ? toMake(recipe, choices).sketch : undefined);
  if (!review || !recipe || !choices) return null;

  const t = tally(review);
  const open = canCheck(review, at);
  const files = review.files;
  const file = (x: { at?: ReadPlace | null } | null) => (x?.at ? (files[x.at.page] ?? null) : null);
  const page = file(recipe);
  const note = markNote(review.marks[at], review.unsure.includes(at));

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <PressableScale role="button" accessibilityLabel="Finish later. What’s left waits on this device" onPress={onFinishLater} style={styles.later}>
            <DsText variant="body" color={ds.c.ink} style={styles.medium}>
              Finish later
            </DsText>
          </PressableScale>
          <Caption tone="muted" style={styles.mono}>{`Drink ${at + 1} of ${t.total}`}</Caption>
        </View>
        <ProgressLine t={t} words={`${t.checked} of ${t.total}`} />
        <DrawnFromSpec inputs={sketch} seed={recipe.name} name={choices.name} />
        <TextInput accessibilityLabel="Drink name" editable={open} value={choices.name} onChangeText={(name) => setChoices(at, (c) => ({ ...c, name }))} style={[styles.name, { color: ds.c.ink, fontFamily: fontFamilies.instrument }]} />
        {page?.uri && recipe.at ? (
          <FromYourFile
            file={page}
            box={recipe.at.box}
            words={recipe.lines.slice(0, 3).map((l) => `${amountShown(l, l.unit ?? usual)} ${l.ingredient}`).join('\n')}
            page={files.length > 1 ? recipe.at.page + 1 : null}
            onLook={() => setLook({ at: recipe.at, title: choices.name })}
          />
        ) : null}
        <RecipeSpec recipe={recipe} choices={choices} data={data} files={files} usual={usual} label={false} onChoose={(i, c) => setChoices(at, (prev) => chooseLine(prev, i, c))} onLook={(where, title) => setLook({ at: where, title })} />
        {open ? <EditLink onPress={() => editDrink(at)} /> : null}
        {note ? <Caption tone="muted">{note}</Caption> : null}
        {error ? <Caption tone="accent">{error}</Caption> : null}
      </ScrollView>
      <CheckFooter note={open ? openPickLine(recipe, choices, data) : null}>
        <View style={styles.row}>
          <Button label="Skip" size="lg" variant="secondary" disabled={!open} onPress={() => skip(at)} />
          <Button label="Approve" size="lg" disabled={!open || !choices.name.trim()} onPress={() => approve(at)} style={styles.flex} />
        </View>
      </CheckFooter>
      <PageLook file={file(look)} at={look?.at ?? null} title={look?.title ?? ''} onClose={() => setLook(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.md, paddingBottom: space.xxl },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  later: { minHeight: 44, justifyContent: 'center' },
  medium: { fontFamily: fontFamilies.bodyMedium },
  mono: { fontFamily: fontFamilies.mono },
  name: { ...typeScale.title, paddingVertical: 0 },
  row: { flexDirection: 'row', gap: space.sm + 2 },
  flex: { flex: 1 },
});
