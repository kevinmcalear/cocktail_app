import { AlphabetScroller } from "@/components/AlphabetScroller";
import { FilterModal } from "@/components/FilterModal";
import { SearchBar, SearchChip } from "@/components/SearchBar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import { useSettingsStore } from "@/store/useSettingsStore";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
import { memo, ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View, ViewToken } from "react-native";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, H1, H4, Paragraph, Text, useTheme, XStack, YStack } from "tamagui";

export interface SearchItem {
    id: string;
    name: string;
    description?: string | null;
    category?: "Cocktail" | "Beer" | "Wine" | "Ingredient" | "Category";
    price?: string | null;
    recipes?: {
        ingredient_item_id?: string;
        ingredient?: {
            name: string;
            item_categories?: {
                category_id: string;
            }[];
        } | null;
    }[];
    item_images?: {
        images?: {
            url: string;
        };
    }[];
    item_categories?: {
        category_id: string;
    }[];
    image?: any;
    method_id?: string | null;
    glassware_id?: string | null;
    family_id?: string | null;
}

interface SearchListProps {
    title: string;
    items: SearchItem[];
    headerButtons?: ReactNode;
    initialSearchQuery?: string;
    hideHeader?: boolean;
    onDrinkPress?: (drink: SearchItem) => void;
    onBackPress?: () => void;
    isModal?: boolean;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
        paddingHorizontal: 12,
        paddingBottom: 16,
    }
});

const getImage = (item: SearchItem) => {
    if (item.image) {
        return item.image;
    }
    if (item.item_images && item.item_images.length > 0 && item.item_images[0].images) {
        return { uri: item.item_images[0].images.url };
    }
    // Fallback to a single reliable image since specific placeholders don't exist yet
    return require("@/assets/images/cocktails/house_martini.png");
};

const SectionHeader = memo(function SectionHeader({ letter }: { letter: string }) {
    return (
        <XStack alignItems="center" justifyContent="center" paddingVertical="$0" marginTop="$2" marginBottom="$2" paddingHorizontal="$4">
            <Text 
                fontFamily="IBMPlexSansItalic" 
                fontSize={22} 
                fontWeight="400" 
                fontStyle="italic" 
                color="$color" 
                opacity={0.3}
                textAlign="center"
            >
                {letter}
            </Text>
        </XStack>
    );
});

const SearchItemCard = memo(function SearchItemCard({
    drink,
    isFav,
    inStudy,
    onToggleFavorite,
    onToggleStudyPile,
    onPress,
    onCategoryPress
}: {
    drink: SearchItem;
    isFav: boolean;
    inStudy: boolean;
    onToggleFavorite: (id: string, swipeable: Swipeable) => void;
    onToggleStudyPile: (id: string, swipeable: Swipeable) => void;
    onPress?: (drink: SearchItem) => void;
    onCategoryPress?: (id: string, name: string) => void;
}) {
    let swipeableRef: Swipeable | null = null;

    let subText = drink.recipes?.map(r => r.ingredient?.name).filter(Boolean).join(", ") || drink.description || "No description";

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

    const theme = useTheme();

    const cardContent = (
        <Card
            borderWidth={drink.category === "Category" ? 1 : 0}
            backgroundColor={drink.category === "Category" ? "$color4" : "$backgroundStrong"}
            borderColor={drink.category === "Category" ? theme.color8?.get() as string : "transparent"}
            overflow="hidden"
            marginBottom="$3"
            elevation="$1"
            borderRadius={20}
            pressStyle={{ scale: 0.98 }}
            onPress={onPress ? () => onPress(drink) : undefined}
        >
            <Card.Header flexDirection="row" padding="$3" minHeight={drink.category === "Category" ? 80 : 100} alignItems="center">
                {drink.category === "Category" && (
                    <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: theme.color7?.get() as string, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <IconSymbol name="tag.fill" size={24} color={theme.color11?.get() as string} />
                    </View>
                )}
                <YStack flex={1} paddingRight="$3" gap="$1" justifyContent="center">
                    <H4 
                        color="$color" 
                        fontSize={20} 
                        fontWeight="700" 
                        numberOfLines={1}
                    >
                        {drink.name}
                    </H4>
                    <Paragraph color="$color11" size="$3" numberOfLines={2}>
                        {subText}
                    </Paragraph>
                </YStack>
                {drink.category !== "Category" && (
                    <Image
                        source={getImage(drink)}
                        style={{ width: 76, height: 76, borderRadius: 18, backgroundColor: theme.color5?.get() as string }}
                        contentFit="cover"
                        transition={500}
                        onError={(e) => {
                            // Silent fallback
                        }}
                    />
                )}
                {drink.category === "Category" && (
                    <IconSymbol name="chevron.right" size={24} color={theme.color8?.get() as string} />
                )}
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
            {onPress ? (
                cardContent
            ) : drink.category === "Category" ? (
                <TouchableOpacity onPress={() => onCategoryPress?.(drink.id.replace("category-", ""), drink.name)} activeOpacity={0.8}>
                    {cardContent}
                </TouchableOpacity>
            ) : drink.category === "Beer" ? (
                <Link href={`/beer/${drink.id}`} asChild>
                    {cardContent}
                </Link>
            ) : drink.category === "Wine" ? (
                <Link href={`/wine/${drink.id}`} asChild>
                    {cardContent}
                </Link>
            ) : drink.category === "Ingredient" ? (
                <Link href={`/ingredient/${drink.id}`} asChild>
                    {cardContent}
                </Link>
            ) : (
                <Link href={`/cocktail/${drink.id}`} asChild>
                    {cardContent}
                </Link>
            )}
        </Swipeable>
    );
});

export function SearchList({ title, items, headerButtons, initialSearchQuery = "", hideHeader = false, isModal = false, onDrinkPress, onBackPress }: SearchListProps) {
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
    const allCategories = ["Cocktails", "Beers", "Wines", "Ingredients"];
    const [activeFilters, setActiveFilters] = useState<string[]>(allCategories);
    const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
    const [showFavesOnly, setShowFavesOnly] = useState(false);
    const [activeChips, setActiveChips] = useState<SearchChip[]>([]);
    const flatListRef = useRef<FlatList>(null);
    const { toggleFavorite, isFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();
    const { data: dropdowns } = useDropdowns();

    const handleToggleFilter = useCallback((category: string) => {
        if (category === "All") {
            setActiveFilters(prev => {
                const isAllSelected = allCategories.every(cat => prev.includes(cat));
                if (isAllSelected) {
                    return [];
                } else {
                    return [...allCategories];
                }
            });
        } else {
            setActiveFilters(prev => {
                if (prev.includes(category)) {
                    return prev.filter(c => c !== category);
                } else {
                    return [...prev, category];
                }
            });
        }
    }, [allCategories]);

    // Filter and Sort
    const filteredDrinks = useMemo(() => {
        let result = items;

        if (activeFilters.length !== allCategories.length) {
            const mappedFilters = activeFilters.map(f => {
                 if (f === "Cocktails") return "Cocktail";
                 if (f === "Beers") return "Beer";
                 if (f === "Wines") return "Wine";
                 if (f === "Ingredients") return "Ingredient";
                 return f;
            });
            result = result.filter(d => d.category && mappedFilters.includes(d.category));
        }

        if (showFavesOnly) {
            result = result.filter(d => isFavorite(d.id));
        }

        if (activeChips.length > 0) {
            activeChips.forEach(chip => {
                if (chip.type === "Search") {
                    const lowerQuery = chip.label.replace(/"/g, "").toLowerCase();
                    result = result.filter(
                        (c) =>
                            c.name.toLowerCase().includes(lowerQuery) ||
                            (c.recipes?.some(r => r.ingredient?.name?.toLowerCase().includes(lowerQuery))) ||
                            (c.description?.toLowerCase().includes(lowerQuery))
                    );
                } else if (chip.type === "Ingredient") {
                    const ingId = chip.id.replace("ingredient-", "");
                    result = result.filter(
                        (c) =>
                           ((c.category === "Ingredient" && c.id === ingId) || false) ||
                           (c.recipes?.some(r => r.ingredient_item_id === ingId) || false)
                    );
                } else if (chip.type === "Category") {
                    const categoryId = chip.id.replace("category-", "");
                    result = result.filter(c => 
                        (c.item_categories?.some(ic => ic.category_id === categoryId) || false) ||
                        (c.recipes?.some(r => r.ingredient?.item_categories?.some((ic: any) => ic.category_id === categoryId)) || false)
                    );
                } else if (chip.type === "Method") {
                    const methodId = chip.id.replace("method-", "");
                    result = result.filter(c => c.method_id === methodId);
                } else if (chip.type === "Glassware") {
                    const glasswareId = chip.id.replace("glassware-", "");
                    result = result.filter(c => c.glassware_id === glasswareId);
                } else if (chip.type === "Family") {
                    const familyId = chip.id.replace("family-", "");
                    result = result.filter(c => c.family_id === familyId);
                }
            });
        }

        if (searchQuery && activeChips.length === 0) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(
                (c) =>
                    c.name.toLowerCase().includes(lowerQuery) ||
                    (c.recipes?.some(r => r.ingredient?.name?.toLowerCase().includes(lowerQuery))) ||
                    (c.description?.toLowerCase().includes(lowerQuery))
            );

            // Inject matching categories directly into the search results
            const matchedCategories = dropdowns?.categories?.filter((c: any) => c.name.toLowerCase().includes(lowerQuery)) || [];
            if (matchedCategories.length > 0) {
                const categorySearchItems: SearchItem[] = matchedCategories.map((cat: any) => ({
                    id: `category-${cat.id}`,
                    name: cat.name,
                    description: "Tap to explore this category",
                    category: "Category",
                }));
                result = [...categorySearchItems, ...result];
            }
        }

        return result.sort((a, b) => {
            // Force Categories to always appear at the top
            if (a.category === "Category" && b.category !== "Category") return -1;
            if (a.category !== "Category" && b.category === "Category") return 1;
            return a.name.localeCompare(b.name);
        });
    }, [items, searchQuery, activeFilters, allCategories, activeChips, showFavesOnly, isFavorite, dropdowns?.categories]);

    const suggestions = useMemo(() => {
        if (!searchQuery) return [];
        const query = searchQuery.toLowerCase();
        const sugs: SearchChip[] = [];

        dropdowns?.categories?.filter((c: any) => c.name.toLowerCase().includes(query)).slice(0, 3).forEach((c: any) => {
            sugs.push({ id: `category-${c.id}`, label: c.name, type: "Category" });
        });

        dropdowns?.ingredients?.filter(i => i.name.toLowerCase().includes(query)).slice(0, 3).forEach(i => {
            sugs.push({ id: `ingredient-${i.id}`, label: i.name, type: "Ingredient" });
        });

        dropdowns?.methods?.filter(m => m.name.toLowerCase().includes(query)).slice(0, 2).forEach(m => {
            sugs.push({ id: `method-${m.id}`, label: m.name, type: "Method" });
        });

        dropdowns?.glassware?.filter(g => g.name.toLowerCase().includes(query)).slice(0, 2).forEach(g => {
            sugs.push({ id: `glassware-${g.id}`, label: g.name, type: "Glassware" });
        });

        dropdowns?.families?.filter(f => f.name.toLowerCase().includes(query)).slice(0, 2).forEach(f => {
            sugs.push({ id: `family-${f.id}`, label: f.name, type: "Family" });
        });
        
        const existingTextSearch = sugs.find(s => s.type === "Search");
        if (!existingTextSearch) {
            sugs.push({ id: `text-${query}`, label: `"${searchQuery}"`, type: "Search" });
        }

        return sugs;
    }, [searchQuery, dropdowns]);

    // Section Headers Logic
    const listData = useMemo(() => {
        const data: (SearchItem | { type: "header"; letter: string; id: string })[] = [];
        let lastLetter = "";
        const seenLetters = new Set<string>();

        filteredDrinks.forEach((item) => {
            // Category items are forced to the top and shouldn't trigger alphabetical headers
            if (item.category === "Category") {
                data.push(item);
                return;
            }

            let currentLetter = item.name.charAt(0).toUpperCase();

            // Group numbers under "#"
            if (/[0-9]/.test(currentLetter)) {
                currentLetter = "#";
            }

            if (currentLetter !== lastLetter) {
                lastLetter = currentLetter;
                // Double check to absolutely prevent duplicate keys in React if sorting somehow folds
                if (!seenLetters.has(currentLetter)) {
                    seenLetters.add(currentLetter);
                    data.push({ type: "header", letter: currentLetter, id: `header-${currentLetter}` });
                }
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

    const renderHeader = useCallback(() => {
        return (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={{ paddingTop: hideHeader ? (isModal ? 20 : insets.top + 4) : 0 }}>
                    {!hideHeader && (
                        <View style={[styles.header, { paddingTop: isModal ? 20 : insets.top + 4 }]}>
                            <TouchableOpacity onPress={() => onBackPress ? onBackPress() : router.back()} style={styles.headerTitleContainer}>
                                <IconSymbol name="chevron.down" size={24} color={theme.color?.get() as string} />
                            </TouchableOpacity>
                            <H1 fontSize={34} lineHeight={38} letterSpacing={0.5} fontWeight="bold" color="$color">{title}</H1>
                            <View style={{ width: 40 }} />
                        </View>
                    )}
                    {headerButtons}

                    <View style={[styles.topSearchContainer, { backgroundColor: 'transparent' }]}>
                        <SearchBar
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder={`Search drinks...`}
                            onFilterPress={() => setIsFilterModalVisible(true)}
                            chips={activeChips}
                            onRemoveChip={(chipId) => {
                                setActiveChips(prev => prev.filter(c => c.id !== chipId));
                            }}
                            suggestions={suggestions}
                            onSuggestionPress={(sug) => {
                                setActiveChips(prev => {
                                    if (prev.find(c => c.id === sug.id)) return prev;
                                    return [...prev, sug];
                                });
                                setSearchQuery("");
                                Keyboard.dismiss();
                            }}
                        />
                    </View>
                </View>
            </TouchableWithoutFeedback>
        );
    }, [hideHeader, isModal, insets.top, onBackPress, router, theme.color, title, headerButtons, searchQuery, setSearchQuery, setIsFilterModalVisible, activeChips, suggestions]);
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

    const renderItem = useCallback(({ item }: { item: SearchItem | { type: "header"; letter: string; id: string } }) => {
        if ("type" in item && item.type === "header") {
            return <SectionHeader letter={item.letter} />;
        }

        const drink = item as SearchItem;
        return (
            <SearchItemCard
                drink={drink}
                isFav={isFavorite(drink.id)}
                inStudy={isInStudyPile(drink.id)}
                onToggleFavorite={handleToggleFavorite}
                onToggleStudyPile={handleToggleStudyPile}
                onPress={onDrinkPress}
                onCategoryPress={(id, name) => {
                    setActiveChips(prev => {
                        if (prev.find(c => c.id === `category-${id}`)) return prev;
                        return [...prev, { id: `category-${id}`, label: name, type: "Category" }];
                    });
                    setSearchQuery("");
                }}
            />
        );
    }, [isFavorite, isInStudyPile, handleToggleFavorite, handleToggleStudyPile, onDrinkPress]);

    return (
        <YStack style={styles.container} backgroundColor="$background">
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'transparent' }} pointerEvents="box-none">
                {renderHeader()}
            </View>
            <View style={styles.contentContainer}>
                <FlatList
                    ref={flatListRef}
                    data={listData}
                    keyExtractor={(item) => ('name' in item ? item.id : `header-${item.letter}`)}
                    contentContainerStyle={[
                        styles.listContent, 
                        { 
                            paddingTop: (hideHeader ? (isModal ? 20 : insets.top + 4) : (isModal ? 60 : insets.top + 50)) + 76, 
                            paddingBottom: 100 + insets.bottom 
                        }
                    ]}
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
            {(!searchQuery && activeChips.length === 0) && (
                <AlphabetScroller onScrollToLetter={handleScrollToLetter} />
            )}
            </View>

            <FilterModal 
                visible={isFilterModalVisible}
                onClose={() => setIsFilterModalVisible(false)}
                activeFilters={activeFilters}
                onToggleFilter={handleToggleFilter}
                showFavesOnly={showFavesOnly}
                onToggleFavesOnly={() => setShowFavesOnly(prev => !prev)}
            />
        </YStack>
    );
}


