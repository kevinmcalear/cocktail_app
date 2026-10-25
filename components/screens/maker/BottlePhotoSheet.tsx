import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, GlassButton, Sheet, SheetScrollView, Title, useBreakpoint, useDs, useSheetClose } from '@/components/ds';
import { IngredientPhoto } from '@/components/ds/IngredientDrawing';
import { pickDrinkPhotos, takeDrinkPhoto } from '@/components/drink/drinkImages';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useSetMakerBottlePicture, type MakerBottlePhoto } from '@/hooks/useMakerPhotos';
import { useWebImageDrop } from '@/hooks/useWebImageDrop';
import { cutout, cutoutAvailable } from '@/modules/subject-cutout';

const WHERE = 'Shows to everyone: on its page, in specs, in Libraries and on back bars.';
const RULES = ['Front on, the whole bottle in the frame.', 'The label you sell now.', 'Nothing redrawn: no edits to the label, no AI.'];

/** A photo picked here: the file as taken, and the bottle lifted off it (phones that can; null elsewhere). */
type Picked = { original: string; cut: string | null };

/**
 * "Its picture" for a maker's bottle (ppl-maker board, step 3): take or choose
 * a square photo; phones that can lift the bottle off its background show it
 * before and after, cut out on the drawings' paper. The web keeps the square
 * crop for now. Use this photo saves it; Keep the drawing puts a bottle with
 * a photo back to its drawing.
 */
export function BottlePhotoSheet({ profileId, bottle, current, onClose }: { profileId: string; bottle: { id: string; name: string }; current: MakerBottlePhoto | null; onClose: () => void }) {
  const ds = useDs();
  const wide = useBreakpoint() !== 'phone';
  const save = useSetMakerBottlePicture(profileId);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [cutting, setCutting] = useState(false);
  const [dropping, setDropping] = useState(false);

  const take = async (uri: string | null | undefined) => {
    if (!uri) return;
    if (!cutoutAvailable) return setPicked({ original: uri, cut: null });
    setCutting(true);
    const cut = await cutout(uri);
    setCutting(false);
    setPicked({ original: uri, cut: cut?.uri ?? null });
  };
  const choose = async () => take((await pickDrinkPhotos({ square: true }))[0]);
  const shoot = async () => take(await takeDrinkPhoto({ square: true }));
  const dropRef = useWebImageDrop(Platform.OS === 'web' ? (uris) => void take(uris[0]) : undefined, setDropping);

  return (
    <Sheet visible onClose={onClose} accessibilityLabel={`Its picture, ${bottle.name}`} style={[styles.sheet, wide ? styles.wide : null]} header={<Head name={bottle.name} wide={wide} />}>
      <SheetScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <Caption tone="muted">{WHERE}</Caption>
        <View ref={dropRef} style={styles.pair}>
          {cutting ? (
            <Tile solo caption="Cutting out the bottle…"><Centered><ActivityIndicator /></Centered></Tile>
          ) : picked ? (
            <>
              <Tile solo={!picked.cut} caption="Your photo" raw><IngredientPhoto url={picked.original} /></Tile>
              {picked.cut ? (
                <>
                  <View style={styles.arrow} aria-hidden><IconSymbol name="arrow.right" size={22} color={ds.c.muted} /></View>
                  <Tile caption="Cut out, on the same paper as the drawings"><IngredientPhoto url={picked.cut} /></Tile>
                </>
              ) : null}
            </>
          ) : current ? (
            <Tile solo caption={current.checked ? 'The photo it shows now' : 'Waiting for a check'}><IngredientPhoto url={current.url} /></Tile>
          ) : (
            <Empty dropping={dropping} onTake={Platform.OS === 'web' ? null : () => void shoot()} onChoose={() => void choose()} />
          )}
        </View>
        {picked && !picked.cut && !cutting ? <Caption tone="muted">{cutoutAvailable ? 'We couldn’t find the bottle in this one, so it shows as you took it, cropped square.' : 'It shows cropped square.'}</Caption> : null}
        <View role="list" style={styles.rules}>
          {RULES.map((r) => (
            <View key={r} role="listitem" style={styles.rule}>
              <IconSymbol name="checkmark" size={16} color={ds.accentText} />
              <Caption tone="muted" style={styles.flex}>{r}</Caption>
            </View>
          ))}
        </View>
        {save.error ? <Caption tone="accent" role="alert">{save.error.message}</Caption> : null}
        <Actions
          wide={wide}
          busy={save.isPending || cutting}
          canUse={!!picked}
          hasPhoto={!!current}
          onUse={() => save.mutateAsync({ itemId: bottle.id, picture: 'photo', photo: picked?.cut ?? picked?.original })}
          onAnother={picked ? () => void choose() : null}
          onDrawing={current ? () => save.mutateAsync({ itemId: bottle.id, picture: 'drawing' }) : null}
        />
      </SheetScrollView>
    </Sheet>
  );
}

function Head({ name, wide }: { name: string; wide: boolean }) {
  const close = useSheetClose();
  return (
    <View style={styles.head}>
      <View style={styles.flex}>
        <Caption tone="muted" numberOfLines={1}>{name}</Caption>
        <Title>Its picture</Title>
      </View>
      {wide ? <GlassButton accessibilityLabel="Close" icon="xmark" onPress={close} /> : null}
    </View>
  );
}

/** Use this photo, Try another photo and Keep the drawing; a save that worked slides the sheet away. */
function Actions({ wide, busy, canUse, hasPhoto, onUse, onAnother, onDrawing }: { wide: boolean; busy: boolean; canUse: boolean; hasPhoto: boolean; onUse: () => Promise<void>; onAnother: (() => void) | null; onDrawing: (() => Promise<void>) | null }) {
  const close = useSheetClose();
  const after = (run: () => Promise<void>) => () => void run().then(close, () => undefined);
  const use = <Button label={busy ? 'Saving…' : 'Use this photo'} size={wide ? 'md' : 'lg'} disabled={!canUse || busy} onPress={after(onUse)} />;
  const another = onAnother ? <Button label="Try another photo" variant="secondary" icon="photo" disabled={busy} onPress={onAnother} /> : null;
  const drawing = <Button label="Keep the drawing" variant="secondary" disabled={busy} onPress={onDrawing ? after(onDrawing) : close} accessibilityHint={hasPhoto ? 'Takes its photo off and shows the drawing' : undefined} />;
  if (wide) return <View style={styles.actionsWide}>{drawing}{another}{use}</View>;
  return (
    <View style={styles.actions}>
      {use}
      {another}
      {drawing}
    </View>
  );
}

function Empty({ dropping, onTake, onChoose }: { dropping: boolean; onTake: (() => void) | null; onChoose: () => void }) {
  const ds = useDs();
  return (
    <View style={[styles.empty, { borderColor: ds.c.lineStrong, backgroundColor: dropping ? ds.c.line : 'transparent' }]}>
      <IconSymbol name="camera.fill" size={28} color={ds.c.ink} />
      <Body align="center">{onTake ? 'A photo of the bottle, front on' : 'Drop a photo of the bottle, or choose one'}</Body>
      <View style={styles.choices}>
        {onTake ? <Button label="Take a photo" variant="secondary" icon="camera" onPress={onTake} /> : null}
        <Button label="Choose a photo" variant="secondary" icon="photo" onPress={onChoose} />
      </View>
    </View>
  );
}

/** One picture with its caption: a raw photo on its own, anything else on the drawings' paper. */
/** `solo`: the only picture in the row, kept to a size that leaves the buttons in view. */
function Tile({ caption, raw, solo, children }: { caption: string; raw?: boolean; solo?: boolean; children: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.tile, solo ? styles.solo : null]}>
      <View style={[styles.frame, { backgroundColor: raw ? ds.c.raised : ds.c.paper }]}>{children}</View>
      <Caption tone="muted">{caption}</Caption>
    </View>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  wide: { maxWidth: 680, padding: space.xl },
  scroll: { flexShrink: 1 },
  body: { gap: space.md, paddingBottom: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.xs },
  pair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  tile: { flex: 1, minWidth: 0, gap: space.xs },
  solo: { flex: 0, width: '100%', maxWidth: 280 },
  frame: { width: '100%', aspectRatio: 1, borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden' },
  arrow: { paddingBottom: space.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', gap: space.md, padding: space.lg, borderWidth: 2, borderStyle: 'dashed', borderRadius: radius.card },
  rules: { gap: space.xs },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  actions: { gap: space.sm },
  actionsWide: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: space.sm },
  choices: { alignSelf: 'stretch', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
