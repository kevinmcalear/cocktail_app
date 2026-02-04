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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { CocktailCategory, FlashcardItem, sharedStyles, Subject, width } from "./shared";

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
    const [loading, setLoading] = useState(true);
    const flipped = useSharedValue(0);

    const cardCount = parseInt(params.cardCount || "10");
    const includeMeasurements = params.includeMeasurements === "true";

    useEffect(() => {
        startQuiz();
    }, []);

    const startQuiz = async () => {
        setLoading(true);
        let fetchedItems: FlashcardItem[] = [];

        if (params.subject === "COCKTAILS") {
            fetchedItems = await fetchCocktails();
        } else if (params.subject === "MENU") {
            fetchedItems = menuItems.map(m => ({
                id: m.name,
                name: m.name,
                description: m.description,
                ingredients: m.ingredients.split(", ").map(i => ({ name: i })),
                imageUrl: m.image
            }));
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

            if (params.cocktailCategory === "STUDY_PILE") {
                query = query.in('id', studyPile);
            } else if (params.cocktailCategory === "TOP_20") {
                query = query.limit(20);
            } else if (params.cocktailCategory === "TOP_40") {
                query = query.limit(40);
            } else if (params.cocktailCategory === "RANDOM") {
                query = query.limit(100);
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

            if (params.cocktailCategory === "RANDOM") {
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

    if (loading) {
        return (
            <ThemedView style={sharedStyles.container}>
                <SafeAreaView style={sharedStyles.safeArea}>
                    <View style={styles.loadingContainer}>
                        <ThemedText>LOADING ITEMS...</ThemedText>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    if (items.length === 0) {
        return (
            <ThemedView style={sharedStyles.container}>
                <SafeAreaView style={sharedStyles.safeArea}>
                    <View style={sharedStyles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={sharedStyles.backButton}>
                            <IconSymbol name="chevron.left" size={28} color={Colors.dark.text} />
                        </TouchableOpacity>
                        <ThemedText type="title" style={sharedStyles.title} adjustsFontSizeToFit={true} numberOfLines={1}>TESTING</ThemedText>
                        <View style={{ width: 44 }} />
                    </View>
                    <View style={styles.emptyContainer}>
                        <IconSymbol name="exclamationmark.triangle" size={64} color={Colors.dark.icon} />
                        <ThemedText style={styles.emptyText}>No items found for this selection.</ThemedText>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    const currentItem = items[currentIndex];

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemedView style={sharedStyles.container}>
                <SafeAreaView style={sharedStyles.safeArea}>
                    <View style={sharedStyles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={sharedStyles.backButton}>
                            <IconSymbol name="chevron.left" size={28} color={Colors.dark.text} />
                        </TouchableOpacity>
                        <ThemedText type="title" style={sharedStyles.title} adjustsFontSizeToFit={true} numberOfLines={1}>TESTING</ThemedText>
                        <ThemedText style={styles.counter}>{currentIndex + 1} / {items.length}</ThemedText>
                    </View>

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
                </SafeAreaView>
            </ThemedView>
        </GestureHandlerRootView>
    );
}

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
    controls: { flexDirection: "row", justifyContent: "center", gap: 40, paddingBottom: 40 },
    navButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" },
    disabledButton: { opacity: 0.2 },
});
