import * as Device from 'expo-device';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Sheet, Title } from '@/components/ds';
import { space } from '@/constants/tokens';
import { pickBottlePhoto, takeBottlePhoto, type BottlePhoto } from '@/lib/readBottle';

import { useStartBringIn } from '../bringin/useStartBringIn';

/** Where the bottles go: your own shelf, or a venue's ingredients. */
export type BottleTarget = { kind: 'home' } | { kind: 'venue'; barId: string; name: string; canEdit: boolean };

interface BottlePhotoSheetProps {
  visible: boolean;
  target: BottleTarget;
  onClose: () => void;
}

/**
 * Snap a bottle (or a shelf of them): the photo goes to Bring in, read as
 * bottles, and checked there (canvas make-bringin-bottles) before anything
 * goes onto your shelf or into the venue's ingredients.
 */
export function BottlePhotoSheet({ visible, target, onClose }: BottlePhotoSheetProps) {
  const insets = useSafeAreaInsets();
  const start = useStartBringIn();
  const [error, setError] = useState<string | null>(null);
  // The simulator has no camera, and launching it there crashes the app.
  const camera = Platform.OS !== 'web' && Device.isDevice;
  const where = target.kind === 'home' ? 'your shelf' : `${target.name}’s ingredients`;
  const barId = target.kind === 'venue' && target.canEdit ? target.barId : null;

  const get = async (from: () => Promise<BottlePhoto | null>) => {
    setError(null);
    try {
      const photo = await from();
      if (!photo) return;
      onClose();
      start([{ files: [photo], text: null, url: null }], { as: 'bottles', barId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t open your photos.');
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel="Snap a bottle">
      <View style={[styles.body, { paddingBottom: insets.bottom + space.xl }]}>
        <Title>Snap a bottle</Title>
        <Body tone="muted">{`The front labels, a few bottles side by side is fine. You check what we found before anything goes into ${where}.`}</Body>
        {target.kind === 'venue' && !target.canEdit ? <Caption tone="muted">Adding to the venue opens at Drink Creator, so these come into your own shelf.</Caption> : null}
        {error ? <Caption tone="accent">{error}</Caption> : null}
        <View style={styles.buttons}>
          {camera ? <Button label="Take a photo" icon="camera.fill" size="lg" onPress={() => void get(takeBottlePhoto)} /> : null}
          <Button label="Choose a photo" icon="photo" size="lg" variant={camera ? 'secondary' : 'primary'} onPress={() => void get(pickBottlePhoto)} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl - 4, paddingTop: space.md, gap: space.lg },
  buttons: { gap: space.sm },
});
