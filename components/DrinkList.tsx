import { AlphabetScroller } from "@/components/AlphabetScroller";
import { BottomSearchBar } from "@/components/BottomSearchBar";
import { FilterModal } from "@/components/FilterModal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
import { memo, ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View, ViewToken } from "react-native";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, H1, H4, Paragraph, Text, useTheme, XStack, YStack } from "tamagui";

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
    onDrinkPress?: (drink: DrinkListItem) => void;
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

const DrinkCard = memo(function DrinkCard({
    drink,
    isFav,
    inStudy,
    onToggleFavorite,
    onToggleStudyPile,
    onPress
}: {
    drink: DrinkListItem;
    isFav: boolean;
    inStudy: boolean;
    onToggleFavorite: (id: string, swipeable: Swipeable) => void;
    onToggleStudyPile: (id: string, swipeable: Swipeable) => void;
    onPress?: (drink: DrinkListItem) => void;
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

    const theme = useTheme();

    const cardContent = (
        <Card
            borderWidth={0}
            backgroundColor="$backgroundStrong"
            borderColor="transparent"
            overflow="hidden"
            marginBottom="$3"
            elevation="$1"
            borderRadius={20}
            disabled={!onPress && drink.category !== "Cocktail" && drink.category != null}
            pressStyle={{ scale: 0.98 }}
            onPress={onPress ? () => onPress(drink) : undefined}
        >
            <Card.Header flexDirection="row" padding="$3" minHeight={100} alignItems="center">
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
                <Image
                    source={getImage(drink)}
                    style={{ width: 76, height: 76, borderRadius: 18, backgroundColor: theme.color5?.get() as string }}
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
            {onPress ? (
                cardContent
            ) : drink.category === "Beer" ? (
                <Link href={`/beer/${drink.id}`} asChild>
                    {cardContent}
                </Link>
            ) : drink.category === "Wine" ? (
                <Link href={`/wine/${drink.id}`} asChild>
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

export function DrinkList({ title, drinks, headerButtons, initialSearchQuery = "", hideHeader = false, isModal = false, onDrinkPress, onBackPress }: DrinkListProps) {
    const router = useRouter();
    const theme = useTheme();
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
                        <BottomSearchBar
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder={`Search drinks...`}
                            onFilterPress={() => setIsFilterModalVisible(true)}
                        />
                    </View>
                </View>
            </TouchableWithoutFeedback>
        );
    }, [hideHeader, isModal, insets.top, onBackPress, router, theme.color, title, headerButtons, searchQuery, setSearchQuery, setIsFilterModalVisible]);
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
                onPress={onDrinkPress}
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


