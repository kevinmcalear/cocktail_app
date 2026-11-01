import { KeyboardAvoidingView, Modal, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SheetProps } from './Sheet';
import { CloseContext } from './sheetClose';
import { useDs } from './theme';

/**
 * Android's whole flow (Add, Rank it, Theme): a full-screen dialog that
 * brings its own back, the predictive back gesture included; the flow's
 * FlowHead draws the arrow. It's full height from the first step, so `part`
 * has nothing to do here. iOS has its own (FlowSheet.ios.tsx); the web's flow
 * is the centred dialog (Sheet.web.tsx).
 */
export function FlowSheet({ visible, onClose, accessibilityLabel, children, style, ground, header, keyboard, keyboardOffset = 0, onShow, onDismiss }: SheetProps) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const body = (
    <View role="dialog" aria-label={accessibilityLabel} style={[styles.flex, style]}>
      {header}
      {children}
    </View>
  );
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      onShow={onShow}
      onDismiss={onDismiss}
    >
      <GestureHandlerRootView style={[styles.flex, { backgroundColor: ground ? ds.c.ground : ds.c.surface, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <CloseContext value={onClose}>
          {keyboard ? (
            <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={keyboardOffset} style={styles.flex}>
              {body}
            </KeyboardAvoidingView>
          ) : (
            body
          )}
        </CloseContext>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
