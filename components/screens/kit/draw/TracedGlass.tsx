import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Switch, TextLink, useDs } from '@/components/ds';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import type { BarGlass } from '@/hooks/useBarGlassware';
import { useDeleteGlassPhoto, useDrinksDrawnIn, useGlassPhotoUrl, useGlassShare, useSetGlassShared } from '@/hooks/useGlassDrawing';
import { confirmAsync } from '@/lib/dialogs';
import { aboutMl, mmText } from '@/lib/drawGlass';
import { holdsMl } from '@/lib/glassTrace';
import type { KitFact } from '../KitItemPage';

// A glass drawn from its own photo, opened (Draw my glass, step 6): its size
// and where each number came from, the drinks drawn in it, sharing it with
// the catalog (Open decisions d56, d58, d59) and its private photo (d57).

/** "Hollow Fire Studio · drawn from your photo" */
export const drawnLine = (g: BarGlass) => [g.maker, 'drawn from your photo'].filter(Boolean).join(' · ');

/** Its height and what it holds, each with where it came from. */
export function tracedFacts(g: BarGlass, onFix?: () => void): KitFact[] {
  if (!g.outline) return [];
  const byCapacity = g.capacity_ml != null;
  return [
    { label: byCapacity ? 'Height · from the shape' : 'Height · you typed it', value: mmText(g.outline.height_mm), onChange: byCapacity ? undefined : onFix },
    {
      label: byCapacity ? 'Holds to the brim · you typed it' : 'Holds to the brim · from the shape',
      value: byCapacity ? `${Math.round(g.capacity_ml!)} ml` : aboutMl(holdsMl(g.outline)),
      onChange: byCapacity ? onFix : undefined,
    },
  ];
}

/** "Saved on Little Rye’s glassware. Next: where it comes from." */
export function SavedNote({ where }: { where: string }) {
  const ds = useDs();
  return (
    <View role="status" style={[styles.note, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name="checkmark.circle.fill" size={18} color={ds.c.ink} />
      <Body style={styles.flex}>{`Saved on ${where}. Next: where it comes from.`}</Body>
    </View>
  );
}

/** "4 drinks are drawn in it now", with the first two drawn. Only for the main glass of its type. */
export function DrinksDrawnIn({ barId, glass }: { barId: string; glass: BarGlass }) {
  const ds = useDs();
  const { data } = useDrinksDrawnIn(barId, glass.glass, glass.is_default);
  if (!glass.is_default || !data?.count) return null;
  const more = data.count - data.first.length;
  return (
    <View style={styles.stack}>
      <Body>{`${data.count} ${data.count === 1 ? 'drink is' : 'drinks are'} drawn in it now`}</Body>
      <View style={styles.drinks}>
        {data.first.map((d) => (
          <View key={d.id} style={[styles.drink, { backgroundColor: ds.c.paper }]} aria-hidden>
            <SketchDrawing inputs={d.inputs} seed={d.id} detail="thumb" />
          </View>
        ))}
        {more > 0 ? (
          <View style={[styles.drink, styles.more, { backgroundColor: ds.c.surface }]}>
            <Caption tone="muted">{`+${more}`}</Caption>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Share it with other bars: off unless turned on; in review until the Cocktail team checks it. */
export function ShareGlass({ glass, home, venueName, canEdit }: { glass: BarGlass; home: boolean; venueName: string; canEdit: boolean }) {
  const ds = useDs();
  const of = home ? { home_glass_id: glass.id } : { bar_glass_id: glass.id };
  const { data: share, isLoading } = useGlassShare(of);
  const set = useSetGlassShared(of);
  const others = home ? 'Share it with everyone' : 'Share it with other bars';
  const name = [glass.name, glass.maker].filter(Boolean).join(', ');
  if (isLoading) return null;
  const body =
    share?.status === 'in_review' ? (
      <>
        <View style={styles.row}>
          <Body style={styles.flex}>{home ? 'Shared with everyone' : 'Shared with other bars'}</Body>
          <Caption tone="muted">In review</Caption>
        </View>
        <Caption tone="muted">
          {`Sent ${new Date(share.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}. Once it’s checked it shows in the catalog as “${name}”${home ? '' : `, drawn from ${venueName}’s photo`}. Until then only ${home ? 'you see' : `${venueName} sees`} it.`}
        </Caption>
        {canEdit ? <Button label={set.isPending ? 'Stopping…' : 'Stop sharing'} variant="secondary" disabled={set.isPending} onPress={() => set.mutate(false)} style={styles.start} /> : null}
      </>
    ) : share?.status === 'added' ? (
      <Body>{`In the catalog as “${name}”${home ? '' : `, drawn from ${venueName}’s photo`}.`}</Body>
    ) : share?.status === 'declined' ? (
      <>
        <Body>Not added to the catalog</Body>
        {share.note ? <Caption tone="muted">{share.note}</Caption> : null}
      </>
    ) : (
      <>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Body>{others}</Body>
            <Caption tone="muted">It joins the catalog after a review, so anyone can find it in “Which glass is it?”. Off unless you turn it on.</Caption>
          </View>
          <Switch value={false} onValueChange={(on) => on && set.mutate(true)} label={others} disabled={!canEdit || set.isPending} />
        </View>
        <Caption tone="muted">Shared: the outline, name, kind{home ? '' : ', maker'} and the number you typed. Your photo goes to the review only.</Caption>
      </>
    );
  return (
    <View style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      {body}
      {set.error ? (
        <Caption tone="accent" role="alert">
          Couldn’t change that. Check your connection and try again.
        </Caption>
      ) : null}
    </View>
  );
}

/** The photo it was traced from: private to the venue (or to you at home), with Delete photo. */
export function GlassPhoto({ glass, home, venueName, canEdit, invalidate }: { glass: BarGlass; home: boolean; venueName: string; canEdit: boolean; invalidate: readonly unknown[] }) {
  const ds = useDs();
  const { data: url } = useGlassPhotoUrl(glass.photo_path);
  const remove = useDeleteGlassPhoto(home ? 'home_glassware' : 'bar_glassware', invalidate);
  if (!glass.photo_path) return null;
  const ask = async () => {
    const ok = await confirmAsync({
      title: 'Delete the photo?',
      message: 'The drawing stays. Without the photo it can’t be traced again: a new photo would be needed.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) remove.mutate({ id: glass.id, path: glass.photo_path! });
  };
  return (
    <View style={[styles.photoRow, { backgroundColor: ds.c.surface }]}>
      {url ? <Image source={{ uri: url }} style={styles.photo} contentFit="cover" accessibilityLabel="Your photo of the glass" /> : <View style={[styles.photo, { backgroundColor: ds.c.raised }]} />}
      <View style={styles.flex}>
        <Body>Your photo</Body>
        <Caption tone="muted">{home ? 'Only you see it.' : `Only ${venueName}’s team sees it.`} Never shown in public.</Caption>
      </View>
      {canEdit ? <TextLink label={remove.isPending ? 'Deleting…' : 'Delete photo'} onPress={() => void ask()} /> : null}
    </View>
  );
}

/** Redraw from a new photo, Fix the height. */
export function RedrawLinks({ glass, onRedraw, onFix }: { glass: BarGlass; onRedraw: () => void; onFix: () => void }) {
  return (
    <View style={styles.links}>
      <TextLink label="Redraw from a new photo" onPress={onRedraw} />
      <TextLink label={glass.capacity_ml != null ? 'Fix the capacity' : 'Fix the height'} onPress={onFix} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  start: { alignSelf: 'flex-start' },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  drinks: { flexDirection: 'row', gap: space.sm },
  drink: { width: 72, height: 72, borderRadius: radius.control, overflow: 'hidden' },
  more: { alignItems: 'center', justifyContent: 'center' },
  card: { gap: space.sm, padding: space.md, borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.card, borderCurve: 'continuous' },
  photo: { width: 56, height: 56, borderRadius: radius.control },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
});
