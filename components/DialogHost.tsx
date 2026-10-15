import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { AlertButton } from 'react-native';

import { Body, Button, Headline, useDs } from '@/components/ds';
import { Appear } from '@/components/ds/Appear';
import { radius, space } from '@/constants/tokens';
import { type Dialog, useDialogStore } from '@/store/useDialogStore';

/**
 * Web-only renderer for Alert.alert (see installWebAlert). Shows the first
 * queued dialog as a card in the middle of the window, dressed as the app's
 * web sheets are (Sheet.web.tsx): the scrim fading in, the raised surface, ds
 * Buttons. Escape or a click outside cancels, Enter confirms.
 * Not built on Sheet: its Modal would take Escape as well, running Cancel twice.
 */
export function DialogHost() {
  const dialog = useDialogStore((s) => s.queue[0]);
  if (Platform.OS !== 'web' || !dialog) return null;
  return <DialogCard key={dialog.id} dialog={dialog} />;
}

function DialogCard({ dialog }: { dialog: Dialog }) {
  const ds = useDs();
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
  // Destructive in status red, the main action in ink (the accent belongs to the venue's screens), the rest outlined.
  const variant = (button: AlertButton) => (button.style === 'destructive' ? 'danger' : button === primary && button.style !== 'cancel' ? 'ink' : 'secondary');

  return (
    <Appear kind="fade" duration={200} style={[styles.overlay, { backgroundColor: ds.c.scrim }]}>
      <Pressable accessibilityLabel="Close dialog" style={StyleSheet.absoluteFill} onPress={dismiss} />
      <View
        role="alertdialog"
        aria-modal
        aria-label={dialog.title}
        style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong }]}
      >
        <Headline role="heading">{dialog.title}</Headline>
        {dialog.message ? <Body tone="muted">{dialog.message}</Body> : null}
        <View style={[styles.buttons, stacked && styles.stacked]}>
          {ordered.map((button, i) => (
            <Button key={`${button.text}-${i}`} label={button.text ?? 'OK'} variant={variant(button)} onPress={() => press(button)} />
          ))}
        </View>
      </View>
    </Appear>
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
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: space.xl,
    gap: space.md,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
});
