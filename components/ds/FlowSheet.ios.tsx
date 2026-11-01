import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { preferredColorScheme, presentationBackground, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useEffectEvent, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { flowDetents } from './flowDetents';
import type { SheetProps } from './Sheet';
import { CloseContext } from './sheetClose';
import { useDs } from './theme';

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

  // Up while the parent wants it and nobody inside has closed it.
  const [shown, setShown] = useState(visible);
  const [wanted, setWanted] = useState(visible);
  // Closed from inside (X, swipe): the parent hears once it has animated away.
  const [ours, setOurs] = useState(false);
  if (visible !== wanted) {
    setWanted(visible);
    setShown(visible);
    setOurs(false);
  }
  const close = () => {
    setOurs(true);
    setShown(false);
  };

  // Rests where the step wants it; a drag between stops is the person's until the step changes.
  const { detents, rest } = flowDetents(part);
  const [at, setAt] = useState(rest);
  const [step, setStep] = useState(part);
  if (part !== step) {
    setStep(part);
    setAt(rest);
  }

  return (
    <Host style={styles.host} pointerEvents="none">
      <BottomSheet
        isPresented={shown}
        onIsPresentedChange={(presented) => {
          if (!presented && shown) close();
        }}
        onDismiss={() => {
          if (ours) {
            setOurs(false);
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
            <GestureHandlerRootView style={[styles.flex, { backgroundColor: fill }]}>
              <Shown onShow={onShow} />
              <CloseContext value={close}>
                <View role="dialog" aria-label={accessibilityLabel} style={[styles.flex, style]}>
                  {header}
                  {children}
                </View>
              </CloseContext>
            </GestureHandlerRootView>
          </RNHostView>
        </Group>
      </BottomSheet>
    </Host>
  );
}

/** The sheet's content mounts as it's presented: that's its onShow. */
function Shown({ onShow }: { onShow?: () => void }) {
  const shown = useEffectEvent(() => onShow?.());
  useEffect(() => shown(), []);
  return null;
}

const styles = StyleSheet.create({
  host: { position: 'absolute' },
  flex: { flex: 1 },
});
