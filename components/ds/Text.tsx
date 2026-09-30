import { Platform, Text as RNText, type TextProps } from 'react-native';

import { displayFaces, fontFamilies, textSlack, type, type TypeStyle } from '@/constants/tokens';

import { useDs } from './theme';

type Tone = 'ink' | 'muted' | 'accent' | 'onAccent';

export interface DsTextProps extends TextProps {
  variant?: TypeStyle;
  tone?: Tone;
  /** Display and title only: the display face's italic. */
  italic?: boolean;
  /** Override the colour (for text on a drink photo or a scrim). */
  color?: string;
  align?: 'left' | 'center' | 'right';
}

// Each weight is its own registered family on native, so the family carries
// the weight and fontWeight stays normal.
const FAMILY: Record<TypeStyle, string> = {
  display: fontFamilies.instrument,
  title: fontFamilies.instrument,
  headline: fontFamilies.bodySemiBold,
  body: fontFamilies.body,
  spec: fontFamilies.monoMedium,
  caption: fontFamilies.bodyMedium,
};

// iOS lays text out in a box exactly the size of its frame. Yoga rounds that
// frame to the pixel grid in float32, and a paragraph on a fractional offset
// (below a 1/3 pt hairline, say) that crosses y = 1024, 2048... comes out a
// hair shorter than the text it measured. TextKit then fits one line fewer and
// clips the rest onto the last line: one line running off the edge, with the
// full height still reserved. A sliver of padding makes the height fractional,
// and Yoga rounds a fractional text height up, so the box always fits.
// ponytail: an app-side guard for react/yoga#2011; drop it once React Native
// ships that fix.
const SLACK = Platform.OS === 'ios' ? { paddingBottom: textSlack } : null;

/**
 * Text in one of the six Back Bar styles. Display and title use the venue's
 * display face; everything else is fixed so every venue stays legible.
 * Scales with the person's text size setting (Dynamic Type) by default.
 */
export function DsText({ variant = 'body', tone = 'ink', italic, color, align, style, ...rest }: DsTextProps) {
  const ds = useDs();
  const isDisplay = variant === 'display' || variant === 'title';
  const face = displayFaces[ds.displayFace];
  const fontFamily = isDisplay ? (italic ? face.italic : face.regular) : FAMILY[variant];
  const toneColor = {
    ink: ds.c.ink,
    muted: ds.c.muted,
    accent: ds.accentText,
    onAccent: ds.accentFill.text,
  }[tone];
  return (
    <RNText
      {...rest}
      style={[
        type[variant],
        SLACK,
        {
          fontFamily,
          color: color ?? toneColor,
          textAlign: align,
          fontVariant: variant === 'spec' ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  );
}

type Named = Omit<DsTextProps, 'variant'>;
export const Display = (p: Named) => <DsText variant="display" role="heading" {...p} />;
export const Title = (p: Named) => <DsText variant="title" role="heading" {...p} />;
export const Headline = (p: Named) => <DsText variant="headline" {...p} />;
export const Body = (p: Named) => <DsText variant="body" {...p} />;
export const Spec = (p: Named) => <DsText variant="spec" {...p} />;
export const Caption = (p: Named) => <DsText variant="caption" {...p} />;
