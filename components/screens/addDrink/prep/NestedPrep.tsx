import { Modal, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDs, useGutter } from '@/components/ds';
import { FormScrollContainer } from '@/components/recipe/FormScrollContainer';
import { layout, space } from '@/constants/tokens';

import type { PrepBuilderProps } from './PrepBuilder';
import { PrepCard } from './PrepCard';

/**
 * A house-made written inside the drink on the draft page (Kept-add-helpers,
 * Writing it, then back): its own page over the drink, with the trail back
 * to it. Back keeps what's done as a recipe to finish; Done puts it on the line.
 */
export function NestedPrep(props: Omit<PrepBuilderProps, 'name'> & { name: string; venueName: string | null }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={props.onClose}>
      {/* Android: gestures in a Modal need their own root (the recipe's lines drag). */}
      <GestureHandlerRootView style={[styles.flex, { backgroundColor: ds.c.ground }]}>
        <FormScrollContainer keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.body, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: gutter }]}>
          <PrepCard {...props} page />
        </FormScrollContainer>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { width: '100%', maxWidth: layout.page.text, alignSelf: 'center' },
});
