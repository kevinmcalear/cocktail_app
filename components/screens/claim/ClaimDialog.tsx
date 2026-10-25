import { StyleSheet, View } from 'react-native';

import { GlassButton, Sheet, SheetScrollView, useSheetClose } from '@/components/ds';
import { space } from '@/constants/tokens';

import { ClaimBody } from './BarClaimScreen';

/**
 * A maker's or supplier's claim over its page on wide screens (ppl-maker
 * board, step 1): the claim screen's body in a centred dialog. Phones keep
 * the claim screen.
 */
export function ClaimDialog({ profileRef, name, onClose }: { profileRef: string; name: string; onClose: () => void }) {
  return (
    <Sheet visible onClose={onClose} accessibilityLabel={`Claim ${name}`} style={styles.sheet} header={<Head />}>
      <SheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <ClaimBody profileRef={profileRef} onBack={onClose} />
      </SheetScrollView>
    </Sheet>
  );
}

function Head() {
  const close = useSheetClose();
  return (
    <View style={styles.head}>
      <GlassButton accessibilityLabel="Close" icon="xmark" onPress={close} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { maxWidth: 600, padding: space.xl },
  body: { paddingBottom: space.sm },
  head: { flexDirection: 'row', justifyContent: 'flex-end' },
});
