import { SearchItem, SearchList } from "@/components/SearchList";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useBeers } from "@/hooks/useBeers";
import { useCocktails } from "@/hooks/useCocktails";
import { useWines } from "@/hooks/useWines";
import React, { useEffect, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, XStack } from "tamagui";
import { useRouter } from "expo-router";
import { useAppStore } from "@/store/useAppStore";
import { useDrafts } from "@/hooks/useDrafts";
import { useDropdowns } from "@/hooks/useDropdowns";
import { capitalize } from "@/lib/stringUtils";
import { calculateDraftProgress } from "@/lib/draftProgress";

interface Props {
    sections: any[];
    selections: Record<string, string[]>;
    setSelections: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
    onNext: () => void;
}

export const Step3Drinks = ({ sections, selections, setSelections, onNext }: Props) => {
    const router = useRouter();
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
            item_images: c.item_images
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
                image: d.draft_data?.localImages?.[0]?.url ? { uri: d.draft_data.localImages[0].url } : undefined
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

    const isValid = sections.every(sec => {
        const count = (selections[sec.id] || []).length;
        return count >= (sec.min_items || 1);
    });

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Build your Menu</Text>
                <Text style={styles.subtitle}>Add drinks to meet the template requirements.</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {sections.map((sec) => {
                    const count = (selections[sec.id] || []).length;
                    const isFulfilled = count >= (sec.min_items || 1);
                    const isFull = sec.max_items ? count >= sec.max_items : false;

                    return (
                        <View key={sec.id} style={styles.sectionContainer}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>{sec.name}</Text>
                                <Text style={[styles.sectionCount, isFulfilled && { color: Colors.dark.tint }]}>
                                    {count} / {sec.max_items || '∞'} 
                                    {sec.min_items && sec.min_items > 0 ? ` (Min ${sec.min_items})` : ''}
                                </Text>
                            </View>

                            {selections[sec.id]?.map((cocktailId) => {
                                // Strip potentially prefixed ids if they don't match, though the picker returns the generated IDs. Just find by ID.
                                const c = allDrinks.find(x => x.id === cocktailId) || { name: "Unknown Drink", isDraft: false };
                                return (
                                    <View key={cocktailId} style={styles.cocktailRow}>
                                        <XStack gap="$2" alignItems="center">
                                            <Text style={styles.cocktailName}>{capitalize(c?.name)}</Text>
                                            {c?.isDraft && (
                                                <View style={[styles.draftBadge, c.draftProgress && { backgroundColor: c.draftProgress.badgeBg, borderColor: c.draftProgress.color }]}>
                                                    <Text style={[styles.draftBadgeText, c.draftProgress && { color: c.draftProgress.badgeText }]} textTransform="uppercase">
                                                        {c.draftProgress ? `${c.draftProgress.label} (${c.draftProgress.percentage}%)` : "Draft"}
                                                    </Text>
                                                </View>
                                            )}
                                        </XStack>
                                        <TouchableOpacity 
                                            onPress={() => handleRemoveCocktail(sec.id, cocktailId)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <IconSymbol name="minus.circle.fill" size={24} color="#ff4444" />
                                        </TouchableOpacity>
                                    </View>
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
                                    <IconSymbol name="plus" size={20} color={Colors.dark.icon} />
                                    <Text style={styles.addDrinkText}>Add Drink</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

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
                        router.push({
                            pathname: "/add-cocktail",
                            params: { name: query }
                        });
                    }}
                    createNewText="Create cocktail"
                />
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    title: {
        fontSize: 34,
        fontWeight: "bold",
        color: Colors.dark.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.dark.icon,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    sectionContainer: {
        marginBottom: 24,
    },
    sectionHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    sectionCount: {
        fontSize: 14,
        color: Colors.dark.icon,
        marginBottom: 4,
    },
    cocktailRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.05)",
        padding: 16,
        borderRadius: 15,
        marginBottom: 8,
    },
    cocktailName: {
        fontSize: 20,
        color: Colors.dark.text,
        fontWeight: "700",
    },
    draftBadge: {
        backgroundColor: "rgba(255, 165, 0, 0.15)",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(255, 165, 0, 0.4)",
    },
    draftBadgeText: {
        color: "#ffa500",
        fontSize: 10,
        fontWeight: "bold",
    },
    addDrinkBtn: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        borderRadius: 15,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "rgba(255,255,255,0.2)",
        gap: 8,
        marginTop: 4,
    },
    addDrinkText: {
        color: Colors.dark.icon,
        fontSize: 16,
        fontWeight: "600",
    }
});
