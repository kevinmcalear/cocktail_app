import { useRouter } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { BackbarTheme, Body, BrandProvider, TextLink, useDs } from '@/components/ds';
import { radius, space, springs } from '@/constants/tokens';
import type { Venue } from '@/hooks/useActiveVenue';

import { Eyebrow } from '../addDrink/WizardChrome';
import { GuestCardContent } from './MenuCardScreen';
import type { LayoutEditor } from './useLayoutEditor';

/**
 * What guests see, live: the guest card set from the menu as it stands in
 * the editor (unsaved changes too), on paper with each drink's sketch. Like
 * the add-drink wizard's drawing, it gives a small pour bounce when a drink lands.
 */
export function GuestPreview({ editor, venue }: { editor: LayoutEditor; venue: Venue | null }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const sections = editor.layout.sections.map((s) => ({ id: s.key, name: s.name, drinks: s.drinks }));
  const count = sections.reduce((n, s) => n + s.drinks.length, 0);

  const scale = useSharedValue(1);
  const before = useRef(count);
  useEffect(() => {
    if (count > before.current && !reduceMotion) scale.set(withSequence(withSpring(0.97, springs.snap), withSpring(1, springs.pour)));
    before.current = count;
  }, [count, reduceMotion, scale]);
  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Eyebrow>What guests see</Eyebrow>
        <TextLink label="Open the card" onPress={() => router.push(`/menus/${editor.menu.id}/card`)} />
      </View>
      <Animated.View style={bounce}>
        <BackbarTheme scheme="light">
          <BrandProvider accent={venue?.accent ?? undefined}>
            <Paper count={count}>
              <GuestCardContent name={editor.layout.name.trim() || 'Menu'} startsAt={editor.menu.startsAt} venue={venue} sections={sections} pictures="above" compact />
            </Paper>
          </BrandProvider>
        </BackbarTheme>
      </Animated.View>
    </View>
  );
}

/** The card's paper, in the light theme whatever the app is in. */
function Paper({ count, children }: { count: number; children: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.paper, { backgroundColor: ds.c.paper }]}>
      {children}
      {count ? null : <Body tone="muted">Add drinks and they show up here, the way guests will see them.</Body>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  paper: { borderRadius: radius.card, borderCurve: 'continuous', paddingVertical: space.xl, paddingHorizontal: space.md, gap: space.md, alignItems: 'center' },
});
