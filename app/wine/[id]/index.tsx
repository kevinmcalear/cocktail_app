import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Modal, StatusBar, StyleSheet, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { GestureHandlerRootView, RectButton, Swipeable } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Paragraph, Text, XStack, YStack, useTheme } from "tamagui";

import { ImageCarousel } from "@/components/ImageCarousel";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import { useWine } from "@/hooks/useWines";

export default function WineDetailsScreen() {
    const { id } = useLocalSearchParams();
    // In case the ID was passed as "wine-1234", strip the prefix
    const safeId = (id as string)?.replace('wine-', '');
    
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const { isFavorite, toggleFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();
    const theme = useTheme();

    const { data: wine, isLoading: loading, error } = useWine(safeId);
    const [modalVisible, setModalVisible] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

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
                [40, 60],
                [0, 1],
                Extrapolation.CLAMP
            ),
        };
    });

    if (loading) {
        return (
            <YStack style={styles.container} justifyContent="center" alignItems="center">
                <Text color="$color">Loading Wine...</Text>
            </YStack>
        );
    }

    if (!wine) {
        return (
            <YStack style={styles.container} justifyContent="center" alignItems="center">
                <Text color="$color">Wine not found.</Text>
            </YStack>
        );
    }

    const images = wine.wine_images?.map((img: any) => img.images.url).filter(Boolean) as string[] || [];
    if (images.length === 0) {
        images.push(require('@/assets/images/cocktails/house_martini.png'));
    }

    let swipeableRef: Swipeable | null = null;

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
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                >
                    <IconSymbol name={inStudy ? "book.fill" : "book"} size={24} color="#FFF" />
                    <Text style={[styles.actionText, { color: '#FFF' }]}>{inStudy ? "Remove" : "Study"}</Text>
                </RectButton>
            </View>
        );
    };

    return (
        <GestureHandlerRootView style={[styles.container, { paddingBottom: insets.bottom, backgroundColor: theme.background?.get() as string }]}>
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
                    onPress={() => router.push(`/wine/${id}/edit`)}
                >
                    <GlassView intensity={50} style={styles.buttonGlass}>
                        <IconSymbol name="pencil" size={24} color={theme.color?.get() as string} />
                    </GlassView>
                </TouchableOpacity>

                {/* Sticky Title */}
                <Animated.View style={[styles.stickyTitleContainer, { bottom: 20, left: 20 }, stickyTitleStyle]}>
                    <Text style={[styles.stickyTitleText, { color: theme.color?.get() as string }]}>{wine.name}</Text>
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
                        renderRightActions={() => renderRightActions(wine.id, swipeableRef!)}
                        friction={2}
                        rightThreshold={40}
                        overshootRight={false}
                    >
                        <Text style={[styles.title, { fontSize: 32, fontWeight: 'bold', color: theme.color?.get() as string }]}>{wine.name}</Text>
                    </Swipeable>
                </View>

                {/* Core Metadata Badges */}
                <XStack flexWrap="wrap" gap="$2" paddingHorizontal="$4" marginBottom="$4">
                    {wine.varietal && (
                        <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                            <IconSymbol name="drop.fill" size={16} color={theme.color?.get() as string} />
                            <Text color="$color" fontSize={14} fontWeight="500">{wine.varietal}</Text>
                        </XStack>
                    )}
                    {wine.region && (
                        <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                            <IconSymbol name="map.fill" size={16} color={theme.color?.get() as string} />
                            <Text color="$color" fontSize={14} fontWeight="500">{wine.region}</Text>
                        </XStack>
                    )}
                    {wine.location && (
                        <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                            <IconSymbol name="mappin.and.ellipse" size={16} color={theme.color?.get() as string} />
                            <Text color="$color" fontSize={14} fontWeight="500">{wine.location}</Text>
                        </XStack>
                    )}
                    {wine.abv && (
                        <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                            <IconSymbol name="percent" size={16} color={theme.color?.get() as string} />
                            <Text color="$color" fontSize={14} fontWeight="500">{wine.abv}% ABV</Text>
                        </XStack>
                    )}
                    {wine.price && (
                        <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                            <IconSymbol name="dollarsign.circle.fill" size={16} color={theme.color?.get() as string} />
                            <Text color="$color" fontSize={14} fontWeight="500">${wine.price}</Text>
                        </XStack>
                    )}
                </XStack>

                {/* Description */}
                {wine.description && (
                    <YStack gap="$3" paddingHorizontal="$4" marginBottom="$4">
                        <Paragraph color="$color" fontSize={16} lineHeight={24}>
                            {wine.description}
                        </Paragraph>
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
    },
    imageWrapper: {
        
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
    scrollContainer: {
        flex: 1,
        marginTop: 16,
    },
    scrollContent: {
        paddingBottom: 40,
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
