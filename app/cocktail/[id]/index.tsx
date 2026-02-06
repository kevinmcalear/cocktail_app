import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Modal, StatusBar, StyleSheet, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedRef,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ImageCarousel } from "@/components/ImageCarousel";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useFavorites } from "@/hooks/useFavorites";
import { supabase } from "@/lib/supabase";
import { DatabaseCocktail } from "@/types/types";

export default function CocktailDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const { isFavorite, toggleFavorite } = useFavorites();

    // -- HOOKS --
    const [cocktail, setCocktail] = useState<DatabaseCocktail | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [hasScrolledToInitial, setHasScrolledToInitial] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Reanimated Hooks
    const scrollY = useSharedValue(0);
    const scrollRef = useAnimatedRef<Animated.ScrollView>();

    const scrollHandler = useAnimatedScrollHandler((event) => {
        scrollY.value = event.contentOffset.y;
    });

    // -- LAYOUT CONSTANTS --
    // These must be calculated before useAnimatedStyle if used therein
    const LOCKED_HEADER_HEIGHT = 100; // Minimal height for title bar when locked
    const spacerHeight = windowHeight - LOCKED_HEADER_HEIGHT - insets.bottom;

    // Initial Scroll: Show 40% Image, 60% Content.
    const initialScrollOffset = Math.max(0, spacerHeight - (windowHeight * 0.4));

    // -- ANIMATED STYLES --
    const imageStyle = useAnimatedStyle(() => {
        // Animate 'top' property:
        // - At scroll 0 (Expanded/Locked Bottom): top = 0 (Behind Status Bar)
        // - At scroll initialScrollOffset (Reading): top = insets.top (Below Status Bar)
        const top = interpolate(
            scrollY.value,
            [0, initialScrollOffset],
            [0, insets.top],
            Extrapolation.CLAMP
        );

        return {
            transform: [{ translateY: scrollY.value + top }],
            // Height matches the visible space above the card content.
            // visualTop = top
            // visualBottom = spacerHeight - scrollY
            // height = visualBottom - visualTop
            height: Math.max(0, spacerHeight - scrollY.value - top),
        };
    });

    // -- EFFECTS --
    useEffect(() => {
        if (id) {
            fetchCocktailDetails();
        }
    }, [id]);

    // -- FUNCTIONS --
    const fetchCocktailDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('cocktails')
                .select(`
                    *,
                    cocktail_images (
                        images (
                            url,
                            id
                        )
                    ),
                    recipes (
                        id,
                        ingredient_ml,
                        ingredient_dash,
                        ingredient_amount,
                        ingredients!recipes_ingredient_id_fkey (
                            name
                        )
                    ),
                    methods ( name ),
                    glassware ( name ),
                    families ( name )
                `)
                .eq('id', id)
                .single();

            if (data) {
                setCocktail(data);
            }
        } catch (error) {
            console.error('Error fetching cocktail details:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatIngredient = (recipe: any) => {
        const parts = [];
        if (recipe.ingredient_ml) parts.push(`${recipe.ingredient_ml}ml`);
        if (recipe.ingredient_dash) parts.push(`${recipe.ingredient_dash} dash${recipe.ingredient_dash > 1 ? 'es' : ''}`);
        if (recipe.ingredient_amount) parts.push(`${recipe.ingredient_amount}`);

        if (recipe.ingredients && recipe.ingredients.name) {
            parts.push(recipe.ingredients.name);
        }

        return parts.join(' ');
    };

    const handleLayout = () => {
        if (!hasScrolledToInitial && scrollRef.current) {
            scrollRef.current.scrollTo({ y: initialScrollOffset, animated: false });
            setHasScrolledToInitial(true);
        }
    };

    // -- RENDER CHECKS --
    if (loading) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>Loading...</ThemedText>
            </ThemedView>
        );
    }

    if (!cocktail) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>Cocktail not found.</ThemedText>
            </ThemedView>
        );
    }

    // -- PREPARE ASSETS --
    // -- PREPARE ASSETS --
    const images = cocktail.cocktail_images?.map(img => img.images.url).filter(Boolean) as string[] || [];
    if (images.length === 0) {
        images.push(require('@/assets/images/cocktails/house_martini.png'));
    }

    // -- RENDER --
    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" />

            {/* Custom Back Button */}
            <TouchableOpacity
                style={[styles.backButton, { top: insets.top + 10 }]}
                onPress={() => router.back()}
            >
                <GlassView intensity={50} style={styles.backButtonGlass}>
                    <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                </GlassView>
            </TouchableOpacity>

            {/* Edit and Favorite Buttons */}
            <View style={[styles.headerActions, { top: insets.top + 10 }]}>
                <TouchableOpacity
                    onPress={() => {
                        toggleFavorite(id as string);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={styles.actionButton}
                >
                    <GlassView intensity={50} style={styles.backButtonGlass}>
                        <IconSymbol
                            name={isFavorite(id as string) ? "heart.fill" : "heart"}
                            size={20}
                            color={isFavorite(id as string) ? "#FF4B4B" : Colors.dark.text}
                        />
                    </GlassView>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => router.push(`/cocktail/${id}/edit`)}
                    style={styles.actionButton}
                >
                    <GlassView intensity={50} style={styles.backButtonGlass}>
                        <IconSymbol name="pencil" size={20} color={Colors.dark.text} />
                    </GlassView>
                </TouchableOpacity>
            </View>

            {/* Foreground Content */}
            <Animated.ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.scrollContent}
                pointerEvents="box-none"
                showsVerticalScrollIndicator={false}
                decelerationRate="fast"
                snapToOffsets={[0, initialScrollOffset]}
                snapToEnd={false}
                scrollEventThrottle={16}
                onScroll={scrollHandler}
                onLayout={handleLayout}
            >
                {/* Image Carousel (Parallax) */}
                <View style={{ height: spacerHeight, overflow: 'visible' }}>
                    <Animated.View style={[{ width: '100%', position: 'absolute' }, imageStyle]}>
                        <ImageCarousel
                            images={images}
                            initialIndex={currentImageIndex}
                            onIndexChange={setCurrentImageIndex}
                            onImagePress={() => setModalVisible(true)}
                            style={{ flex: 1 }}
                        />
                    </Animated.View>
                </View>

                <GlassView style={[styles.contentContainer, { minHeight: windowHeight * 0.8 }]} intensity={95}>
                    <View style={styles.dragHandleContainer}>
                        <View style={styles.dragHandle} />
                    </View>

                    <View style={styles.header}>
                        <ThemedText type="title" style={styles.title}>{cocktail.name}</ThemedText>

                        <View style={styles.badges}>
                            {[
                                cocktail.methods?.name,
                                cocktail.glassware?.name,
                                cocktail.families?.name
                            ].filter(Boolean).map((badge, index) => (
                                <GlassView key={index} style={styles.badge} intensity={30}>
                                    <ThemedText style={styles.badgeText}>{badge}</ThemedText>
                                </GlassView>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>Description</ThemedText>
                        <ThemedText style={styles.text}>{cocktail.description}</ThemedText>
                    </View>

                    {cocktail.recipes && cocktail.recipes.length > 0 && (
                        <View style={styles.section}>
                            <ThemedText type="subtitle" style={styles.sectionTitle}>Ingredients</ThemedText>
                            <View style={styles.ingredientsList}>
                                {cocktail.recipes.map((recipe, index) => (
                                    <View key={index} style={styles.ingredientRow}>
                                        <IconSymbol name="circle.fill" size={6} color={Colors.dark.tint} />
                                        <ThemedText style={styles.text}>{formatIngredient(recipe)}</ThemedText>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>Details</ThemedText>
                        <View style={styles.detailsList}>
                            {cocktail.garnish_1 && (
                                <View style={styles.detailRow}>
                                    <ThemedText style={styles.detailLabel}>Garnish:</ThemedText>
                                    <ThemedText style={styles.detailValue}>{cocktail.garnish_1}</ThemedText>
                                </View>
                            )}
                            {cocktail.origin && (
                                <View style={styles.detailRow}>
                                    <ThemedText style={styles.detailLabel}>Origin:</ThemedText>
                                    <ThemedText style={styles.detailValue}>{cocktail.origin}</ThemedText>
                                </View>
                            )}
                            {cocktail.notes && (
                                <View style={styles.detailRow}>
                                    <ThemedText style={styles.detailLabel}>Notes:</ThemedText>
                                    <ThemedText style={styles.detailValue}>{cocktail.notes}</ThemedText>
                                </View>
                            )}
                            {cocktail.spec && (
                                <View style={styles.detailRow}>
                                    <ThemedText style={styles.detailLabel}>Spec:</ThemedText>
                                    <ThemedText style={styles.detailValue}>{cocktail.spec}</ThemedText>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={{ height: insets.bottom + 50 }} />

                </GlassView>
            </Animated.ScrollView>

            {/* Lightbox Modal */}
            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <View style={styles.modalContainer}>
                        <TouchableOpacity
                            style={styles.modalCloseArea}
                            activeOpacity={1}
                            onPress={() => setModalVisible(false)}
                        />

                        <View style={styles.modalContent}>
                            <ImageCarousel
                                images={images}
                                initialIndex={currentImageIndex}
                                onIndexChange={setCurrentImageIndex}
                                onImagePress={() => setModalVisible(false)}
                                zoomEnabled={true}
                                style={{ flex: 1 }}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.closeButton, { top: insets.top + 10 }]}
                            onPress={() => setModalVisible(false)}
                        >
                            <GlassView intensity={50} style={styles.backButtonGlass}>
                                <IconSymbol name="xmark" size={24} color={Colors.dark.text} />
                            </GlassView>
                        </TouchableOpacity>
                    </View>
                </GestureHandlerRootView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    imageContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 0,
    },
    scrollContent: {
        flexGrow: 1,
    },
    contentContainer: {
        flex: 1,
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        padding: 24,
        gap: 24,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -10,
        },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
        backgroundColor: Colors.dark.background,
    },
    dragHandleContainer: {
        alignItems: 'center',
        paddingBottom: 10,
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
    },
    header: {
        gap: 12,
        marginBottom: 10
    },
    title: {
        fontSize: 32,
        lineHeight: 36,
        color: Colors.dark.text
    },
    badges: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.1)"
    },
    badgeText: {
        fontSize: 12,
        fontWeight: "600",
        color: Colors.dark.text
    },
    section: {
        gap: 12
    },
    sectionTitle: {
        color: Colors.dark.tint,
        fontSize: 18
    },
    text: {
        fontSize: 16,
        lineHeight: 24,
        color: Colors.dark.text,
        opacity: 0.9
    },
    ingredientsList: {
        gap: 8
    },
    ingredientRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    detailsList: {
        gap: 8
    },
    detailRow: {
        flexDirection: 'row',
        gap: 8,
    },
    detailLabel: {
        fontWeight: 'bold',
        color: Colors.dark.text,
        fontSize: 16,
    },
    detailValue: {
        color: Colors.dark.text,
        fontSize: 16,
        flex: 1,
        opacity: 0.9
    },
    backButton: {
        position: 'absolute',
        left: 20,
        zIndex: 10,
    },
    backButtonGlass: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'black',
    },
    modalCloseArea: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0
    },
    modalContent: {
        flex: 1,
        justifyContent: 'center',
        zIndex: 1,
        pointerEvents: 'box-none'
    },
    closeButton: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
    },
    headerActions: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        // Individual buttons within the row
    }
});
