import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Caption, GlassButton, Tag, Title, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { pictureTag } from '@/lib/itemImages';
import type { ServiceShot } from '@/lib/servicePhotos';

/**
 * One service photo, full screen, with its angle named. Always on the dark
 * service ground so the photo reads the same in either theme.
 * ponytail: no pinch-zoom yet (components/ZoomableImage needs a gesture root
 * inside the Modal); add it if staff ask to zoom into garnishes.
 */
export function PhotoViewer({ shot, name, onClose }: { shot: ServiceShot | null; name: string; onClose: () => void }) {
  return (
    <Modal visible={!!shot?.picture} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <BackbarTheme scheme="dark">{shot?.picture ? <Viewer shot={shot} name={name} onClose={onClose} /> : null}</BackbarTheme>
    </Modal>
  );
}

function Viewer({ shot, name, onClose }: { shot: ServiceShot; name: string; onClose: () => void }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const tag = pictureTag(shot.picture);
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.titles}>
          <Title role="heading">{shot.label}</Title>
          <Caption tone="muted">{name}</Caption>
        </View>
        <GlassButton accessibilityLabel="Close photo" icon="xmark" onPress={onClose} />
      </View>
      <Image
        source={{ uri: shot.picture!.url }}
        style={styles.image}
        contentFit="contain"
        accessibilityLabel={`${name}, ${shot.label} photo`}
        accessible
      />
      {tag ? <Tag label={tag} tone={shot.picture!.isSketch ? 'sketch' : 'warning'} style={styles.tag} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingHorizontal: space.lg },
  titles: { flex: 1 },
  image: { flex: 1, width: '100%' },
  tag: { alignSelf: 'center' },
});
