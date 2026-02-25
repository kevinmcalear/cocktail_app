import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import React, { useState } from "react";
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
import { useCocktail } from "@/hooks/useCocktails";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";

import { RectButton, Swipeable } from "react-native-gesture-handler";


export default function CocktailDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const { isFavorite, toggleFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    const { data: cocktail, isLoading: loading, error } = useCocktail(id as string);
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

                <TouchableOpacity
                    style={[styles.editButton, { top: 10, right: 20 }]}
                    onPress={() => router.push(`/cocktail/${id}/edit`)}
                >
                    <GlassView intensity={50} style={styles.buttonGlass}>
                        <IconSymbol name="pencil" size={24} color={Colors.dark.text} />
                    </GlassView>
                </TouchableOpacity>

                {/* Sticky Title */}
                <Animated.View style={[styles.stickyTitleContainer, { bottom: 20, left: 20 }, stickyTitleStyle]}>
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
                    <View style={[styles.section, styles.sectionLeft, { marginBottom: 24 }]}>
                        <View style={styles.ingredientsList}>
                            {cocktail.recipes.map((recipe, index) => (
                                <View key={index} style={styles.ingredientRow}>
                                    <ThemedText style={[styles.text, styles.textLeft]}>{formatIngredient(recipe)}</ThemedText>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Core Metadata Badges */}
                <View style={[styles.section, styles.sectionLeft, { marginBottom: 24 }]}>
                    <View style={styles.badgeContainer}>
                        {cocktail.methods?.name && (
                            <View style={styles.badge}>
                                <IconSymbol name="hammer.fill" size={16} color={Colors.dark.text} />
                                <ThemedText style={styles.badgeText}>{cocktail.methods.name}</ThemedText>
                            </View>
                        )}
                        {cocktail.glassware?.name && (
                            <View style={styles.badge}>
                                <IconSymbol name="wineglass" size={16} color={Colors.dark.text} />
                                <ThemedText style={styles.badgeText}>{cocktail.glassware.name}</ThemedText>
                            </View>
                        )}
                        {cocktail.ice?.name && (
                            <View style={styles.badge}>
                                <IconSymbol name="snowflake" size={16} color={Colors.dark.text} />
                                <ThemedText style={styles.badgeText}>{cocktail.ice.name}</ThemedText>
                            </View>
                        )}
                        {cocktail.garnish_1 && (
                            <View style={styles.badge}>
                                <IconSymbol name="leaf.fill" size={16} color={Colors.dark.text} />
                                <ThemedText style={styles.badgeText}>{cocktail.garnish_1}</ThemedText>
                            </View>
                        )}
                        {cocktail.families?.name && (
                            <View style={styles.badge}>
                                <IconSymbol name="person.2.fill" size={16} color={Colors.dark.text} />
                                <ThemedText style={styles.badgeText}>{cocktail.families.name}</ThemedText>
                            </View>
                        )}
                        {cocktail.origin && (
                            <View style={styles.badge}>
                                <IconSymbol name="globe" size={16} color={Colors.dark.text} />
                                <ThemedText style={styles.badgeText}>{cocktail.origin}</ThemedText>
                            </View>
                        )}
                    </View>
                </View>

                {/* Description and Notes */}
                {(cocktail.description || cocktail.notes) && (
                    <View style={[styles.section, styles.sectionLeft]}>
                        {cocktail.description && (
                            <ThemedText style={[styles.text, styles.textLeft, { marginBottom: 16 }]}>{cocktail.description}</ThemedText>
                        )}
                        {cocktail.notes && (
                            <TouchableOpacity 
                                style={styles.notesToggle} 
                                onPress={() => setNotesExpanded(!notesExpanded)}
                                activeOpacity={0.7}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <IconSymbol name="note.text" size={16} color={Colors.dark.text} style={{ opacity: 0.8 }} />
                                    <ThemedText style={styles.notesLabel}>Notes</ThemedText>
                                    <IconSymbol 
                                        name={notesExpanded ? "chevron.up" : "chevron.down"} 
                                        size={14} 
                                        color={Colors.dark.text} 
                                        style={{ opacity: 0.6, marginLeft: 'auto' }}
                                    />
                                </View>
                                {notesExpanded && (
                                    <ThemedText style={[styles.text, styles.textLeft, { marginTop: 12, opacity: 0.9 }]}>{cocktail.notes}</ThemedText>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                )}

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
    badgeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
    },
    badgeText: {
        color: Colors.dark.text,
        fontSize: 14,
        fontWeight: '500',
    },
    notesToggle: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 16,
        borderRadius: 12,
        width: '100%',
    },
    notesLabel: {
        fontWeight: 'bold',
        color: Colors.dark.text,
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    stickyTitleContainer: {
        position: 'absolute',
        zIndex: 10,
        backgroundColor: 'transparent',
    },
    stickyTitleText: {
        fontSize: 32,
        lineHeight: 42,
        fontWeight: 'bold',
        color: Colors.dark.text,
        textAlign: 'left',
        paddingTop: 8,
    },
    header: {
        marginBottom: 8,
        alignItems: 'flex-start',
        width: '100%',
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 32,
        lineHeight: 36,
        color: Colors.dark.text,
        textAlign: 'left',
    },
    section: {
        gap: 12,
        marginBottom: 16,
        paddingHorizontal: 24,
        alignItems: 'flex-start',
        width: '100%',
    },
    sectionLeft: {
        alignItems: 'flex-start',
    },
    text: {
        fontSize: 16,
        lineHeight: 24,
        color: Colors.dark.text,
        opacity: 0.9,
    },
    textLeft: {
        textAlign: 'left',
    },
    ingredientsList: {
        gap: 6,
        alignItems: 'flex-start',
    },
    ingredientRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: 'flex-start',
        gap: 10
    },

    backButton: {
        position: 'absolute',
        zIndex: 10,
    },
    editButton: {
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
