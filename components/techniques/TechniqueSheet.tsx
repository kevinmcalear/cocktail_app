import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, Caption, GlassButton, Title, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';

interface Props {
  visible: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  children: ReactNode;
}

/** A bottom sheet over the add-drink wizard for a technique choice (how to make a prep, which foamer). */
export function TechniqueSheet(props: Props) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <BackbarTheme>
        <Body {...props} />
      </BackbarTheme>
    </Modal>
  );
}

function Body({ onClose, eyebrow, title, children }: Props) {
  const ds = useDs();
  return (
    <Pressable accessibilityLabel="Close" style={[styles.scrim, { backgroundColor: ds.c.scrim }]} onPress={onClose}>
      <View style={styles.avoider} pointerEvents="box-none">
        <Pressable style={[styles.sheet, { backgroundColor: ds.c.ground }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.head}>
              <View style={styles.flex}>
                <Caption tone="muted">{eyebrow.toUpperCase()}</Caption>
                <Title role="heading">{title}</Title>
              </View>
              <GlassButton accessibilityLabel="Close" icon="xmark" onPress={onClose} />
            </View>
            {children}
          </ScrollView>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  avoider: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '92%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  body: { padding: space.xl, paddingBottom: space.xxxl, gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
});
