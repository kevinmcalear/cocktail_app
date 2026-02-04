import { menuItems } from "@/components/CurrentMenuList";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { beers } from "@/data/beers";
import { wines } from "@/data/wines";
import { useStudyPile } from "@/hooks/useStudyPile";
import { supabase } from "@/lib/supabase";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

type TestStage = "SUBJECT" | "COCKTAIL_CAT" | "CONFIG" | "QUIZ";
type Subject = "COCKTAILS" | "MENU" | "BEERS" | "WINES";
type CocktailCategory = "TOP_20" | "TOP_40" | "STUDY_PILE" | "RANDOM";

interface FlashcardItem {
    id: string;
    name: string;
    description: string;
    ingredients: {
        name: string;
        amount?: string;
    }[];
    imageUrl?: string;
}

export default function TestScreen() {
    const router = useRouter();
    const { studyPile } = useStudyPile();

    // -- State --
    const [stage, setStage] = useState<TestStage>("SUBJECT");
    const [subject, setSubject] = useState<Subject | null>(null);
    const [cocktailCategory, setCocktailCategory] = useState<CocktailCategory | null>(null);
    const [includeMeasurements, setIncludeMeasurements] = useState(true);
    const [items, setItems] = useState<FlashcardItem[]>([]);
    const [cardCount, setCardCount] = useState(10);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const flipped = useSharedValue(0);
    const sliderPos = useSharedValue((10 - 5) / 15); // Initialize at 10

    // -- Navigation Handlers --
    const handleBack = () => {
        if (stage === "SUBJECT") router.back();
        else if (stage === "COCKTAIL_CAT") setStage("SUBJECT");
        else if (stage === "CONFIG") {
            setStage(subject === "COCKTAILS" ? "COCKTAIL_CAT" : "SUBJECT");
        }
        else if (stage === "QUIZ") setStage("CONFIG");
    };

    const selectSubject = (s: Subject) => {
        setSubject(s);
        if (s === "COCKTAILS") setStage("COCKTAIL_CAT");
        else setStage("CONFIG");
    };

    const selectCocktailCategory = (c: CocktailCategory) => {
        setCocktailCategory(c);
        setStage("CONFIG");
    };

    const startQuiz = async () => {
        setLoading(true);
        let fetchedItems: FlashcardItem[] = [];

        if (subject === "COCKTAILS") {
            fetchedItems = await fetchCocktails();
        } else if (subject === "MENU") {
            fetchedItems = menuItems.map(m => ({
                id: m.name,
                name: m.name,
                description: m.description,
                ingredients: m.ingredients.split(", ").map(i => ({ name: i })),
                imageUrl: m.image
            }));
        } else if (subject === "BEERS") {
            fetchedItems = beers.map(b => ({
                id: b.id,
                name: b.name,
                description: b.description,
                ingredients: [{ name: b.description }]
            }));
        } else if (subject === "WINES") {
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
        setStage("QUIZ");
        setLoading(false);
    };

    const fetchCocktails = async (): Promise<FlashcardItem[]> => {
        try {
            let query = supabase
                .from('cocktails')
                .select(`
                    id,
                    name,
                    description,
                    recipes (
                        ingredient_ml,
                        ingredient_dash,
                        ingredient_amount,
                        ingredients ( name )
                    ),
                    cocktail_images ( images ( url ) )
                `);

            if (cocktailCategory === "STUDY_PILE") {
                query = query.in('id', studyPile);
            } else if (cocktailCategory === "TOP_20") {
                query = query.limit(20);
            } else if (cocktailCategory === "TOP_40") {
                query = query.limit(40);
            } else if (cocktailCategory === "RANDOM") {
                query = query.limit(100); // Fetch a larger set to shuffle from
            }

            const { data, error } = await query;
            if (error) throw error;
            if (!data) return [];

            let result = data.map((c: any) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                ingredients: c.recipes.map((r: any) => ({
                    name: r.ingredients?.name || "Unknown",
                    amount: formatAmount(r)
                })),
                imageUrl: c.cocktail_images?.[0]?.images.url
            }));

            if (cocktailCategory === "RANDOM") {
                result = result.sort(() => Math.random() - 0.5);
            }

            return result;
        } catch (error) {
            console.error("Error fetching cocktails:", error);
            return [];
        }
    };

    const formatAmount = (r: any) => {
        const parts = [];
        if (r.ingredient_ml) parts.push(`${r.ingredient_ml}ml`);
        if (r.ingredient_dash) parts.push(`${r.ingredient_dash} dash${r.ingredient_dash > 1 ? 'es' : ''}`);
        if (r.ingredient_amount) parts.push(`${r.ingredient_amount}`);
        return parts.join(" ");
    };

    // -- Flashcard Animation --
    const handleFlip = () => {
        flipped.value = withSpring(flipped.value === 0 ? 180 : 0);
    };

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

    // -- Render Helpers --
    const renderSubjectSelection = () => (
        <ScrollView contentContainerStyle={styles.selectionGrid}>
            <SubjectCard icon="wineglass.fill" label="COCKTAILS" onPress={() => selectSubject("COCKTAILS")} />
            <SubjectCard icon="menucard.fill" label="MENU" onPress={() => selectSubject("MENU")} />
            <SubjectCard icon="mug.fill" label="BEERS" onPress={() => selectSubject("BEERS")} />
            <SubjectCard icon="wineglass" label="WINES" onPress={() => selectSubject("WINES")} />
        </ScrollView>
    );

    const renderCocktailCategorySelection = () => (
        <View style={styles.selectionGrid}>
            <SubjectCard icon="arrow.up.circle.fill" label="TOP 20" onPress={() => selectCocktailCategory("TOP_20")} />
            <SubjectCard icon="star.circle.fill" label="TOP 40" onPress={() => selectCocktailCategory("TOP_40")} />
            <SubjectCard icon="book.fill" label="STUDY PILE" onPress={() => selectCocktailCategory("STUDY_PILE")} />
            <SubjectCard icon="dice.fill" label="RANDOM" onPress={() => selectCocktailCategory("RANDOM")} />
        </View>
    );

    const renderConfig = () => (
        <View style={styles.configContainer}>
            <ThemedText type="subtitle" style={styles.configTitle}>TESTING MODE</ThemedText>
            <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setIncludeMeasurements(!includeMeasurements)}
                activeOpacity={0.7}
            >
                <GlassView style={[styles.toggleBackground, includeMeasurements && styles.toggleActive]} intensity={20}>
                    <Animated.View style={[styles.toggleHandle, { marginLeft: includeMeasurements ? 24 : 4 }]} />
                </GlassView>
                <ThemedText style={styles.toggleText}>INCLUDE MEASUREMENTS</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.startButton} onPress={startQuiz}>
                <GlassView style={styles.startButtonContent} intensity={40}>
                    <ThemedText style={styles.startButtonText}>START TEST</ThemedText>
                </GlassView>
            </TouchableOpacity>
        </View>
    );

    const renderQuiz = () => {
        if (items.length === 0) return (
            <View style={styles.emptyContainer}>
                <IconSymbol name="exclamationmark.triangle" size={64} color={Colors.dark.icon} />
                <ThemedText style={styles.emptyText}>No items found for this selection.</ThemedText>
            </View>
        );

        const currentItem = items[currentIndex];

        return (
            <View style={styles.quizContent}>
                <View style={styles.cardWrapper}>
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
                                <ThemedText type="subtitle" style={styles.cardName}>{currentItem.name}</ThemedText>
                                <ThemedText style={styles.tapToFlip}>TAP TO FLIP</ThemedText>
                            </GlassView>
                        </Animated.View>

                        <Animated.View style={[styles.card, backAnimatedStyle]}>
                            <GlassView style={styles.glassCard} intensity={25}>
                                <ScrollView style={styles.ingredientsList} showsVerticalScrollIndicator={false} contentContainerStyle={styles.backContent}>
                                    <ThemedText type="subtitle" style={styles.recipeTitle}>Recipe</ThemedText>
                                    {currentItem.imageUrl && (
                                        <Image source={{ uri: currentItem.imageUrl }} style={styles.backCardImage} contentFit="cover" />
                                    )}
                                    {currentItem.ingredients.map((ing, i) => (
                                        <View key={i} style={styles.ingredientRow}>
                                            <IconSymbol name="circle.fill" size={6} color={Colors.dark.tint} />
                                            {includeMeasurements && ing.amount && (
                                                <ThemedText style={styles.amount}>{ing.amount}</ThemedText>
                                            )}
                                            <ThemedText style={styles.ingredientName}>{ing.name}</ThemedText>
                                        </View>
                                    ))}
                                    <ThemedText style={styles.description}>{currentItem.description}</ThemedText>
                                </ScrollView>
                                <ThemedText style={styles.tapToFlip}>TAP TO FLIP BACK</ThemedText>
                            </GlassView>
                        </Animated.View>
                    </TouchableOpacity>
                </View>

                <View style={styles.controls}>
                    <TouchableOpacity
                        style={[styles.navButton, currentIndex === 0 && styles.disabledButton]}
                        onPress={() => { if (currentIndex > 0) { flipped.value = 0; setCurrentIndex(currentIndex - 1); } }}
                        disabled={currentIndex === 0}
                    >
                        <IconSymbol name="arrow.left" size={28} color={Colors.dark.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.navButton, currentIndex === items.length - 1 && styles.disabledButton]}
                        onPress={() => { if (currentIndex < items.length - 1) { flipped.value = 0; setCurrentIndex(currentIndex + 1); } }}
                        disabled={currentIndex === items.length - 1}
                    >
                        <IconSymbol name="arrow.right" size={28} color={Colors.dark.text} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const sliderWidth = width - 110; // Width - margins - limits

    const gesture = Gesture.Pan()
        .onUpdate((e) => {
            const val = Math.max(0, Math.min(1, e.x / sliderWidth));
            sliderPos.value = val;
            const count = Math.round(5 + (val * 15));
            runOnJS(setCardCount)(count);
        })
        .onBegin((e) => {
            const val = Math.max(0, Math.min(1, e.x / sliderWidth));
            sliderPos.value = val;
            const count = Math.round(5 + (val * 15));
            runOnJS(setCardCount)(count);
        });

    const animatedSliderFillStyle = useAnimatedStyle(() => ({
        width: `${sliderPos.value * 100}%`
    }));

    const animatedSliderHandleStyle = useAnimatedStyle(() => ({
        left: `${sliderPos.value * 100}%`
    }));

    const renderSlider = () => (
        <View style={styles.sliderWrapper}>
            <ThemedText style={styles.sliderLabel}>NUMBER OF CARDS: {cardCount}</ThemedText>
            <View style={styles.sliderContainer}>
                <ThemedText style={styles.sliderLimit}>5</ThemedText>
                <GestureDetector gesture={gesture}>
                    <View style={styles.sliderTrack}>
                        <GlassView style={styles.sliderTrackGlass} intensity={10}>
                            <Animated.View style={[styles.sliderFill, animatedSliderFillStyle]} />
                            <Animated.View style={[styles.sliderHandle, animatedSliderHandleStyle]} />
                        </GlassView>
                    </View>
                </GestureDetector>
                <ThemedText style={styles.sliderLimit}>20</ThemedText>
            </View>
        </View>
    );

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemedView style={styles.container}>
                <Stack.Screen options={{ title: "Test Your Knowledge", headerShown: false }} />
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                            <IconSymbol name="chevron.left" size={28} color={Colors.dark.text} />
                        </TouchableOpacity>
                        <ThemedText type="title" style={styles.title}>
                            {stage === "SUBJECT" ? "SELECT SUBJECT" :
                                stage === "COCKTAIL_CAT" ? "COCKTAIL CATEGORY" :
                                    stage === "CONFIG" ? "CONFIGURE TEST" : "TESTING"}
                        </ThemedText>
                        {stage === "QUIZ" && <ThemedText style={styles.counter}>{currentIndex + 1} / {items.length}</ThemedText>}
                        {stage !== "QUIZ" && <View style={{ width: 44 }} />}
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ThemedText>LOADING ITEMS...</ThemedText>
                        </View>
                    ) : (
                        <View style={{ flex: 1 }}>
                            <View style={{ flex: 1 }}>
                                {stage === "SUBJECT" && renderSubjectSelection()}
                                {stage === "COCKTAIL_CAT" && renderCocktailCategorySelection()}
                                {stage === "CONFIG" && renderConfig()}
                                {stage === "QUIZ" && renderQuiz()}
                            </View>
                            {stage !== "QUIZ" && renderSlider()}
                        </View>
                    )}
                </SafeAreaView>
            </ThemedView>
        </GestureHandlerRootView>
    );
}

function SubjectCard({ icon, label, onPress }: { icon: string, label: string, onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.subjectCardWrapper} onPress={onPress}>
            <GlassView style={styles.subjectCard} intensity={20}>
                <IconSymbol name={icon as any} size={32} color={Colors.dark.tint} />
                <ThemedText style={styles.subjectLabel}>{label}</ThemedText>
            </GlassView>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.dark.background },
    safeArea: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10 },
    backButton: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
    title: { fontSize: 24, fontWeight: "bold" },
    counter: { fontSize: 16, color: Colors.dark.icon, width: 44, textAlign: "right" },
    selectionGrid: { flexDirection: "row", flexWrap: "wrap", padding: 15, gap: 15, justifyContent: "space-between" },
    subjectCardWrapper: { width: "47%", height: 120 },
    subjectCard: { flex: 1, borderRadius: 20, justifyContent: "center", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
    subjectLabel: { fontSize: 18, fontWeight: "600", letterSpacing: 1 },
    configContainer: { flex: 1, padding: 40, justifyContent: "center", gap: 30 },
    configTitle: { fontSize: 28, textAlign: "center", marginBottom: 10 },
    toggleRow: { flexDirection: "row", alignItems: "center", gap: 15, justifyContent: "center" },
    toggleBackground: { width: 50, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center" },
    toggleActive: { backgroundColor: Colors.dark.tint },
    toggleHandle: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#FFF" },
    toggleText: { fontSize: 18, color: Colors.dark.text },
    startButton: { height: 60, marginTop: 20 },
    startButtonContent: { flex: 1, borderRadius: 15, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)" },
    startButtonText: { fontSize: 20, fontWeight: "bold", letterSpacing: 2, color: Colors.dark.tint },
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
    controls: { flexDirection: "row", justifyContent: "center", gap: 40, paddingBottom: 40 },
    navButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" },
    disabledButton: { opacity: 0.2 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20 },
    emptyText: { fontSize: 18, color: Colors.dark.icon, textAlign: "center" },
    sliderWrapper: { padding: 30, paddingBottom: 50 },
    sliderLabel: { fontSize: 16, fontWeight: "600", color: Colors.dark.icon, marginBottom: 15, textAlign: "center" },
    sliderContainer: { flexDirection: "row", alignItems: "center", gap: 15 },
    sliderLimit: { fontSize: 14, color: Colors.dark.icon, width: 25 },
    sliderTrack: { flex: 1, height: 40, justifyContent: "center" },
    sliderTrackGlass: { height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.05)", overflow: "visible" },
    sliderFill: { height: "100%", backgroundColor: Colors.dark.tint, borderRadius: 5 },
    sliderHandle: { position: "absolute", width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFF", top: -7, marginLeft: -12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 }
});
