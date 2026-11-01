import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Caption, Sheet, SheetScrollView } from '@/components/ds';
import { space, type DisplayFace } from '@/constants/tokens';

import { FaceChoices } from '../BrandSections';
import { FlowHead } from './FlowHead';

/**
 * Type for names (canvas Theme-flow-5): each face set in the bar's own name,
 * so the choice is about the bar, not a font sample. Done keeps the pick; X
 * leaves the face as it was.
 */
export function TypeSheet({ visible, onClose, name, value, onUse }: { visible: boolean; onClose: () => void; name: string; value: DisplayFace; onUse: (face: DisplayFace) => void }) {
  const [face, setFace] = useState(value);
  return (
    <Sheet visible={visible} onClose={onClose} onShow={() => setFace(value)} accessibilityLabel="Type" kind="flow">
      <FlowHead title="Type" onDone={() => onUse(face)} />
      <SheetScrollView contentContainerStyle={styles.body}>
        <FaceChoices list name={name} value={face} onChange={setFace} />
        <Caption tone="muted">For names only: your bar, its drinks and menus. Amounts, allergens and buttons stay in the app’s type.</Caption>
      </SheetScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, padding: space.lg, paddingBottom: space.xxxl },
});
