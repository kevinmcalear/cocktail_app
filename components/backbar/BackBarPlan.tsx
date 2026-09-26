import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { Caption, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { PLAN_ASPECT, zoneRect } from '@/lib/backBar';
import { withAlpha } from '@/lib/color';
import type { BarZone } from '@/types/backBar';

interface BackBarPlanProps {
  zones: BarZone[];
  /** Zones drawn in the accent: the selected one on the map, or where an item lives. */
  highlightIds?: string[];
  /** Makes each zone a button. Without it the plan is a picture (the ingredient card). */
  onPressZone?: (zone: BarZone) => void;
  /** Describes what pressing a zone does right now ("Places Honey here"). */
  zoneHint?: (zone: BarZone) => string | undefined;
  /** When set, tapping an empty part of the plan reports where, as fractions. */
  onPressPlan?: (x: number, y: number) => void;
  /** Label every zone (the map) or only the highlighted ones (the small card). */
  labels?: 'all' | 'highlighted';
  /** Per-zone count for the accessible name ("Fridge 2, 4 items"). */
  countFor?: (zoneId: string) => number;
  accessibilityLabel: string;
}

// Web press events carry offsetX/Y; native ones carry locationX/Y.
function pointIn(e: GestureResponderEvent, size: { w: number; h: number }) {
  const ne = e.nativeEvent as GestureResponderEvent['nativeEvent'] & { offsetX?: number; offsetY?: number };
  const x = Platform.OS === 'web' && ne.offsetX != null ? ne.offsetX : ne.locationX;
  const y = Platform.OS === 'web' && ne.offsetY != null ? ne.offsetY : ne.locationY;
  return { x: x / size.w, y: y / size.h };
}

/**
 * Announces a toggle's state: aria-pressed on web (aria-selected only counts on
 * tabs and options there), aria-selected on native, which has no pressed state.
 * ponytail: lib/a11yState's pressedProps once PR #61 reaches this stack.
 */
export function selectedProps(on: boolean): object {
  return Platform.OS === 'web' ? { 'aria-pressed': on } : { 'aria-selected': on };
}

/**
 * The venue's plan, drawn from each zone's fractional position so the phone
 * and the web show the same map at any size. Zones that haven't been drawn
 * yet don't appear here; the map lists them underneath.
 */
export function BackBarPlan({ zones, highlightIds = [], onPressZone, zoneHint, onPressPlan, labels = 'all', countFor, accessibilityLabel }: BackBarPlanProps) {
  const ds = useDs();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const accent = ds.accentText;
  // On a phone-width plan, capitals, tracking and mono cost the characters that tell Fridge 1 from Fridge 2.
  const narrow = size.w > 0 && size.w < 520;

  const drawn = zones.flatMap((z) => {
    const r = zoneRect(z);
    return r ? [{ zone: z, r }] : [];
  });

  return (
    <View role="group" aria-label={accessibilityLabel} style={[styles.frame, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={styles.plan}>
        {/* Behind the zones, not around them, so it never wraps (or disables) their
            buttons. Keyboards use the arrow buttons instead. */}
        {onPressPlan ? (
          <Pressable
            accessible={false}
            focusable={false}
            onPress={(e) => {
              if (!size.w) return;
              const p = pointIn(e, size);
              onPressPlan(p.x, p.y);
            }}
            style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(accent, 0.05) }]}
          />
        ) : null}
        {drawn.map(({ zone, r }) => {
          const on = highlightIds.includes(zone.id);
          const showLabel = labels === 'all' || on;
          const box = {
            left: `${r.x * 100}%`,
            top: `${r.y * 100}%`,
            width: `${r.w * 100}%`,
            height: `${r.h * 100}%`,
            borderColor: on ? accent : ds.c.lineStrong,
            backgroundColor: on ? withAlpha(accent, 0.22) : zone.kind === 'bar_top' ? ds.c.raised : 'transparent',
            borderWidth: on ? 2 : 1,
          } as const;
          const label = showLabel ? (
            <Caption
              numberOfLines={1}
              color={on ? accent : ds.c.muted}
              style={[!narrow && styles.label, { fontFamily: narrow ? fontFamilies.bodyMedium : on ? fontFamilies.monoMedium : fontFamilies.mono }]}
            >
              {narrow ? zone.name : zone.name.toUpperCase()}
            </Caption>
          ) : null;
          if (!onPressZone) {
            return (
              <View key={zone.id} style={[styles.zone, box]} pointerEvents="none">
                {label}
              </View>
            );
          }
          const count = countFor?.(zone.id);
          return (
            <PressableScale
              key={zone.id}
              onPress={() => onPressZone(zone)}
              accessibilityLabel={count == null ? zone.name : `${zone.name}, ${count} ${count === 1 ? 'item' : 'items'}`}
              accessibilityHint={zoneHint?.(zone)}
              {...selectedProps(on)}
              style={[styles.zone, box]}
            >
              {label}
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, padding: space.sm },
  plan: { width: '100%', aspectRatio: PLAN_ASPECT, borderRadius: radius.control, overflow: 'hidden' },
  zone: { position: 'absolute', borderRadius: radius.mark, paddingHorizontal: space.xs, justifyContent: 'center', overflow: 'hidden' },
  label: { letterSpacing: 0.5 },
});
