import { AlphabetScroller } from "@/components/AlphabetScroller";
import { BottomSearchBar } from "@/components/BottomSearchBar";
import { FilterModal } from "@/components/FilterModal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
import { memo, ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View, ViewToken } from "react-native";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, H4, Paragraph, Text, YStack } from "tamagui";

export interface DrinkListItem {
    id: string;
    name: string;
    description?: string;
    category?: "Cocktail" | "Beer" | "Wine";
    price?: string;
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
    image?: any;
}

interface DrinkListProps {
    title: string;
    drinks: DrinkListItem[];
    headerButtons?: ReactNode;
    initialSearchQuery?: string;
    hideHeader?: boolean;
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

    rightActionsContainer: {
        flexDirection: 'row',
        width: 160,
        height: 100,
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
    topSearchContainer: {
        paddingHorizontal: 16,
        paddingBottom: 16,
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
    },
    categoryFiltersContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 8,
    },
    categoryPillWrapper: {
        flex: 1,
        height: 40,
    },
    categoryPill: {
        flex: 1,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
        backgroundColor: "rgba(255,255,255,0.01)",
    },
    categoryPillSelected: {
        backgroundColor: "rgba(255,255,255,0.2)",
        borderColor: "rgba(255,255,255,0.4)",
    },
    categoryPillText: {
        fontSize: 13,
        fontWeight: '600',
        color: "rgba(255,255,255,0.6)",
    },
    categoryPillTextSelected: {
        color: "#FFFFFF",
        fontWeight: '800',
    }
});

const getImage = (item: DrinkListItem) => {
    if (item.image) {
        return item.image;
    }
    if (item.cocktail_images && item.cocktail_images.length > 0) {
        return { uri: item.cocktail_images[0].images.url };
    }
    // Fallback to a single reliable image since specific placeholders don't exist yet
    return require("@/assets/images/cocktails/house_martini.png");
};

const SectionHeader = memo(function SectionHeader({ letter }: { letter: string }) {
    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionHeaderText}>{letter}</Text>
            <View style={styles.sectionDivider} />
        </View>
    );
});

const DrinkCard = memo(function DrinkCard({
    drink,
    isFav,
    inStudy,
    onToggleFavorite,
    onToggleStudyPile
}: {
    drink: DrinkListItem;
    isFav: boolean;
    inStudy: boolean;
    onToggleFavorite: (id: string, swipeable: Swipeable) => void;
    onToggleStudyPile: (id: string, swipeable: Swipeable) => void;
}) {
    let swipeableRef: Swipeable | null = null;

    let subText = drink.recipes?.map(r => r.ingredients?.name).filter(Boolean).join(", ") || drink.description || "No description";
    if (drink.price) {
        subText = `${drink.price} • ${subText}`;
    }
    if (drink.category && drink.category !== "Cocktail") {
        subText = `${drink.category.toUpperCase()} • ${subText}`;
    }

    const renderRightActions = () => (
        <View style={styles.rightActionsContainer}>
            <RectButton
                style={[styles.actionButton, { backgroundColor: '#FF4B4B' }]}
                onPress={() => onToggleFavorite(drink.id, swipeableRef!)}
            >
                <IconSymbol name={isFav ? "heart.fill" : "heart"} size={24} color="#FFF" />
                <Text style={[styles.actionText, { color: '#FFF' }]}>{isFav ? "Unfav" : "Fav"}</Text>
            </RectButton>
            <RectButton
                style={[styles.actionButton, { backgroundColor: '#4A90E2' }]}
                onPress={() => onToggleStudyPile(drink.id, swipeableRef!)}
            >
                <IconSymbol name={inStudy ? "book.fill" : "book"} size={24} color="#FFF" />
                <Text style={[styles.actionText, { color: '#FFF' }]}>{inStudy ? "Remove" : "Study"}</Text>
            </RectButton>
        </View>
    );

    const cardContent = (
        <Card
            borderWidth={1}
            backgroundColor="rgba(255,255,255,0.03)"
            borderColor="rgba(255,255,255,0.08)"
            overflow="hidden"
            marginBottom="$2"
            disabled={drink.category !== "Cocktail" && drink.category != null}
        >
            <Card.Header flexDirection="row" padding="$3" minHeight={100} alignItems="center">
                <YStack flex={1} paddingRight="$3" gap="$1" justifyContent="center">
                    <H4 color="$color" fontSize={20} fontWeight="700" numberOfLines={1}>
                        {drink.name}
                    </H4>
                    <Paragraph color="$color11" size="$3" numberOfLines={2}>
                        {subText}
                    </Paragraph>
                </YStack>
                <Image
                    source={getImage(drink)}
                    style={{ width: 76, height: 76, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)" }}
                    contentFit="cover"
                    transition={500}
                    onError={(e) => {
                        // Silent fallback
                    }}
                />
            </Card.Header>
        </Card>
    );

    return (
        <Swipeable
            ref={(ref) => { swipeableRef = ref; }}
            renderRightActions={renderRightActions}
            friction={2}
            rightThreshold={40}
        >
            {drink.category === "Cocktail" || !drink.category ? (
                <Link href={`/cocktail/${drink.id}`} asChild>
                    {cardContent}
                </Link>
            ) : (
                cardContent
            )}
        </Swipeable>
    );
});

export function DrinkList({ title, drinks, headerButtons, initialSearchQuery = "", hideHeader = false }: DrinkListProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
    const [selectedCategory, setSelectedCategory] = useState<"All" | "Cocktails" | "Beers" | "Wines">("All");
    const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
    const [showFavesOnly, setShowFavesOnly] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const { toggleFavorite, isFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    // Filter and Sort
    const filteredDrinks = useMemo(() => {
        let result = drinks;

        if (selectedCategory !== "All") {
            const mappedCategory = selectedCategory === "Cocktails" ? "Cocktail" : selectedCategory === "Beers" ? "Beer" : "Wine";
            result = result.filter(d => d.category === mappedCategory);
        }

        if (showFavesOnly) {
            result = result.filter(d => isFavorite(d.id));
        }

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(
                (c) =>
                    c.name.toLowerCase().includes(lowerQuery) ||
                    (c.recipes?.some(r => r.ingredients?.name?.toLowerCase().includes(lowerQuery))) ||
                    (c.description?.toLowerCase().includes(lowerQuery))
            );
        }

        return result.sort((a, b) => a.name.localeCompare(b.name));
    }, [drinks, searchQuery, selectedCategory]);

    // Section Headers Logic
    const listData = useMemo(() => {
        const data: (DrinkListItem | { type: "header"; letter: string; id: string })[] = [];
        let lastLetter = "";

        filteredDrinks.forEach((item) => {
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
    }, [filteredDrinks]);

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

    const handleToggleFavorite = useCallback((id: string, swipeable: Swipeable) => {
        toggleFavorite(id);
        swipeable.close();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, [toggleFavorite]);

    const handleToggleStudyPile = useCallback((id: string, swipeable: Swipeable) => {
        toggleStudyPile(id);
        swipeable.close();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, [toggleStudyPile]);

    const renderItem = useCallback(({ item }: { item: DrinkListItem | { type: "header"; letter: string; id: string } }) => {
        if ("type" in item && item.type === "header") {
            return <SectionHeader letter={item.letter} />;
        }

        const drink = item as DrinkListItem;
        return (
            <DrinkCard
                drink={drink}
                isFav={isFavorite(drink.id)}
                inStudy={isInStudyPile(drink.id)}
                onToggleFavorite={handleToggleFavorite}
                onToggleStudyPile={handleToggleStudyPile}
            />
        );
    }, [isFavorite, isInStudyPile, handleToggleFavorite, handleToggleStudyPile]);

    return (
        <YStack style={styles.container} backgroundColor="$background">
            <View style={styles.contentContainer}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={{ paddingTop: hideHeader ? insets.top + 4 : 0 }}>
                        {!hideHeader && (
                            <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
                                <TouchableOpacity onPress={() => router.back()} style={styles.headerTitleContainer}>
                                    <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                                </TouchableOpacity>
                                <Text style={[styles.title, { fontSize: 34 }]}>{title}</Text>
                                <View style={{ width: 40 }} />
                            </View>
                        )}
                        {headerButtons}

                        <View style={styles.topSearchContainer}>
                            <BottomSearchBar
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder={`Search drinks...`}
                                onFilterPress={() => setIsFilterModalVisible(true)}
                            />
                        </View>
                    </View>
                </TouchableWithoutFeedback>

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
                    renderItem={renderItem}
                />
            </View>

            <AlphabetScroller onScrollToLetter={handleScrollToLetter} />

            <FilterModal 
                visible={isFilterModalVisible}
                onClose={() => setIsFilterModalVisible(false)}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                showFavesOnly={showFavesOnly}
                onToggleFavesOnly={() => setShowFavesOnly(prev => !prev)}
            />
        </YStack>
    );
}


