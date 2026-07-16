import { AlphabetScroller } from "@/components/AlphabetScroller";
import { FilterModal } from "@/components/FilterModal";
import { SearchBar, SearchChip } from "@/components/SearchBar";
import { WEB_SIDEBAR_WIDTH } from "@/components/WebSidebar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import { useAppStore } from "@/store/useAppStore";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
import { memo, ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { capitalize } from "@/lib/stringUtils";
import { FlatList, Keyboard, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View, ViewToken, useWindowDimensions } from "react-native";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, H1, H4, Paragraph, Text, useTheme, XStack, YStack } from "tamagui";

// ponytail: columns from the panel width (not the window — sidebar steals space)
const DESKTOP_BREAKPOINT = 768;
const GRID_PAD_H = 28;
const GRID_GAP = 20;
const ALPHA_SCROLLER_WIDTH = 40; // matches AlphabetScroller
function getGridColumns(width: number) {
    if (width >= 1200) return 5;
    if (width >= 900) return 4;
    if (width >= DESKTOP_BREAKPOINT) return 3;
    if (width >= 520) return 2;
    return 1;
}

export interface SearchItem {
    id: string;
    name: string;
    description?: string | null;
    category?: "Cocktail" | "Beer" | "Wine" | "Ingredient" | "Category" | "Menu";
    isDraft?: boolean;
    draftProgress?: any;
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
    ice_id?: string | null;
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
    onCreateNewPress?: (query: string) => void;
    createNewText?: string;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: "hidden",
        minWidth: 0,
    },
    contentContainer: {
        flex: 1,
        overflow: "hidden",
        minWidth: 0,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 0,
    },
    gridRow: {
        flexDirection: "row",
        flexWrap: "nowrap",
        gap: GRID_GAP,
        marginBottom: GRID_GAP,
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
    onCategoryPress,
    layout = "list",
}: {
    drink: SearchItem;
    isFav: boolean;
    inStudy: boolean;
    onToggleFavorite: (id: string, swipeable: Swipeable) => void;
    onToggleStudyPile: (id: string, swipeable: Swipeable) => void;
    onPress?: (drink: SearchItem) => void;
    onCategoryPress?: (id: string, name: string) => void;
    layout?: "list" | "grid";
}) {
    let swipeableRef: Swipeable | null = null;
    const isGrid = layout === "grid";

    let subText = drink.recipes?.map(r => r.ingredient?.name ? capitalize(r.ingredient.name) : "").filter(Boolean).join(", ") || drink.description || "No description";

    if (drink.price) {
        subText = `${drink.price} • ${subText}`;
    }
    if (drink.category && drink.category !== "Cocktail") {
        subText = drink.category === "Menu"
            ? "Menu"
            : `${drink.category.toUpperCase()} • ${subText}`;
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

    const draftBadge = drink.isDraft ? (
        <View style={{
            backgroundColor: drink.draftProgress?.badgeBg || "rgba(255, 165, 0, 0.15)",
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: drink.draftProgress?.color || "rgba(255, 165, 0, 0.4)",
            alignSelf: "flex-start",
        }}>
            <Text style={{
                color: drink.draftProgress?.badgeText || "#ffa500",
                fontSize: 10,
                fontWeight: "bold",
            }} textTransform="uppercase">
                {drink.draftProgress ? `${drink.draftProgress.label} (${drink.draftProgress.percentage}%)` : "Draft"}
            </Text>
        </View>
    ) : null;

    const cardContent = isGrid ? (
        <Card
            borderWidth={0}
            backgroundColor="$backgroundStrong"
            overflow="hidden"
            elevation={0}
            borderRadius={16}
            width="100%"
            marginBottom={0}
            pressStyle={{ scale: 0.985, opacity: 0.92 }}
            onPress={onPress ? () => onPress(drink) : undefined}
            cursor="pointer"
        >
            {drink.category === "Category" || drink.category === "Menu" ? (
                <YStack width="100%" aspectRatio={1} alignItems="center" justifyContent="center" backgroundColor="$color4" gap="$3">
                    <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: theme.color7?.get() as string, justifyContent: 'center', alignItems: 'center' }}>
                        <IconSymbol name={drink.category === "Menu" ? "note.text" : "tag.fill"} size={26} color={theme.color11?.get() as string} />
                    </View>
                </YStack>
            ) : (
                <Image
                    source={getImage(drink)}
                    style={{ width: "100%", aspectRatio: 1, backgroundColor: theme.color5?.get() as string }}
                    contentFit="cover"
                    transition={400}
                />
            )}
            <YStack paddingHorizontal="$3" paddingTop="$3" paddingBottom="$4" gap="$1.5">
                <H4
                    color="$color"
                    fontSize={16}
                    fontWeight="600"
                    numberOfLines={1}
                    letterSpacing={-0.2}
                >
                    {capitalize(drink.name)}
                </H4>
                {draftBadge}
                <Paragraph color="$color11" size="$2" numberOfLines={2} opacity={0.85}>
                    {subText}
                </Paragraph>
            </YStack>
        </Card>
    ) : (
        <Card
            borderWidth={drink.category === "Category" || drink.category === "Menu" ? 1 : 0}
            backgroundColor={drink.category === "Category" || drink.category === "Menu" ? "$color4" : "$backgroundStrong"}
            borderColor={drink.category === "Category" || drink.category === "Menu" ? theme.color8?.get() as string : "transparent"}
            overflow="hidden"
            marginBottom="$3"
            elevation="$1"
            borderRadius={20}
            pressStyle={{ scale: 0.98 }}
            onPress={onPress ? () => onPress(drink) : undefined}
        >
            <Card.Header flexDirection="row" padding="$3" minHeight={drink.category === "Category" || drink.category === "Menu" ? 80 : 100} alignItems="center">
                {(drink.category === "Category" || drink.category === "Menu") && (
                    <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: theme.color7?.get() as string, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <IconSymbol name={drink.category === "Menu" ? "note.text" : "tag.fill"} size={24} color={theme.color11?.get() as string} />
                    </View>
                )}
                <YStack flex={1} paddingRight="$3" gap="$1" justifyContent="center">
                    <XStack gap="$2" alignItems="center" flexWrap="wrap">
                        <H4 
                            color="$color" 
                            fontSize={20} 
                            fontWeight="700" 
                            numberOfLines={1}
                            flexShrink={1}
                        >
                            {capitalize(drink.name)}
                        </H4>
                        {draftBadge}
                    </XStack>
                    <Paragraph color="$color11" size="$3" numberOfLines={2}>
                        {subText}
                    </Paragraph>
                </YStack>
                {drink.category !== "Category" && drink.category !== "Menu" && (
                    <Image
                        source={getImage(drink)}
                        style={{ width: 76, height: 76, borderRadius: 18, backgroundColor: theme.color5?.get() as string }}
                        contentFit="cover"
                        transition={500}
                        onError={() => {
                            // Silent fallback
                        }}
                    />
                )}
                {(drink.category === "Category" || drink.category === "Menu") && (
                    <IconSymbol name="chevron.right" size={24} color={theme.color8?.get() as string} />
                )}
            </Card.Header>
        </Card>
    );

    const linked = onPress ? (
        cardContent
    ) : drink.category === "Category" ? (
        <TouchableOpacity onPress={() => onCategoryPress?.(drink.id.replace("category-", ""), drink.name)} activeOpacity={0.8}>
            {cardContent}
        </TouchableOpacity>
    ) : drink.category === "Menu" ? (
        <Link href="/(tabs)/menus" asChild>
            {cardContent}
        </Link>
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
    );

    // ponytail: swipe gestures are mobile-only; desktop uses click-through
    if (isGrid) {
        return linked;
    }

    return (
        <Swipeable
            ref={(ref) => { swipeableRef = ref; }}
            renderRightActions={renderRightActions}
            friction={2}
            rightThreshold={40}
        >
            {linked}
        </Swipeable>
    );
});

export function SearchList({
    title,
    items,
    headerButtons,
    initialSearchQuery = "",
    hideHeader = false,
    isModal = false,
    onDrinkPress,
    onBackPress,
    onCreateNewPress,
    createNewText,
}: SearchListProps) {
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { width: windowWidth } = useWindowDimensions();
    const [containerWidth, setContainerWidth] = useState(0);
    // Prefer measured panel; before layout, subtract default sidebar so first paint doesn't overflow
    const layoutWidth = containerWidth > 0
        ? containerWidth
        : Math.max(0, windowWidth - WEB_SIDEBAR_WIDTH);
    const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
    const allCategories = ["Menus", "Cocktails", "Beers", "Wines", "Ingredients"];
    const [activeFilters, setActiveFilters] = useState<string[]>(allCategories);
    const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
    const [showFavesOnly, setShowFavesOnly] = useState(false);
    const [activeChips, setActiveChips] = useState<SearchChip[]>([]);
    const flatListRef = useRef<FlatList>(null);
    const { toggleFavorite, isFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();
    const { data: dropdowns } = useDropdowns();
    const setSelectedMenuId = useAppStore((s) => s.setSelectedMenuId);

    const alphabetVisible = !searchQuery && activeChips.length === 0;
    const alphabetReserve = alphabetVisible ? ALPHA_SCROLLER_WIDTH : 0;
    const usableWidth = Math.max(0, layoutWidth - alphabetReserve);
    const numColumns = getGridColumns(usableWidth);
    const isGrid = numColumns > 1;
    const gridItemWidth = isGrid
        ? (usableWidth - GRID_PAD_H * 2 - GRID_GAP * (numColumns - 1)) / numColumns
        : undefined;

    const emptyStateQuery = useMemo(() => {
        return searchQuery || activeChips.filter(c => c.type === "Search").map(c => c.label.replace(/"/g, '')).join(" ") || "";
    }, [searchQuery, activeChips]);

    const emptyStateButtonText = useMemo(() => {
        return emptyStateQuery 
            ? `${createNewText || "Create New"} "${emptyStateQuery}"`
            : (createNewText || "Create New");
    }, [emptyStateQuery, createNewText]);

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
                 if (f === "Menus") return "Menu";
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
            const rank = (c?: SearchItem["category"]) =>
                c === "Category" ? 0 : c === "Menu" ? 1 : 2;
            const diff = rank(a.category) - rank(b.category);
            if (diff !== 0) return diff;
            return a.name.localeCompare(b.name);
        });
    }, [items, searchQuery, activeFilters, allCategories, activeChips, showFavesOnly, isFavorite, dropdowns?.categories]);

    const suggestions = useMemo(() => {
        if (!searchQuery) return [];
        const query = searchQuery.toLowerCase();
        const sugs: SearchChip[] = [];

        const queryTrimmed = searchQuery.trim();
        if (onCreateNewPress && queryTrimmed) {
            const hasExactMatch = items.some(
                item => item.name.toLowerCase() === queryTrimmed.toLowerCase()
            );
            if (!hasExactMatch) {
                sugs.push({ id: `create-${queryTrimmed}`, label: `Create "${queryTrimmed}"`, type: "Create" });
            }
        }

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
        
        // Only show search chip suggestion if there is actually something in the list matching the query
        const queryLower = queryTrimmed.toLowerCase();
        const hasAnyMatches = items.some(
            c => c.name.toLowerCase().includes(queryLower) ||
                 (c.recipes?.some(r => r.ingredient?.name?.toLowerCase().includes(queryLower))) ||
                 (c.description?.toLowerCase().includes(queryLower))
        );

        if (hasAnyMatches) {
            const existingTextSearch = sugs.find(s => s.type === "Search");
            if (!existingTextSearch) {
                sugs.push({ id: `text-${query}`, label: `"${searchQuery}"`, type: "Search" });
            }
        }

        return sugs;
    }, [searchQuery, dropdowns, items, onCreateNewPress]);

    type ListRow = { type: "row"; id: string; items: SearchItem[] };
    type ListHeader = { type: "header"; letter: string; id: string };
    type ListEntry = SearchItem | ListHeader | ListRow;

    // Grid: chunk into rows (numColumns is flaky on RN web). List: A–Z headers.
    const listData = useMemo(() => {
        if (isGrid) {
            const rows: ListRow[] = [];
            for (let i = 0; i < filteredDrinks.length; i += numColumns) {
                rows.push({
                    type: "row",
                    id: `row-${i}`,
                    items: filteredDrinks.slice(i, i + numColumns),
                });
            }
            return rows as ListEntry[];
        }

        const data: ListEntry[] = [];
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
    }, [filteredDrinks, isGrid, numColumns]);

    const handleScrollToLetter = useCallback((letter: string) => {
        const index = listData.findIndex((item) => {
            if ("type" in item && item.type === "row") {
                return item.items.some((drink) => {
                    let first = drink.name.charAt(0).toUpperCase();
                    if (/[0-9]/.test(first)) first = "#";
                    return first === letter;
                });
            }
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
                                <IconSymbol name={isModal ? "chevron.down" : "chevron.left"} size={24} color={theme.color?.get() as string} />
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
                            placeholder="Search drinks..."
                            onFilterPress={() => setIsFilterModalVisible(true)}
                            chips={activeChips}
                            onRemoveChip={(chipId) => {
                                setActiveChips(prev => prev.filter(c => c.id !== chipId));
                            }}
                            suggestions={suggestions}
                            onSuggestionPress={(sug) => {
                                if (sug.type === "Create") {
                                    onCreateNewPress?.(sug.id.replace("create-", ""));
                                    return;
                                }
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

    const handleCategoryPress = useCallback((id: string, name: string) => {
        setActiveChips(prev => {
            if (prev.find(c => c.id === `category-${id}`)) return prev;
            return [...prev, { id: `category-${id}`, label: name, type: "Category" }];
        });
        setSearchQuery("");
    }, []);

    const openItem = useCallback((drink: SearchItem) => {
        if (drink.category === "Menu") {
            setSelectedMenuId(drink.id.replace("menu-", ""));
            router.push("/(tabs)/menus" as any);
        } else if (drink.category === "Beer") {
            router.push(`/beer/${drink.id}` as any);
        } else if (drink.category === "Wine") {
            router.push(`/wine/${drink.id}` as any);
        } else if (drink.category === "Ingredient") {
            router.push(`/ingredient/${drink.id}` as any);
        } else if (drink.category === "Category") {
            handleCategoryPress(drink.id.replace("category-", ""), drink.name);
        } else {
            router.push(`/cocktail/${drink.id}` as any);
        }
        onDrinkPress?.(drink);
    }, [onDrinkPress, router, setSelectedMenuId, handleCategoryPress]);

    const renderDrinkCard = useCallback((drink: SearchItem, layout: "list" | "grid") => (
        <SearchItemCard
            drink={drink}
            isFav={isFavorite(drink.id)}
            inStudy={isInStudyPile(drink.id)}
            onToggleFavorite={handleToggleFavorite}
            onToggleStudyPile={handleToggleStudyPile}
            onPress={drink.category === "Menu" || onDrinkPress ? openItem : undefined}
            layout={layout}
            onCategoryPress={handleCategoryPress}
        />
    ), [isFavorite, isInStudyPile, handleToggleFavorite, handleToggleStudyPile, onDrinkPress, openItem, handleCategoryPress]);

    const renderItem = useCallback(({ item }: { item: ListEntry }) => {
        if ("type" in item && item.type === "header") {
            return <SectionHeader letter={item.letter} />;
        }

        if ("type" in item && item.type === "row") {
            return (
                <View style={styles.gridRow}>
                    {item.items.map((drink) => (
                        <View key={drink.id} style={{ width: gridItemWidth }}>
                            {renderDrinkCard(drink, "grid")}
                        </View>
                    ))}
                </View>
            );
        }

        return renderDrinkCard(item as SearchItem, "list");
    }, [gridItemWidth, renderDrinkCard]);

    return (
        <YStack
            style={styles.container}
            backgroundColor="$background"
            onLayout={(e) => {
                const next = e.nativeEvent.layout.width;
                setContainerWidth((prev) => (prev === next ? prev : next));
            }}
        >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'transparent' }} pointerEvents="box-none">
                {renderHeader()}
            </View>
            <View style={styles.contentContainer}>
                <FlatList
                    key={`search-${isGrid ? numColumns : "list"}`}
                    ref={flatListRef}
                    data={listData}
                    keyExtractor={(item) => {
                        if ("type" in item) return item.id;
                        return item.id;
                    }}
                    contentContainerStyle={[
                        styles.listContent,
                        isGrid && {
                            paddingLeft: GRID_PAD_H,
                            paddingRight: GRID_PAD_H + alphabetReserve,
                        },
                        { 
                            paddingTop: (hideHeader ? (isModal ? 20 : insets.top + 4) : (isModal ? 60 : insets.top + 50)) + 76, 
                            paddingBottom: 100 + insets.bottom,
                        }
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    onViewableItemsChanged={isGrid ? undefined : onViewableItemsChanged}
                    viewabilityConfig={{ itemVisiblePercentThreshold: 10 }}
                    onScrollToIndexFailed={(info) => {
                        flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
                    }}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <YStack padding="$4" alignItems="center" gap="$4" marginTop="$8">
                            <IconSymbol name="magnifyingglass" size={48} color={theme.color11?.get() as string} />
                            <H4 color="$color11" textAlign="center">No results found</H4>
                            {onCreateNewPress && (
                                <Button 
                                    marginTop="$4" 
                                    backgroundColor="$color8" 
                                    pressStyle={{ scale: 0.97 }}
                                    onPress={() => {
                                        onCreateNewPress(emptyStateQuery);
                                    }}
                                >
                                    <Text color="$backgroundStrong" fontWeight="700">
                                        {emptyStateButtonText}
                                    </Text>
                                </Button>
                            )}
                        </YStack>
                    }
                />
            {alphabetVisible && (
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


