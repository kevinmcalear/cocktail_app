import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, Sheet, SheetScrollView, Title, useDs, useSheetClose } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { angleOf, PHOTO_ANGLES, roomFor, setAngle, type AnglePhotos } from '@/lib/photoAngles';

interface WhichIsWhichProps {
  visible: boolean;
  onClose: () => void;
  /** The rows, in the order they were picked; each is one of the draft's photos. */
  uris: readonly string[];
  photos: AnglePhotos;
  onChange: (photos: AnglePhotos) => void;
  /** Add more: back to the library for the angles still free. */
  onAddMore: () => void;
}

/**
 * "Which is which?" (E26, board w2-wizard-finish): after picking several
 * photos at once, each gets its angle, one angle each; the Hero leads the
 * drink's page. Every tap is kept at once, so closing it any way loses nothing.
 */
export function WhichIsWhich({ visible, onClose, uris, photos, onChange, onAddMore }: WhichIsWhichProps) {
  const ds = useDs();
  const count = uris.length;
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel="Which is which?" style={styles.sheet} header={<Title>Which is which?</Title>}>
      <SheetScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <Caption tone="muted">{`${count} photo${count === 1 ? '' : 's'} picked. Give each its angle; the Hero leads the drink’s page.`}</Caption>
        {uris.map((uri, i) => {
          const angle = angleOf(photos, uri);
          return (
            <View key={uri} style={[styles.row, { borderBottomColor: ds.c.line }]}>
              <Image source={{ uri }} style={styles.photo} contentFit="cover" accessibilityLabel={`Photo ${i + 1}`} />
              <View role="radiogroup" accessibilityLabel={`Which angle is photo ${i + 1}`} style={styles.chips}>
                {PHOTO_ANGLES.map((a) => (
                  <Chip key={a.angle} label={a.label} quiet selected={angle === a.angle} onPress={() => onChange(setAngle(photos, uri, a.angle))} />
                ))}
              </View>
            </View>
          );
        })}
        <View style={styles.footer}>
          {roomFor(photos) ? <Button label="Add more" variant="secondary" onPress={onAddMore} /> : null}
          <Done />
        </View>
      </SheetScrollView>
    </Sheet>
  );
}

function Done() {
  const close = useSheetClose();
  return <Button label="Done" onPress={close} style={styles.done} />;
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  scroll: { flexShrink: 1 },
  body: { gap: space.sm, paddingBottom: space.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  photo: { width: 88, height: 88, borderRadius: radius.control },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  footer: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  done: { flex: 1 },
});
