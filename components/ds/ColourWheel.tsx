import { useState } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { backbar, radius, space } from '@/constants/tokens';
import { colourName } from '@/lib/brandColours';
import { hexToHsv, hsvToHex } from '@/lib/color';

import { useDs } from './theme';

const SIZE = 232;
const R = SIZE / 2;
// ponytail: SVG has no conic gradient, so the hue ring is 90 thin wedges (4° each); smooth at this size.
const WEDGES = 90;
const SLIDER = 28;
const THUMB = 28;
const RING = backbar.light.surface;

const wedges = Array.from({ length: WEDGES }, (_, i) => {
  // Each wedge a hair wider than its share, so no seam shows between them.
  const a0 = ((i - 0.6) * 2 * Math.PI) / WEDGES;
  const a1 = ((i + 0.6) * 2 * Math.PI) / WEDGES;
  const p = (a: number) => `${R + R * Math.cos(a)} ${R + R * Math.sin(a)}`;
  return { hue: (i * 360) / WEDGES, d: `M${R} ${R} L${p(a0)} A${R} ${R} 0 0 1 ${p(a1)} Z` };
});

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

interface ColourWheelProps {
  /** '#RRGGBB', or null while the hex field holds something that isn't one. */
  value: string | null;
  onChange: (hex: string) => void;
}

/**
 * A hue and saturation wheel with a brightness slider under it: drag either
 * (touch or mouse) and the colour comes back as hex. The hex field beside it
 * stays for an exact colour; typing one moves the wheel. Screen readers get
 * increment and decrement on each (hue in 15° steps, brightness in 5%).
 */
export function ColourWheel({ value, onChange }: ColourWheelProps) {
  const ds = useDs();
  const [own, setOwn] = useState(() => (value ? hexToHsv(value) : { h: 25, s: 0.7, v: 0.8 }));
  const [track, setTrack] = useState(0);
  // Our own pick while `value` is what we sent (so a grey keeps its hue); a typed hex otherwise.
  const hsv = value && value !== hsvToHex(own.h, own.s, own.v) ? hexToHsv(value) : own;

  const emit = (next: { h: number; s: number; v: number }) => {
    setOwn(next);
    onChange(hsvToHex(next.h, next.s, next.v));
  };
  const pickWheel = (x: number, y: number) => {
    const dx = x - R;
    const dy = y - R;
    emit({ ...hsv, h: ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360, s: clamp(Math.hypot(dx, dy) / R, 0, 1) });
  };
  const pickBrightness = (x: number) => {
    if (track) emit({ ...hsv, v: clamp((x - SLIDER / 2) / (track - SLIDER), 0, 1) });
  };

  // From the first touch, so a tap picks too and the pager behind doesn't take the drag.
  const wheelPan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => scheduleOnRN(pickWheel, e.x, e.y))
    .onUpdate((e) => scheduleOnRN(pickWheel, e.x, e.y));
  const sliderPan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => scheduleOnRN(pickBrightness, e.x))
    .onUpdate((e) => scheduleOnRN(pickBrightness, e.x));

  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const full = hsvToHex(hsv.h, hsv.s, 1);
  const angle = (hsv.h * Math.PI) / 180;
  const thumb = { left: R + Math.cos(angle) * hsv.s * R - THUMB / 2, top: R + Math.sin(angle) * hsv.s * R - THUMB / 2 };
  const step = (by: Partial<{ h: number; v: number }>) => (e: AccessibilityActionEvent) => {
    const sign = e.nativeEvent.actionName === 'increment' ? 1 : -1;
    emit({ h: (hsv.h + sign * (by.h ?? 0) + 360) % 360, s: by.h && !hsv.s ? 1 : hsv.s, v: clamp(hsv.v + sign * (by.v ?? 0), 0, 1) });
  };
  const actions = [{ name: 'increment' }, { name: 'decrement' }];

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={wheelPan}>
        <View
          role="slider"
          accessibilityLabel="Colour wheel"
          aria-valuetext={`${colourName(hex)}, ${hex}`}
          accessibilityActions={actions}
          onAccessibilityAction={step({ h: 15 })}
          style={styles.wheel}
        >
          <View pointerEvents="none">
            <Svg width={SIZE} height={SIZE}>
              <Defs>
                {/* Grey at the centre, the pure hue at the rim: brightness greys both. */}
                <RadialGradient id="sat" cx={R} cy={R} r={R} gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={hsvToHex(0, 0, hsv.v)} stopOpacity={1} />
                  <Stop offset="1" stopColor={hsvToHex(0, 0, hsv.v)} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              {wedges.map((w) => (
                <Path key={w.hue} d={w.d} fill={hsvToHex(w.hue, 1, hsv.v)} />
              ))}
              <Circle cx={R} cy={R} r={R} fill="url(#sat)" />
            </Svg>
          </View>
          <View pointerEvents="none" style={[styles.thumb, thumb, { backgroundColor: hex, borderColor: RING, outlineColor: ds.c.lineStrong }]} />
        </View>
      </GestureDetector>

      <GestureDetector gesture={sliderPan}>
        <View
          role="slider"
          accessibilityLabel="Brightness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hsv.v * 100)}
          aria-valuetext={`${Math.round(hsv.v * 100)}%`}
          accessibilityActions={actions}
          onAccessibilityAction={step({ v: 0.05 })}
          onLayout={(e) => setTrack(e.nativeEvent.layout.width)}
          style={styles.slider}
        >
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width="100%" height={SLIDER}>
              <Defs>
                <LinearGradient id="val" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={hsvToHex(0, 0, 0)} />
                  <Stop offset="1" stopColor={full} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height={SLIDER} rx={SLIDER / 2} fill="url(#val)" stroke={ds.c.line} />
            </Svg>
          </View>
          <View
            pointerEvents="none"
            style={[styles.thumb, { top: 0, left: hsv.v * Math.max(0, track - SLIDER) + (SLIDER - THUMB) / 2, backgroundColor: hex, borderColor: RING, outlineColor: ds.c.lineStrong }]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.lg, paddingVertical: space.sm },
  wheel: { width: SIZE, height: SIZE, cursor: 'pointer' },
  slider: { maxWidth: SIZE + space.xl * 2, width: '100%', height: SLIDER, alignSelf: 'center', cursor: 'pointer' },
  thumb: { position: 'absolute', width: THUMB, height: THUMB, borderRadius: radius.pill, borderWidth: 3, outlineWidth: 1, outlineStyle: 'solid' },
});
