import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { GlassButton, useDs, useGutter } from '@/components/ds';
import { FEATURES } from '@/constants/features';
import { layout, space, type BackbarScheme } from '@/constants/tokens';

interface DrinkControlsProps {
  /** What fills the hero: a photo, or the cream paper a sketch sits on. */
  media: 'photo' | 'paper';
  /** Room above the buttons: the safe-area top, or less inside an iOS sheet. */
  top: number;
  heroHeight: number;
  /** The page's scroll offset (phones). Wide screens leave it at 0. */
  scrollY: SharedValue<number>;
  wide: boolean;
  /** In a pane beside a list: nothing to go back to. */
  noBack?: boolean;
  /** On the To make list in Collection. */
  saved: boolean;
  onToggleSaved: () => void;
  inStudyPile: boolean;
  onToggleStudyPile: () => void;
  canEdit: boolean;
  onEdit: () => void;
  /** What the edit button says to a screen reader; the ingredient page reuses these controls. */
  editLabel?: string;
  /** Ingredients keep a favourites heart on the device; drinks go to To make. */
  saveAs?: 'toMake' | 'favourite';
}

/**
 * Close, To make and edit, pinned to the top of the drink page. Over the
 * hero they take the picture's colours: dark glass on a photo, light glass on
 * sketch paper. Once the hero scrolls up, a bar in the page ground fades in
 * behind them and they take the theme's colours.
 */
export function DrinkControls({ media, top, heroHeight, scrollY, wide, noBack, saved, onToggleSaved, inStudyPile, onToggleStudyPile, canEdit, onEdit, editLabel = 'Edit drink', saveAs = 'toMake' }: DrinkControlsProps) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const barHeight = top + space.sm * 2 + layout.minTapTarget;
  // The scroll offset where the hero's bottom edge meets the bar's.
  const tucked = heroHeight - barHeight;
  const [overHero, setOverHero] = useState(true);
  useAnimatedReaction(
    () => scrollY.value < tucked,
    (now, before) => {
      if (now !== before) runOnJS(setOverHero)(now);
    },
    [tucked],
  );
  const barStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [tucked - space.xxl, tucked], [0, 1], 'clamp') }));

  const heroScheme: BackbarScheme = media === 'photo' ? 'dark' : 'light';
  const left = overHero ? heroScheme : undefined;
  // On wide screens the right-hand buttons sit over the page, not the hero.
  const right = overHero && !wide ? heroScheme : undefined;

  return (
    <>
      {wide ? null : <Animated.View style={[styles.bar, { height: barHeight, backgroundColor: ds.c.ground, borderBottomColor: ds.c.line }, barStyle]} />}
      <View style={[styles.controls, { top: top + space.sm, left: gutter, right: gutter }]}>
        {noBack ? (
          <View />
        ) : (
          <GlassButton
            accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
            icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
            scheme={left}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        )}
        <View style={styles.right}>
          <GlassButton
            accessibilityLabel={saveAs === 'favourite' ? (saved ? 'Remove from favourites' : 'Add to favourites') : saved ? 'Remove from To make' : 'Add to To make'}
            icon={`${saveAs === 'favourite' ? 'heart' : 'bookmark'}${saved ? '.fill' : ''}`}
            scheme={right}
            onPress={onToggleSaved}
          />
          {FEATURES.study ? (
            <GlassButton accessibilityLabel={inStudyPile ? 'Remove from study pile' : 'Add to study pile'} icon={inStudyPile ? 'book.fill' : 'book'} scheme={right} onPress={onToggleStudyPile} />
          ) : null}
          {canEdit ? <GlassButton accessibilityLabel={editLabel} icon="pencil" scheme={right} onPress={onEdit} /> : null}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, borderBottomWidth: StyleSheet.hairlineWidth, pointerEvents: 'none' },
  controls: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  right: { flexDirection: 'row', gap: space.sm },
});
