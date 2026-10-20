import { Image } from 'expo-image';
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

/** Step 1's angles, in the order drawn: straight down, eye level, the garnish close up. */
const START_SLOTS: { angle: ImageAngle; label: string; brief: string }[] = [
  { angle: 'top', label: 'Top', brief: 'straight down' },
  { angle: 'side', label: 'Side', brief: 'eye level' },
  { angle: 'garnish', label: 'Close up', brief: 'the garnish' },
];

/**
 * Photos at the start (Ian at Bar Snack, 16 Oct; board create-eddie-oct16):
 * the hero wide, then three angles. The same draft photos the review shows.
 * Nothing at a venue that doesn't let you add photos.
 */
export function StartPhotos({ photos, onChange, barId }: { photos: Photos; onChange: (photos: Photos) => void; barId: string | null }) {
  const ds = useDs();
  const caps = useCapabilities(barId).data;
  const { choose, remove } = usePhotoSlots(photos, onChange);
  if (barId && !caps?.includes('photos')) return null;
  const hero = photos.hero;
  const removeButton = (angle: ImageAngle, name: string) => (
    <PressableScale role="button" onPress={() => remove(angle)} accessibilityLabel={`Remove the ${name} photo`} hitSlop={space.sm} style={[styles.remove, { backgroundColor: ds.c.ground }]}>
      <IconSymbol name="xmark" size={10} color={ds.c.ink} />
    </PressableScale>
  );
  return (
    <View style={styles.stack}>
      <Eyebrow>Photos</Eyebrow>
      <View>
        <PressableScale
          role="button"
          onPress={() => choose('hero')}
          accessibilityLabel={hero ? 'Hero photo added. Change it' : 'Add a photo: the one that leads the drink page'}
          style={[styles.wide, hero ? { backgroundColor: ds.c.paper } : [styles.empty, { borderColor: ds.c.lineStrong }]]}
        >
          {hero ? <Image source={{ uri: hero }} style={StyleSheet.absoluteFill} contentFit="cover" /> : (
            <>
              <IconSymbol name="camera" size={22} color={ds.c.ink} />
              <Body>Add a photo</Body>
            </>
          )}
        </PressableScale>
        {hero ? removeButton('hero', 'hero') : null}
      </View>
      <View style={styles.row}>
        {START_SLOTS.map(({ angle, label, brief }) => {
          const uri = photos[angle];
          return (
            <View key={angle} style={styles.cell}>
              <PressableScale
                role="button"
                onPress={() => choose(angle)}
                accessibilityLabel={uri ? `${label} photo added. Change it` : `Add a ${label.toLowerCase()} photo: ${brief}`}
                style={[styles.angle, uri ? { backgroundColor: ds.c.paper } : [styles.empty, { borderColor: ds.c.lineStrong }]]}
              >
                {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : (
                  <>
                    <IconSymbol name="camera" size={18} color={ds.c.ink} />
                    <Caption>{label}</Caption>
                    <Caption tone="muted">{brief}</Caption>
                  </>
                )}
              </PressableScale>
              {uri ? removeButton(angle, label.toLowerCase()) : null}
            </View>
          );
        })}
      </View>
      <Caption tone="muted">Got photos? They lead the drink page. No photo, and the drawing stands in.</Caption>
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
  angle: { minHeight: 92, padding: space.sm, borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 2 },
  onPicture: { position: 'absolute', left: space.xs, bottom: space.xs },
  remove: { position: 'absolute', top: -space.xs, right: -space.xs, width: 20, height: 20, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
