import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackbarTheme, BrandProvider, Button, Caption, Sheet, SheetScrollView, SketchTintPicker, Title, useSheetClose } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { useSetSketchTint } from '@/hooks/useSketchTint';

/**
 * "Sketch colour" for whoever can edit the drink: Auto, or a house
 * watercolour for its drawing everywhere it's drawn (menus, tiles, its page,
 * link previews). Saves on tap, with Undo. Nothing until the drink is drawn.
 */
export function SketchColour({ itemId }: { itemId: string }) {
  const sketch = useItemSketch(itemId).data ?? null;
  const save = useSetSketchTint(itemId);
  // The colour before the last pick, for Undo.
  const [before, setBefore] = useState<{ tint: string | null } | null>(null);
  if (!sketch) return null;
  const current = sketch.tint ?? null;
  const pick = (tint: string | null) => {
    if (tint === current) return;
    setBefore({ tint: current });
    save.mutate(tint);
  };
  return (
    <View style={styles.section}>
      <Caption tone="muted" style={styles.title}>SKETCH COLOUR</Caption>
      <Caption tone="muted">The watercolour in the drink&apos;s drawing while it has no photo, on every menu and tile.</Caption>
      <SketchTintPicker inputs={sketch} seed={itemId} value={current} onChange={pick} />
      {save.isError ? (
        <Caption tone="accent">{"Couldn't save the colour. Check your connection and try again."}</Caption>
      ) : before && !save.isPending ? (
        <View style={styles.saved}>
          <Caption tone="muted">Saved.</Caption>
          <Button
            label="Undo"
            variant="ghost"
            size="sm"
            accessibilityLabel="Undo the colour change"
            onPress={() => {
              save.mutate(before.tint);
              setBefore(null);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

interface SketchColourSheetProps {
  visible: boolean;
  onClose: () => void;
  itemId: string;
  name: string;
  accent?: string;
}

/** The drink page's way in: the Colour button on a drawn hero opens this. */
export function SketchColourSheet({ visible, onClose, itemId, name, accent }: SketchColourSheetProps) {
  return (
    <BackbarTheme>
      <BrandProvider accent={accent}>
        <Sheet visible={visible} onClose={onClose} accessibilityLabel={`Sketch colour, ${name}`} ground>
          <SheetScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            <Title>{name}</Title>
            <SketchColour itemId={itemId} />
            <Done />
          </SheetScrollView>
        </Sheet>
      </BrandProvider>
    </BackbarTheme>
  );
}

function Done() {
  const close = useSheetClose();
  return <Button label="Done" variant="secondary" onPress={close} style={styles.done} />;
}

const styles = StyleSheet.create({
  section: { gap: space.sm, paddingTop: space.lg },
  title: { letterSpacing: 1.2 },
  saved: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  scroll: { flexShrink: 1 },
  body: { padding: space.xl, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.sm },
  done: { alignSelf: 'flex-start', marginTop: space.md },
});
