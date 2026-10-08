import * as Device from 'expo-device';
import { Image } from 'expo-image';
import { Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Title, useDs, useGutter } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { pickBottlePhoto, takeBottlePhoto, type BottlePhoto } from '@/lib/readBottle';

import { BottleResultRow } from './BottleResultRow';
import { useBottlePhoto, type BottleTarget } from './useBottlePhoto';

interface BottlePhotoSheetProps {
  visible: boolean;
  target: BottleTarget;
  onClose: () => void;
}

/**
 * Photograph a bottle (or a few) and the label is read and found in the
 * catalog. A sure match goes straight onto your shelf, or into the venue's
 * ingredients; anything less sure waits for you to pick.
 */
export function BottlePhotoSheet({ visible, target, onClose }: BottlePhotoSheetProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const flow = useBottlePhoto(target);
  // The simulator has no camera, and launching it there crashes the app.
  const camera = Platform.OS !== 'web' && Device.isDevice;
  const where = target.kind === 'home' ? 'your shelf' : `${target.name}’s ingredients`;
  const busy = flow.reading || flow.catalogLoading;

  const get = async (from: () => Promise<BottlePhoto | null>) => {
    try {
      const photo = await from();
      if (photo) await flow.readPhoto(photo);
    } catch (e) {
      flow.fail(e instanceof Error ? e.message : 'Couldn’t open your photos.');
    }
  };
  const close = () => {
    flow.reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.sheet, { backgroundColor: ds.c.ground, paddingTop: Platform.OS === 'ios' ? space.lg : insets.top + space.lg }]}>
        <View style={[styles.head, { paddingHorizontal: gutter }]}>
          <Title>Snap a bottle</Title>
          <Button label="Done" variant="secondary" onPress={close} />
        </View>
        <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
          {flow.photo ? (
            <View style={styles.top}>
              <View style={[styles.thumb, { backgroundColor: ds.c.raised }]}>
                <Image source={{ uri: flow.photo.uri }} contentFit="cover" style={styles.fill} accessible accessibilityLabel="Your bottle photo" />
              </View>
              <Body tone="muted" style={styles.flex}>
                {flow.reading ? 'Reading the label…' : flow.rows.length ? `Found ${flow.rows.length === 1 ? 'a bottle' : `${flow.rows.length} bottles`}.` : ''}
              </Body>
            </View>
          ) : (
            <Caption tone="muted">{`Take a photo of the front label. Bottles in the catalog go straight into ${where}. A few bottles side by side work too.`}</Caption>
          )}
          {flow.error ? <Body tone="accent">{flow.error}</Body> : null}
          {flow.error && flow.photo && !flow.reading ? <Button label="Try again" variant="secondary" onPress={flow.retry} style={styles.start} /> : null}
          <View>
            {flow.rows.map((row, i) => (
              <BottleResultRow key={`${row.reading.name}-${i}`} row={row} target={target} onPick={(item, kindId) => flow.pick(i, item, kindId)} onUndo={() => flow.undo(i)} />
            ))}
          </View>
          <View style={styles.buttons}>
            {camera ? <Button label={flow.photo ? 'Take another' : 'Take a photo'} icon="camera.fill" variant={flow.photo ? 'secondary' : 'primary'} disabled={busy} onPress={() => get(takeBottlePhoto)} /> : null}
            <Button label={flow.photo ? 'Choose another' : 'Choose a photo'} icon="photo" variant={camera || flow.photo ? 'secondary' : 'primary'} disabled={busy} onPress={() => get(pickBottlePhoto)} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { gap: space.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  // A fixed size, not aspectRatio: Android lays aspectRatio tiles out at zero in a row.
  thumb: { width: 72, height: 96, borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous' },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  flex: { flex: 1 },
  start: { alignSelf: 'flex-start' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
