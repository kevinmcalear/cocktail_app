import { useRef } from 'react';
import { Modal, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDs, useGutter } from '@/components/ds';
import { DragScrollView } from '@/components/ds/dragScroll';
import { layout, space } from '@/constants/tokens';

import { KeyboardScreen } from '../WizardFrame';
import type { PrepBuilderProps } from './PrepBuilder';
import { PrepCard } from './PrepCard';

/**
 * A house-made written inside the drink on the draft page (Kept-add-helpers,
 * Writing it, then back): its own page over the drink, with the trail back
 * to it. Back, or Android's back (which goes to the Modal), keeps what's done
 * as a recipe to finish; Done puts it on the line.
 */
export function NestedPrep(props: Omit<PrepBuilderProps, 'name'> & { name: string; venueName: string | null }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const back = useRef(props.onClose);
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => back.current()}>
      {/* Android: gestures in a Modal need their own root (the recipe's lines drag). */}
      <GestureHandlerRootView style={[styles.flex, { backgroundColor: ds.c.ground }]}>
        <KeyboardScreen testID="nested-prep">
          {(statusBar) => (
            <DragScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, { paddingTop: statusBar + space.sm, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: gutter }]}>
              <PrepCard {...props} page backRef={back} />
            </DragScrollView>
          )}
        </KeyboardScreen>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { width: '100%', maxWidth: layout.page.text, alignSelf: 'center' },
});
