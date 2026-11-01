import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Display, useDs } from '@/components/ds';
import { displayFaces, space } from '@/constants/tokens';

/**
 * The name block every drink and item page opens with (boards Decided-who-*,
 * Item-page): an eyebrow ("Caretaker's · House spec", "Beer · Pilsner"), the
 * name in the display face, then the credit in its italic. `credit` is a line
 * of text or a richer node (the drink's linked credit); `children` follow it.
 */
export function ItemTitle({ eyebrow, name, credit, children }: { eyebrow: string | null; name: string; credit?: ReactNode; children?: ReactNode }) {
  return (
    <View style={styles.title}>
      {eyebrow ? (
        <Caption tone="muted" style={styles.eyebrow}>
          {eyebrow}
        </Caption>
      ) : null}
      <Display>{name}</Display>
      {typeof credit === 'string' ? <ItalicLine text={credit} /> : credit}
      {children}
    </View>
  );
}

/** A line in the name's italic: the maker and where it's from, whose recipe it is. */
export function ItalicLine({ text }: { text: string }) {
  return <Body tone="muted" style={useItalic()}>{text}</Body>;
}

/** The display face's italic, for text set under the name. */
export function useItalic() {
  return { fontFamily: displayFaces[useDs().displayFace].italic };
}

const styles = StyleSheet.create({
  title: { gap: space.xs },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.2 },
});
