import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Line icons Feather doesn't have, drawn like the canvas's own icons: a
 * 24-point box, a 1.7 stroke, round caps and joins. The wine glass and the
 * palette are the canvas's paths (My Bar, Brand).
 */
const GLYPHS = {
  wineglass: ['M8 3h8l-.5 6a3.5 3.5 0 0 1-7 0z', 'M12 12.5V20M8.5 20h7'],
  beer: ['M6 8h9v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z', 'M15 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2', 'M6 5.5c1-1.5 3-1.5 4.5 0 1.5-1.5 3.5-1.5 4.5 0'],
  snowflake: ['M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5', 'M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5'],
  leaf: ['M5 19c0-8.5 5.5-14 15-14 0 9.5-5.5 15-14 15', 'M5 19l7.5-7.5'],
  building: ['M4.5 20.5V6.5l8-3v17', 'M12.5 9h7v11.5', 'M3 20.5h18', 'M7.5 9.5h2M7.5 13h2M7.5 16.5h2M15.5 12.5h1.5M15.5 16h1.5'],
  flask: ['M9 3h6M10 3v6.5L5.2 18a1.6 1.6 0 0 0 1.4 2.5h10.8a1.6 1.6 0 0 0 1.4-2.5L14 9.5V3', 'M7.6 14.5h8.8'],
  sparkles: ['M11 3.5l1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6-4.6-1.7 4.6-1.7z', 'M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z'],
  palette: ['M12 20.5c-1.5-2-1-4 1.5-4h3', 'M12 20.5a8.5 8.5 0 1 1 8.5-8.5c0 2.6-1.8 4.5-4 4.5'],
  pin: ['M9 3.5h6l-1 5.5 3 3H7l3-3z', 'M12 12v8.5'],
  seal: [
    'M12 3l2.3 1.6 2.8-.1.9 2.7 2.3 1.6-.9 2.7.9 2.7-2.3 1.6-.9 2.7-2.8-.1L12 21l-2.3-1.6-2.8.1-.9-2.7-2.3-1.6.9-2.7-.9-2.7 2.3-1.6.9-2.7 2.8.1z',
    'M9 12l2 2 4-4',
  ],
  updown: ['M8 4v16M4.5 7.5L8 4l3.5 3.5', 'M16 20V4M12.5 16.5L16 20l3.5-3.5'],
  // The one filled glyph: a bar you love (ppl-bar-top's Loved pill).
  heartFill: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'],
} as const;

export type LineGlyphName = keyof typeof GLYPHS | 'dot';

export function LineGlyph({ name, size, color }: { name: LineGlyphName; size: number; color: ColorValue }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={name === 'heartFill' ? color : 'none'} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {name === 'dot' ? (
        <Circle cx={12} cy={12} r={6} fill={color} stroke="none" />
      ) : (
        <>
          {GLYPHS[name].map((d) => (
            <Path key={d} d={d} />
          ))}
          {name === 'palette' ? (
            <>
              <Circle cx={8.5} cy={10} r={1.2} />
              <Circle cx={12} cy={7.5} r={1.2} />
              <Circle cx={15.5} cy={10} r={1.2} />
            </>
          ) : null}
        </>
      )}
    </Svg>
  );
}
