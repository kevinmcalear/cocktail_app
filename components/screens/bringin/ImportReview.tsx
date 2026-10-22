import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, TextLink, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { fontFamilies, space } from '@/constants/tokens';
import { useBringInMatchData } from '@/hooks/useBringInMatchData';
import { useApproveDrink, useBringInSave } from '@/hooks/useBringInSave';
import { openPickLine } from '@/lib/bringInDraft';
import type { MatchData } from '@/lib/bringInMatch';
import { nextWaiting, reviewCount } from '@/lib/importReview';
import { useBringIn } from '@/store/useBringIn';
import { useDrinkWizardStore, wizardPlace } from '@/store/useDrinkWizardStore';
import { useImportReview, type ImportReview as Review } from '@/store/useImportReview';

import { CheckFooter } from './CheckParts';
import { DrinkList, FileColumn, ReviewBar } from './ImportReviewParts';
import { RecipeDrink, useDrinkMaker } from './RecipeDrink';

const store = () => useImportReview.getState();

/** Keys on the laptop: A approves, S skips, arrows move. Not while typing, or with a sheet open. */
function useReviewKeys(on: boolean, keys: { approve: () => void; skip: () => void; move: (by: number) => void }) {
  const latest = useRef(keys);
  useEffect(() => {
    latest.current = keys;
  });
  useEffect(() => {
    if (!on || Platform.OS !== 'web') return;
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest?.('input, textarea, [contenteditable="true"]') || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      const act = k === 'a' ? latest.current.approve : k === 's' ? latest.current.skip : k === 'arrowdown' || k === 'arrowright' ? () => latest.current.move(1) : k === 'arrowup' || k === 'arrowleft' ? () => latest.current.move(-1) : null;
      if (!act) return;
      e.preventDefault();
      act();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [on]);
}

/**
 * A big import, checked drink by drink (canvas eddie-oct22-wave2, Fix 11).
 * Approve saves that drink straight away; Skip leaves it out; Finish later
 * leaves the rest waiting on this device. When every drink is checked, what
 * was approved is recorded as one bring-in and Brought in opens. On a
 * laptop it's one page (the drinks, the drink, the file); on a phone, one
 * drink at a time.
 */
export function ImportReview({ review, onLeave }: { review: Review; onLeave: () => void }) {
  const ds = useDs();
  const data = useBringInMatchData(review.barId, true);
  if (!data) {
    return (
      <View style={[styles.center, { backgroundColor: ds.c.ground }]}>
        <ActivityIndicator color={ds.accentText} />
      </View>
    );
  }
  return <ReviewBody review={review} data={data} onLeave={onLeave} />;
}

function ReviewBody({ review, data, onLeave }: { review: Review; data: MatchData; onLeave: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const breakpoint = useBreakpoint();
  // A laptop's browser gets the one-page review, as the add-drink wizard gets its desk.
  const desk = Platform.OS === 'web' && breakpoint === 'desktop';
  const { toMake } = useDrinkMaker(data);
  const approve = useApproveDrink(review.barId);
  const finish = useBringInSave(review.barId);
  const [error, setError] = useState<string | null>(null);
  const { id, at } = review;
  const recipe = review.recipes[at];
  const choices = review.choices[at];
  const mark = review.marks[at];
  const count = reviewCount(review.marks);
  const busy = approve.isPending || finish.isPending;

  // Every drink checked: what was approved is recorded as one bring-in, then Brought in.
  const end = () => {
    const done = store().reviews[id];
    if (!done?.made.drinkIds.length) {
      store().remove(id);
      return onLeave();
    }
    finish.mutate(
      { kind: 'recipes', source: done.source, drinks: [], made: done.made, title: done.title },
      {
        onSuccess: (saved) => {
          useBringIn.getState().setDone(saved);
          router.replace((saved.batchId ? `/bring-in/done?batch=${saved.batchId}` : '/bring-in/done') as Href);
          store().remove(id);
        },
      }
    );
  };
  const moveOn = () => {
    const next = nextWaiting(store().reviews[id]?.marks ?? [], at);
    if (next === null) end();
    else store().go(id, next);
  };
  const onApprove = () => {
    if (busy || mark === 'approved' || !choices.name.trim()) return;
    setError(null);
    // Marked as soon as it's saved, even if the screen has gone, so it's never approved twice.
    approve.mutateAsync(toMake(recipe, choices)).then(
      (made) => {
        store().mark(id, at, 'approved', made);
        moveOn();
      },
      (e: Error) => setError(e.message)
    );
  };
  const onSkip = () => {
    if (busy || mark === 'approved') return;
    store().mark(id, at, 'skipped');
    moveOn();
  };
  const move = (by: number) => store().go(id, at + by);
  // The full editor saves it; the review waits here for the rest.
  const onEdit = () => {
    const wizardAt = wizardPlace(review.barId);
    const wizard = useDrinkWizardStore.getState();
    wizard.clear(wizardAt);
    wizard.patch(wizardAt, toMake(recipe, choices).draft);
    wizard.setStep(wizardAt, 'review');
    store().mark(id, at, 'edited');
    router.push((review.barId ? `/add-cocktail?barId=${review.barId}` : '/add-cocktail') as Href);
  };
  useReviewKeys(desk, { approve: onApprove, skip: onSkip, move });

  const drink = (
    <RecipeDrink
      key={at}
      recipe={recipe}
      choices={choices}
      onChange={(change) => store().choose(id, at, change)}
      files={review.files}
      from={review.from}
      data={data}
      count={desk ? { at, of: review.recipes.length } : null}
      wide={desk}
      onEdit={onEdit}
    />
  );
  const failed = error ?? (finish.error ? finish.error.message : null);
  const status = mark === 'approved' ? 'Approved and in the Library.' : mark === 'edited' ? 'Opened in the editor. Approve it here if you didn’t save it there.' : null;
  const note = status ?? openPickLine(recipe, choices, data);
  const approveLabel = finish.isPending || approve.isPending ? 'Saving…' : desk ? 'Approve and next' : 'Approve';
  const buttons =
    mark === 'approved' ? (
      <Button label="Next drink" size="lg" disabled={busy} onPress={moveOn} style={desk ? undefined : styles.flex} />
    ) : (
      <>
        <Button label="Skip" size="lg" variant="secondary" disabled={busy} onPress={onSkip} />
        <Button label={approveLabel} size="lg" disabled={busy || !choices.name.trim()} onPress={onApprove} style={desk ? undefined : styles.flex} />
      </>
    );

  if (desk) {
    return (
      <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
        <View style={[styles.deskHead, { borderBottomColor: ds.c.line }]}>
          <View style={styles.title}>
            <Caption tone="muted">Bring in</Caption>
            <Body style={styles.semibold} numberOfLines={1}>
              {review.title}
            </Body>
          </View>
          <View style={styles.flex}>
            <ReviewBar count={count} />
          </View>
          <Button label="Finish later" size="lg" variant="secondary" disabled={busy} onPress={onLeave} />
        </View>
        <View style={styles.columns}>
          <DrinkList review={review} onPick={(i) => store().go(id, i)} />
          <View style={styles.flex}>
            <ScrollView contentContainerStyle={styles.middle} keyboardShouldPersistTaps="handled">
              {drink}
            </ScrollView>
            <View style={[styles.deskFoot, { borderTopColor: ds.c.line }]}>
              {note || failed ? <Caption tone={failed ? 'accent' : 'muted'}>{failed ?? note}</Caption> : null}
              <View style={styles.row}>
                {buttons}
                <Caption tone="muted" style={styles.hint}>
                  A approves · S skips · arrow keys move
                </Caption>
              </View>
            </View>
          </View>
          <FileColumn recipe={recipe} files={review.files} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled">
        <View style={styles.phoneHead}>
          <View style={styles.top}>
            <TextLink label="Finish later" tone="ink" accessibilityHint="Keeps the rest on this device, to carry on from the Library" onPress={() => !busy && onLeave()} />
            <Caption tone="muted" style={styles.mono}>{`Drink ${at + 1} of ${review.recipes.length}`}</Caption>
          </View>
          <ReviewBar count={count} form="short" />
        </View>
        {drink}
        {failed ? <Caption tone="accent">{failed}</Caption> : null}
      </ScrollView>
      <CheckFooter note={note}>
        <View style={styles.row}>{buttons}</View>
      </CheckFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.lg, paddingBottom: space.xxl },
  phoneHead: { gap: space.md },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mono: { fontFamily: fontFamilies.mono },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  flex: { flex: 1, minWidth: 0 },
  deskHead: { flexDirection: 'row', alignItems: 'center', gap: space.lg + 4, paddingVertical: space.lg + 2, paddingHorizontal: space.xl, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { maxWidth: 320 },
  semibold: { fontFamily: fontFamilies.bodySemiBold },
  columns: { flex: 1, flexDirection: 'row', minHeight: 0 },
  middle: { paddingVertical: space.xl - 2, paddingHorizontal: space.xl + 4, gap: space.lg, maxWidth: 760 },
  deskFoot: { paddingVertical: space.lg, paddingHorizontal: space.xl + 4, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  hint: { marginLeft: space.sm },
});
