import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import React, { useEffect, useState } from "react";
import { Modal, StatusBar, StyleSheet, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ImageCarousel } from "@/components/ImageCarousel";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import { supabase } from "@/lib/supabase";

import { RectButton, Swipeable } from "react-native-gesture-handler";

import { DatabaseCocktail } from "@/types/types";

export default function CocktailDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const { isFavorite, toggleFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    const [cocktail, setCocktail] = useState<DatabaseCocktail | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [notesExpanded, setNotesExpanded] = useState(false);

    const scrollY = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const stickyTitleStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(
                scrollY.value,
                [40, 60], // Adjust these values based on where the title actually disappears
                [0, 1],
                Extrapolation.CLAMP
            ),
        };
    });



    useEffect(() => {
        if (id) {
            fetchCocktailDetails();
        }
    }, [id]);

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
                        ingredient_bsp,
                        ingredient_ml,
                        ingredient_dash,
                        ingredient_amount,
                        is_top,
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
        if (recipe.is_top) parts.push(`Top`);
        if (recipe.ingredient_ml) parts.push(`${recipe.ingredient_ml}ml`);
        if (recipe.ingredient_bsp) parts.push(`${recipe.ingredient_bsp} bsp`);
        if (recipe.ingredient_dash) parts.push(`${recipe.ingredient_dash} dash${recipe.ingredient_dash > 1 ? 'es' : ''}`);
        if (recipe.ingredient_amount) parts.push(`${recipe.ingredient_amount}`);

        if (recipe.ingredients && recipe.ingredients.name) {
            parts.push(recipe.ingredients.name);
        }

        return parts.join(' ');
    };

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

    const images = cocktail.cocktail_images?.map(img => img.images.url).filter(Boolean) as string[] || [];
    if (images.length === 0) {
        images.push(require('@/assets/images/cocktails/house_martini.png'));
    }

    const renderRightActions = (id: string, swipeable: Swipeable) => {
        const isFav = isFavorite(id);
        const inStudy = isInStudyPile(id);

        return (
            <View style={styles.rightActionsContainer}>
                <RectButton
                    style={[styles.actionButton, { backgroundColor: '#FF4B4B' }]}
                    onPress={() => {
                        toggleFavorite(id);
                        swipeable.close();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }}
                >
                    <IconSymbol name={isFav ? "heart.fill" : "heart"} size={24} color="#FFF" />
                    <ThemedText style={[styles.actionText, { color: '#FFF' }]}>{isFav ? "Unfav" : "Fav"}</ThemedText>
                </RectButton>
                <RectButton
                    style={[styles.actionButton, { backgroundColor: '#4A90E2' }]}
                    onPress={() => {
                        toggleStudyPile(id);
                        swipeable.close();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }}
                >
                    <IconSymbol name={inStudy ? "book.fill" : "book"} size={24} color="#FFF" />
                    <ThemedText style={[styles.actionText, { color: '#FFF' }]}>{inStudy ? "Remove" : "Study"}</ThemedText>
                </RectButton>
            </View>
        );
    };

    let swipeableRef: Swipeable | null = null;

    return (
        <GestureHandlerRootView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" />

            {/* Top Section: Fixed Image & Header Actions */}
            <View style={styles.fixedHeader}>
                <View style={styles.imageWrapper}>
                    <ImageCarousel
                        images={images}
                        initialIndex={currentImageIndex}
                        onIndexChange={setCurrentImageIndex}
                        onImagePress={() => setModalVisible(true)}
                        paginationBelow={true} 
                    />
                </View>

                {/* Navigation & Action Buttons */}
                <TouchableOpacity
                    style={[styles.backButton, { top: 10, left: 20 }]}
                    onPress={() => router.back()}
                >
                    <GlassView intensity={50} style={styles.buttonGlass}>
                        <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                    </GlassView>
                </TouchableOpacity>



                {/* Sticky Title */}
                <Animated.View style={[styles.stickyTitleContainer, { bottom: 20, right: 20 }, stickyTitleStyle]}>
                    <ThemedText style={styles.stickyTitleText}>{cocktail?.name}</ThemedText>
                </Animated.View>
            </View>

            {/* Bottom Section: Scrollable Content */}
            <Animated.ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
            >
                <View style={styles.header}>
                    <Swipeable
                        ref={(ref) => { swipeableRef = ref; }}
                        renderRightActions={() => cocktail?.id ? renderRightActions(cocktail.id, swipeableRef!) : null}
                        friction={2}
                        rightThreshold={40}
                        overshootRight={false}
                    >
                        <ThemedText type="title" style={styles.title}>{cocktail.name}</ThemedText>
                    </Swipeable>
                </View>

                {/* Ingredients List */}
                {cocktail.recipes && cocktail.recipes.length > 0 && (
                    <View style={[styles.section, styles.sectionRight, { marginBottom: 32 }]}>
                        <View style={styles.ingredientsList}>
                            {cocktail.recipes.map((recipe, index) => (
                                <View key={index} style={styles.ingredientRow}>
                                    <ThemedText style={[styles.text, styles.textRight]}>{formatIngredient(recipe)}</ThemedText>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Core Metadata */}
                <View style={styles.section}>
                    <View style={styles.detailsList}>
                        {cocktail.methods?.name && (
                            <View style={styles.detailRow}>
                                <ThemedText style={styles.detailLabel}>Method</ThemedText>
                                <ThemedText style={styles.detailValue}>{cocktail.methods.name}</ThemedText>
                            </View>
                        )}
                        {cocktail.glassware?.name && (
                            <View style={styles.detailRow}>
                                <ThemedText style={styles.detailLabel}>Glassware</ThemedText>
                                <ThemedText style={styles.detailValue}>{cocktail.glassware.name}</ThemedText>
                            </View>
                        )}
                        {cocktail.garnish_1 && (
                            <View style={styles.detailRow}>
                                <ThemedText style={styles.detailLabel}>Garnish</ThemedText>
                                <ThemedText style={styles.detailValue}>{cocktail.garnish_1}</ThemedText>
                            </View>
                        )}
                    </View>
                </View>

                {/* Description */}
                <View style={styles.section}>
                    <ThemedText style={[styles.text, styles.textRight]}>{cocktail.description}</ThemedText>
                </View>

                {/* Extended Details */}
                <View style={styles.section}>
                    <View style={styles.detailsList}>
                        {cocktail.families?.name && (
                            <View style={styles.detailRow}>
                                <ThemedText style={styles.detailLabel}>Family</ThemedText>
                                <ThemedText style={styles.detailValue}>{cocktail.families.name}</ThemedText>
                            </View>
                        )}
                        {cocktail.origin && (
                            <View style={styles.detailRow}>
                                <ThemedText style={styles.detailLabel}>Origin</ThemedText>
                                <ThemedText style={styles.detailValue}>{cocktail.origin}</ThemedText>
                            </View>
                        )}
                        {cocktail.notes && (
                            <TouchableOpacity 
                                style={styles.detailRow} 
                                onPress={() => setNotesExpanded(!notesExpanded)}
                                activeOpacity={0.7}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <IconSymbol 
                                        name={notesExpanded ? "chevron.up" : "chevron.down"} 
                                        size={12} 
                                        color={Colors.dark.text} 
                                        style={{ opacity: 0.7 }}
                                    />
                                    <ThemedText style={styles.detailLabel}>Notes</ThemedText>
                                </View>
                                {notesExpanded && (
                                    <ThemedText style={styles.detailValue}>{cocktail.notes}</ThemedText>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Bottom Spacing */}
                <View style={{ height: 40 }} />
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
                            <GlassView intensity={50} style={styles.buttonGlass}>
                                <IconSymbol name="xmark" size={24} color={Colors.dark.text} />
                            </GlassView>
                        </TouchableOpacity>
                    </View>
                </GestureHandlerRootView>
            </Modal>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    fixedHeader: {
        width: '100%',
        position: 'relative',
        zIndex: 1,
        // Removed aspectRatio: 1 to allow growth for text lines
    },
    imageWrapper: {
        // Removed flex: 1 and overflow hidden to let it size naturally
    },
    scrollContainer: {
        flex: 1,
        marginTop: 16,
    },

    scrollContent: {
        paddingBottom: 40,
    },
    // Removed columnsContainer, leftColumn, rightColumn, bottomSection, detailsListLeft, detailRowLeft, detailLabelLeft, detailValueLeft, titleOverlay, titleOverlayText
    // Re-added styles that were removed
    detailsList: {
        gap: 16,
        alignItems: 'flex-end',
    },
    detailRow: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 2,
    },
    detailLabel: {
        fontWeight: 'bold',
        color: Colors.dark.text,
        fontSize: 12,
        opacity: 0.7,
        textTransform: 'uppercase',
        letterSpacing: 1,
        textAlign: 'right',
    },
    detailValue: {
        color: Colors.dark.text,
        fontSize: 16,
        textAlign: 'right',
    },
    stickyTitleContainer: {
        position: 'absolute',
        zIndex: 10,
        backgroundColor: 'transparent',
    },
    stickyTitleText: {
        fontSize: 32,
        lineHeight: 42, // increased to prevent clipping
        fontWeight: 'bold',
        color: Colors.dark.text,
        textAlign: 'right',
        paddingTop: 8, // added padding for ascenders
    },
    header: {
        marginBottom: 8,
        alignItems: 'flex-end',
        width: '100%',
        paddingHorizontal: 24, // Added to align with other sections
    },
    title: {
        fontSize: 32,
        lineHeight: 36,
        color: Colors.dark.text,
        textAlign: 'right',
    },
    section: {
        gap: 12,
        marginBottom: 16,
        paddingHorizontal: 24,
        alignItems: 'flex-end',
    },
    sectionRight: {
        alignItems: 'flex-end',
    },
    text: {
        fontSize: 16,
        lineHeight: 24,
        color: Colors.dark.text,
        opacity: 0.9,
    },
    textRight: {
        textAlign: 'right',
    },
    ingredientsList: {
        gap: 4,
        alignItems: 'flex-end',
    },
    ingredientRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: 'flex-end',
        gap: 10
    },

    backButton: {
        position: 'absolute',
        zIndex: 10,
    },
    buttonGlass: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    },
    rightActionsContainer: {
        flexDirection: 'row',
        width: 160,
        height: '100%',
        alignItems: 'center',
        paddingLeft: 16,
    },
    actionButton: {
        width: 64,
        height: 64,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
        marginLeft: 8,
    },
    actionText: {
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 4,
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
});
