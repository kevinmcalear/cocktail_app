import { createContext, use, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Display, useDs } from '@/components/ds';
import { backbar, displayFaces, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

/** True inside a title set on a dark photo on the desktop: its lines take the board's soft shadow. */
export const TitleOnPhoto = createContext(false);
const SHADOW = { textShadowColor: withAlpha(backbar.dark.ground, 0.35), textShadowOffset: { width: 0, height: 1 }, textShadowRadius: space.xl };

/** The shadow for a line of the title, where it's on a photo (board Desk-photo-side-dark). */
export const useTitleShadow = () => (use(TitleOnPhoto) ? SHADOW : null);

/**
 * The name block every drink and item page opens with (boards Decided-who-*,
 * Item-page): an eyebrow ("Caretaker's · House spec", "Beer · Pilsner"), the
 * name in the display face, then the credit in its italic. `credit` is a line
 * of text or a richer node (the drink's linked credit); `children` follow it.
 */
export function ItemTitle({ eyebrow, name, credit, children }: { eyebrow: string | null; name: string; credit?: ReactNode; children?: ReactNode }) {
  const shadow = useTitleShadow();
  return (
    <View style={styles.title}>
      {eyebrow ? (
        <Caption tone="muted" style={[styles.eyebrow, shadow]}>
          {eyebrow}
        </Caption>
      ) : null}
      <Display style={shadow}>{name}</Display>
      {typeof credit === 'string' ? <ItalicLine text={credit} /> : credit}
      {children}
    </View>
  );
}

/** A line in the name's italic: the maker and where it's from, whose recipe it is. */
export function ItalicLine({ text }: { text: string }) {
  return <Body tone="muted" style={[useItalic(), useTitleShadow()]}>{text}</Body>;
}

/** The display face's italic, for text set under the name. */
export function useItalic() {
  return { fontFamily: displayFaces[useDs().displayFace].italic };
}

const styles = StyleSheet.create({
  title: { gap: space.xs },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.2 },
});
