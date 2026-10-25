import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, PressableScale } from '@/components/ds';
import { fontFamilies, layout, space } from '@/constants/tokens';
import { useMenuSectionPlace } from '@/hooks/useDrinkDesk';

/** One level of what's being made, from the menu down; `onPress` goes up to it. The last is where you are. */
export interface TrailItem {
  label: string;
  onPress?: () => void;
}

/**
 * Where you are in what's being made (make-anything-overview, rule 3):
 * "Halloween party › Salty Boy › Miso banana liqueur". A tap on a level
 * above takes you up to it; the last is where you are.
 */
export function Trail({ items, color }: { items: readonly TrailItem[]; color?: string }) {
  if (items.length < 2) return null;
  return (
    <View role="navigation" aria-label="Where you are" style={styles.trail}>
      {items.map((t, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={`${i}:${t.label}`}>
            {i ? (
              <Caption aria-hidden color={color} style={[styles.mono, styles.sep]}>
                ›
              </Caption>
            ) : null}
            {last || !t.onPress ? (
              <Caption color={color} tone={color ? undefined : last ? undefined : 'muted'} style={[styles.mono, last && styles.here]} aria-current={last ? 'page' : undefined} numberOfLines={1}>
                {t.label}
              </Caption>
            ) : (
              <PressableScale role="link" onPress={t.onPress} accessibilityLabel={`Up to ${t.label}`} style={styles.link}>
                <Caption color={color} tone={color ? undefined : 'muted'} style={styles.mono} numberOfLines={1}>
                  {t.label}
                </Caption>
              </PressableScale>
            )}
          </Fragment>
        );
      })}
    </View>
  );
}

/** A drink's trail (make-anything-steps-1, step 3): the menu it's for, else the venue, else your drinks, then its name; the first goes back there. None before it has a name. */
export function drinkTrail(name: string, { menu, venueName, onClose }: { menu: string | null; venueName: string | null; onClose: () => void }): TrailItem[] | undefined {
  const named = name.trim();
  return named ? [{ label: menu ?? venueName ?? 'Your drinks', onPress: onClose }, { label: named }] : undefined;
}

/** A drink's trail and the menu it's for, read from the menu section it was started from. */
export function useDrinkTrail(name: string, { menuSectionId, venueName, onClose }: { menuSectionId: string | null | undefined; venueName: string | null; onClose: () => void }) {
  const menu = useMenuSectionPlace(menuSectionId).data?.menu ?? null;
  return { menu, trail: drinkTrail(name, { menu, venueName, onClose }) };
}

/**
 * The trail one level down. `leave` leaves this level, keeping what's done
 * (make-anything-overview, rule 4): the level just above is `leave`, and
 * every level higher up leaves this one first, then goes on up from there.
 */
export function trailInto(items: readonly TrailItem[], leave: () => void, here: string): TrailItem[] {
  const up = items.slice(0, -1).map((t) => {
    const go = t.onPress;
    return go
      ? {
          ...t,
          onPress: () => {
            leave();
            go();
          },
        }
      : t;
  });
  return [...up, ...(items.length ? [{ ...items[items.length - 1], onPress: leave }] : []), { label: here }];
}

const styles = StyleSheet.create({
  trail: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.xs + 2 },
  mono: { fontFamily: fontFamilies.monoMedium },
  here: { fontFamily: fontFamilies.monoMedium, fontWeight: '600' },
  sep: { opacity: 0.6 },
  link: { minHeight: layout.minTapTarget, justifyContent: 'center' },
});
