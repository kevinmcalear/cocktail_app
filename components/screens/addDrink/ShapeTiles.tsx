import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import type { GlassVariant } from '@/lib/sketch/geometry';
import { glassOutline } from '@/lib/sketch/glassOutline';

interface ShapeTilesProps {
  shapes: readonly GlassVariant[];
  /** The picked shape's key. */
  value: string;
  onChange: (key: string) => void;
  /** A line under a shape, by key: "Little Rye uses this". */
  notes?: Partial<Record<string, string>>;
}

/**
 * "Which shape?" (canvas make-create-glass): each shape of the glass as a
 * line drawing on paper in a card, its name and the bar's note inside, the
 * picked one ringed in the accent.
 */
export function ShapeTiles({ shapes, value, onChange, notes }: ShapeTilesProps) {
  const ds = useDs();
  const noted = shapes.some((s) => notes?.[s.key]);
  return (
    <View role="radiogroup" accessibilityLabel="Glass shape" style={styles.row}>
      {shapes.map((s) => {
        const on = s.key === value;
        const note = notes?.[s.key];
        return (
          <PressableScale
            key={s.key}
            role="radio"
            aria-checked={on}
            accessibilityLabel={note ? `${s.label}. ${note}` : s.label}
            onPress={() => onChange(s.key)}
            style={[styles.tile, { borderColor: on ? ds.accentText : ds.c.line, backgroundColor: on ? ds.c.raised : ds.c.surface }]}
          >
            <View style={[styles.paper, { backgroundColor: ds.c.paper }]}>
              <Svg width={62} height={62} viewBox="0 0 100 100" aria-hidden>
                <Path d={glassOutline(s.shape)} fill="none" stroke={ds.c.sketchInk} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Body>{s.label}</Body>
            {noted ? (
              <Caption tone="muted" align="center" style={styles.note}>
                {note ?? ''}
              </Caption>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Three to a row: wine has six shapes, and a phone row of six is too small to tell apart.
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '30%', flexGrow: 1, maxWidth: '33.3%', minWidth: 0, alignItems: 'center', gap: space.xs + 2, paddingTop: space.sm + 2, paddingBottom: space.md, paddingHorizontal: space.xs + 2, borderRadius: radius.card, borderWidth: 1.5 },
  paper: { alignSelf: 'stretch', height: 88, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  note: { minHeight: 36 },
});
