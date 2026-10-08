import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import { PressableScale, useDs } from '@/components/ds';
import { fontFamilies, layout, type } from '@/constants/tokens';
import { layoutLabels, mapSizeFor, placePairs, RINGS, type MapPair } from '@/lib/flavorMap';

/**
 * The rings. Drawn at the size it's given (so labels stay at caption size),
 * with what's picked in the middle. It's a picture of the list under it,
 * which carries the same results for screen readers.
 */
export function RingMap({ pairs, centre, onPick }: { pairs: readonly MapPair[]; centre: string[]; onPick: (id: string) => void }) {
  const ds = useDs();
  const [w, setW] = useState(0);
  const placed = placePairs(pairs.slice(0, mapSizeFor(w)));
  const centreR = Math.max(w * 0.11, 40);
  const labels = new Map(layoutLabels(placed, w, type.caption.fontSize, 7.4, centreR).map((l) => [l.id, l]));
  const c = w / 2;
  const font = {
    fontFamily: fontFamilies.body,
    fontSize: type.caption.fontSize,
  };

  return (
    <View style={styles.box} onLayout={(e) => setW(Math.min(e.nativeEvent.layout.width, 560))}>
      <View style={[styles.canvas, { width: w, height: w }]}>
        <Svg width={w} height={w} viewBox={`0 0 ${w} ${w}`}>
          {RINGS.map((r) => (
            <Circle key={r.label} cx={c} cy={c} r={(r.r * w) / 2} stroke={ds.c.line} strokeWidth={1} fill="none" />
          ))}
          {placed.map((p) => (
            <Line key={`l-${p.id}`} x1={c} y1={c} x2={p.x * w} y2={p.y * w} stroke={ds.c.line} strokeWidth={1} />
          ))}
          {placed.map((p) => (
            <Circle key={p.id} cx={p.x * w} cy={p.y * w} r={p.dot * w} fill={p.ring === 0 ? ds.c.ink : p.ring === 1 ? ds.c.muted : ds.c.faint} />
          ))}
          {/* Names after every dot, each over a halo of the ground, so an outer dot under an inner name stays readable. */}
          {placed.map((p) => {
            const label = labels.get(p.id);
            if (!label || label.hidden) return null;
            const props = { x: label.x, y: label.y, textAnchor: label.anchor, fontWeight: p.ring === 0 ? ('600' as const) : ('400' as const), ...font };
            return (
              <G key={`n-${p.id}`}>
                <SvgText {...props} stroke={ds.c.ground} strokeWidth={4} strokeLinejoin="round" fill={ds.c.ground}>
                  {label.text}
                </SvgText>
                <SvgText {...props} fill={ds.c.ink}>
                  {label.text}
                </SvgText>
              </G>
            );
          })}
          <Circle cx={c} cy={c} r={centreR} fill={ds.accentFill.fill} />
          {centre.map((name, i) => (
            <SvgText
              key={`${name}-${i}`}
              x={c}
              y={c + 5 + (i - (centre.length - 1) / 2) * (type.caption.fontSize + 3)}
              fill={ds.accentFill.text}
              textAnchor="middle"
              fontWeight="600"
              {...font}
            >
              {name.length > 14 ? `${name.slice(0, 13)}…` : name}
            </SvgText>
          ))}
        </Svg>
        {/* Taps land on plain views over the dots: SVG press handlers leak responder props into the DOM on web. */}
        {placed.map((p) => (
          <PressableScale
            key={`t-${p.id}`}
            role="button"
            accessibilityLabel={`Add ${p.name}`}
            onPress={() => onPick(p.id)}
            style={[
              styles.target,
              {
                left: p.x * w - layout.minTapTarget / 2,
                top: p.y * w - layout.minTapTarget / 2,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%' },
  canvas: { alignSelf: 'center' },
  target: {
    position: 'absolute',
    width: layout.minTapTarget,
    height: layout.minTapTarget,
    borderRadius: layout.minTapTarget / 2,
  },
});
