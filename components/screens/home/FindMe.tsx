import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { GlassButton } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { ZOOM_BUTTON } from '@/lib/discoverMap';

import { VIEW_PILL } from './DiscoverControls';

/**
 * Find me (disc-maps-habits, approved 24 Oct), as Google Maps' button: back
 * to the blue dot. It is Near me (asking for location when it's off), and
 * `again` changes on every press, so the map refits on the person even when
 * the area is already near them. Phones: above the sheet, riding it as it
 * moves and gone when it is all the way up, with `view` (List / Map) riding
 * in the middle beside it; wide screens: under the zoom buttons.
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
    button: (mode: 'sheet' | 'side', view?: ReactNode) => {
      if (mode === 'sheet') {
        return (
          <>
            {view ? (
              <OnSheet position={position} index={index} height={VIEW_PILL} style={styles.middle}>
                {view}
              </OnSheet>
            ) : null}
            {onFindMe ? (
              <OnSheet position={position} index={index} style={styles.onSheet}>
                <Button onPress={onPress} />
              </OnSheet>
            ) : null}
          </>
        );
      }
      if (!onFindMe) return null;
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

/** Rides just above the phone map's sheet as it moves, gone once it is all the way up. `height`: what rides. */
function OnSheet({ position, index, height = layout.minTapTarget, style, children }: { position: SharedValue<number>; index: SharedValue<number>; height?: number; style: ViewStyle; children: ReactNode }) {
  const ride = useAnimatedStyle(() => ({
    // Off the clipping box once the sheet is up, so it can't be tapped unseen.
    top: index.value > 1.5 ? -2 * height : position.value - height - space.md,
    opacity: interpolate(index.value, [1, 1.5], [1, 0], Extrapolation.CLAMP),
  }));
  return <Animated.View style={[style, ride]}>{children}</Animated.View>;
}

// Two buttons, a line between them and the group's border (discoverMapDom.ts).
const ZOOM_HEIGHT = 2 * ZOOM_BUTTON + 2;

const styles = StyleSheet.create({
  onSheet: { position: 'absolute', right: 0 },
  middle: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  // Under the web map's zoom buttons, which sit space.lg in from the top right.
  side: { position: 'absolute', right: space.lg, top: Platform.OS === 'web' ? space.lg + ZOOM_HEIGHT + space.sm : space.lg },
});
