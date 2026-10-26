import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Caption, Headline, Sheet, SheetScrollView, SketchTintPicker, useSheetClose } from '@/components/ds';
import { space } from '@/constants/tokens';
import { usePhotoColours } from '@/hooks/useSketchTint';
import type { SketchInputs } from '@/lib/sketch/types';

import { Eyebrow } from './WizardChrome';

interface DraftColourSheetProps {
  visible: boolean;
  onClose: () => void;
  name: string;
  /** The drink as drawn so far: the picker paints it in each colour. */
  inputs: SketchInputs;
  seed: string;
  value: string | null;
  onChange: (tint: string | null) => void;
  /** The draft's hero photo: its colours come first (From your photo). */
  photo?: string | null;
}

/**
 * The drawing's colour while the drink is being added (the add wizard's band,
 * from step 1): Auto, worked out from the spec as it's written, or one of the
 * house watercolours, which holds while the spec changes; with a photo, its
 * colours first. Saved with the drink
 * as its sketch colour, the one the drink page's Colour button changes later.
 */
export function DraftColourSheet({ visible, onClose, name, inputs, seed, value, onChange, photo }: DraftColourSheetProps) {
  return (
    <Sheet style={styles.sheet} visible={visible} onClose={onClose} accessibilityLabel={`Sketch colour, ${name}`} header={<Headline role="heading">{name}</Headline>}>
      <SheetScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <Eyebrow>Sketch colour</Eyebrow>
        <Caption tone="muted">The watercolour in the drink’s drawing while it has no photo, on every menu and tile.</Caption>
        <DraftTintPicker inputs={inputs} seed={seed} value={value} onChange={onChange} photo={photo} />
        <Done />
      </SheetScrollView>
    </Sheet>
  );
}

/** The picker with the draft photo's colours, read once it's shown (the wizard's sheet, the desktop's drink card). */
export function DraftTintPicker({ photo, ...picker }: Omit<ComponentProps<typeof SketchTintPicker>, 'photo'> & { photo?: string | null }) {
  const colours = usePhotoColours(photo);
  return <SketchTintPicker {...picker} photo={photo && colours ? { uri: photo, colours } : null} />;
}

function Done() {
  const close = useSheetClose();
  return <Button label="Done" variant="secondary" onPress={close} style={styles.done} />;
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  // Only as tall as the picker: a short sheet, not a page.
  scroll: { flexShrink: 1 },
  body: { paddingBottom: space.lg, gap: space.sm },
  done: { alignSelf: 'flex-start', marginTop: space.md },
});
