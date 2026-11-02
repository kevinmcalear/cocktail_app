import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';

import type { SheetProps } from './Sheet';
import { CloseContext } from './sheetClose';
import { sheetFrame } from './sheetFrame';
import { useDs } from './theme';
import { ToastHost } from './Toast';
import { EASE_IN, EASE_OUT, webMotion } from './webMotion';
import { attachSheetDrag } from './webSheetDrag';

/** As on native: in over about 200 ms easing out, out over 180 ms easing in. */
const IN_MS = 200;
const OUT_MS = 180;
/** Below this the window is a phone's: a sheet that asks for it takes the whole window. */
const PHONE_WIDTH = 600;

export { useSheetClose } from './sheetClose';

/**
 * The web's Sheet: the same dialog in the middle of the window over the same
 * fading backdrop (Sheet.tsx), faded with CSS transitions so the web needn't
 * load Reanimated or Gesture Handler. A finger drags it down to close it
 * (webSheetDrag), as on native.
 */
export function Sheet({ visible, onClose, accessibilityLabel, children, style, ground, header, onShow, onDismiss, kind, fullAtPhoneWidth }: SheetProps) {
  const ds = useDs();
  const full = useWindowDimensions().width < PHONE_WIDTH && !!fullAtPhoneWidth;
  const reduceMotion = useReducedMotion();
  // Gone once it has faded out: the Modal stays up until then.
  const [gone, setGone] = useState(!visible);
  if (visible && gone) setGone(false);
  // In a frame after it mounts, so the fade has somewhere to start from.
  const [entered, setEntered] = useState(false);
  // We started closing it (the backdrop, Escape, its own X or Cancel).
  const [closing, setClosing] = useState(false);
  const shown = visible && entered && !closing;
  const leaving = useRef<ReturnType<typeof setTimeout>>(undefined);
  const outMs = reduceMotion ? 0 : OUT_MS;

  const settle = () => {
    setGone(true);
    setEntered(false);
    setClosing(false);
  };
  // Ours to close: fade out (or slide out after a drag, over leaveMs), then tell the parent.
  const dismiss = (leaveMs = outMs) => {
    setClosing(true);
    clearTimeout(leaving.current);
    leaving.current = setTimeout(() => {
      settle();
      onClose();
    }, leaveMs);
  };
  const close = () => dismiss();
  // The drag attaches once per panel and reads these when a finger lets go.
  const latest = useRef({ dismiss, reduceMotion });
  useEffect(() => {
    latest.current = { dismiss, reduceMotion };
  });
  const dragRef = (el: React.ComponentRef<typeof View> | null) =>
    // ponytail: on web a React Native view is a DOM element, which RN's types don't describe.
    el ? attachSheetDrag(el as unknown as HTMLElement, (ms) => latest.current.dismiss(ms), () => latest.current.reduceMotion) : undefined;

  useEffect(() => {
    if (!visible || gone) return;
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [visible, gone]);

  // The parent closed it (a Save, a Cancel): it's already fading; then the Modal goes.
  const settleLater = useEffectEvent(() => setTimeout(settle, outMs));
  useEffect(() => {
    if (visible || gone) return;
    const timer = settleLater();
    return () => clearTimeout(timer);
  }, [visible, gone]);
  useEffect(() => () => clearTimeout(leaving.current), []);

  const fade = webMotion({
    transitionProperty: 'opacity',
    transitionDuration: `${reduceMotion ? 0 : shown ? IN_MS : OUT_MS}ms`,
    transitionTimingFunction: shown ? EASE_OUT : EASE_IN,
  });
  const opacity = { opacity: shown ? 1 : 0 };

  return (
    <Modal visible={visible || !gone} transparent animationType="none" onRequestClose={close} onShow={onShow} onDismiss={onDismiss}>
      <CloseContext value={close}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: ds.c.scrim }, fade, opacity]}>
          <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={close} />
        </View>
        <View style={[styles.place, sheetFrame.scrim, full ? styles.bare : null]}>
          <View
            ref={dragRef}
            role="dialog"
            aria-modal
            aria-label={accessibilityLabel}
            style={[
              styles.panel,
              kind === 'flow' ? styles.flow : null,
              sheetFrame.panel,
              { backgroundColor: ground ? ds.c.ground : ds.c.surface, borderColor: ds.c.lineStrong },
              style,
              full ? styles.full : null,
              fade,
              opacity,
            ]}
          >
            {header}
            {children}
          </View>
        </View>
      </CloseContext>
      {/* The dialog sits over the page: a toast shown from it draws here, on top. */}
      <ToastHost />
    </Modal>
  );
}

const styles = StyleSheet.create({
  place: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'box-none' },
  panel: { width: '100%', maxWidth: 560, maxHeight: '86%', overflow: 'hidden' },
  // A whole flow (Add, Rank it, Theme): the same dialog, a little wider and taller.
  flow: { maxWidth: 680, maxHeight: '92%' },
  bare: { padding: 0 },
  full: { maxWidth: '100%', height: '100%', maxHeight: '100%', borderWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
});
