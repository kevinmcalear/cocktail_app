import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Caption, PressableScale, useDs } from '@/components/ds';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { CutoutOfferHost } from '@/components/drink/CutoutOfferHost';
import { pickDrinkPhotos } from '@/components/drink/drinkImages';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import type { ImageAngle } from '@/lib/itemImages';
import { showMessage } from '@/lib/dialogs';
import { SERVICE_ANGLES } from '@/lib/servicePhotos';
import type { SketchInputs } from '@/lib/sketch/types';

import { Eyebrow } from './WizardChrome';

type Photos = Partial<Record<ImageAngle, string>>;

const SLOTS: { angle: ImageAngle; label: string }[] = [{ angle: 'hero', label: 'Hero' }, ...SERVICE_ANGLES.map(({ angle, label }) => ({ angle, label }))];

/**
 * The review's photo slots: the hero (the sketch until a photo is added)
 * and the four service angles. Photos are kept on the draft and uploaded
 * when the drink is saved (useCreateDrink).
 */
export function ReviewPhotos({ photos, onChange, sketch, seed }: { photos: Photos; onChange: (photos: Photos) => void; sketch: SketchInputs; seed: string }) {
  const ds = useDs();
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
  onPicture: { position: 'absolute', left: space.xs, bottom: space.xs },
  remove: { position: 'absolute', top: -space.xs, right: -space.xs, width: 20, height: 20, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
