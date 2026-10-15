import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Segmented, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';

import type { DrinkSections } from './DrinkSections';

type Tab = 'spec' | 'service' | 'more';

interface DrinkDesktopProps {
  sections: DrinkSections;
  /** The drink's pictures, drawn to fit the card. */
  hero: (height: number) => ReactNode;
  /** To make, Share, Edit, More: over the hero card. */
  heroActions: ReactNode;
  /** Batch, Rank it, I made it, in a row under the method. */
  actions: ReactNode;
  /** The venue's team: a Service tab. */
  staff: boolean;
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
export function DrinkDesktop({ sections: s, hero, heroActions, actions, staff, top }: DrinkDesktopProps) {
  const ds = useDs();
  const gutter = useGutter();
  const desktop = useBreakpoint() === 'desktop';
  const [tab, setTab] = useState<Tab>('spec');
  const tabs = [
    { value: 'spec' as const, label: 'Spec' },
    ...(staff ? [{ value: 'service' as const, label: 'Service' }] : []),
    { value: 'more' as const, label: 'More' },
  ];
  const shown = tabs.some((t) => t.value === tab) ? tab : 'spec';

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ paddingTop: top + (desktop ? space.xl : layout.minTapTarget + space.lg), paddingBottom: space.xxxl, paddingHorizontal: gutter }}>
      <View style={styles.page}>
        <View style={[styles.hero, { backgroundColor: ds.c.paper }]}>
          {hero(HERO_H)}
          <View style={styles.heroActions}>{heroActions}</View>
        </View>
        <View style={styles.body}>
          {s.header}
          {s.intro}
          <Segmented options={tabs} value={shown} onChange={setTab} accessibilityLabel="Drink" variant="ink" />
          {shown === 'spec' ? (
            <View style={[styles.tab, styles.make]}>
              {s.spec}
              {actions}
              {s.journey}
              {s.myNote}
              {s.floor}
            </View>
          ) : null}
          {shown === 'service' ? <View style={styles.tab}>{s.service}</View> : null}
          {shown === 'more' ? (
            <View style={styles.tab}>
              {s.standing}
              {s.banner}
              {s.description}
              {s.facts}
              {s.allergens}
              {s.flavor}
              {s.servedAt}
              {s.menus}
              {s.history}
              {s.cost}
              {s.backstory}
              {s.photos}
              {s.classicLink}
              {s.publish}
            </View>
          ) : null}
        </View>
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
  tab: { gap: space.xl, paddingTop: space.sm },
  // A recipe card's width: the amounts stay near their ingredients.
  make: { maxWidth: 560 },
});
