import { createContext, use } from 'react';

import { Body, useDs } from '@/components/ds';
import { backbar, displayFaces, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';

/** True inside a title set on a dark photo on the desktop: its lines take the board's soft shadow. */
export const TitleOnPhoto = createContext(false);
const SHADOW = { textShadowColor: withAlpha(backbar.dark.ground, 0.35), textShadowOffset: { width: 0, height: 1 }, textShadowRadius: space.xl };

/** The shadow for a line of the title, where it's on a photo (board Desk-photo-side-dark). */
export const useTitleShadow = () => (use(TitleOnPhoto) ? SHADOW : null);

/** A line in the name's italic: the maker and where it's from, whose recipe it is. */
export function ItalicLine({ text }: { text: string }) {
  return <Body tone="muted" style={[useItalic(), useTitleShadow()]}>{text}</Body>;
}

/** The display face's italic, for text set under the name. */
export function useItalic() {
  return { fontFamily: displayFaces[useDs().displayFace].italic };
}
