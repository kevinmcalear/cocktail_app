import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Caption, GlassButton, Tag, Title, useDs, type TagTone } from '@/components/ds';
import { space } from '@/constants/tokens';

/** A photo opened full screen: what it shows ("Garnish", "Photo by Jo") and an optional tag. */
export interface ViewedPhoto {
  url: string;
  title: string;
  tag?: { label: string; tone: TagTone } | null;
}

/**
 * One photo (a service angle, or someone's photo of the drink), full screen.
 * Always on the dark service ground so the photo reads the same in either
 * theme. `actions` sit under it (delete, report).
 * ponytail: no pinch-zoom yet (components/ZoomableImage needs a gesture root
 * inside the Modal); add it if staff ask to zoom into garnishes.
 */
export function PhotoViewer({ photo, name, onClose, actions }: { photo: ViewedPhoto | null; name: string; onClose: () => void; actions?: ReactNode }) {
  return (
    <Modal visible={!!photo} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <BackbarTheme scheme="dark">{photo ? <Viewer photo={photo} name={name} onClose={onClose} actions={actions} /> : null}</BackbarTheme>
    </Modal>
  );
}

function Viewer({ photo, name, onClose, actions }: { photo: ViewedPhoto; name: string; onClose: () => void; actions?: ReactNode }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.titles}>
          <Title role="heading">{photo.title}</Title>
          <Caption tone="muted">{name}</Caption>
        </View>
        <GlassButton accessibilityLabel="Close photo" icon="xmark" onPress={onClose} />
      </View>
      <Image
        source={{ uri: photo.url }}
        style={styles.image}
        contentFit="contain"
        accessibilityLabel={`${name}, ${photo.title}`}
        accessible
      />
      {photo.tag ? <Tag label={photo.tag.label} tone={photo.tag.tone} style={styles.tag} /> : null}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingHorizontal: space.lg },
  titles: { flex: 1 },
  image: { flex: 1, width: '100%' },
  tag: { alignSelf: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.lg },
});
