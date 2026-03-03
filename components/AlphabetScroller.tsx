import { Colors } from "@/constants/theme";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    runOnJS,
    SharedValue,
    useAnimatedStyle,
    useSharedValue, withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ALPHABET = ["#", ...("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""))];
const SCROLLER_WIDTH = 40;

interface AlphabetScrollerProps {
    onScrollToLetter: (letter: string) => void;
    letters?: string[];
}

export function AlphabetScroller({ onScrollToLetter, letters = ALPHABET }: AlphabetScrollerProps) {
    const insets = useSafeAreaInsets();
    const activeY = useSharedValue(-1);
    const isTouching = useSharedValue(false);
    const activeIndex = useSharedValue(-1); // Track index on UI thread
    const [containerHeight, setContainerHeight] = useState(0);

    const letterHeightSV = useSharedValue(0);

    const displayLetters = letters;
    const letterHeight = containerHeight > 0
        ? containerHeight / displayLetters.length
        : 0;

    React.useEffect(() => {
        letterHeightSV.value = letterHeight;
    }, [letterHeight]);

    const triggerSelection = (index: number) => {
        if (index >= 0 && index < displayLetters.length) {
            Haptics.selectionAsync();
            onScrollToLetter(displayLetters[index]);
        }
    };

    const panGesture = React.useMemo(() => Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
            activeY.value = e.y;
            isTouching.value = true;

            const lh = letterHeightSV.value;
            if (lh > 0) {
                const index = Math.floor(e.y / lh);
                if (index !== activeIndex.value) {
                    activeIndex.value = index;
                    runOnJS(triggerSelection)(index);
                }
            }
        })
        .onUpdate((e) => {
            activeY.value = e.y;

            const lh = letterHeightSV.value;
            if (lh > 0) {
                const index = Math.floor(e.y / lh);
                // Only trigger if index changed
                if (index !== activeIndex.value && index >= 0 && index < displayLetters.length) {
                    activeIndex.value = index;
                    runOnJS(triggerSelection)(index);
                }
            }
        })
        .onFinalize(() => {
            activeY.value = -1;
            isTouching.value = false;
            activeIndex.value = -1;
        }), [displayLetters, onScrollToLetter]);

    const onLayout = (event: LayoutChangeEvent) => {
        setContainerHeight(event.nativeEvent.layout.height);
    };

    const animatedContainerStyle = useAnimatedStyle(() => {
        return {
            opacity: withTiming(isTouching.value ? 1 : 0, { duration: 200 }),
        };
    });

    return (
        <View
            style={[styles.container, { top: insets.top + 140, bottom: insets.bottom + 110 }]}
            onLayout={onLayout}
            pointerEvents="box-none"
        >
            <GestureDetector gesture={panGesture}>
                <Animated.View style={styles.gestureContainer}>
                    <Animated.View style={[styles.innerContainer, animatedContainerStyle]} pointerEvents="none">
                        {displayLetters.map((letter, index) => (
                            <LetterItem
                                key={letter}
                                letter={letter}
                                index={index}
                                activeY={activeY}
                                letterHeight={letterHeight}
                            />
                        ))}
                    </Animated.View>
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

const LetterItem = ({
    letter,
    index,
    activeY,
    letterHeight,
}: {
    letter: string;
    index: number;
    activeY: SharedValue<number>;
    letterHeight: number;
}) => {
    // Hooks must be unconditional. Use a fallback height if 0 to maintain hook order/count
    const safeLetterHeight = letterHeight > 0 ? letterHeight : 10;

    const startY = index * safeLetterHeight;
    // We can't center perfectly without real height, but hooks need to run. 
    // If height is 0 (first render), visuals don't matter much.
    const centerY = startY + safeLetterHeight / 2;

    const animatedStyle = useAnimatedStyle(() => {
        const distance = Math.abs(activeY.value - centerY);
        const isActive = activeY.value !== -1;

        let opacity = 0.6;
        let textShadowRadius = 0;
        let textShadowColor = "transparent";

        const influenceRange = Math.max(safeLetterHeight * 5, 120);

        if (isActive && distance < influenceRange) {
            const progress = distance / influenceRange;
            const curve = (Math.cos(progress * Math.PI) + 1) / 2;

            opacity = 0.6 + curve * 0.4;

            if (distance < safeLetterHeight / 2) {
                // Active letter
                textShadowRadius = 10;
                textShadowColor = Colors.light.tint; // Use a contrasting tint for glow
            }
        }

        return {
            opacity: withTiming(opacity, { duration: 50 }),
            // Animate these for smoothness
            textShadowColor: textShadowColor,
            textShadowRadius: withTiming(textShadowRadius, { duration: 50 }),
        };
    });

    const textStyle = useAnimatedStyle(() => {
        const distance = Math.abs(activeY.value - centerY);
        const isActive = activeY.value !== -1;
        const isClosest = isActive && distance < safeLetterHeight / 1.5;

        return {
            color: withTiming(isClosest ? "#fff" : Colors.dark.tint, { duration: 50 }),
        }
    });

    // Don't render content if height is 0 to avoid layout thrashing, 
    // but we MUST have called the hooks above.
    if (letterHeight === 0) {
        // Return a dummy view to take up space/allow layout measurement passed down
        return <View style={{ flex: 1 }} />;
    }

    return (
        <View style={[styles.letterWrapper, { height: letterHeight }]}>
            <Animated.View style={[styles.letterInner, animatedStyle]}>
                <Animated.Text style={[styles.letterText, textStyle]}>{letter}</Animated.Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        right: 0,
        width: 40, // Wider touch target since it's invisible
        justifyContent: "center",
        alignItems: "flex-end", // Align letters inside the wider touch target to the right
        zIndex: 10, // Must be high enough to catch touch events
    },
    innerContainer: {
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "space-between",
    },
    gestureContainer: {
        width: "100%",
        height: "100%",
        alignItems: 'center',
        paddingRight: 4,
        backgroundColor: "transparent",
    },
    letterWrapper: {
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    letterInner: {
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
    },
    letterText: {
        fontSize: 10, // iOS standard size is tiny
        fontWeight: "bold",
        color: Colors.light.tint, // Classic iOS blue color instead of dark tint
    }
});

