import { useEffect } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
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
 * In a Modal of its own, so it opens over a sheet that asked it (Discard
 * changes?): the app's root sits under every Modal on the web. Not built on
 * Sheet, and its Modal has no onRequestClose: that would take Escape as well,
 * running Cancel twice.
 */
export function DialogHost() {
  const dialog = useDialogStore((s) => s.queue[0]);
  if (Platform.OS !== 'web' || !dialog) return null;
  return (
    <Modal visible transparent animationType="none">
      <DialogCard key={dialog.id} dialog={dialog} />
    </Modal>
  );
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
      // A button in focus answers Enter itself (Tab to Keep editing, Enter keeps editing).
      if (event.key === 'Enter' && !(event.target instanceof Element && event.target.closest('[role="button"]'))) press(primary);
    };
    // Escape is the dialog's alone: caught first, kept from the page's own Escape (an editor's leave would ask
    // again), and so is the keyup after it, or the sheet that asked (a Modal closes on Escape's keyup) would.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      swallowKeyup('Escape');
      dismiss();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onEscape, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onEscape, true);
    };
  });

  const ordered = cancel ? [cancel, ...actions] : actions;
  const stacked = ordered.length > 2;
  // Destructive in status red, the main action in ink (the accent belongs to the venue's screens), the rest outlined.
  const variant = (button: AlertButton) => (button.style === 'destructive' ? 'danger' : button === primary && button.style !== 'cancel' ? 'ink' : 'secondary');

  return (
    <Appear kind="fade" duration={200} style={[styles.overlay, { backgroundColor: ds.c.scrim }]}>
      {/* A plain view, not a button: the Modal's focus trap focuses the first thing that takes focus, so it lands
          on the card and Enter is its main action (the window's Enter, above), never this window-sized backdrop. */}
      <View aria-hidden style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} onResponderRelease={dismiss} />
      <View
        tabIndex={-1}
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

/**
 * Keeps the next `key` keyup from the page. Given up on a window blur or the
 * next key pressed (not a held key's repeat), so a keyup lost to another
 * window never swallows a later one.
 */
function swallowKeyup(key: string) {
  const swallow = (up: KeyboardEvent) => {
    if (up.key !== key) return;
    up.stopPropagation();
    stop();
  };
  const next = (down: KeyboardEvent) => {
    if (!down.repeat) stop();
  };
  const stop = () => {
    window.removeEventListener('keyup', swallow, true);
    window.removeEventListener('keydown', next, true);
    window.removeEventListener('blur', stop);
  };
  window.addEventListener('keyup', swallow, true);
  window.addEventListener('keydown', next, true);
  window.addEventListener('blur', stop);
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
