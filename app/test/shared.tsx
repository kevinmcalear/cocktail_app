import { ThemedText } from "@/components/themed-text";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
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

    const gesture = Gesture.Pan()
        .onUpdate((e) => {
            const val = Math.max(0, Math.min(1, e.x / sliderWidth));
            sliderPos.value = val;
            const count = Math.round(5 + (val * 15));
            runOnJS(onCountChange)(count);
        })
        .onBegin((e) => {
            const val = Math.max(0, Math.min(1, e.x / sliderWidth));
            sliderPos.value = val;
            const count = Math.round(5 + (val * 15));
            runOnJS(onCountChange)(count);
        });

    const animatedSliderFillStyle = useAnimatedStyle(() => ({
        width: `${sliderPos.value * 100}%`
    }));

    const animatedSliderHandleStyle = useAnimatedStyle(() => ({
        left: `${sliderPos.value * 100}%`
    }));

    return (
        <View style={sharedStyles.sliderWrapper}>
            <ThemedText style={sharedStyles.sliderLabel}>NUMBER OF CARDS: {cardCount}</ThemedText>
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

export function CocktailGlass({ progress, color }: { progress: SharedValue<number>, color: string }) {
    // Liquid fill height calculation
    const animatedLiquidStyle = useAnimatedStyle(() => ({
        height: interpolate(progress.value, [0, 1, 1.2], [0, 75, 80]),
        backgroundColor: color,
        opacity: interpolate(progress.value, [0, 0.1], [0, 1])
    }));

    // Pouring elements animations
    const animatedBubbleStyle = useAnimatedStyle(() => ({
        opacity: progress.value > 0 && progress.value < 1.05 ? 0.6 : 0,
        transform: [
            { translateY: interpolate(progress.value, [0, 1], [0, -35]) },
            { scale: interpolate(progress.value, [0, 1], [0.5, 1.2]) }
        ]
    }));

    const animatedStreamStyle = useAnimatedStyle(() => ({
        opacity: progress.value > 0 && progress.value < 1.05 ? 0.8 : 0,
        height: interpolate(progress.value, [0, 1], [90, 0], 'clamp')
    }));

    const renderSplash = (index: number) => {
        const animatedSplashStyle = useAnimatedStyle(() => {
            const isSplashing = progress.value > 0.95 && progress.value < 1.3;
            const splashProgress = interpolate(progress.value, [0.95, 1.2], [0, 1], 'clamp');
            const xDir = index % 2 === 0 ? -1 : 1;
            const xDist = (index + 1) * 15 * xDir;
            const yDist = -35 - (index * 8);

            return {
                opacity: isSplashing ? interpolate(splashProgress, [0, 0.8, 1], [0, 0.8, 0]) : 0,
                transform: [
                    { translateX: splashProgress * xDist },
                    { translateY: (splashProgress * yDist) + (splashProgress * splashProgress * 60) },
                    { scale: interpolate(splashProgress, [0, 0.5, 1], [0, 1, 0.5]) }
                ],
                backgroundColor: color
            };
        });
        return <Animated.View key={index} style={[sharedStyles.splashParticle, animatedSplashStyle]} />;
    };

    return (
        <View style={sharedStyles.glassOuterContainer}>
            <View style={sharedStyles.martiniBowl}>
                {/* Visual Walls */}
                <View style={[sharedStyles.martiniWall, sharedStyles.martiniWallLeft]} />
                <View style={[sharedStyles.martiniWall, sharedStyles.martiniWallRight]} />

                {/* Liquid Area with Clipping */}
                <View style={sharedStyles.martiniLiquidArea}>
                    <Animated.View style={[sharedStyles.liquidBodyStandard, animatedLiquidStyle]} />

                    {/* Corner shrouds to mask the liquid into a V-shape */}
                    <View style={[sharedStyles.martiniShroud, sharedStyles.martiniShroudLeft]} />
                    <View style={[sharedStyles.martiniShroud, sharedStyles.martiniShroudRight]} />
                </View>

                {/* Pouring elements (above the liquid, centered) */}
                <View pointerEvents="none" style={sharedStyles.pourOverlay}>
                    <Animated.View style={[sharedStyles.pourBubble, animatedBubbleStyle]} />
                    <Animated.View style={[sharedStyles.pourStream, animatedStreamStyle, { backgroundColor: color }]} />
                </View>

                {/* Overflow Spritzes */}
                {[...Array(6)].map((_, i) => renderSplash(i))}
            </View>
            <View style={sharedStyles.glassStem} />
            <View style={sharedStyles.glassBase} />
        </View>
    );
}

export function ShakerToggle({ active, onPress }: { active: boolean, onPress: () => void }) {
    const progress = useDerivedValue(() => {
        return withSpring(active ? 1 : 0, { damping: 15 });
    });

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
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10 },
    backButton: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
    title: {
        fontSize: 28,
        lineHeight: 34,
        fontWeight: "bold",
        letterSpacing: 0.5,
        flex: 1,
        textAlign: "center"
    },
    selectionGrid: { flexDirection: "row", flexWrap: "wrap", padding: 15, gap: 15, justifyContent: "space-between" },
    subjectCardWrapper: { width: "47%", height: 120 },
    subjectCard: { flex: 1, borderRadius: 20, justifyContent: "center", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
    subjectLabel: { fontSize: 18, fontWeight: "600", letterSpacing: 1 },
    sliderWrapper: { padding: 30, paddingBottom: 50 },
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
    // Fresh Martini Glass Styles
    glassOuterContainer: { alignItems: 'center', justifyContent: 'center', padding: 10 },
    martiniBowl: { width: 100, height: 75, position: 'relative', alignItems: 'center' },
    martiniWall: { position: 'absolute', width: 2, height: 90, backgroundColor: 'rgba(255,255,255,0.4)', top: -10, zIndex: 30 },
    martiniWallLeft: { transform: [{ rotate: '-35deg' }], left: 22 },
    martiniWallRight: { transform: [{ rotate: '35deg' }], right: 22 },
    martiniLiquidArea: { width: 100, height: 75, overflow: 'hidden', position: 'relative', alignItems: 'center' },
    liquidBodyStandard: { width: '100%', position: 'absolute', bottom: 0, zIndex: 10 },
    martiniShroud: { position: 'absolute', width: 100, height: 100, backgroundColor: Colors.dark.background, zIndex: 20 },
    martiniShroudLeft: { transform: [{ rotate: '-35deg' }], left: -78, top: -5 },
    martiniShroudRight: { transform: [{ rotate: '35deg' }], right: -78, top: -5 },
    pourOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', zIndex: 40 },
    pourBubble: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.4)', position: 'absolute', top: -15 },
    pourStream: { width: 4, position: 'absolute', top: -120, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
    splashParticle: { position: 'absolute', top: 0, width: 8, height: 8, borderRadius: 4, zIndex: 50 },
    glassStem: { width: 4, height: 50, backgroundColor: 'rgba(255,255,255,0.3)' },
    glassBase: { width: 50, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
});
