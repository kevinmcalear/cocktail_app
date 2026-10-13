import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Display, PressableScale, Spec, useDs, useGutter } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useUndoBringIn } from '@/hooks/useBringInBatches';
import { canUndo, fromLine, type BatchSummary } from '@/lib/bringInBatch';
import { useBringIn } from '@/store/useBringIn';

/** What Brought in shows: a saved batch, or a save that couldn't be recorded as one. */
export interface BroughtInView {
  batchId: string | null;
  title: string;
  source: string;
  menuId: string | null;
  drinkIds: string[];
  barId: string | null;
  summary: BatchSummary;
  createdAt: string;
  undoneAt: string | null;
  warnings?: string[];
}

function Made({ label, detail, count, onPress }: { label: string; detail?: string; count: number; onPress?: () => void }) {
  const ds = useDs();
  const body = (
    <>
      <Body style={styles.flex} numberOfLines={2}>
        {label}
        {detail ? <Body tone="muted">{` (${detail})`}</Body> : null}
      </Body>
      <Spec tone="muted">{String(count)}</Spec>
    </>
  );
  return onPress ? (
    <PressableScale role="link" accessibilityLabel={`${label} ${detail ?? ''} ${count}`} onPress={onPress} style={[styles.made, { borderBottomColor: ds.c.line }]}>
      {body}
    </PressableScale>
  ) : (
    <View style={[styles.made, { borderBottomColor: ds.c.line }]}>{body}</View>
  );
}

function Blank({ label, action, onPress }: { label: string; action: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={`${label}. ${action}`} onPress={onPress} style={[styles.made, { borderBottomColor: ds.c.line }]}>
      <View style={[styles.dash, { borderColor: ds.accentText }]} />
      <Body style={styles.flex}>{label}</Body>
      <Caption tone="accent">{action}</Caption>
    </PressableScale>
  );
}

const names = (list: string[]) => (list.length > 3 ? `${list.slice(0, 3).join(', ')} and ${list.length - 3} more` : list.join(', '));

/**
 * Brought in (canvas make-bringin-done): what one bring-in made, grouped so
 * it can all be undone until tomorrow, what's still blank, and where to go next.
 */
export function BroughtIn({ view }: { view: BroughtInView }) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const undo = useUndoBringIn();
  const queue = useBringIn((s) => s.queue);
  const [undone, setUndone] = useState<{ removed: number; kept: number } | null>(null);
  const s = view.summary;
  const undoable = !!view.batchId && !undone && canUndo(view);
  const go = (href: string) => router.push(href as Href);
  const drinks = s.drinksNew + s.drinksHad;
  const drinkDetail = [s.drinksNew ? `${s.drinksNew} new` : null, s.drinksHad ? `${s.drinksHad} already yours` : null].filter(Boolean).join(', ');

  const next = () => {
    if (useBringIn.getState().next(view.barId)) router.replace('/bring-in' as Href);
  };
  const primary = queue.length
    ? { label: `Check the next one${queue[0].name ? ` (${queue[0].name})` : ''}`, onPress: next }
    : view.menuId
      ? { label: 'Open the menu', onPress: () => go(`/menus/${view.menuId}/edit`) }
      : view.drinkIds.length === 1
        ? { label: 'Open the drink', onPress: () => go(`/cocktail/${view.drinkIds[0]}`) }
        : s.kind === 'bottles' && !view.barId
          ? { label: 'Open My Bar', onPress: () => router.replace('/(tabs)' as Href) }
          : { label: 'Done', onPress: () => router.replace('/(tabs)' as Href) };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.xxxl, paddingHorizontal: gutter }]}>
        <View style={styles.head}>
          <IconSymbol name={undone ? 'arrow.uturn.backward' : 'checkmark.circle.fill'} size={44} color={ds.accentText} />
          <Display>{undone ? 'Undone' : 'Brought in'}</Display>
          <Body tone="muted">
            {undone
              ? `Took back ${undone.removed}.${undone.kept ? ` ${undone.kept} stayed, because something made since uses ${undone.kept === 1 ? 'it' : 'them'}.` : ''}`
              : `${fromLine(view)}${undoable ? ' Everything below is grouped, so you can undo it in one go until tomorrow.' : ''}`}
          </Body>
          {view.warnings?.map((w) => (
            <Caption key={w} tone="accent">
              {w}
            </Caption>
          ))}
        </View>
        {!undone ? (
          <>
            <View>
              <Caption tone="muted" style={styles.eyebrow}>
                MADE
              </Caption>
              {view.menuId ? <Made label={view.title} count={1} onPress={() => go(`/menus/${view.menuId}/edit`)} /> : null}
              {drinks ? <Made label="Drinks" detail={drinkDetail} count={drinks} onPress={view.drinkIds.length === 1 ? () => go(`/cocktail/${view.drinkIds[0]}`) : undefined} /> : null}
              {s.preps.length ? <Made label="Preps" detail={names(s.preps)} count={s.preps.length} /> : null}
              {s.ingredients.length ? <Made label="Ingredients" detail={names(s.ingredients)} count={s.ingredients.length} /> : null}
              {s.bottles ? <Made label="Bottles" detail={view.barId ? 'in the venue’s ingredients' : 'on My Bar'} count={s.bottles} /> : null}
            </View>
            {s.noAmounts || s.prepsNoRecipe.length ? (
              <View>
                <Caption tone="muted" style={styles.eyebrow}>
                  STILL BLANK
                </Caption>
                {s.noAmounts ? <Blank label={`${s.noAmounts} new ${s.noAmounts === 1 ? 'drink has' : 'drinks have'} no amounts`} action="Snap the specs" onPress={() => useBringIn.getState().openSheet()} /> : null}
                {s.prepsNoRecipe.map((p) => (
                  <Blank key={p.id} label={`${p.name} needs a recipe`} action="Add" onPress={() => go(`/ingredient/${p.id}/edit`)} />
                ))}
              </View>
            ) : null}
          </>
        ) : null}
        {undo.error ? <Caption tone="accent">{undo.error.message}</Caption> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg, paddingHorizontal: gutter }]}>
        <Button label={undone ? 'Done' : primary.label} size="lg" onPress={undone ? () => router.replace('/(tabs)' as Href) : primary.onPress} />
        <View style={styles.row}>
          <Button label="Bring in more" size="lg" variant="secondary" onPress={() => useBringIn.getState().openSheet()} style={styles.flex} />
          {undoable ? (
            <UndoAll pending={undo.isPending} onPress={() => undo.mutate(view.batchId!, { onSuccess: setUndone })} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** "Undo all until tomorrow", a secondary button whose label wraps to two lines beside Bring in more (canvas make-bringin-done). */
function UndoAll({ pending, onPress }: { pending: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" onPress={onPress} disabled={pending} aria-disabled={pending} accessibilityLabel="Undo all until tomorrow" style={[styles.undo, { borderColor: ds.c.lineStrong, opacity: pending ? 0.45 : 1 }]}>
      <IconSymbol name="arrow.uturn.backward" size={16} color={ds.c.muted} />
      <Body numberOfLines={2} align="center" style={styles.undoLabel}>
        {pending ? 'Undoing…' : 'Undo all until tomorrow'}
      </Body>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.xl + 4, paddingBottom: space.xl },
  head: { gap: space.sm + 2 },
  eyebrow: { letterSpacing: 0.6 },
  made: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  dash: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 1.5, borderStyle: 'dashed' },
  footer: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.sm + 2, paddingTop: space.md },
  row: { flexDirection: 'row', gap: space.sm + 2 },
  flex: { flex: 1 },
  undo: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1 },
  undoLabel: { flexShrink: 1, fontFamily: fontFamilies.bodySemiBold },
});
