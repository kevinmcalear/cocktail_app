import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { GlassButton } from '@/components/ds';
import { layout, space } from '@/constants/tokens';

/**
 * Find me (disc-maps-habits, approved 24 Oct), as Google Maps' button: back
 * to the blue dot. It is Near me (asking for location when it's off), and
 * `again` changes on every press, so the map refits on the person even when
 * the area is already near them. Phones: above the sheet, riding it as it
 * moves and gone when it is all the way up; wide screens: under the zoom buttons.
 */
export function useFindMe(onFindMe?: () => void) {
  const [again, setAgain] = useState(0);
  const position = useSharedValue(0);
  const index = useSharedValue(0);
  const onPress = () => {
    setAgain((n) => n + 1);
    onFindMe?.();
  };
  return {
    again,
    /** Spread on the phone's BottomSheet. */
    sheet: { animatedPosition: position, animatedIndex: index },
    button: (mode: 'sheet' | 'side') => {
      if (!onFindMe) return null;
      if (mode === 'sheet') return <OnSheet position={position} index={index} onPress={onPress} />;
      return (
        <View style={styles.side}>
          <Button onPress={onPress} />
        </View>
      );
    },
  };
}

function Button({ onPress }: { onPress: () => void }) {
  return <GlassButton accessibilityLabel="Find me" icon="location.fill" onPress={onPress} />;
}

function OnSheet({ position, index, onPress }: { position: SharedValue<number>; index: SharedValue<number>; onPress: () => void }) {
  const ride = useAnimatedStyle(() => ({
    // Off the clipping box once the sheet is up, so it can't be tapped unseen.
    top: index.value > 1.5 ? -2 * layout.minTapTarget : position.value - layout.minTapTarget - space.md,
    opacity: interpolate(index.value, [1, 1.5], [1, 0], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[styles.onSheet, ride]}>
      <Button onPress={onPress} />
    </Animated.View>
  );
}

const ZOOM_HEIGHT = 82;

const styles = StyleSheet.create({
  onSheet: { position: 'absolute', right: 0 },
  // Under the web map's zoom buttons: two 40-point buttons and their borders, space.lg in from the top right (discoverMapDom.ts).
  side: { position: 'absolute', right: space.lg, top: Platform.OS === 'web' ? space.lg + ZOOM_HEIGHT + space.sm : space.lg },
});
