import { AlphabetScroller } from "@/components/AlphabetScroller";
import { BottomSearchBar } from "@/components/BottomSearchBar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
import { ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View, ViewToken } from "react-native";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface CocktailListItem {
    id: string;
    name: string;
    description?: string;
    recipes?: {
        ingredients: {
            name: string;
        } | null;
    }[];
    cocktail_images?: {
        images: {
            url: string;
        };
    }[];
}

interface CocktailListProps {
    title: string;
    cocktails: CocktailListItem[];
    headerButtons?: ReactNode;
}

export function CocktailList({ title, cocktails, headerButtons }: CocktailListProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState("");
    const flatListRef = useRef<FlatList>(null);
    const { toggleFavorite, isFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    // Filter and Sort
    const filteredCocktails = useMemo(() => {
        let result = cocktails;

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(
                (c) =>
                    c.name.toLowerCase().includes(lowerQuery) ||
                    (c.recipes?.some(r => r.ingredients?.name?.toLowerCase().includes(lowerQuery)))
            );
        }

        return result.sort((a, b) => a.name.localeCompare(b.name));
    }, [cocktails, searchQuery]);

    // Section Headers Logic
    const listData = useMemo(() => {
        const data: (CocktailListItem | { type: "header"; letter: string; id: string })[] = [];
        let lastLetter = "";

        filteredCocktails.forEach((item) => {
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
    }, [filteredCocktails]);

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
        const headerBecameVisible = changed.some((token) => {
            return token.isViewable && 'type' in token.item && token.item.type === 'header';
        });

        if (headerBecameVisible) {
            Haptics.selectionAsync();
        }
    }).current;

    const getImage = (item: CocktailListItem) => {
        if (item.cocktail_images && item.cocktail_images.length > 0) {
            return { uri: item.cocktail_images[0].images.url };
        }
        return require("@/assets/images/cocktails/house_martini.png");
    };

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

    const renderItem = ({ item }: { item: CocktailListItem | { type: "header"; letter: string; id: string } }) => {
        if ("type" in item && item.type === "header") {
            return (
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionDivider} />
                    <ThemedText style={styles.sectionHeaderText}>{item.letter}</ThemedText>
                    <View style={styles.sectionDivider} />
                </View>
            );
        }

        const cocktail = item as CocktailListItem;
        const ingredientNames = cocktail.recipes?.map(r => r.ingredients?.name).filter(Boolean) as string[] | undefined;
        const recipeText = ingredientNames && ingredientNames.length > 0 ? ingredientNames.join(", ") : "No recipe listed";
        const ingredientCount = ingredientNames?.length ?? 0;
        let swipeableRef: Swipeable | null = null;

        return (
            <Swipeable
                ref={(ref) => { swipeableRef = ref; }}
                renderRightActions={() => renderRightActions(cocktail.id, swipeableRef!)}
                friction={2}
                rightThreshold={40}
            >
                <Link href={`/cocktail/${cocktail.id}`} asChild>
                    <TouchableOpacity activeOpacity={0.7}>
                        <GlassView style={styles.itemCard} intensity={20}>
                            <View style={styles.itemRow}>
                                <View style={styles.textContainer}>
                                    <View style={styles.nameRow}>
                                        <ThemedText type="subtitle" style={styles.itemName} numberOfLines={1}>{cocktail.name}</ThemedText>
                                        <View style={styles.typePill}>
                                            <ThemedText style={styles.typePillText}>COCKTAIL</ThemedText>
                                        </View>
                                    </View>
                                    <ThemedText style={styles.itemDescription} numberOfLines={2}>
                                        {cocktail.description?.trim() ? cocktail.description : "No description provided."}
                                    </ThemedText>
                                    <ThemedText style={styles.itemRecipe} numberOfLines={2}>
                                        {recipeText}
                                    </ThemedText>
                                    <View style={styles.metaRow}>
                                        <View style={styles.metaPill}>
                                            <ThemedText style={styles.metaText}>
                                                {ingredientCount > 0 ? `${ingredientCount} ingredients` : "No recipe"}
                                            </ThemedText>
                                        </View>
                                    </View>
                                </View>
                                <Image
                                    source={getImage(cocktail)}
                                    style={styles.itemImage}
                                    contentFit="cover"
                                    transition={500}
                                />
                            </View>
                        </GlassView>
                    </TouchableOpacity>
                </Link>
            </Swipeable>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.contentContainer}>
                <FlatList
                    ref={flatListRef}
                    data={listData}
                    keyExtractor={(item) => ('name' in item ? item.id : `header-${item.letter}`)}
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
                                    <ThemedText type="title" style={styles.title}>{title}</ThemedText>
                                    <View style={{ width: 40 }} />
                                </View>
                                {headerButtons}
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
                    placeholder="Search cocktails..."
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
        alignItems: 'flex-start',
        padding: 14,
        minHeight: 112,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: 12,
        gap: 6,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    itemName: {
        fontSize: 20,
        fontWeight: "700",
        color: Colors.dark.text,
        flex: 1,
    },
    itemDescription: {
        fontSize: 14,
        color: Colors.dark.icon,
        lineHeight: 19,
    },
    itemRecipe: {
        fontSize: 14,
        color: Colors.dark.text,
        opacity: 0.9,
        lineHeight: 20,
    },
    itemImage: {
        width: 84,
        height: 84,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    typePill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    typePillText: {
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1,
        color: Colors.dark.icon,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    metaPill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
    },
    metaText: {
        fontSize: 11,
        fontWeight: "600",
        color: Colors.dark.tint,
        letterSpacing: 0.5,
    },
    rightActionsContainer: {
        flexDirection: 'row',
        width: 160,
        height: 112,
        marginBottom: 12,
    },
    actionButton: {
        flex: 1,
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
