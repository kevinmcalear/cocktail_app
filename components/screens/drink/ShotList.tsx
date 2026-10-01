import * as Device from 'expo-device';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, Button, Caption, PressableScale, useBreakpoint, useDs } from '@/components/ds';
import { pickDrinkPhotos, takeDrinkPhoto } from '@/components/drink/drinkImages';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useWebImageDrop } from '@/hooks/useWebImageDrop';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useAddServicePhoto } from '@/hooks/useServicePhotos';
import { showMessage } from '@/lib/dialogs';
import type { ItemImageLink } from '@/lib/itemImages';
import { serviceShots, shotList, type ServiceShot } from '@/lib/servicePhotos';

const STATUS: Record<ServiceShot['status'], string> = {
  missing: 'No photo yet',
  sketch: 'Sketch only, no photo yet',
  outdated: 'May be out of date: the spec changed after it was taken',
  photo: '',
};

/**
 * Edit mode only. Collapsed until someone asks to add service photos (side,
 * top, garnish, hand-off). Angles that already have a current photo are left
 * out; those show on the drink page.
 */
export function ShotList({ itemId, barId, links }: { itemId: string; barId: string | null; links: ItemImageLink[] | null | undefined }) {
  const { data: capabilities } = useCapabilities(barId);
  const shots = shotList(serviceShots(links));
  const canAdd = !barId || !!capabilities?.includes('photos');
  const [open, setOpen] = useState(false);
  if (!canAdd || !shots.length) return null;
  return (
    <BackbarTheme>
      <AddPhotos itemId={itemId} shots={shots} open={open} onToggle={() => setOpen((v) => !v)} />
    </BackbarTheme>
  );
}

function AddPhotos({ itemId, shots, open, onToggle }: { itemId: string; shots: ServiceShot[]; open: boolean; onToggle: () => void }) {
  const add = useAddServicePhoto(itemId);
  const ds = useDs();
  return (
    <View style={styles.list}>
      <PressableScale
        accessibilityLabel={open ? 'Hide service photos' : 'Add service photos'}
        accessibilityHint="Side, top, garnish, and the hand-off"
        aria-expanded={open}
        onPress={onToggle}
        style={styles.toggle}
      >
        <View style={styles.toggleCopy}>
          <Body>Add service photos</Body>
          <Caption tone="muted">Side, top, garnish, and the hand-off</Caption>
        </View>
        <IconSymbol name={open ? 'chevron.up' : 'chevron.down'} size={16} color={ds.c.muted} />
      </PressableScale>
      {open
        ? shots.map((shot) => (
            <ShotRow
              key={shot.angle}
              shot={shot}
              busy={add.isPending}
              uploading={add.isPending && add.variables?.angle === shot.angle}
              onPhoto={(uri) => add.mutate({ angle: shot.angle, uri, replaces: shot.photoLinkIds })}
            />
          ))
        : null}
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
  list: { gap: space.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: layout.minTapTarget },
  toggleCopy: { flex: 1, gap: space.xs },
  row: { gap: space.xs, padding: space.md, borderWidth: 1, borderRadius: radius.control },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});
