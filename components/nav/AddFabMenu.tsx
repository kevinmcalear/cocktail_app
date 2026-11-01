import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { DsText, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

import { useAddActions } from './useAddActions';

/** Where the FAB sits on screen, so the menu's close button lands on it. */
export interface FabFrame {
  right: number;
  bottom: number;
}

/**
 * Android's Add (Prod-and, "Add · FAB menu", decided 31 Oct 2026): the
 * Extended FAB opens Material 3's FAB menu over a dimmed page. Snap a menu or
 * bottle, Paste a link, Type a drink, each a tonal pill stacked over the FAB,
 * which turns into a round close button. Type a drink opens the Add sheet.
 */
export function AddFabMenu({ frame, onClose, onType }: { frame: FabFrame; onClose: () => void; onType: () => void }) {
  const ds = useDs();
  const add = useAddActions(onClose);
  const still = useReducedMotion();
  const items: { label: string; icon: IconName; onPress: () => void }[] = [
    ...(add.canSnap ? [{ label: 'Snap a menu or bottle', icon: 'camera' as const, onPress: add.snap }] : []),
    { label: 'Paste a link', icon: 'doc.on.clipboard', onPress: () => void add.paste() },
    { label: 'Type a drink', icon: 'pencil', onPress: onType },
  ];
  const container = withAlpha(ds.accentFill.fill, ds.scheme === 'dark' ? 0.32 : 0.28);
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Animated.View entering={still ? undefined : FadeIn.duration(150)} style={StyleSheet.absoluteFill}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: ds.c.scrim }]} />
      </Animated.View>
      <View role="menu" aria-label="Add" style={[styles.menu, { right: frame.right, bottom: frame.bottom }]}>
        {items.map((item, i) => (
          <Animated.View key={item.label} entering={still ? undefined : FadeInDown.delay((items.length - 1 - i) * 30).duration(180)}>
            <PressableScale role="menuitem" accessibilityLabel={item.label} onPress={item.onPress} style={[styles.item, { backgroundColor: container }]}>
              <IconSymbol name={item.icon} size={20} color={ds.c.ink} />
              <DsText style={{ ...font.medium }}>{item.label}</DsText>
            </PressableScale>
          </Animated.View>
        ))}
        {add.error ? (
          <DsText variant="caption" tone="accent" style={styles.error}>
            {add.error}
          </DsText>
        ) : null}
        <PressableScale role="button" accessibilityLabel="Close" onPress={onClose} style={[styles.close, { backgroundColor: ds.accentFill.fill }]}>
          <IconSymbol name="xmark" size={22} color={ds.accentFill.text} />
        </PressableScale>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // M3 FAB menu: items 56 tall, 4 apart, right-aligned over the close button.
  menu: { position: 'absolute', alignItems: 'flex-end', gap: space.xs },
  item: { height: 56, borderRadius: radius.pill, paddingHorizontal: space.lg + 4, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  error: { paddingVertical: space.xs },
  close: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: space.sm, elevation: 3 },
});
