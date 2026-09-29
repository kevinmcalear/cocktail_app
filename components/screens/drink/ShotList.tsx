import * as Device from 'expo-device';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useBreakpoint, useDs } from '@/components/ds';
import { pickDrinkPhotos, takeDrinkPhoto } from '@/components/drink/drinkImages';
import { radius, space } from '@/constants/tokens';
import { useAddServicePhoto } from '@/hooks/useServicePhotos';
import { showMessage } from '@/lib/dialogs';
import { useWebImageDrop } from '@/hooks/useWebImageDrop';
import type { ServiceShot } from '@/lib/servicePhotos';

const STATUS: Record<ServiceShot['status'], string> = {
  missing: 'No photo yet',
  sketch: 'Sketch only, no photo yet',
  outdated: 'May be out of date: the spec changed after it was taken',
  photo: '',
};

/**
 * The angles still to photograph, for people who can add photos. Each one
 * takes a photo or picks one from the library; on web, a photo can also be
 * dropped on its row.
 */
export function ShotList({ itemId, shots }: { itemId: string; shots: ServiceShot[] }) {
  const add = useAddServicePhoto(itemId);
  if (!shots.length) {
    return <Caption tone="muted">Every angle has a current photo.</Caption>;
  }
  return (
    <View style={styles.list}>
      <Caption tone="muted" role="heading" style={styles.eyebrow}>
        Shot list
      </Caption>
      {shots.map((shot) => (
        <ShotRow
          key={shot.angle}
          shot={shot}
          busy={add.isPending}
          uploading={add.isPending && add.variables?.angle === shot.angle}
          onPhoto={(uri) => add.mutate({ angle: shot.angle, uri, replaces: shot.photoLinkIds })}
        />
      ))}
    </View>
  );
}

function ShotRow({ shot, busy, uploading, onPhoto }: { shot: ServiceShot; busy: boolean; uploading: boolean; onPhoto: (uri: string) => void }) {
  const ds = useDs();
  const web = Platform.OS === 'web';
  // The native picker throws, killing the app, where there's no camera (simulators).
  const camera = !web && Device.isDevice;
  // Only a desk has files to drag; phones and tablets pick or shoot.
  const canDrop = useBreakpoint() === 'desktop' && web;
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useWebImageDrop((uris) => onPhoto(uris[0]), setDragOver);
  const action = shot.status === 'outdated' ? 'Replace' : 'Add';
  const hint = `${action}s the ${shot.label.toLowerCase()} photo`;
  const choose = async (shoot: boolean) => {
    try {
      const uri = shoot ? await takeDrinkPhoto() : (await pickDrinkPhotos())[0];
      if (uri) onPhoto(uri);
    } catch {
      showMessage(shoot ? "Couldn't open the camera" : "Couldn't open your photos", 'Try again, or choose a photo from your library.');
    }
  };
  return (
    <View
      ref={dropRef}
      style={[styles.row, { borderColor: dragOver ? ds.accentText : ds.c.line, backgroundColor: dragOver ? ds.c.raised : 'transparent' }]}
    >
      <Body>
        {shot.label}: {shot.brief.toLowerCase()}
      </Body>
      <Caption tone="muted">{uploading ? 'Uploading…' : canDrop ? `${STATUS[shot.status]}. Drop a photo here, or:` : STATUS[shot.status]}</Caption>
      <View style={styles.actions}>
        {camera ? <Button label="Take photo" icon="camera.fill" variant="secondary" disabled={busy} accessibilityHint={hint} onPress={() => choose(true)} /> : null}
        <Button
          label={web ? `${action} photo` : 'Choose photo'}
          icon="photo"
          variant={camera ? 'ghost' : 'secondary'}
          disabled={busy}
          accessibilityHint={hint}
          onPress={() => choose(false)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm, marginTop: space.sm },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1 },
  row: { gap: space.xs, padding: space.md, borderWidth: 1, borderRadius: radius.control },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});
