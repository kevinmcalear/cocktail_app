import { AlphabetScroller } from "@/components/AlphabetScroller";
import { BottomSearchBar } from "@/components/BottomSearchBar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
import { ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View, ViewToken } from "react-native";
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

        return (
            <Link href={`/cocktail/${cocktail.id}`} asChild>
                <TouchableOpacity activeOpacity={0.7}>
                    <GlassView style={styles.itemCard} intensity={20}>
                        <View style={styles.itemRow}>
                            <View style={styles.textContainer}>
                                <View style={styles.nameRow}>
                                    <ThemedText type="subtitle" style={styles.itemName} numberOfLines={1}>{cocktail.name}</ThemedText>
                                </View>
                                <ThemedText style={styles.itemDescription} numberOfLines={2}>
                                    {cocktail.recipes?.map(r => r.ingredients?.name).filter(Boolean).join(", ") || cocktail.description || "No ingredients listed"}
                                </ThemedText>
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
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    itemName: {
        fontSize: 20,
        fontWeight: "700",
        color: Colors.dark.text,
        flex: 1,
    },
    itemDescription: {
        fontSize: 15,
        color: Colors.dark.icon,
        lineHeight: 20,
    },
    itemImage: {
        width: 76,
        height: 76,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.05)",
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
