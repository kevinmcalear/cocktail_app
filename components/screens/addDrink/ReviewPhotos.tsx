import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, useDs } from '@/components/ds';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { CutoutOfferHost } from '@/components/drink/CutoutOfferHost';
import { pickDrinkPhotos } from '@/components/drink/drinkImages';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import type { ImageAngle } from '@/lib/itemImages';
import { showMessage } from '@/lib/dialogs';
import { SERVICE_ANGLES } from '@/lib/servicePhotos';
import type { SketchInputs } from '@/lib/sketch/types';

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
 * The draft page's photos: at home one, the one that leads the drink's page
 * (Q15), more angles go on the page; at a venue the slots, for those who may
 * add photos, and nothing for anyone else.
 */
export function DraftPhotos({ barId, photos, onChange, sketch, seed }: { barId: string | null; photos: Photos; onChange: (photos: Photos) => void; sketch: SketchInputs; seed: string }) {
  const caps = useCapabilities(barId).data;
  if (!barId) return <HomePhoto photos={photos} onChange={onChange} />;
  return caps?.includes('photos') ? <ReviewPhotos photos={photos} onChange={onChange} sketch={sketch} seed={seed} /> : null;
}

/** At home, one photo: the one that leads the drink's page. */
function HomePhoto({ photos, onChange }: { photos: Photos; onChange: (photos: Photos) => void }) {
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
          {hero ? (
            <Image source={{ uri: hero }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
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
 * With a hero photo: whether the drawing stays on the drink's page after the
 * photos. Removed to start (Kevin's call B, 26 Oct), Keep it in one tap.
 */
export function DrawingChoice({ kept, onChange }: { kept: boolean; onChange: (keep: boolean) => void }) {
  const ds = useDs();
  return (
    <View style={styles.drawing}>
      <IconSymbol name="pencil" size={16} color={ds.c.muted} />
      <Body style={styles.flex}>{kept ? 'Drawing: after the photos' : 'Drawing removed'}</Body>
      <Button label={kept ? 'Remove' : 'Keep it'} size="sm" variant="secondary" accessibilityLabel={kept ? 'Remove the drawing: photos only on the drink’s page' : 'Keep the drawing, after the photos'} onPress={() => onChange(!kept)} />
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
  drawing: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  onPicture: { position: 'absolute', left: space.xs, bottom: space.xs },
  remove: { position: 'absolute', top: -space.xs, right: -space.xs, width: 20, height: 20, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
