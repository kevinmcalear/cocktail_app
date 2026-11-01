import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useBreakpoint, useDs, useGutter } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';

interface DrinkDesktopProps {
  /** A beer's or wine's page, which has no spec. */
  children: ReactNode;
  /** The drink's pictures, drawn to fit the card. */
  hero: (height: number) => ReactNode;
  /** To make, Share, Edit, More: over the hero card. */
  heroActions: ReactNode;
  top: number;
}

const HERO_W = 300;
const HERO_H = 640;

/**
 * The drink page from tablet width up (board drink-desktop): the hero as a
 * card on the left, the page beside it with Spec | Service | More tabs.
 * No inspector column: the shot list is on the Service tab and View as is
 * in More (13 Oct). It sits left, beside the sidebar, in the 1240 column (docs/design_system.md, Layout). As on the phone
 * (13 Oct), the Spec tab is just what you need to make it; strength,
 * allergens, flavor, the backstory and the rest are under More.
 */
export function DrinkDesktop({ children, hero, heroActions, top }: DrinkDesktopProps) {
  const ds = useDs();
  const gutter = useGutter();
  const desktop = useBreakpoint() === 'desktop';
  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ paddingTop: top + (desktop ? space.xl : layout.minTapTarget + space.lg), paddingBottom: space.xxxl, paddingHorizontal: gutter }}>
      <View style={styles.page}>
        <View style={[styles.hero, { backgroundColor: ds.c.paper }]}>
          {hero(HERO_H)}
          <View style={styles.heroActions}>{heroActions}</View>
        </View>
        <View style={styles.body}>{children}</View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xl, maxWidth: layout.page.wide, width: '100%' },
  hero: { width: HERO_W, height: HERO_H, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  heroActions: { position: 'absolute', top: space.md, right: space.md, flexDirection: 'row', gap: space.sm },
  body: { flex: 1, minWidth: 0, gap: space.lg },
});
