import { Text as RNText, type TextProps } from 'react-native';

import { displayFaces, fontFamilies, type, type TypeStyle } from '@/constants/tokens';

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
