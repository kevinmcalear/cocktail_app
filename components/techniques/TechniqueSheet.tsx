import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, Caption, GlassButton, Sheet, Title, useSheetClose } from '@/components/ds';
import { space } from '@/constants/tokens';

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
    <BackbarTheme>
      <Sheet visible={props.visible} onClose={props.onClose} accessibilityLabel={props.title} ground>
        <Body {...props} />
      </Sheet>
    </BackbarTheme>
  );
}

function Body({ eyebrow, title, children }: Props) {
  const close = useSheetClose();
  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <View style={styles.flex}>
          <Caption tone="muted">{eyebrow.toUpperCase()}</Caption>
          <Title role="heading">{title}</Title>
        </View>
        <GlassButton accessibilityLabel="Close" icon="xmark" onPress={close} />
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
});
