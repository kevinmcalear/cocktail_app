import { Platform, Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';

import { faceWeightReset, font, nameStyle, textSlack, type, type TypeStyle } from '@/constants/tokens';

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

// Everything but display, head and title is the system font; spec amounts in tabular figures.
const FACE: Record<Exclude<TypeStyle, 'display' | 'head' | 'title'>, TextStyle> = {
  headline: font.semiBold,
  body: font.regular,
  spec: font.figuresMedium,
  label: font.medium,
  caption: font.medium,
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
 * Text in one of the eight Back Bar styles. Display, head and title set names, in
 * the venue's face or the app's own (Redaction); everything else is the
 * system font, so every venue stays legible.
 * Scales with the person's text size setting (Dynamic Type) by default.
 */
export function DsText({ variant = 'body', tone = 'ink', italic, color, align, style, ...rest }: DsTextProps) {
  const ds = useDs();
  const isDisplay = variant === 'display' || variant === 'head' || variant === 'title';
  // A bar's face sits at Redaction's height, with its own spacing and capitals.
  const faceStyle = isDisplay ? nameStyle(ds.displayFace, type[variant], italic) : FACE[variant];
  const toneColor = {
    ink: ds.c.ink,
    muted: ds.c.muted,
    accent: ds.accentText,
    onAccent: ds.accentFill.text,
  }[tone];
  // A caller that sets a display face on a system variant gets the face's own weight.
  const own = isDisplay ? undefined : StyleSheet.flatten(style);
  const weightReset = own ? faceWeightReset(own.fontFamily, own.fontWeight) : undefined;
  return (
    <RNText
      {...rest}
      style={[
        type[variant],
        SLACK,
        faceStyle,
        weightReset,
        { color: color ?? toneColor, textAlign: align },
        style,
      ]}
    />
  );
}

type Named = Omit<DsTextProps, 'variant'>;
export const Display = (p: Named) => <DsText variant="display" role="heading" {...p} />;
/** A main tab's name at the top of its page. */
export const Head = (p: Named) => <DsText variant="head" role="heading" {...p} />;
export const Title = (p: Named) => <DsText variant="title" role="heading" {...p} />;
export const Headline = (p: Named) => <DsText variant="headline" {...p} />;
export const Body = (p: Named) => <DsText variant="body" {...p} />;
export const Spec = (p: Named) => <DsText variant="spec" {...p} />;
export const Caption = (p: Named) => <DsText variant="caption" {...p} />;
