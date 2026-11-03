import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, DsText, GlassSurface, PressableScale, useDs } from '@/components/ds';
import { useTabBarTop } from '@/components/nav/WebTabBar';
import { font, radius, space } from '@/constants/tokens';
import { useMenuArrowKeys, useMenuPagerNav } from '@/hooks/useMenuPager';
import type { PagerDrink } from '@/lib/menuPager';

// Past this many the dots are too small to count: the label above already says "4 of 20".
const MAX_DOTS = 12;

/**
 * A drink page read inside a menu (2027 canvas, Menu-pager, Menu-in-draw):
 * the drink page itself is unchanged, with "Autumn · 4 of 8" at the top and a
 * glass bar at the foot, ‹ the drink before, a dot for each drink, the next ›.
 * The arrow keys page on the web (a swipe on phones, PagerSwipe). InMenu
 * lays it over the drink page, only inside a menu (?menu=).
 */
export function MenuPager({ menuId, bar, itemId }: { menuId: string; bar: string | null; itemId: string }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarTop() + space.md;
  const { place, go } = useMenuPagerNav(menuId, bar, itemId);
  const prev = place?.prev ?? null;
  const next = place?.next ?? null;

  // The web: ← and → page through the menu.
  useMenuArrowKeys(place ? () => go(prev) : null, place ? () => go(next) : null);

  if (!place) return null;
  return (
    <>
      {/* Under the glass buttons, clear of Save, Share and More, over the top of the sky. */}
      <View pointerEvents="none" style={[styles.label, { top: insets.top + space.lg + 44 + space.md }]}>
        <Caption tone="muted" style={styles.caps}>
          {place.label.toUpperCase()}
        </Caption>
      </View>
      <View style={[styles.foot, { bottom }]} pointerEvents="box-none">
        <GlassSurface style={styles.bar} interactive>
          <View role="navigation" aria-label="Drinks on this menu" style={styles.nav}>
            <PagerEnd drink={prev} dir="prev" onPress={() => go(prev)} />
            {place.total <= MAX_DOTS ? (
              <View style={styles.dots} aria-hidden>
                {Array.from({ length: place.total }, (_, i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: i === place.index ? ds.c.ink : ds.c.lineStrong }]} />
                ))}
              </View>
            ) : null}
            <PagerEnd drink={next} dir="next" onPress={() => go(next)} />
          </View>
        </GlassSurface>
      </View>
    </>
  );
}

/** ‹ Old Fashioned, or Clover Club ›; an empty end at the first or last drink keeps the dots centred. */
function PagerEnd({ drink, dir, onPress }: { drink: PagerDrink | null; dir: 'prev' | 'next'; onPress: () => void }) {
  if (!drink) return <View style={styles.end} />;
  return (
    <PressableScale role="link" accessibilityLabel={`${dir === 'next' ? 'Next' : 'Before'}: ${drink.name}`} onPress={onPress} style={[styles.end, dir === 'next' ? styles.endNext : null]}>
      <DsText variant="label" numberOfLines={1} style={font.semiBold}>
        {dir === 'prev' ? `‹ ${drink.name}` : `${drink.name} ›`}
      </DsText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  label: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  caps: { letterSpacing: 1.5, ...font.medium },
  foot: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 520, height: 58, borderRadius: radius.pill },
  nav: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs + 2 },
  end: { flex: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  endNext: { alignItems: 'flex-end' },
  dots: { flexDirection: 'row', gap: 4, paddingHorizontal: space.xs },
  dot: { width: 5, height: 5, borderRadius: radius.pill },
});
