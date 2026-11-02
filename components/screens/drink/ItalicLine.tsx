import { Body, useDs } from '@/components/ds';
import { displayFaces } from '@/constants/tokens';

/** A line in the name's italic: the maker and where it's from, whose recipe it is. */
export function ItalicLine({ text }: { text: string }) {
  return <Body tone="muted" style={useItalic()}>{text}</Body>;
}

/** The display face's italic, for text set under the name. */
export function useItalic() {
  return { fontFamily: displayFaces[useDs().displayFace].italic };
}
