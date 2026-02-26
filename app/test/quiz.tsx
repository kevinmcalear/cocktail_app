import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { beers } from "@/data/beers";
import { wines } from "@/data/wines";
import { useCocktails } from "@/hooks/useCocktails";
import { useStudyPile } from "@/hooks/useStudyPile";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { AnimatePresence, MotiView } from "moti";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { FadeInDown, FadeInUp, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming, ZoomIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, YStack } from "tamagui";
import { CocktailCategory, CocktailGlass, FlashcardItem, height, sharedStyles, Subject, width } from "./_shared";

export default function QuizScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        subject: Subject,
        cocktailCategory?: CocktailCategory,
        cardCount: string,
        includeMeasurements: string
    }>();

    const { studyPile } = useStudyPile();
    const [items, setItems] = useState<FlashcardItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [scores, setScores] = useState<Record<string, 'poor' | 'acceptable' | 'perfect'>>({});
    const [showResults, setShowResults] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);
    const [loading, setLoading] = useState(true);
    const flipped = useSharedValue(0);
    const pourAnimation = useSharedValue(0);

    const cardCount = parseInt(params.cardCount || "10");
    const includeMeasurements = params.includeMeasurements === "true";

    const { data: allCocktails, isLoading: loadingCocktails } = useCocktails();

    useEffect(() => {
        if (!loadingCocktails) {
            startQuiz();
        }
    }, [loadingCocktails, allCocktails]);

    const startQuiz = async () => {
        setLoading(true);
        let fetchedItems: FlashcardItem[] = [];

        if (params.subject === "COCKTAILS") {
            fetchedItems = getCocktails();
        } else if (params.subject === "MENU") {
            fetchedItems = []; // Hardcoded menu removed in favor of dynamic DB
        } else if (params.subject === "BEERS") {
            fetchedItems = beers.map(b => ({
                id: b.id,
                name: b.name,
                description: b.description,
                ingredients: [{ name: b.description }]
            }));
        } else if (params.subject === "WINES") {
            fetchedItems = wines.map(w => ({
                id: w.id,
                name: w.name,
                description: w.description,
                ingredients: [{ name: w.description }]
            }));
        }

        // Shuffle and limit based on cardCount
        fetchedItems = fetchedItems
            .sort(() => Math.random() - 0.5)
            .slice(0, cardCount);

        setItems(fetchedItems);
        setCurrentIndex(0);
        flipped.value = 0;
        setLoading(false);
    };

    const getCocktails = (): FlashcardItem[] => {
        if (!allCocktails) return [];
        let filtered = allCocktails;

        if (params.cocktailCategory === "STUDY_PILE") {
            filtered = filtered.filter(c => studyPile.includes(c.id));
        } else if (params.cocktailCategory === "TOP_20") {
            filtered = filtered.slice(0, 20);
        } else if (params.cocktailCategory === "TOP_40") {
            filtered = filtered.slice(0, 40);
        } // RANDOM does nothing, shuffles later

        let result = filtered.map((c: any) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            ingredients: c.recipes?.map((r: any) => ({
                name: r.ingredients?.name || "Unknown",
                amount: formatAmount(r)
            })) || [],
            imageUrl: c.cocktail_images?.[0]?.images?.url
        }));

        if (params.cocktailCategory === "RANDOM") {
            result = result.sort(() => Math.random() - 0.5);
        }

        return result;
    };

    const formatAmount = (r: any) => {
        const parts = [];
        if (r.is_top) parts.push("Top");
        if (r.ingredient_ml) parts.push(`${r.ingredient_ml}ml`);
        if (r.ingredient_bsp) parts.push(`${r.ingredient_bsp} bsp`);
        if (r.ingredient_dash) parts.push(`${r.ingredient_dash} dash${r.ingredient_dash > 1 ? 'es' : ''}`);
        if (r.ingredient_amount) parts.push(`${r.ingredient_amount}`);
        return parts.join(" ");
    };

    const handleRetry = () => {
        setScores({});
        setCurrentIndex(0);
        setShowResults(false);
        setIsRevealed(false);
        flipped.value = 0;
        pourAnimation.value = 0;
    };

    const handleNewTest = () => {
        router.back();
    };

    const handleFlip = () => {
        const newValue = flipped.value === 0 ? 180 : 0;
        flipped.value = withSpring(newValue);
        // Delay setting isRevealed slightly to match the flip animation
        setTimeout(() => {
            setIsRevealed(newValue === 180);
        }, 150);
    };

    const handleScore = (score: 'poor' | 'acceptable' | 'perfect') => {
        const item = items[currentIndex];
        setScores(prev => ({ ...prev, [item.id]: score }));

        if (currentIndex < items.length - 1) {
            flipped.value = 0;
            setIsRevealed(false);
            setCurrentIndex(currentIndex + 1);
        } else {
            setShowResults(true);
            // Very slow, dramatic pour: 0-1 (fill glass), 1-2 (slow fill screen)
            setTimeout(() => {
                pourAnimation.value = withTiming(2, { duration: 10000 });
            }, 500);
        }
    };

    const calculateResult = () => {
        const total = items.length;
        const counts = { poor: 0, acceptable: 0, perfect: 0 };
        Object.values(scores).forEach(s => counts[s]++);

        const r = (counts.poor * 255 + counts.acceptable * 255 + counts.perfect * 76) / total;
        const g = (counts.poor * 75 + counts.acceptable * 165 + counts.perfect * 175) / total;
        const b = (counts.poor * 75 + counts.acceptable * 0 + counts.perfect * 80) / total;

        return {
            color: `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`,
            percentage: (counts.perfect + counts.acceptable * 0.5) / total,
            counts
        };
    };

    const result = calculateResult();

    const animatedBgStyle = useAnimatedStyle(() => ({
        height: interpolate(pourAnimation.value, [1, 2], [0, height + 100]), // Ensure it goes past the top
        backgroundColor: result.color,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 0, // Keep at the very back of the results layer
    }));

    const frontAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotateY: `${interpolate(flipped.value, [0, 180], [0, 180])}deg` }],
        backfaceVisibility: "hidden",
    }));

    const backAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotateY: `${interpolate(flipped.value, [0, 180], [180, 360])}deg` }],
        backfaceVisibility: "hidden",
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
    }));

    const actionsOpacityStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pourAnimation.value, [1.8, 2.0], [0, 1]),
        transform: [{ translateY: interpolate(pourAnimation.value, [1.8, 2.0], [20, 0]) }]
    }));

    const glassRevealStyle = useAnimatedStyle(() => ({
        opacity: withTiming(showResults ? 1 : 0, { duration: 1000 }),
        transform: [{ scale: withSpring(showResults ? 1.2 : 0.8) }]
    }));

    if (loading) {
        return (
            <YStack style={sharedStyles.container}>
                <SafeAreaView style={sharedStyles.safeArea}>
                    <View style={styles.loadingContainer}>
                        <Text>LOADING ITEMS...</Text>
                    </View>
                </SafeAreaView>
            </YStack>
        );
    }

    if (items.length === 0) {
        return (
            <YStack style={sharedStyles.container}>
                <SafeAreaView style={sharedStyles.safeArea}>
                    <Stack.Screen options={{ headerShown: false }} />
                    <View style={styles.emptyContainer}>
                        <IconSymbol name="exclamationmark.triangle" size={64} color={Colors.dark.icon} />
                        <Text style={styles.emptyText}>No items found for this selection.</Text>
                    </View>
                </SafeAreaView>
            </YStack>
        );
    }



    if (showResults) {
        const { color, percentage, counts } = result;

        return (
            <YStack style={sharedStyles.container}>
                {/* Background Liquid Overlay */}
                <Animated.View style={animatedBgStyle} />

                <SafeAreaView style={[sharedStyles.safeArea, { zIndex: 10 }]}>
                    <View style={styles.resultsWrapper}>
                        <View style={styles.resultsMainContent}>
                            <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.titleBox}>
                                <Text style={styles.resultsTitle}>RESULTS</Text>
                            </Animated.View>

                            <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.glassWrapperLarge}>
                                <CocktailGlass progress={pourAnimation} color={color} />
                            </Animated.View>

                            <View style={[styles.statsContainer, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }]}>
                                <View style={{ gap: 10 }}>
                                    <View style={styles.statRow}>
                                        <View style={[styles.statDot, { backgroundColor: '#4CAF50' }]} />
                                        <Text style={styles.statLabel}>PERFECT: {counts.perfect}</Text>
                                    </View>
                                    <View style={styles.statRow}>
                                        <View style={[styles.statDot, { backgroundColor: '#FFA500' }]} />
                                        <Text style={styles.statLabel}>ACCEPTABLE: {counts.acceptable}</Text>
                                    </View>
                                    <View style={styles.statRow}>
                                        <View style={[styles.statDot, { backgroundColor: '#FF4B4B' }]} />
                                        <Text style={styles.statLabel}>POOR: {counts.poor}</Text>
                                    </View>
                                </View>
                                <PieGraph counts={counts} size={100} />
                            </View>

                            <Animated.View style={styles.scoreBox} entering={ZoomIn.delay(600).springify()}>
                                <Text style={styles.finalScore}>
                                    {Math.round(percentage * 100)}%
                                </Text>
                            </Animated.View>
                        </View>

                        <Animated.View style={styles.bottomPinnedSection} entering={FadeInUp.delay(800).springify()}>
                            <View style={styles.actionButtonsRow}>
                                <TouchableOpacity style={styles.actionButtonSmall} onPress={handleRetry}>
                                    <GlassView style={styles.actionButtonContent} intensity={80}>
                                        <Text style={styles.actionButtonText}>RETRY</Text>
                                    </GlassView>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionButtonSmall} onPress={handleNewTest}>
                                    <GlassView style={styles.actionButtonContent} intensity={80}>
                                        <Text style={styles.actionButtonText}>NEW TEST</Text>
                                    </GlassView>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.closeButton} onPress={() => router.replace("/")}>
                                <GlassView style={styles.finishButtonContent} intensity={90}>
                                    <Text style={styles.finishButtonText}>FINISH</Text>
                                </GlassView>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </SafeAreaView>
            </YStack>
        );
    }

    const currentItem = items[currentIndex];

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <YStack style={sharedStyles.container}>
                <SafeAreaView style={sharedStyles.safeArea}>
                    <Stack.Screen options={{ headerShown: false }} />
                    <View style={sharedStyles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={sharedStyles.backButton}>
                            <IconSymbol name="chevron.left" size={28} color={Colors.dark.text} />
                        </TouchableOpacity>
                        <Text style={[sharedStyles.title, { fontSize: 32, fontWeight: 'bold' }]} adjustsFontSizeToFit={true} numberOfLines={1}>TESTING</Text>
                        <Text style={styles.counter}>{currentIndex + 1} / {items.length}</Text>
                    </View>

                    <View style={styles.quizContent}>
                        <AnimatePresence exitBeforeEnter>
                            <MotiView
                                key={currentIndex}
                                from={{ opacity: 0, scale: 0.9, translateX: 100 }}
                                animate={{ opacity: 1, scale: 1, translateX: 0 }}
                                exit={{ opacity: 0, scale: 0.9, translateX: -100 }}
                                transition={{ type: 'timing', duration: 150 }}
                                style={styles.cardWrapper}
                            >
                                <TouchableOpacity activeOpacity={1} onPress={handleFlip} style={styles.flipContainer}>
                                    <Animated.View style={[styles.card, frontAnimatedStyle]}>
                                        <GlassView style={styles.glassCard} intensity={25}>
                                            {currentItem.imageUrl ? (
                                                <View style={styles.imageWrapper}>
                                                    <Image
                                                        source={{ uri: currentItem.imageUrl }}
                                                        style={styles.cardImage}
                                                        contentFit="cover"
                                                    />
                                                    <BlurView intensity={90} style={StyleSheet.absoluteFill} tint="dark" />
                                                </View>
                                            ) : (
                                                <IconSymbol name="wineglass" size={80} color={Colors.dark.icon} />
                                            )}
                                            <Text style={[styles.cardName, { fontSize: 20, fontWeight: 'bold' }]}>{currentItem.name}</Text>
                                            <Text style={styles.tapToFlip}>TAP TO FLIP</Text>
                                        </GlassView>
                                    </Animated.View>

                                    <Animated.View style={[styles.card, backAnimatedStyle]}>
                                        <GlassView style={styles.glassCard} intensity={25}>
                                            <ScrollView style={styles.ingredientsList} showsVerticalScrollIndicator={false} contentContainerStyle={styles.backContent}>
                                                <Text style={[styles.recipeTitle, { fontSize: 20, fontWeight: 'bold' }]}>Recipe</Text>
                                                {currentItem.imageUrl && (
                                                    <Image source={{ uri: currentItem.imageUrl }} style={styles.backCardImage} contentFit="cover" />
                                                )}
                                                {currentItem.ingredients.map((ing, i) => (
                                                    <View key={i} style={styles.ingredientRow}>
                                                        <IconSymbol name="circle.fill" size={6} color={Colors.dark.tint} />
                                                        {includeMeasurements && ing.amount && (
                                                            <Text style={styles.amount}>{ing.amount}</Text>
                                                        )}
                                                        <Text style={styles.ingredientName}>{ing.name}</Text>
                                                    </View>
                                                ))}
                                                <Text style={styles.description}>{currentItem.description}</Text>
                                            </ScrollView>
                                            <Text style={styles.tapToFlip}>TAP TO FLIP BACK</Text>
                                        </GlassView>
                                    </Animated.View>
                                </TouchableOpacity>
                            </MotiView>
                        </AnimatePresence>

                        <View style={styles.controls}>
                            {isRevealed ? (
                                <View style={styles.scoreButtons}>
                                    <TouchableOpacity
                                        style={[styles.scoreButton, { backgroundColor: '#FF4B4B' }]}
                                        onPress={() => handleScore('poor')}
                                    >
                                        <Text style={styles.scoreText}>POOR</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.scoreButton, { backgroundColor: '#FFA500' }]}
                                        onPress={() => handleScore('acceptable')}
                                    >
                                        <Text style={styles.scoreText}>ACCEPTABLE</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.scoreButton, { backgroundColor: '#4CAF50' }]}
                                        onPress={() => handleScore('perfect')}
                                    >
                                        <Text style={styles.scoreText}>PERFECT</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity onPress={handleFlip} style={styles.actionPrompt}>
                                    <IconSymbol name="hand.tap" size={24} color={Colors.dark.icon} />
                                    <Text style={styles.promptText}>TAP TO REVEAL RECIPE</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </SafeAreaView>
            </YStack>
        </GestureHandlerRootView >
    );
}

// ... (Top of file remains)

// ...

// Insert PieGraph and Slice components before styles
// PieGraph: Renders a donut chart using radial segments
function PieGraph({ counts, size = 120 }: { counts: any, size?: number }) {
    const total = counts.perfect + counts.acceptable + counts.poor;
    if (total === 0) return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#333' }} />;

    const radius = size / 2;
    const numSegments = 80; // Total segments
    const segmentWidth = (Math.PI * size) / numSegments + 2; // +2 for overlap

    // Calculate cumulative ratios
    const perfectRatio = counts.perfect / total;
    const acceptableRatio = perfectRatio + (counts.acceptable / total);
    // poorRatio reaches 1.0

    const segments = [];
    for (let i = 0; i < numSegments; i++) {
        const ratio = i / numSegments;
        let color = '#FF4B4B'; // Poor (default/remainder)
        if (ratio < perfectRatio) color = '#4CAF50';
        else if (ratio < acceptableRatio) color = '#FFA500';

        const angle = (ratio * 360);

        segments.push(
            <View
                key={i}
                style={{
                    position: 'absolute',
                    width: segmentWidth,
                    height: radius, // Radius length
                    backgroundColor: color,
                    left: (size - segmentWidth) / 2,
                    top: 0,
                    transform: [
                        { translateY: radius / 2 },
                        { rotate: `${angle}deg` },
                        { translateY: -radius / 2 }
                    ]
                }}
            />
        );
    }

    return (
        <View style={{ width: size, height: size, position: 'relative', overflow: 'hidden' }}>
            {segments}
            {/* Inner Donut Hole */}
            <View style={{
                position: 'absolute',
                width: size * 0.6, height: size * 0.6, borderRadius: size * 0.3,
                backgroundColor: '#000',
                top: size * 0.2, left: size * 0.2
            }} />
        </View>
    );
}

// Removed PieSlice as it is no longer used

const styles = StyleSheet.create({
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 },
    emptyText: { fontSize: 18, color: Colors.dark.icon, textAlign: "center" },
    counter: { fontSize: 16, color: Colors.dark.icon, width: 44, textAlign: "right" },
    quizContent: { flex: 1 },
    cardWrapper: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
    flipContainer: { width: width * 0.85, height: width * 1.25 },
    card: { width: "100%", height: "100%" },
    glassCard: { flex: 1, borderRadius: 30, padding: 24, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
    cardImage: { width: "100%", height: "100%", borderRadius: 20 },
    imageWrapper: { width: "100%", height: "60%", borderRadius: 20, marginBottom: 20, overflow: "hidden" },
    backCardImage: { width: "100%", height: 150, borderRadius: 15, marginBottom: 20 },
    backContent: { paddingBottom: 10 },
    cardName: { fontSize: 32, fontWeight: "bold", textAlign: "center" },
    tapToFlip: { fontSize: 14, color: Colors.dark.icon, marginTop: 20 },
    recipeTitle: { fontSize: 24, fontWeight: "bold", marginBottom: 20, alignSelf: "flex-start" },
    ingredientsList: { width: "100%", flex: 1, marginBottom: 10 },
    ingredientRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 },
    amount: { fontSize: 16, fontWeight: "bold", color: Colors.dark.tint, minWidth: 50 },
    ingredientName: { fontSize: 18, flex: 1 },
    description: { fontSize: 15, color: Colors.dark.icon, lineHeight: 22, marginTop: 15 },
    controls: { paddingHorizontal: 20, paddingBottom: 40 },
    scoreButtons: { flexDirection: "row", gap: 12, width: '100%', height: 70 },
    scoreButton: { flex: 1, borderRadius: 15, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
    scoreText: { fontSize: 13, fontWeight: "900", color: "#FFF", letterSpacing: 1 },
    actionPrompt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 70 },
    promptText: { fontSize: 16, fontWeight: '700', color: Colors.dark.icon, letterSpacing: 1.5 },
    resultsWrapper: { flex: 1, paddingHorizontal: 30, paddingTop: 40, paddingBottom: 40, justifyContent: 'center', alignItems: 'center' },
    resultsMainContent: { alignItems: "center", justifyContent: "center", width: '100%', gap: 20 },
    resultsContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
    titleBox: { backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 15, zIndex: 30, borderWidth: 1, borderColor: '#FFF', marginBottom: 60 },
    resultsTitle: { fontSize: 24, fontWeight: "900", color: "#FFF", textAlign: 'center', letterSpacing: 2 },
    glassWrapperLarge: { height: 180, justifyContent: 'center', alignItems: 'center' },
    statsContainer: { width: '100%', gap: 12, backgroundColor: '#000', padding: 25, borderRadius: 25, borderWidth: 1, borderColor: '#FFF' },
    statRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    statDot: { width: 14, height: 14, borderRadius: 7 },
    statLabel: { fontSize: 16, fontWeight: '800', color: "#FFF" },
    bottomPinnedSection: { width: '100%', paddingBottom: 0, gap: 10, marginTop: 20 },
    scoreBox: { backgroundColor: '#000', paddingVertical: 30, paddingHorizontal: 20, borderRadius: 25, borderWidth: 1, borderColor: '#FFF', width: '100%' },
    finalScore: { fontSize: 52, fontWeight: "900", color: "#FFF", textAlign: 'center', lineHeight: 60 },
    actionButtonsRow: { flexDirection: 'row', gap: 10, width: '100%' },
    actionButtonSmall: { flex: 1, height: 54 },
    actionButtonContent: { flex: 1, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#000", borderWidth: 1, borderColor: '#FFF' },
    actionButtonText: { fontSize: 13, fontWeight: "900", letterSpacing: 1, color: "#FFF" },
    closeButton: { width: '100%', height: 64 },
    finishButtonContent: { flex: 1, borderRadius: 18, justifyContent: "center", alignItems: "center", backgroundColor: "#000", borderWidth: 1, borderColor: '#FFF' },
    finishButtonText: { fontSize: 20, fontWeight: "900", letterSpacing: 3, color: "#FFF" },
    navButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" },
    disabledButton: { opacity: 0.2 },
});
