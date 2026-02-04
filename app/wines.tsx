import { AlphabetScroller } from "@/components/AlphabetScroller";
import { BottomSearchBar } from "@/components/BottomSearchBar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { wines } from "@/data/wines";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, FlatList, Keyboard, Platform, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View, ViewToken } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function WinesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState("");
    const flatListRef = useRef<FlatList>(null);
    const currentViewableSection = useRef<string | null>(null);

    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const showSubscription = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            (e) => {
                Animated.timing(translateY, {
                    toValue: -(e.endCoordinates.height - insets.bottom),
                    duration: (e.duration || 250) * 0.7,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.ease),
                }).start();
            }
        );
        const hideSubscription = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
            (e) => {
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: (e.duration || 250) * 0.7,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.ease),
                }).start();
            }
        );

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, [insets.bottom, translateY]);

    const filteredWines = useMemo(() => {
        return wines.filter((wine) =>
            wine.name.toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [searchQuery]);

    // Section Headers Logic
    const listData = useMemo(() => {
        const data: (typeof wines[0] | { type: "header"; letter: string; id: string })[] = [];
        let lastLetter = "";

        filteredWines.forEach((item) => {
            let currentLetter = item.name.charAt(0).toUpperCase();

            // Group numbers under "#"
            if (/[0-9]/.test(currentLetter)) {
                currentLetter = "#";
            }

            if (currentLetter !== lastLetter) {
                lastLetter = currentLetter;
                data.push({ type: "header", letter: currentLetter, id: `header-${currentLetter}` });
            }
            data.push(item);
        });

        return data;
    }, [filteredWines]);

    const handleScrollToLetter = useCallback((letter: string) => {
        const index = listData.findIndex((item) => {
            if ("type" in item && item.type === "header") {
                return item.letter === letter;
            }
            return false;
        });

        if (index !== -1 && flatListRef.current) {
            flatListRef.current.scrollToIndex({ index, animated: false, viewOffset: 100 });
        }
    }, [listData]);

    const onViewableItemsChanged = useRef(({ changed }: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
        // Trigger haptics when a header becomes visible
        const headerBecameVisible = changed.some((token) => {
            return token.isViewable && 'type' in token.item && token.item.type === 'header';
        });

        if (headerBecameVisible) {
            Haptics.selectionAsync();
        }
    }).current;

    const renderItem = ({ item }: { item: typeof wines[0] | { type: "header"; letter: string; id: string } }) => {
        if ("type" in item && item.type === "header") {
            return (
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionDivider} />
                    <ThemedText style={styles.sectionHeaderText}>{item.letter}</ThemedText>
                    <View style={styles.sectionDivider} />
                </View>
            );
        }

        const wine = item as typeof wines[0];

        return (
            <GlassView style={styles.itemCard} intensity={20}>
                <View style={styles.itemRow}>
                    <View style={styles.textContainer}>
                        <ThemedText type="subtitle" style={styles.itemName} numberOfLines={1}>{wine.name}</ThemedText>
                        <ThemedText style={styles.itemDescription} numberOfLines={2}>{wine.description}</ThemedText>
                    </View>
                    <View style={styles.iconContainer}>
                        <IconSymbol name="wineglass.fill" size={32} color={Colors.dark.tint} />
                    </View>
                </View>
            </GlassView>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.contentContainer}>
                <FlatList
                    ref={flatListRef}
                    data={listData}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
                    showsVerticalScrollIndicator={false}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={{ itemVisiblePercentThreshold: 10 }}
                    onScrollToIndexFailed={(info) => {
                        flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
                    }}
                    ListHeaderComponent={
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                            <View>
                                <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
                                    <TouchableOpacity onPress={() => router.back()} style={styles.headerTitleContainer}>
                                        <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                                    </TouchableOpacity>
                                    <ThemedText type="title" style={styles.title}>Wines</ThemedText>
                                    <View style={{ width: 40 }} />
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    }
                    renderItem={renderItem}
                />
            </View>

            <AlphabetScroller onScrollToLetter={handleScrollToLetter} />

            <View style={[styles.searchBarContainer, { paddingBottom: insets.bottom + 4 }]}>
                <BottomSearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Find your wine..."
                />
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    contentContainer: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 0,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingBottom: 8,
        zIndex: 10,
        marginTop: 0,
        marginHorizontal: 0,
    },
    headerTitleContainer: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    title: {
        fontSize: 34,
        lineHeight: 38,
        fontWeight: "bold",
        letterSpacing: 0.5,
    },
    // New Item Styles
    itemCard: {
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        backgroundColor: "rgba(255,255,255,0.03)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        height: 100,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: 12,
        gap: 4,
    },
    itemName: {
        fontSize: 20,
        fontWeight: "700",
        color: Colors.dark.text,
    },
    itemDescription: {
        fontSize: 15,
        color: Colors.dark.icon,
        lineHeight: 20,
    },
    iconContainer: {
        width: 76,
        height: 76,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.05)",
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBarContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingTop: 15,
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        marginTop: 12,
        marginBottom: 8,
        paddingHorizontal: 32,
    },
    sectionHeaderText: {
        fontSize: 24,
        fontWeight: "800",
        color: "#FFFFFF",
        marginHorizontal: 16,
        textAlign: 'center',
    },
    sectionDivider: {
        flex: 1,
        height: 2,
        backgroundColor: "rgba(255, 255, 255, 0.4)",
    }
});
