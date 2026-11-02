import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { preferredColorScheme, presentationBackground, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { space } from '@/constants/tokens';

import { flowDetents } from './flowDetents';
import type { SheetProps } from './Sheet';
import { CloseContext } from './sheetClose';
import { useDs } from './theme';
import { ToastHost } from './Toast';

/** About how long the system's sheet takes to come up: onShow waits for it, as Modal's did. */
const PRESENT_MS = 350;

/**
 * iOS's whole flow (Add, Rank it, Theme): SwiftUI's own sheet, so it has the
 * system's grabber, glass, swipe to close and detents. With `part` it rests
 * part-way, the floating inset sheet with every corner round, and grows to
 * full height (attached to the edges) when the caller drops `part` for the
 * next step. On iPad it is the system's form sheet in the middle.
 *
 * Closing from inside (its X, a swipe down) lets the sheet animate away first
 * and calls onClose once it's gone, as the small sheet does. The keyboard is
 * the system's: SwiftUI lifts the sheet's content over it, so `keyboard` and
 * `keyboardOffset` have nothing to do here.
 */
export function FlowSheet({ visible, onClose, accessibilityLabel, children, style, ground, header, onShow, onDismiss, part }: SheetProps) {
  const ds = useDs();
  const fill = ground ? ds.c.ground : ds.c.surface;
  const { detents, rest } = flowDetents(part);

  // Up while the parent wants it and nobody inside has closed it.
  const [shown, setShown] = useState(visible);
  const [wanted, setWanted] = useState(visible);
  // Where it rests: the step's stop, or wherever the person dragged it, until the step changes or it opens again.
  const [at, setAt] = useState(rest);
  const [step, setStep] = useState(part);
  if (visible !== wanted) {
    setWanted(visible);
    setShown(visible);
    if (visible) setAt(rest);
  }
  if (part !== step) {
    setStep(part);
    setAt(rest);
  }

  // Closed from inside (X, swipe): the parent hears once it has animated away.
  // A ref, as SwiftUI can send the swipe and the dismiss before React renders again.
  const ours = useRef(false);
  const close = () => {
    ours.current = true;
    setShown(false);
  };
  useEffect(() => {
    if (visible) ours.current = false;
  }, [visible]);

  return (
    <Host style={styles.host} pointerEvents="none">
      <BottomSheet
        isPresented={shown}
        onIsPresentedChange={(presented) => {
          if (!presented && shown) close();
        }}
        onDismiss={() => {
          if (ours.current) {
            ours.current = false;
            onClose();
          }
          onDismiss?.();
        }}
      >
        <Group
          modifiers={[
            presentationDetents(detents, { selection: at, onSelectionChange: setAt }),
            presentationDragIndicator('visible'),
            presentationBackground(fill),
            preferredColorScheme(ds.scheme),
          ]}
        >
          <RNHostView>
            {/* The grabber is drawn over the top of the content: the head starts below it. */}
            <GestureHandlerRootView style={[styles.flex, styles.grabber, { backgroundColor: fill }]}>
              <Shown onShow={onShow} />
              <CloseContext value={close}>
                <View role="dialog" aria-label={accessibilityLabel} style={[styles.flex, style]}>
                  {header}
                  {children}
                </View>
              </CloseContext>
              {/* The sheet is a window over the app: a toast shown from it draws here, on top. */}
              <ToastHost />
            </GestureHandlerRootView>
          </RNHostView>
        </Group>
      </BottomSheet>
    </Host>
  );
}

/** The content mounts as the sheet starts up; onShow waits until it's on screen. */
function Shown({ onShow }: { onShow?: () => void }) {
  const shown = useEffectEvent(() => onShow?.());
  useEffect(() => {
    // ponytail: a fixed wait for the present animation; SwiftUI's sheet sends no "presented" event to hook instead.
    const timer = setTimeout(shown, PRESENT_MS);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

const styles = StyleSheet.create({
  host: { position: 'absolute' },
  flex: { flex: 1 },
  grabber: { paddingTop: space.md },
});
