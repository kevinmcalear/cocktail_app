import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import React, { useState } from "react";
import { Modal, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ImageCarousel } from "@/components/ImageCarousel";
import { CustomIcon } from "@/components/ui/CustomIcons";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useCocktail } from "@/hooks/useCocktails";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import { Image } from "expo-image";
import { Paragraph, Separator, Text, XStack, YStack, useTheme } from "tamagui";

import { RectButton, Swipeable } from "react-native-gesture-handler";


export default function CocktailDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { height: windowHeight, width: windowWidth } = useWindowDimensions();
    const { isFavorite, toggleFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();
    const theme = useTheme();

    const { data: cocktail, isLoading: loading, error } = useCocktail(id as string);
    const [modalVisible, setModalVisible] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [notesExpanded, setNotesExpanded] = useState(false);
    const [modalHeight, setModalHeight] = useState(windowHeight);

    const scrollY = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const parallaxStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateY: scrollY.value > 0 ? scrollY.value : 0,
                },
            ],
        };
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
        <GestureHandlerRootView style={[styles.container, { paddingBottom: insets.bottom, backgroundColor: theme.background?.get() as string }]}>

            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" />

            {/* Scrollable Content overlay */}
            <Animated.ScrollView
                style={[styles.scrollContainer, { zIndex: 1 }]}
                showsVerticalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                bounces={false}
                onLayout={(e) => setModalHeight(e.nativeEvent.layout.height)}
            >
                {/* Parallax Image & Grabber */}
                <Animated.View style={[
                    { position: 'absolute', top: 0, left: 0, right: 0, height: windowWidth, zIndex: 0 },
                    parallaxStyle
                ]}>
                    <ImageCarousel
                        images={images}
                        initialIndex={currentImageIndex}
                        onIndexChange={setCurrentImageIndex}
                        onImagePress={() => setModalVisible(true)}
                        paginationBelow={true} 
                    />
                    
                    {/* Grabber built into image area */}
                    <View style={{
                        position: 'absolute',
                        top: 12,
                        left: 0,
                        right: 0,
                        alignItems: 'center',
                        pointerEvents: 'none'
                    }}>
                        <View style={{
                            width: 40,
                            height: 5,
                            borderRadius: 2.5,
                            backgroundColor: 'rgba(255, 255, 255, 0.85)',
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.5,
                            shadowRadius: 2,
                            elevation: 4,
                        }} />
                    </View>
                    
                    {/* Sticky Title (Optional, adjust as needed) */}
                    <Animated.View style={[styles.stickyTitleContainer, { bottom: 20, left: 20 }, stickyTitleStyle]}>
                        <Text style={[styles.stickyTitleText, { color: '#FFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }]}>{cocktail?.name}</Text>
                    </Animated.View>
                </Animated.View>

                {/* Transparent Spacer so touches pass through to the Parallax Header */}
                <View style={{ height: windowWidth, backgroundColor: 'transparent' }} pointerEvents="none" />

                {/* Inner ScrollView mapped dynamically to stop exactly below the grabber */}
                <ScrollView 
                    style={[styles.contentSurface, { backgroundColor: theme.background?.get() as string, height: modalHeight - 29 }]}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View style={{ flex: 1 }}>
                        <Swipeable
                            ref={(ref) => { swipeableRef = ref; }}
                            renderRightActions={() => cocktail?.id ? renderRightActions(cocktail.id, swipeableRef!) : null}
                            friction={2}
                            rightThreshold={40}
                            overshootRight={false}
                        >
                            <Text style={[styles.title, { fontSize: 32, color: theme.color?.get() as string }]}>{cocktail.name}</Text>
                        </Swipeable>
                    </View>
                    <TouchableOpacity onPress={() => router.push(`/cocktail/${id}/edit`)} style={{ padding: 8 }}>
                        <IconSymbol name="pencil" size={24} color={theme.color?.get() as string} style={{ opacity: 0.8 }} />
                    </TouchableOpacity>
                </View>

                {/* Core Metadata Badges */}
                <XStack flexWrap="wrap" gap="$4" paddingHorizontal="$4" marginBottom="$6" marginTop="$2" justifyContent="flex-start" alignItems="flex-start">
                    {cocktail.methods?.name && (
                        <YStack alignItems="center" gap="$1" width={75} justifyContent="flex-start">
                            <YStack height={32} justifyContent="flex-end" alignItems="center">
                                <CustomIcon name={cocktail.methods.name} size={28} color={theme.color?.get() as string} />
                            </YStack>
                            <Text color="$color" fontSize={12} opacity={0.7} fontWeight="500" textAlign="center">{cocktail.methods.name}</Text>
                        </YStack>
                    )}
                    {cocktail.glassware?.name && (
                        <YStack alignItems="center" gap="$1" width={75} justifyContent="flex-start">
                            <YStack height={32} justifyContent="flex-end" alignItems="center">
                                <CustomIcon name={cocktail.glassware.name} size={28} color={theme.color?.get() as string} />
                            </YStack>
                            <Text color="$color" fontSize={12} opacity={0.7} fontWeight="500" textAlign="center">{cocktail.glassware.name}</Text>
                        </YStack>
                    )}
                    {cocktail.ice?.name && (
                        <YStack alignItems="center" gap="$1" width={75} justifyContent="flex-start">
                            <YStack height={32} justifyContent="flex-end" alignItems="center">
                                <CustomIcon name={cocktail.ice.name} size={28} color={theme.color?.get() as string} />
                            </YStack>
                            <Text color="$color" fontSize={12} opacity={0.7} fontWeight="500" textAlign="center">{cocktail.ice.name}</Text>
                        </YStack>
                    )}
                    {cocktail.families?.name && (
                        <YStack alignItems="center" gap="$1" width={75} justifyContent="flex-start">
                            <YStack height={32} justifyContent="flex-end" alignItems="center">
                                <CustomIcon name={cocktail.families.name} size={28} color={theme.color?.get() as string} />
                            </YStack>
                            <Text color="$color" fontSize={12} opacity={0.7} fontWeight="500" textAlign="center">{cocktail.families.name}</Text>
                        </YStack>
                    )}
                    {cocktail.origin && (
                        <YStack alignItems="center" gap="$1" width={75} justifyContent="flex-start">
                            <YStack height={32} justifyContent="flex-end" alignItems="center">
                                <CustomIcon name={cocktail.origin} size={28} color={theme.color?.get() as string} />
                            </YStack>
                            <Text color="$color" fontSize={12} opacity={0.7} fontWeight="500" textAlign="center">{cocktail.origin}</Text>
                        </YStack>
                    )}
                </XStack>

                {/* Garnish info */}
                {cocktail.garnish_1 && (
                    <YStack gap="$1" paddingHorizontal="$4" marginBottom="$4">
                        <Text color="$color" fontSize={12} fontWeight="bold" textTransform="uppercase" letterSpacing={1} opacity={0.7}>Garnish</Text>
                        <Text color="$color" fontSize={16}>{cocktail.garnish_1}</Text>
                    </YStack>
                )}

                {/* Ingredients List */}
                {cocktail.recipes && cocktail.recipes.length > 0 && (
                    <YStack gap="$2" marginBottom="$4" paddingHorizontal="$4">
                        <YStack backgroundColor="$backgroundStrong" borderRadius="$4" padding="$3" borderWidth={1} borderColor="$borderColor">
                            {cocktail.recipes.map((recipe, index) => {
                                const ingredientsData = recipe.ingredients as any; // Cast for now until types sync up
                                const imageUrl = ingredientsData?.ingredient_images?.[0]?.images?.url;
                                return (
                                    <React.Fragment key={index}>
                                        <XStack alignItems="center" justifyContent="space-between" paddingVertical="$2">
                                            <Text color="$color" fontSize={16} flex={1}>{formatIngredient(recipe)}</Text>
                                            {imageUrl && (
                                                <Image 
                                                    source={imageUrl} 
                                                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)' }} 
                                                    contentFit="cover"
                                                />
                                            )}
                                        </XStack>
                                        {index < cocktail.recipes!.length - 1 && <Separator borderColor="$borderColor" />}
                                    </React.Fragment>
                                );
                            })}
                        </YStack>
                    </YStack>
                )}


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
                </ScrollView>
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
    },

    scrollContent: {
        paddingBottom: 40,
    },
    contentSurface: {
        paddingTop: 24,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
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
        fontFamily: 'IBMPlexSansItalic',
        fontWeight: 'normal',
        fontStyle: 'italic',
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
        fontFamily: 'IBMPlexSansItalic',
        fontWeight: 'normal',
        fontStyle: 'italic',
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
