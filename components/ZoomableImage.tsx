import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';

import { ImageSourcePropType } from 'react-native';

interface ZoomableImageProps {
    source: string | { uri: string } | ImageSourcePropType;
    onZoomChange?: (isZoomed: boolean) => void;
}

export function ZoomableImage({ source, onZoomChange }: ZoomableImageProps) {
    const { width, height } = useWindowDimensions();
    
    // Shared Values
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const [isPanEnabled, setIsPanEnabled] = React.useState(false);

    // Callbacks wrapper to run on JS thread
    const handleZoomChange = (zoomed: boolean) => {
        setIsPanEnabled(zoomed);
        if (onZoomChange) {
            onZoomChange(zoomed);
        }
    };

    // Pinch Gesture
    const pinch = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = savedScale.value * e.scale;
        })
        .onEnd(() => {
            if (scale.value < 1) {
                // Bounce back to 1 if zoomed out too much
                scale.value = withTiming(1);
                savedScale.value = 1;
                translateX.value = withTiming(0);
                savedTranslateX.value = 0;
                translateY.value = withTiming(0);
                savedTranslateY.value = 0;
                runOnJS(handleZoomChange)(false);
            } else {
                savedScale.value = scale.value;
                runOnJS(handleZoomChange)(true);
            }
        });

    // Pan Gesture
    const pan = Gesture.Pan()
        .enabled(isPanEnabled)
        .averageTouches(true)
        .onUpdate((e) => {
            if (scale.value > 1) {
                translateX.value = savedTranslateX.value + e.translationX;
                translateY.value = savedTranslateY.value + e.translationY;
            }
        })
        .onEnd(() => {
            // Add boundaries or snap back logic if needed later
            // For now, save position
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    // Double Tap to reset
    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            if (scale.value !== 1) {
                scale.value = withTiming(1);
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedScale.value = 1;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
                runOnJS(handleZoomChange)(false);
            } else {
                scale.value = withTiming(2);
                savedScale.value = 2;
                runOnJS(handleZoomChange)(true);
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value }
        ]
    }));

    const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

    return (
        <GestureDetector gesture={composed}>
            <Animated.View style={styles.container}>
                <Animated.Image
                    source={typeof source === 'string' ? { uri: source } : source}
                    style={[{ width, height: '100%', resizeMode: 'contain' }, animatedStyle]}
                />
            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    }
});
