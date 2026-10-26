import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { CutoutOfferHost } from '@/components/drink/CutoutOfferHost';
import { pickDrinkPhotos } from '@/components/drink/drinkImages';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import type { ImageAngle } from '@/lib/itemImages';
import { showMessage } from '@/lib/dialogs';
import { addPhotos, angleOf, PHOTO_ANGLES, photoUris, roomFor } from '@/lib/photoAngles';
import { SERVICE_ANGLES } from '@/lib/servicePhotos';
import type { SketchInputs } from '@/lib/sketch/types';

import { WhichIsWhich } from './WhichIsWhich';
import { Eyebrow } from './WizardChrome';

type Photos = Partial<Record<ImageAngle, string>>;

const SLOTS: { angle: ImageAngle; label: string }[] = [{ angle: 'hero', label: 'Hero' }, ...SERVICE_ANGLES.map(({ angle, label }) => ({ angle, label }))];

/** Picks a photo into a slot, or takes it out. Photos stay on the draft until the drink is saved. */
function usePhotoSlots(photos: Photos, onChange: (photos: Photos) => void) {
  const choose = async (angle: ImageAngle) => {
    try {
      const [uri] = await pickDrinkPhotos({ cutout: true });
      if (uri) onChange({ ...photos, [angle]: uri });
    } catch {
      showMessage('Couldn’t open your photos', 'Try again, or add photos on the drink’s page.');
    }
  };
  const remove = (angle: ImageAngle) => {
    const next = { ...photos };
    delete next[angle];
    onChange(next);
  };
  return { choose, remove };
}

/**
 * Photos at the start, at a venue (Ian at Bar Snack, 16 Oct; E26, board
 * w2-wizard-finish): Add photos picks several at once, then "Which is which?"
 * gives each its angle. A tap on a photo opens it again. The same draft
 * photos the review shows. Nothing at a venue that doesn't let you add photos.
 */
export function StartPhotos({ photos, onChange, barId }: { photos: Photos; onChange: (photos: Photos) => void; barId: string | null }) {
  const ds = useDs();
  const caps = useCapabilities(barId).data;
  const { remove } = usePhotoSlots(photos, onChange);
  // The rows of "Which is which?" while it's open, in the order picked.
  const [rows, setRows] = useState<string[] | null>(null);
  if (barId && !caps?.includes('photos')) return null;
  const shown = photoUris(photos);
  const room = roomFor(photos);
  const add = async () => {
    try {
      const uris = (await pickDrinkPhotos({ cutout: true, several: room })).slice(0, room);
      if (!uris.length) return;
      onChange(addPhotos(photos, uris));
      // One photo is the Hero; several need telling apart.
      const next = [...(rows ?? shown), ...uris];
      if (next.length > 1) setRows(next);
    } catch {
      showMessage('Couldn’t open your photos', 'Try again, or add photos on the drink’s page.');
    }
  };
  return (
    <View style={styles.stack}>
      <Eyebrow>{shown.length ? `Photos · ${shown.length}` : 'Photos'}</Eyebrow>
      {shown.length ? (
        <View style={styles.tiles}>
          {shown.map((uri) => {
            const label = PHOTO_ANGLES.find((a) => a.angle === angleOf(photos, uri))?.label ?? '';
            return (
              <View key={uri} style={styles.tileCell}>
                <PressableScale role="button" onPress={() => setRows(shown)} accessibilityLabel={`${label} photo. Change which is which`} style={[styles.thumb, { backgroundColor: ds.c.paper }]}>
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                </PressableScale>
                <Caption tone="muted">{label}</Caption>
                <PressableScale role="button" onPress={() => remove(angleOf(photos, uri)!)} accessibilityLabel={`Remove the ${label.toLowerCase()} photo`} hitSlop={space.sm} style={[styles.remove, { backgroundColor: ds.c.ground }]}>
                  <IconSymbol name="xmark" size={10} color={ds.c.ink} />
                </PressableScale>
              </View>
            );
          })}
          {room ? (
            <PressableScale role="button" onPress={add} accessibilityLabel="Add photos, several at once" style={[styles.thumb, styles.tileCell, styles.addTile, styles.empty, { borderColor: ds.c.lineStrong }]}>
              <IconSymbol name="plus" size={18} color={ds.c.ink} />
              <Caption>Add</Caption>
            </PressableScale>
          ) : null}
        </View>
      ) : (
        <>
          <PressableScale role="button" onPress={add} accessibilityLabel="Add photos, several at once" style={[styles.wide, styles.empty, { borderColor: ds.c.lineStrong }]}>
            <IconSymbol name="camera" size={22} color={ds.c.ink} />
            <Body>Add photos</Body>
          </PressableScale>
          <Caption tone="muted">Got photos? Pick several at once; the Hero leads the drink page. No photo, and the drawing stands in.</Caption>
        </>
      )}
      <WhichIsWhich visible={!!rows} onClose={() => setRows(null)} uris={rows ?? []} photos={photos} onChange={onChange} onAddMore={add} />
      <CutoutOfferHost />
    </View>
  );
}

/**
 * At home, one photo on the review (Q15): the one that leads the drink's
 * page. More angles are added there.
 */
export function HomePhoto({ photos, onChange }: { photos: Photos; onChange: (photos: Photos) => void }) {
  const ds = useDs();
  const { choose, remove } = usePhotoSlots(photos, onChange);
  const hero = photos.hero;
  return (
    <View style={styles.stack}>
      <Eyebrow>Photo</Eyebrow>
      <View>
        <PressableScale
          role="button"
          onPress={() => choose('hero')}
          accessibilityLabel={hero ? 'Photo added. Change it' : 'Add a photo: it leads the drink page'}
          style={[styles.wide, hero ? { backgroundColor: ds.c.paper } : [styles.empty, { borderColor: ds.c.lineStrong }]]}
        >
          {hero ? <Image source={{ uri: hero }} style={StyleSheet.absoluteFill} contentFit="cover" /> : (
            <>
              <IconSymbol name="camera" size={22} color={ds.c.ink} />
              <Body>Add a photo</Body>
            </>
          )}
        </PressableScale>
        {hero ? (
          <PressableScale role="button" onPress={() => remove('hero')} accessibilityLabel="Remove the photo" hitSlop={space.sm} style={[styles.remove, { backgroundColor: ds.c.ground }]}>
            <IconSymbol name="xmark" size={10} color={ds.c.ink} />
          </PressableScale>
        ) : null}
      </View>
      <Caption tone="muted">It leads the drink’s page. Add more angles there.</Caption>
      <CutoutOfferHost />
    </View>
  );
}

/**
 * The review's photo slots: the hero (the sketch until a photo is added)
 * and the four service angles. Photos are kept on the draft and uploaded
 * when the drink is saved (useCreateDrink).
 */
export function ReviewPhotos({ photos, onChange, sketch, seed }: { photos: Photos; onChange: (photos: Photos) => void; sketch: SketchInputs; seed: string }) {
  const ds = useDs();
  const { choose, remove } = usePhotoSlots(photos, onChange);

  return (
    <View style={styles.stack}>
      <Eyebrow>Photos</Eyebrow>
      <View style={styles.row}>
        {SLOTS.map(({ angle, label }) => {
          const uri = photos[angle];
          const hero = angle === 'hero';
          const name = label.toLowerCase();
          return (
            <View key={angle} style={styles.cell}>
              <PressableScale
                role="button"
                onPress={() => choose(angle)}
                accessibilityLabel={uri ? `${label} photo added. Change it` : hero ? 'Hero photo: a sketch for now. Add a photo' : `Add a ${name} photo`}
                style={[
                  styles.tile,
                  uri || hero ? { backgroundColor: ds.c.paper } : [styles.empty, { borderColor: ds.c.lineStrong }],
                ]}
              >
                {uri ? (
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : hero ? (
                  <View style={StyleSheet.absoluteFill}>
                    <SketchDrawing inputs={sketch} seed={seed} detail="full" />
                  </View>
                ) : (
                  <IconSymbol name="plus" size={16} color={ds.c.ink} />
                )}
                <Caption color={uri || hero ? ds.c.sketchInk : ds.c.muted} style={uri || hero ? styles.onPicture : null} numberOfLines={1}>
                  {label}
                </Caption>
              </PressableScale>
              {uri ? (
                <PressableScale role="button" onPress={() => remove(angle)} accessibilityLabel={`Remove the ${name} photo`} hitSlop={space.sm} style={[styles.remove, { backgroundColor: ds.c.ground }]}>
                  <IconSymbol name="xmark" size={10} color={ds.c.ink} />
                </PressableScale>
              ) : null}
            </View>
          );
        })}
      </View>
      <Caption tone="muted">Empty slots show sketches until you add photos.</Caption>
      <CutoutOfferHost />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.xs },
  cell: { flex: 1 },
  tile: { aspectRatio: 1, borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 2 },
  empty: { borderWidth: 1, borderStyle: 'dashed' },
  wide: { height: 150, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // Four to a row, as drawn, on any phone.
  tileCell: { width: '23%', gap: space.xs },
  addTile: { alignSelf: 'flex-start' },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 2 },
  onPicture: { position: 'absolute', left: space.xs, bottom: space.xs },
  remove: { position: 'absolute', top: -space.xs, right: -space.xs, width: 20, height: 20, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
