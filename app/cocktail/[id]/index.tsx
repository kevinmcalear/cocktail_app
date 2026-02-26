import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import React, { useState } from "react";
import { Modal, StatusBar, StyleSheet, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ImageCarousel } from "@/components/ImageCarousel";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useCocktail } from "@/hooks/useCocktails";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import { H4, Paragraph, Separator, Text, XStack, YStack, useTheme } from "tamagui";

import { RectButton, Swipeable } from "react-native-gesture-handler";


export default function CocktailDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const { isFavorite, toggleFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();
    const theme = useTheme();

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
            <YStack style={styles.container}>
                <Text>Loading...</Text>
            </YStack>
        );
    }

    if (!cocktail) {
        return (
            <YStack style={styles.container}>
                <Text>Cocktail not found.</Text>
            </YStack>
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
                    <Text style={[styles.actionText, { color: '#FFF' }]}>{isFav ? "Unfav" : "Fav"}</Text>
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
                    <Text style={[styles.actionText, { color: '#FFF' }]}>{inStudy ? "Remove" : "Study"}</Text>
                </RectButton>
            </View>
        );
    };

    let swipeableRef: Swipeable | null = null;

    return (
        <GestureHandlerRootView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: theme.background?.get() as string }]}>

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
                        <IconSymbol name="chevron.left" size={24} color={theme.color?.get() as string} />
                    </GlassView>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.editButton, { top: 10, right: 20 }]}
                    onPress={() => router.push(`/cocktail/${id}/edit`)}
                >
                    <GlassView intensity={50} style={styles.buttonGlass}>
                        <IconSymbol name="pencil" size={24} color={theme.color?.get() as string} />
                    </GlassView>
                </TouchableOpacity>

                {/* Sticky Title */}
                <Animated.View style={[styles.stickyTitleContainer, { bottom: 20, left: 20 }, stickyTitleStyle]}>
                    <Text style={[styles.stickyTitleText, { color: theme.color?.get() as string }]}>{cocktail?.name}</Text>
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
                        <Text style={[styles.title, { fontSize: 32, fontWeight: 'bold', color: theme.color?.get() as string }]}>{cocktail.name}</Text>
                    </Swipeable>
                </View>

                {/* Ingredients List */}
                {cocktail.recipes && cocktail.recipes.length > 0 && (
                    <YStack gap="$2" marginBottom="$4" paddingHorizontal="$4">
                        <H4 paddingBottom="$2" color="$color" fontSize={24} fontWeight="700">Ingredients</H4>
                        <YStack backgroundColor="$backgroundStrong" borderRadius="$4" padding="$3" borderWidth={1} borderColor="$borderColor">
                            {cocktail.recipes.map((recipe, index) => (
                                <React.Fragment key={index}>
                                    <XStack alignItems="center" justifyContent="space-between" paddingVertical="$2">
                                        <Text color="$color" fontSize={16}>{formatIngredient(recipe)}</Text>
                                    </XStack>
                                    {index < cocktail.recipes!.length - 1 && <Separator borderColor="$borderColor" />}
                                </React.Fragment>
                            ))}
                        </YStack>
                    </YStack>
                )}

                {/* Core Metadata Badges */}
                <XStack flexWrap="wrap" gap="$2" paddingHorizontal="$4" marginBottom="$4">
                    {cocktail.methods?.name && (
                        <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                            <IconSymbol name="hammer.fill" size={16} color={theme.color?.get() as string} />
                            <Text color="$color" fontSize={14} fontWeight="500">{cocktail.methods.name}</Text>
                        </XStack>
                    )}
                    {cocktail.glassware?.name && (
                        <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                            <IconSymbol name="wineglass" size={16} color={theme.color?.get() as string} />
                            <Text color="$color" fontSize={14} fontWeight="500">{cocktail.glassware.name}</Text>
                        </XStack>
                    )}
                    {cocktail.ice?.name && (
                        <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                            <IconSymbol name="snowflake" size={16} color={theme.color?.get() as string} />
                            <Text color="$color" fontSize={14} fontWeight="500">{cocktail.ice.name}</Text>
                        </XStack>
                    )}
                    {cocktail.garnish_1 && (
                        <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                            <IconSymbol name="leaf.fill" size={16} color={theme.color?.get() as string} />
                            <Text color="$color" fontSize={14} fontWeight="500">{cocktail.garnish_1}</Text>
                        </XStack>
                    )}
                    {cocktail.families?.name && (
                        <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                            <IconSymbol name="person.2.fill" size={16} color={theme.color?.get() as string} />
                            <Text color="$color" fontSize={14} fontWeight="500">{cocktail.families.name}</Text>
                        </XStack>
                    )}
                    {cocktail.origin && (
                        <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                            <IconSymbol name="globe" size={16} color={theme.color?.get() as string} />
                            <Text color="$color" fontSize={14} fontWeight="500">{cocktail.origin}</Text>
                        </XStack>
                    )}
                </XStack>

                {/* Description and Notes */}
                {(cocktail.description || cocktail.notes) && (
                    <YStack gap="$3" paddingHorizontal="$4" marginBottom="$4">
                        {cocktail.description && (
                            <Paragraph color="$color" fontSize={16} lineHeight={24}>
                                {cocktail.description}
                            </Paragraph>
                        )}
                        {cocktail.notes && (
                            <TouchableOpacity 
                                style={[styles.notesToggle, { backgroundColor: theme.backgroundStrong?.get() as string, borderColor: theme.borderColor?.get() as string, borderWidth: 1 }]} 
                                onPress={() => setNotesExpanded(!notesExpanded)}
                                activeOpacity={0.7}
                            >
                                <XStack alignItems="center" gap="$2">
                                    <IconSymbol name="note.text" size={16} color={theme.color?.get() as string} style={{ opacity: 0.8 }} />
                                    <Text color="$color" fontSize={14} fontWeight="bold" textTransform="uppercase" letterSpacing={1}>Notes</Text>
                                    <View style={{ flex: 1 }} />
                                    <IconSymbol 
                                        name={notesExpanded ? "chevron.up" : "chevron.down"} 
                                        size={14} 
                                        color={theme.color?.get() as string} 
                                        style={{ opacity: 0.6 }}
                                    />
                                </XStack>
                                {notesExpanded && (
                                    <Paragraph color="$color" fontSize={16} lineHeight={24} marginTop="$3" opacity={0.9}>
                                        {cocktail.notes}
                                    </Paragraph>
                                )}
                            </TouchableOpacity>
                        )}
                    </YStack>
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
                                <IconSymbol name="xmark" size={24} color={theme.color?.get() as string} />
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

    notesToggle: {
        padding: 16,
        borderRadius: 12,
        width: '100%',
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
        textAlign: 'left',
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
