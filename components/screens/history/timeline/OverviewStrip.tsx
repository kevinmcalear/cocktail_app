import { useRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { familyHues, radius, space } from '@/constants/tokens';
import { FAMILIES, type TreeNode } from '@/lib/drinkTree';
import { ERAS, eraBands, eraOf, eraX, yearAt } from '@/lib/timeline';

const LANE_H = 10;
const DOT = 5;
const LIT = 8;

/**
 * The desktop timeline's overview: every dated drink as a dot in its family's
 * lane, eras as bands sized by how busy they were, the thread lit in the
 * accent, and a frame on the era on screen. Click or drag to travel.
 */
export function OverviewStrip({ nodes, thread, year, onTravel }: { nodes: readonly TreeNode[]; thread: ReadonlySet<string>; year: number | null; onTravel: (year: number) => void }) {
  const ds = useDs();
  const hues = familyHues[ds.scheme];
  const width = useRef(1);
  const bands = eraBands();
  const current = year != null ? eraOf(year) : null;
  const frame = bands.find((b) => b.era.key === current?.key);
  const travel = (e: GestureResponderEvent) => onTravel(yearAt(e.nativeEvent.locationX / width.current));
  const stepEra = (by: number) => {
    const i = Math.max(0, ERAS.findIndex((e) => e.key === current?.key));
    onTravel(ERAS[Math.min(ERAS.length - 1, Math.max(0, i + by))].start);
  };

  return (
    <View style={[styles.box, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.labels}>
        {bands.map((b) => (
          <View key={b.era.key} style={[styles.label, { left: `${b.x * 100}%`, width: `${b.w * 100}%`, borderLeftColor: ds.c.line }]}>
            <Caption tone={b.era.key === current?.key ? 'ink' : 'muted'} color={b.era.key === current?.key ? ds.accentText : undefined} numberOfLines={1}>
              {b.era.name}
            </Caption>
          </View>
        ))}
      </View>
      <View
        role="slider"
        accessibilityLabel="Overview of every era. Click or drag to travel."
        aria-valuemin={ERAS[0].start}
        aria-valuemax={2026}
        aria-valuenow={year ?? ERAS[0].start}
        aria-valuetext={current ? `${year}, ${current.name}` : undefined}
        accessibilityActions={[{ name: 'increment', label: 'Next era' }, { name: 'decrement', label: 'Previous era' }]}
        onAccessibilityAction={(e) => stepEra(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        onLayout={(e) => (width.current = Math.max(1, e.nativeEvent.layout.width))}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={travel}
        onResponderMove={travel}
        style={[styles.lanes, { height: FAMILIES.length * LANE_H + space.sm }]}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {nodes.map((n) => {
            const lane = FAMILIES.findIndex((f) => f.key === n.family);
            if (n.year == null || lane < 0 || n.kind !== 'drink') return null;
            const lit = thread.has(n.key);
            const size = lit ? LIT : DOT;
            return (
              <View
                key={n.key}
                style={{
                  position: 'absolute',
                  left: `${eraX(n.year) * 100}%`,
                  top: space.xs + lane * LANE_H + LANE_H / 2 - size / 2,
                  width: size,
                  height: size,
                  marginLeft: -size / 2,
                  borderRadius: radius.pill,
                  backgroundColor: lit ? ds.accentText : hues[n.family as keyof typeof hues],
                  opacity: lit ? 1 : 0.7,
                }}
              />
            );
          })}
          {frame ? (
            <View style={[styles.frame, { left: `${frame.x * 100}%`, width: `${frame.w * 100}%`, borderColor: ds.accentText }]} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md, gap: space.sm },
  labels: { height: 18 },
  label: { position: 'absolute', top: 0, paddingLeft: space.xs, borderLeftWidth: StyleSheet.hairlineWidth },
  lanes: { position: 'relative' },
  frame: { position: 'absolute', top: 0, bottom: 0, borderWidth: 2, borderRadius: radius.mark + 2 },
});
