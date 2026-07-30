import { SearchItem, SearchList } from "@/components/SearchList";
import { CustomIcon } from "@/components/ui/CustomIcons";
import { GlasswareIcon } from "@/components/ui/GlasswareIcon";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBeers } from "@/hooks/useBeers";
import { useCocktails } from "@/hooks/useCocktails";
import { useWines } from "@/hooks/useWines";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme, XStack } from "tamagui";
import { useRouter } from "expo-router";
import { useAppStore } from "@/store/useAppStore";
import { useDrafts } from "@/hooks/useDrafts";
import { useDropdowns } from "@/hooks/useDropdowns";
import { capitalize } from "@/lib/stringUtils";
import { calculateDraftProgress } from "@/lib/draftProgress";
import { openDraftInCreator } from "@/store/useCreatorNavStore";

const DRAFT_AMBER = "#E5A93B";

const drinkThumbStyles = StyleSheet.create({
    drinkThumb: {
        width: 52,
        height: 52,
        borderRadius: 12,
    },
    drinkThumbPlaceholder: {
        justifyContent: "center",
        alignItems: "center",
    },
});

function getDrinkPhotoSource(item: SearchItem) {
    if (item.image) return item.image;
    if (item.item_images?.[0]?.images?.url) return { uri: item.item_images[0].images.url };
    return null;
}

function inferDrinkCategory(id: string, category?: SearchItem["category"]): SearchItem["category"] {
    if (category === "Beer" || category === "Wine" || category === "Cocktail") return category;
    if (id.startsWith("beer-")) return "Beer";
    if (id.startsWith("wine-")) return "Wine";
    return "Cocktail";
}

function resolveMenuDrink(cocktailId: string, allDrinks: SearchItem[]): SearchItem {
    return allDrinks.find((x) => x.id === cocktailId) ?? {
        id: cocktailId,
        name: "Unknown Drink",
        category: inferDrinkCategory(cocktailId),
    };
}

function DrinkThumb({
    item,
    dropdowns,
    theme,
    isDark,
}: {
    item: SearchItem;
    dropdowns: any;
    theme: ReturnType<typeof useTheme>;
    isDark: boolean;
}) {
    const photo = getDrinkPhotoSource(item);
    const thumbBg = theme.color5?.get() as string;
    const placeholderBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
    const iconColor = theme.color11?.get() as string;

    if (photo) {
        return (
            <Image
                source={photo}
                style={[drinkThumbStyles.drinkThumb, { backgroundColor: thumbBg }]}
                contentFit="cover"
                transition={300}
            />
        );
    }

    const id = item.id ?? "";
    const category = inferDrinkCategory(id, item.category);
    const glassware = dropdowns?.glassware?.find((g: any) => g.id === item.glassware_id);

    return (
        <View style={[drinkThumbStyles.drinkThumb, drinkThumbStyles.drinkThumbPlaceholder, { backgroundColor: placeholderBg }]}>
            {category === "Beer" ? (
                <IconSymbol name="mug.fill" size={24} color={iconColor} />
            ) : category === "Wine" ? (
                <IconSymbol name="wineglass.fill" size={22} color={iconColor} />
            ) : glassware ? (
                <GlasswareIcon
                    name={glassware.name}
                    iconKey={glassware.icon_key}
                    iconUrl={glassware.icon_url}
                    size={26}
                    color={iconColor}
                />
            ) : (
                <CustomIcon name="TabDrinks" size={26} color={iconColor} />
            )}
        </View>
    );
}

interface Props {
    sections: any[];
    selections: Record<string, string[]>;
    setSelections: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
    onNext?: () => void;
    barId?: string | null;
    menuDraftId?: string | null;
    embedded?: boolean;
    onCreateDrinkPress?: (params: {
        query: string;
        barId: string;
        menuDraftId?: string;
        menuSectionId?: string;
    }) => void;
    onOpenDrink?: (drink: SearchItem) => void;
}

export const Step4Drinks = ({ sections, selections, setSelections, barId, menuDraftId, embedded, onCreateDrinkPress, onOpenDrink }: Props) => {
    const router = useRouter();
    const theme = useTheme();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme];
    const isDark = colorScheme === "dark";
    const [allDrinks, setAllDrinks] = useState<SearchItem[]>([]);
    
    // Bottom Sheet State
    const [showPicker, setShowPicker] = useState(false);
    const [pickingForSection, setPickingForSection] = useState<string | null>(null);

    const { recentlyCreatedItem, setRecentlyCreatedItem } = useAppStore();
    const { drafts } = useDrafts();
    const { data: dropdowns } = useDropdowns();

    useEffect(() => {
        if (recentlyCreatedItem?.type === 'cocktail' && pickingForSection) {
            handleAddCocktail(recentlyCreatedItem.id);
            setRecentlyCreatedItem(null);
        }
    }, [recentlyCreatedItem, pickingForSection]);

    const { data: cocktailsData } = useCocktails();
    const { data: beersData } = useBeers();
    const { data: winesData } = useWines();

    useEffect(() => {
        if (!cocktailsData && !beersData && !winesData && !drafts) return;

        const mappedCocktails: SearchItem[] = (cocktailsData || []).map((c: any) => ({
            id: c.id,
            name: capitalize(c.name),
            description: c.description,
            category: "Cocktail",
            recipes: c.recipes,
            item_images: c.item_images,
            glassware_id: c.glassware_id,
        }));

        const mappedBeers: SearchItem[] = (beersData || []).map((b: any) => ({
            id: `beer-${b.id}`,
            name: capitalize(b.name),
            description: b.description,
            category: "Beer",
            price: b.price,
            image: b.item_images?.[0]?.images?.url ? { uri: b.item_images[0].images.url } : undefined
        }));

        const mappedWines: SearchItem[] = (winesData || []).map((w: any) => ({
            id: `wine-${w.id}`,
            name: capitalize(w.name),
            description: w.description,
            category: "Wine",
            price: w.price,
            image: w.item_images?.[0]?.images?.url ? { uri: w.item_images[0].images.url } : undefined
        }));

        const draftCocktails: SearchItem[] = drafts
            .filter((d: any) => d.entity_type === 'cocktail')
            .map((d: any) => ({
                id: d.id,
                name: capitalize(d.draft_data?.name || "Untitled Cocktail Draft"),
                description: d.draft_data?.description,
                category: "Cocktail",
                isDraft: true,
                draftProgress: calculateDraftProgress(d, drafts, dropdowns),
                recipes: d.draft_data?.recipeItems?.map((ri: any) => ({
                    ingredient_item_id: ri.ingredient_id,
                    ingredient: {
                        name: capitalize(ri.name || "Unknown"),
                    }
                })) || [],
                image: d.draft_data?.localImages?.[0]?.url ? { uri: d.draft_data.localImages[0].url } : undefined,
                glassware_id: d.draft_data?.glasswareId || d.draft_data?.glassware_id || null,
            }));

        const draftBeers: SearchItem[] = drafts
            .filter((d: any) => d.entity_type === 'beer')
            .map((d: any) => ({
                id: `beer-${d.id}`,
                name: capitalize(d.draft_data?.name || "Untitled Beer Draft"),
                description: d.draft_data?.description,
                category: "Beer",
                isDraft: true,
                draftProgress: calculateDraftProgress(d, drafts, dropdowns),
                price: d.draft_data?.price,
                image: d.draft_data?.localImages?.[0]?.url ? { uri: d.draft_data.localImages[0].url } : undefined
            }));

        const draftWines: SearchItem[] = drafts
            .filter((d: any) => d.entity_type === 'wine')
            .map((d: any) => ({
                id: `wine-${d.id}`,
                name: capitalize(d.draft_data?.name || "Untitled Wine Draft"),
                description: d.draft_data?.description,
                category: "Wine",
                isDraft: true,
                draftProgress: calculateDraftProgress(d, drafts, dropdowns),
                price: d.draft_data?.price,
                image: d.draft_data?.localImages?.[0]?.url ? { uri: d.draft_data.localImages[0].url } : undefined
            }));

        setAllDrinks([
            ...mappedCocktails, 
            ...mappedBeers, 
            ...mappedWines,
            ...draftCocktails,
            ...draftBeers,
            ...draftWines
        ]);
    }, [cocktailsData, beersData, winesData, drafts, dropdowns]);

    const handleAddCocktail = (cocktailId: string) => {
        if (!pickingForSection) return;
        
        const currentSelected = selections[pickingForSection] || [];
        const sectionDef = sections.find(s => s.id === pickingForSection);
        
        if (sectionDef && sectionDef.max_items && currentSelected.length >= sectionDef.max_items) {
            Alert.alert("Section Full", `You cannot add more than ${sectionDef.max_items} drinks to this section.`);
            return;
        }

        if (currentSelected.includes(cocktailId)) {
            Alert.alert("Already Added", "This cocktail is already in this section.");
            return;
        }

        setSelections(prev => ({
            ...prev,
            [pickingForSection]: [...currentSelected, cocktailId]
        }));
        
        setShowPicker(false);
        setPickingForSection(null);
    };

    const handleRemoveCocktail = (sectionId: string, cocktailId: string) => {
        setSelections(prev => ({
            ...prev,
            [sectionId]: (prev[sectionId] || []).filter(id => id !== cocktailId)
        }));
    };

    // ponytail: creator passes onOpenDrink to stack; otherwise same routes as CommandSearch
    const openDrink = (drink: SearchItem) => {
        if (onOpenDrink) {
            onOpenDrink(drink);
            return;
        }
        if (drink.isDraft) {
            const draftId = drink.id.replace(/^(beer|wine)-/, "");
            const entityType =
                drink.category === "Beer" ? "beer" : drink.category === "Wine" ? "wine" : "cocktail";
            openDraftInCreator(
                { id: draftId, entity_type: entityType, draft_data: { name: drink.name } },
                (href) => router.push(href as any)
            );
            return;
        }
        const category = inferDrinkCategory(drink.id, drink.category);
        if (category === "Beer") router.push(`/beer/${drink.id.replace(/^beer-/, "")}` as any);
        else if (category === "Wine") router.push(`/wine/${drink.id.replace(/^wine-/, "")}` as any);
        else router.push(`/cocktail/${drink.id}` as any);
    };

    const styles = useMemo(
        () =>
            StyleSheet.create({
                container: { flex: 1 },
                header: { paddingHorizontal: 20, marginBottom: 20 },
                title: { fontSize: 34, fontWeight: "bold", color: colors.text, marginBottom: 8 },
                subtitle: { fontSize: 16, color: colors.icon },
                scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
                sectionContainer: { marginBottom: 24 },
                sectionHeaderRow: {
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    marginBottom: 12,
                    paddingHorizontal: 4,
                },
                sectionTitle: { fontSize: 22, fontWeight: "bold", color: colors.text },
                sectionCount: { fontSize: 14, color: colors.icon, marginBottom: 4 },
                cocktailRow: {
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                    padding: 12,
                    borderRadius: 15,
                    marginBottom: 8,
                },
                cocktailName: { fontSize: 17, color: colors.text, fontWeight: "700", flexShrink: 1 },
                draftPct: { color: DRAFT_AMBER, fontSize: 11, fontWeight: "bold" },
                addDrinkBtn: {
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 16,
                    borderRadius: 15,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)",
                    gap: 8,
                    marginTop: 4,
                },
                addDrinkText: { color: colors.icon, fontSize: 16, fontWeight: "600" },
            }),
        [colors, isDark],
    );

    const content = (
            <>
                {sections.map((sec) => {
                    const count = (selections[sec.id] || []).length;
                    const isFulfilled = count >= (sec.min_items || 1);
                    const isFull = sec.max_items ? count >= sec.max_items : false;

                    return (
                        <View key={sec.id} style={styles.sectionContainer}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>{sec.name}</Text>
                                <Text style={[styles.sectionCount, isFulfilled && { color: colors.tint }]}>
                                    {count} / {sec.max_items || '∞'} 
                                    {sec.min_items && sec.min_items > 0 ? ` (Min ${sec.min_items})` : ''}
                                </Text>
                            </View>

                            {selections[sec.id]?.map((cocktailId) => {
                                const drink = resolveMenuDrink(cocktailId, allDrinks);
                                return (
                                    <TouchableOpacity
                                        key={cocktailId}
                                        style={styles.cocktailRow}
                                        onPress={() => openDrink(drink)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Open ${capitalize(drink.name)}`}
                                    >
                                        <XStack flex={1} alignItems="center" gap="$3" marginRight="$2">
                                            <DrinkThumb
                                                item={drink}
                                                dropdowns={dropdowns}
                                                theme={theme}
                                                isDark={isDark}
                                            />
                                            <XStack alignItems="center" gap="$2" flex={1} flexWrap="wrap">
                                                <Text style={styles.cocktailName} numberOfLines={1}>
                                                    {capitalize(drink.name)}
                                                </Text>
                                                {drink.isDraft && (
                                                    <Text style={styles.draftPct}>
                                                        {drink.draftProgress?.percentage ?? 0}%
                                                    </Text>
                                                )}
                                            </XStack>
                                        </XStack>
                                        <TouchableOpacity
                                            onPress={() => handleRemoveCocktail(sec.id, cocktailId)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <IconSymbol name="minus.circle.fill" size={24} color="#ff4444" />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                );
                            })}

                            {!isFull && (
                                <TouchableOpacity 
                                    style={styles.addDrinkBtn}
                                    onPress={() => {
                                        setPickingForSection(sec.id);
                                        setShowPicker(true);
                                    }}
                                >
                                    <IconSymbol name="plus" size={20} color={colors.icon} />
                                    <Text style={styles.addDrinkText}>Add Drink</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                })}
            </>
    );

    return (
        <View style={styles.container}>
            {!embedded && (
                <View style={styles.header}>
                    <Text style={styles.title}>Build your Menu</Text>
                    <Text style={styles.subtitle}>Add drinks to meet the template requirements.</Text>
                </View>
            )}

            {embedded ? content : (
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {content}
                </ScrollView>
            )}

            {/* Drink Selection Native Modal */}
            <Modal
                visible={showPicker}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => {
                    setShowPicker(false);
                    setPickingForSection(null);
                }}
            >
                <SearchList
                    title={`Add ${sections.find(s => s.id === pickingForSection)?.name || "Drink"}`}
                    items={allDrinks}
                    isModal={true}
                    onDrinkPress={(drink) => handleAddCocktail(drink.id)}
                    onBackPress={() => {
                        setShowPicker(false);
                        setPickingForSection(null);
                    }}
                    onCreateNewPress={(query) => {
                        setShowPicker(false);
                        const params = {
                            query,
                            barId: barId || "",
                            menuDraftId: menuDraftId || undefined,
                            menuSectionId: pickingForSection || undefined,
                        };
                        setTimeout(() => {
                            if (onCreateDrinkPress) {
                                onCreateDrinkPress(params);
                            } else {
                                router.push({
                                    pathname: "/add-cocktail",
                                    params: {
                                        name: query,
                                        barId: params.barId,
                                        menuDraftId: params.menuDraftId || "",
                                        menuSectionId: params.menuSectionId || "",
                                    },
                                });
                            }
                        }, 150);
                    }}
                    createNewText="Create cocktail"
                />
            </Modal>
        </View>
    );
};
