import { ThemedText } from "@/components/themed-text";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import * as Haptics from "expo-haptics";
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from "react";
import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, runOnJS, SharedValue, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";

export const { width, height } = Dimensions.get("window");

export type Subject = "COCKTAILS" | "MENU" | "BEERS" | "WINES";
export type CocktailCategory = "TOP_20" | "TOP_40" | "STUDY_PILE" | "RANDOM";

export interface FlashcardItem {
    id: string;
    name: string;
    description: string;
    ingredients: {
        name: string;
        amount?: string;
    }[];
    imageUrl?: string;
}

export function SubjectCard({ icon, label, onPress }: { icon: string, label: string, onPress: () => void }) {
    return (
        <TouchableOpacity style={sharedStyles.subjectCardWrapper} onPress={onPress}>
            <GlassView style={sharedStyles.subjectCard} intensity={20}>
                <IconSymbol name={icon as any} size={32} color={Colors.dark.tint} />
                <ThemedText style={sharedStyles.subjectLabel}>{label}</ThemedText>
            </GlassView>
        </TouchableOpacity>
    );
}

export function CardCountSlider({ cardCount, onCountChange, sliderPos }: {
    cardCount: number,
    onCountChange: (count: number) => void,
    sliderPos: SharedValue<number>
}) {
    const sliderWidth = width - 110;

    const handleCountChange = (newCount: number) => {
        if (newCount !== cardCount) {
            Haptics.selectionAsync();
            onCountChange(newCount);
        }
    };

    const gesture = Gesture.Pan()
        .onUpdate((e) => {
            const val = Math.max(0, Math.min(1, e.x / sliderWidth));
            sliderPos.value = val;
            const count = Math.round(5 + (val * 15));
            runOnJS(handleCountChange)(count);
        })
        .onBegin((e) => {
            const val = Math.max(0, Math.min(1, e.x / sliderWidth));
            sliderPos.value = val;
            const count = Math.round(5 + (val * 15));
            runOnJS(handleCountChange)(count);
        });

    const animatedSliderFillStyle = useAnimatedStyle(() => ({
        width: `${sliderPos.value * 100}%`
    }));

    const animatedSliderHandleStyle = useAnimatedStyle(() => ({
        left: `${sliderPos.value * 100}%`
    }));

    return (
        <View style={sharedStyles.sliderWrapper}>
            <ThemedText style={sharedStyles.sliderLabel}>
                {cardCount === 20 ? "YOU'RE AN ANIMAL" : `NUMBER OF CARDS: ${cardCount}`}
            </ThemedText>
            <View style={sharedStyles.sliderContainer}>
                <ThemedText style={sharedStyles.sliderLimit}>5</ThemedText>
                <GestureDetector gesture={gesture}>
                    <View style={sharedStyles.sliderTrack}>
                        <GlassView style={sharedStyles.sliderTrackGlass} intensity={10}>
                            <Animated.View style={[sharedStyles.sliderFill, animatedSliderFillStyle]} />
                            <Animated.View style={[sharedStyles.sliderHandle, animatedSliderHandleStyle]} />
                        </GlassView>
                    </View>
                </GestureDetector>
                <ThemedText style={sharedStyles.sliderLimit}>20</ThemedText>
            </View>
        </View>
    );
}

// ... (keeping other exports)

export function CocktailGlass({ progress, color }: { progress: SharedValue<number>, color: string }) {
    // Collins Glass Shape (Tall, Straight)

    const animatedLiquidStyle = useAnimatedStyle(() => ({
        height: interpolate(progress.value, [0, 1], [0, 180]), // Full height of 180
        width: '100%',
        backgroundColor: color,
        position: 'absolute',
        bottom: 0,
        opacity: interpolate(progress.value, [0, 0.1], [0, 1])
    }));

    return (
        <View style={sharedStyles.glassOuterContainer}>
            {/* Straw - Straightened */}
            <View style={[sharedStyles.straw, { transform: [{ rotate: '0deg' }], right: 22, top: -55 }]} />

            {/* The Glass Container - Tall Collins */}
            <View style={sharedStyles.collinsContainer}>
                {/* Liquid Layer */}
                <Animated.View style={animatedLiquidStyle} />

                {/* Ice Cubes */}
                <View style={{ position: 'absolute', width: 45, height: 45, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 5, bottom: 20, left: 10, transform: [{ rotate: '10deg' }] }} />
                <View style={{ position: 'absolute', width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 5, bottom: 70, right: 5, transform: [{ rotate: '-15deg' }] }} />
                <View style={{ position: 'absolute', width: 42, height: 42, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 5, bottom: 120, left: 8, transform: [{ rotate: '5deg' }] }} />
                {/* 4th Ice Cube */}
                <View style={{ position: 'absolute', width: 38, height: 38, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 5, bottom: 155, right: 12, transform: [{ rotate: '25deg' }] }} />

                {/* Glass Reflection */}
                <LinearGradient
                    colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0.1)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />

                {/* Glass Border/Gloss */}
                <View style={[StyleSheet.absoluteFill, {
                    borderWidth: 2,
                    borderColor: 'rgba(255,255,255,0.3)',
                    borderTopWidth: 0,
                    borderRadius: 0,
                    borderBottomLeftRadius: 10,
                    borderBottomRightRadius: 10
                }]} />
            </View>

            <View style={sharedStyles.glassBase} />
        </View>
    );
}

export function ShakerToggle({ active, onPress }: { active: boolean, onPress: () => void }) {
    const shakeOffset = useSharedValue(0);

    useEffect(() => {
        if (active) {
            shakeOffset.value = withRepeat(
                withSequence(
                    withTiming(-3, { duration: 50 }),
                    withTiming(3, { duration: 50 })
                ),
                -1,
                true
            );
        } else {
            shakeOffset.value = withSpring(0);
        }
    }, [active]);

    const animatedShakerStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { rotate: active ? `${shakeOffset.value}deg` : '0deg' },
                { scale: withSpring(active ? 1.1 : 1) }
            ]
        };
    });

    const shakerColors: [string, string, string] = ['#E0E0E0', '#B0B0B0', '#E0E0E0'];
    const activeShakerColors: [string, string, string] = ['#FFD700', '#B8860B', '#FFD700'];

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={sharedStyles.shakerToggleContainer}>
            <View style={sharedStyles.shakerToggleLabels}>
                <ThemedText style={[sharedStyles.shakerToggleLabel, !active && sharedStyles.activeLabel]}>TRAINING MODE</ThemedText>
                <ThemedText style={[sharedStyles.shakerToggleLabel, active && sharedStyles.activeLabel]}>SPEC MODE</ThemedText>
            </View>

            <View style={sharedStyles.shakerWrapper}>
                <Animated.View style={[sharedStyles.shakerBody, animatedShakerStyle]}>
                    <LinearGradient
                        colors={active ? activeShakerColors : shakerColors}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={sharedStyles.shakerCap}
                    />
                    <LinearGradient
                        colors={active ? activeShakerColors : shakerColors}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={sharedStyles.shakerTop}
                    />
                    <LinearGradient
                        colors={active ? activeShakerColors : shakerColors}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={sharedStyles.shakerMain}
                    />
                </Animated.View>

                <Animated.View style={[
                    sharedStyles.shakerGlow,
                    { opacity: useDerivedValue(() => withSpring(active ? 0.4 : 0)).value }
                ]} />
            </View>

        </TouchableOpacity>
    );
}

export const sharedStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.dark.background },
    safeArea: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
    backButton: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
    title: {
        fontSize: 34,
        lineHeight: 38,
        fontWeight: "bold",
        letterSpacing: 0.5,
        flex: 1,
        textAlign: "center"
    },
    selectionGrid: { flexDirection: "row", flexWrap: "wrap", padding: 15, gap: 15, justifyContent: "space-between" },
    subjectCardWrapper: { width: "47%", height: 120 },
    subjectCard: { flex: 1, borderRadius: 20, justifyContent: "center", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
    subjectLabel: { fontSize: 18, fontWeight: "600", letterSpacing: 1 },
    sliderWrapper: { padding: 30, paddingBottom: 110 },
    sliderLabel: { fontSize: 16, fontWeight: "600", color: Colors.dark.icon, marginBottom: 15, textAlign: "center" },
    sliderContainer: { flexDirection: "row", alignItems: "center", gap: 15 },
    sliderLimit: { fontSize: 14, color: Colors.dark.icon, width: 25 },
    sliderTrack: { flex: 1, height: 40, justifyContent: "center" },
    sliderTrackGlass: { height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.05)", overflow: "visible" },
    sliderFill: { height: "100%", backgroundColor: Colors.dark.tint, borderRadius: 5 },
    sliderHandle: { position: "absolute", width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFF", top: -7, marginLeft: -12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
    // Shaker Toggle Styles
    shakerToggleContainer: { paddingVertical: 20, alignItems: 'center', gap: 15 },
    shakerToggleLabels: { flexDirection: 'row', justifyContent: 'space-between', width: width - 80, marginBottom: 5 },
    shakerToggleLabel: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.3)', letterSpacing: 1 },
    activeLabel: { color: Colors.dark.tint },
    shakerWrapper: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center' },
    shakerBody: { alignItems: 'center' },
    shakerCap: { width: 30, height: 15, borderTopLeftRadius: 10, borderTopRightRadius: 10, marginBottom: 2 },
    shakerTop: { width: 60, height: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25, marginBottom: 2 },
    shakerMain: { width: 55, height: 70, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
    shakerGlow: { position: 'absolute', width: 110, height: 110, backgroundColor: Colors.dark.tint, borderRadius: 55, zIndex: -1 },
    toggleHint: { fontSize: 14, fontWeight: 'bold', color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginTop: 5 },
    // Collins Glass Styles
    glassOuterContainer: { alignItems: 'center', justifyContent: 'center', padding: 10, position: 'relative' },
    collinsContainer: {
        width: 70,
        height: 180,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        borderTopLeftRadius: 1, // Slight lip
        borderTopRightRadius: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
        position: 'relative',
        marginBottom: 2,
        zIndex: 10
    },
    straw: {
        position: 'absolute',
        width: 8,
        height: 220,
        backgroundColor: '#E0E0E0',
        top: -60,
        right: 15,
        transform: [{ rotate: '15deg' }],
        borderRadius: 4,
        zIndex: 0, // Behind the glass container visually? Or inside? 
        // If behind glass container, it looks like it's in the background. 
        // Ideally: inside glass (zIndex high) but clipped?
        // If outside, we just see it sticking out top. 
        // Let's put it behind for now so it doesn't overlap liquid weirdly if not clipped.
        opacity: 0.9
    },
    pourOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', zIndex: 40 },
    pourBubble: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.4)', position: 'absolute', top: -15 },
    pourStream: { width: 4, position: 'absolute', top: -120, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
    glassBase: { width: 60, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 2 },
});
