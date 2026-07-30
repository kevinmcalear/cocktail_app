import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Modal, ScrollView, StatusBar, StyleSheet, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { GestureHandlerRootView, RectButton, Swipeable } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ImageCarousel } from "@/components/ImageCarousel";
import { CocktailPhotoPlaceholder } from "@/components/cocktail/CocktailPhotoPlaceholder";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Text, useTheme, XStack } from "tamagui";

export interface ItemDetailLayoutProps {
    id: string;
    title: string;
    images: string[];
    isLoading?: boolean;
    isFavorite: boolean;
    isInStudyPile: boolean;
    onToggleFavorite: (id: string) => void;
    onToggleStudyPile: (id: string) => void;
    onEditPress?: () => void;
    canEdit?: boolean;
    onStartEdit?: () => void;
    onCancelEdit?: () => void;
    isEditing?: boolean;
    onSave?: () => void;
    saving?: boolean;
    isDirty?: boolean;
    editableTitle?: {
        value: string;
        onChange: (value: string) => void;
        onBlur?: () => void;
        placeholder?: string;
    };
    onManageImages?: () => void;
    onBack?: () => void;
    /** Hides back, fav/study, cancel/save — for creator workspace inline edit */
    embedded?: boolean;
    /** When true and images is empty, show a generic add-photo placeholder (draft create) */
    emptyPhotoPlaceholder?: boolean;
    children: React.ReactNode;
}

export function ItemDetailLayout({
    id,
    title,
    images,
    isLoading = false,
    isFavorite,
    isInStudyPile,
    onToggleFavorite,
    onToggleStudyPile,
    onEditPress,
    canEdit = false,
    onStartEdit,
    onCancelEdit,
    isEditing = false,
    onSave,
    saving = false,
    isDirty = false,
    editableTitle,
    onManageImages,
    onBack,
    embedded = false,
    emptyPhotoPlaceholder = false,
    children
}: ItemDetailLayoutProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { height: windowHeight, width: windowWidth } = useWindowDimensions();
    const theme = useTheme();
    const { isEditModeEnabled } = useSettingsStore();

    const [modalVisible, setModalVisible] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [modalHeight, setModalHeight] = useState(windowHeight);
    const [titleFocused, setTitleFocused] = useState(false);

    useEffect(() => {
        if (!isEditing) setTitleFocused(false);
    }, [isEditing]);

    const handleImagePress = () => {
        if (isEditing && onManageImages) {
            onManageImages();
            return;
        }
        setModalVisible(true);
    };

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

    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text>Loading...</Text>
            </View>
        );
    }

    const renderRightActions = (id: string, swipeable: Swipeable) => {
        return (
            <View style={styles.rightActionsContainer}>
                <RectButton
                    style={[styles.actionButton, { backgroundColor: '#FF4B4B' }]}
                    onPress={() => {
                        onToggleFavorite(id);
                        swipeable.close();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }}
                >
                    <IconSymbol name={isFavorite ? "heart.fill" : "heart"} size={24} color="#FFF" />
                    <Text style={[styles.actionText, { color: '#FFF' }]}>{isFavorite ? "Unfav" : "Fav"}</Text>
                </RectButton>
                <RectButton
                    style={[styles.actionButton, { backgroundColor: '#4A90E2' }]}
                    onPress={() => {
                        onToggleStudyPile(id);
                        swipeable.close();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }}
                >
                    <IconSymbol name={isInStudyPile ? "book.fill" : "book"} size={24} color="#FFF" />
                    <Text style={[styles.actionText, { color: '#FFF' }]}>{isInStudyPile ? "Remove" : "Study"}</Text>
                </RectButton>
            </View>
        );
    };

    let swipeableRef: Swipeable | null = null;
    const isLargeScreen = windowWidth >= 768;

    const renderTitle = (fontSize: number, lineHeight?: number, numberOfLines?: number) => {
        const color = theme.color?.get() as string;
        const placeholderColor = theme.color11?.get() as string;
        const titlePlaceholder = editableTitle?.placeholder ?? "Cocktail name";
        const displayValue = editableTitle?.value ?? title;
        const isEmpty = !displayValue?.trim();
        const titleStyle = {
            fontSize,
            lineHeight: lineHeight || fontSize + 4,
            fontFamily: "IBMPlexSansItalic" as const,
            fontStyle: "italic" as const,
            fontWeight: "normal" as const,
            color: isEmpty && editableTitle && isEditing ? placeholderColor : color,
            opacity: isEmpty && editableTitle && isEditing ? 0.55 : 1,
        };

        const titleText = (
            <Text style={[styles.title, titleStyle]} numberOfLines={numberOfLines}>
                {isEmpty && editableTitle && isEditing ? titlePlaceholder : displayValue}
            </Text>
        );

        if (editableTitle && titleFocused) {
            return (
                <TextInput
                    value={editableTitle.value}
                    onChangeText={editableTitle.onChange}
                    onBlur={() => {
                        editableTitle.onBlur?.();
                        setTitleFocused(false);
                    }}
                    placeholder={titlePlaceholder}
                    placeholderTextColor={placeholderColor}
                    style={[titleStyle, styles.titleInput, { color, opacity: 1 }]}
                    autoFocus
                />
            );
        }

        if (editableTitle && isEditing) {
            return (
                <TouchableOpacity onPress={() => setTitleFocused(true)} activeOpacity={0.7}>
                    {titleText}
                </TouchableOpacity>
            );
        }

        return titleText;
    };

    const renderHeaderAction = () => {
        if (embedded) return null;
        if (isEditing && onSave) {
            return (
                <XStack alignItems="center" gap="$1">
                    {onCancelEdit && (
                        <TouchableOpacity onPress={onCancelEdit} style={{ padding: 8 }}>
                            <Text color="$color11" fontWeight="600" fontSize={16}>Cancel</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={onSave}
                        disabled={saving || !isDirty}
                        style={{ padding: 8, opacity: isDirty ? 1 : 0.4 }}
                    >
                        <Text color={theme.color8?.get() as string} fontWeight="bold" fontSize={16}>
                            {saving ? "Saving…" : "Save"}
                        </Text>
                    </TouchableOpacity>
                </XStack>
            );
        }
        if (canEdit && onStartEdit) {
            return (
                <TouchableOpacity onPress={onStartEdit} style={{ padding: 8 }}>
                    <Text color={theme.color8?.get() as string} fontWeight="bold" fontSize={16}>Edit</Text>
                </TouchableOpacity>
            );
        }
        if (onEditPress && isEditModeEnabled) {
            return (
                <TouchableOpacity onPress={onEditPress} style={{ padding: 8 }}>
                    <IconSymbol name="ellipsis" size={24} color={theme.color?.get() as string} style={{ opacity: 0.8 }} />
                </TouchableOpacity>
            );
        }
        return null;
    };

    const renderDesktopHeaderAction = () => {
        if (embedded) return null;
        if (isEditing && onSave) {
            return (
                <XStack alignItems="center" gap="$2">
                    {onCancelEdit && (
                        <TouchableOpacity
                            onPress={onCancelEdit}
                            style={[styles.actionButtonDesktop, { backgroundColor: theme.backgroundStrong?.get() as string, width: 'auto', paddingHorizontal: 16 }]}
                        >
                            <Text color={theme.color11?.get() as string} fontWeight="600" fontSize={14}>Cancel</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={onSave}
                        disabled={saving || !isDirty}
                        style={[styles.actionButtonDesktop, { backgroundColor: theme.color8?.get() as string, opacity: isDirty ? 1 : 0.4, width: 'auto', paddingHorizontal: 20 }]}
                    >
                        <Text color={theme.backgroundStrong?.get() as string} fontWeight="bold" fontSize={14}>
                            {saving ? "…" : "Save"}
                        </Text>
                    </TouchableOpacity>
                </XStack>
            );
        }
        if (canEdit && onStartEdit) {
            return (
                <TouchableOpacity
                    onPress={onStartEdit}
                    style={[styles.actionButtonDesktop, { backgroundColor: theme.color8?.get() as string, width: 'auto', paddingHorizontal: 20 }]}
                >
                    <Text color={theme.backgroundStrong?.get() as string} fontWeight="bold" fontSize={14}>Edit</Text>
                </TouchableOpacity>
            );
        }
        if (onEditPress && isEditModeEnabled) {
            return (
                <TouchableOpacity onPress={onEditPress} style={[styles.actionButtonDesktop, { backgroundColor: theme.backgroundStrong?.get() as string }]}>
                    <IconSymbol name="ellipsis" size={22} color={theme.color?.get() as string} />
                </TouchableOpacity>
            );
        }
        return null;
    };

    const renderHeroImage = (paginationBelow?: boolean) => {
        if (images.length > 0) {
            return (
                <ImageCarousel
                    images={images}
                    initialIndex={currentImageIndex}
                    onIndexChange={setCurrentImageIndex}
                    onImagePress={handleImagePress}
                    paginationBelow={paginationBelow}
                />
            );
        }
        // ponytail: edit with no photos always gets a tappable add affordance
        if (emptyPhotoPlaceholder || (isEditing && onManageImages)) {
            return <CocktailPhotoPlaceholder onPress={handleImagePress} />;
        }
        return null;
    };

    const mainContent = isLargeScreen ? (
        <View style={{ flexDirection: 'row', flex: 1, paddingTop: insets.top }}>
            <View style={{ width: '40%', maxWidth: 450, minWidth: 300, padding: 32, paddingTop: 80, justifyContent: 'flex-start' }}>
                <View style={{ width: '100%', aspectRatio: 1, borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8, backgroundColor: theme.backgroundStrong?.get() as string }}>
                    {renderHeroImage(true)}
                </View>
            </View>

            <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingVertical: 32, paddingBottom: insets.bottom + 40 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 }]}>
                    <View style={{ flex: 1, paddingRight: 16 }}>
                        {renderTitle(48, 56, 2)}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {!isEditing && (
                            <>
                                <TouchableOpacity onPress={() => {
                                    onToggleFavorite(id);
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                }} style={[styles.actionButtonDesktop, { backgroundColor: isFavorite ? 'rgba(255, 75, 75, 0.1)' : theme.backgroundStrong?.get() as string }]}>
                                    <IconSymbol name={isFavorite ? "heart.fill" : "heart"} size={22} color={isFavorite ? '#FF4B4B' : theme.color?.get() as string} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => {
                                    onToggleStudyPile(id);
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                }} style={[styles.actionButtonDesktop, { backgroundColor: isInStudyPile ? 'rgba(74, 144, 226, 0.1)' : theme.backgroundStrong?.get() as string }]}>
                                    <IconSymbol name={isInStudyPile ? "book.fill" : "book"} size={22} color={isInStudyPile ? '#4A90E2' : theme.color?.get() as string} />
                                </TouchableOpacity>
                            </>
                        )}
                        {renderDesktopHeaderAction()}
                    </View>
                </View>

                {children}
            </ScrollView>
        </View>
    ) : (
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
                {renderHeroImage(true)}
                
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
                
                {/* Sticky Title */}
                <Animated.View style={[styles.stickyTitleContainer, { bottom: 20, left: 20 }, stickyTitleStyle]}>
                    <Text style={[styles.stickyTitleText, { color: '#FFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }]}>{title}</Text>
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
                        {isEditing ? (
                            renderTitle(32, 36)
                        ) : (
                            <Swipeable
                                ref={(ref) => { swipeableRef = ref; }}
                                renderRightActions={() => renderRightActions(id, swipeableRef!)}
                                friction={2}
                                rightThreshold={40}
                                overshootRight={false}
                            >
                                {renderTitle(32, 36)}
                            </Swipeable>
                        )}
                    </View>
                    {renderHeaderAction()}
                </View>

                {/* Inject Specific Content Here */}
                {children}

                {/* Bottom Spacing */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </Animated.ScrollView>
    );

    return (
        <GestureHandlerRootView style={[styles.container, { paddingBottom: isLargeScreen ? 0 : insets.bottom, backgroundColor: theme.background?.get() as string }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" />

            {/* Floating Back Button */}
            {!embedded && !isEditing && (
            <TouchableOpacity
                style={{
                    position: 'absolute',
                    left: isLargeScreen ? 32 : 16,
                    top: isLargeScreen ? (insets.top > 0 ? insets.top + 16 : 24) : (insets.top > 0 ? insets.top + 8 : 16),
                    zIndex: 100,
                    cursor: 'pointer' as any,
                }}
                onPress={() => (onBack ? onBack() : router.back())}
                activeOpacity={0.7}
            >
                <GlassView intensity={50} style={styles.buttonGlass}>
                    <IconSymbol name="chevron.left" size={24} color={theme.color?.get() as string} />
                </GlassView>
            </TouchableOpacity>
            )}

            {mainContent}

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
    scrollContainer: {
        flex: 1,
    },
    contentSurface: {
        paddingTop: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4, },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
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
    titleInput: {
        padding: 0,
        margin: 0,
        backgroundColor: 'transparent',
        borderWidth: 0,
        width: '100%',
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
    actionButtonDesktop: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
