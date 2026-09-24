import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { AlertButton, PressableStateCallbackType } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';

import { type Dialog, useDialogStore } from '@/store/useDialogStore';

const DESTRUCTIVE = '#E5484D';

/**
 * Web-only renderer for Alert.alert (see installWebAlert). Shows the first
 * queued dialog as a modal card; Escape or a click outside cancels, Enter
 * confirms.
 */
export function DialogHost() {
  const dialog = useDialogStore((s) => s.queue[0]);
  if (Platform.OS !== 'web' || !dialog) return null;
  return <DialogCard key={dialog.id} dialog={dialog} />;
}

function DialogCard({ dialog }: { dialog: Dialog }) {
  const close = useDialogStore((s) => s.close);
  const cancel = dialog.buttons.find((b) => b.style === 'cancel');
  const actions = dialog.buttons.filter((b) => b !== cancel);
  const primary = actions[actions.length - 1];

  const press = (button: AlertButton | undefined) => {
    close(dialog.id);
    if (button) button.onPress?.();
    else dialog.onDismiss?.();
  };

  // Clicking away or Escape behaves like Cancel; a lone button (OK) just closes.
  const dismiss = () => press(cancel ?? (dialog.buttons.length === 1 ? dialog.buttons[0] : undefined));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
      if (event.key === 'Enter') press(primary);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const ordered = cancel ? [cancel, ...actions] : actions;
  const stacked = ordered.length > 2;

  return (
    <View style={styles.overlay}>
      <Pressable accessibilityLabel="Close dialog" style={StyleSheet.absoluteFill} onPress={dismiss} />
      <YStack
        role="alertdialog"
        aria-modal
        aria-label={dialog.title}
        width="100%"
        maxWidth={400}
        backgroundColor="$backgroundStrong"
        borderColor="$borderColor"
        borderWidth={1}
        borderRadius={16}
        padding="$5"
        gap="$3"
        boxShadow="0 24px 64px rgba(0,0,0,0.35)"
      >
        <Text fontSize={18} fontWeight="700" color="$color">
          {dialog.title}
        </Text>
        {dialog.message ? (
          <Text fontSize={15} lineHeight={22} color="$color11">
            {dialog.message}
          </Text>
        ) : null}
        <XStack
          flexDirection={stacked ? 'column' : 'row'}
          justifyContent="flex-end"
          gap="$2"
          marginTop="$2"
        >
          {ordered.map((button, i) => (
            <DialogButton
              key={`${button.text}-${i}`}
              button={button}
              isPrimary={button === primary}
              stacked={stacked}
              onPress={() => press(button)}
            />
          ))}
        </XStack>
      </YStack>
    </View>
  );
}

function DialogButton({
  button,
  isPrimary,
  stacked,
  onPress,
}: {
  button: AlertButton;
  isPrimary: boolean;
  stacked: boolean;
  onPress: () => void;
}) {
  const destructive = button.style === 'destructive';
  const filled = destructive || (isPrimary && button.style !== 'cancel');
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={stacked ? styles.stackedButton : undefined}>
      {/* `hovered` exists on web only; React Native's own types leave it out. */}
      {({ hovered }: PressableStateCallbackType & { hovered?: boolean }) => (
        <XStack
          justifyContent="center"
          paddingHorizontal="$4"
          paddingVertical="$2.5"
          borderRadius={10}
          backgroundColor={filled ? (destructive ? DESTRUCTIVE : '$color') : hovered ? '$borderColor' : 'transparent'}
          borderWidth={filled ? 0 : 1}
          borderColor="$borderColor"
          opacity={filled && hovered ? 0.9 : 1}
        >
          <Text fontSize={15} fontWeight="600" color={filled ? (destructive ? '#FFFFFF' : '$background') : '$color'}>
            {button.text ?? 'OK'}
          </Text>
        </XStack>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Mounted last inside the root view, which fills the viewport.
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100000,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  stackedButton: { alignSelf: 'stretch' },
});
