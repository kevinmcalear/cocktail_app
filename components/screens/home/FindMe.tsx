import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { GlassButton } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { ZOOM_BUTTON } from '@/lib/discoverMap';

/**
 * Find me (disc-maps-habits, approved 24 Oct), as Google Maps' button: back
 * to the blue dot. It is Near me (asking for location when it's off), and
 * `again` changes on every press, so the map refits on the person even when
 * the area is already near them. Phones: above the sheet, riding it as it
 * moves and gone as it heads all the way up (`full`: the sheet's top snap
 * point); wide screens: under the zoom buttons.
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
    button: (mode: 'sheet' | 'side', full = 1) => {
      if (!onFindMe) return null;
      if (mode === 'sheet') {
        return (
          <OnSheet position={position} index={index} full={full} style={styles.onSheet}>
            <Button onPress={onPress} />
          </OnSheet>
        );
      }
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

/** Rides just above the phone map's sheet as it moves, fading as it heads for `full` (the top snap). */
function OnSheet({ position, index, full, style, children }: { position: SharedValue<number>; index: SharedValue<number>; full: number; style: ViewStyle; children: ReactNode }) {
  const height = layout.minTapTarget;
  const ride = useAnimatedStyle(() => ({
    // Off the clipping box once the sheet is up, so it can't be tapped unseen.
    top: index.value > full - 0.5 ? -2 * height : position.value - height - space.md,
    opacity: interpolate(index.value, [full - 1, full - 0.5], [1, 0], Extrapolation.CLAMP),
  }));
  return <Animated.View style={[style, ride]}>{children}</Animated.View>;
}

// Two buttons, a line between them and the group's border (discoverMapDom.ts).
const ZOOM_HEIGHT = 2 * ZOOM_BUTTON + 2;

const styles = StyleSheet.create({
  onSheet: { position: 'absolute', right: space.lg },
  // Under the web map's zoom buttons, which sit space.lg in from the top right.
  side: { position: 'absolute', right: space.lg, top: Platform.OS === 'web' ? space.lg + ZOOM_HEIGHT + space.sm : space.lg },
});
