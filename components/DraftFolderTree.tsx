import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { Text, XStack, YStack, useTheme, ScrollView } from "tamagui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBars } from "@/hooks/useBars";
import { useDropdowns } from "@/hooks/useDropdowns";
import { calculateDraftProgress } from "@/lib/draftProgress";
import { capitalize } from "@/lib/stringUtils";

export type DraftNodeType = 
    | "bar" 
    | "folder" 
    | "menu_draft" 
    | "drink_draft" 
    | "ingredient_draft" 
    | "published_drink" 
    | "published_ingredient";

export interface SelectedDraftNode {
    type: DraftNodeType;
    id: string;
    name: string;
}

interface DraftFolderTreeProps {
    drafts: any[];
    selectedNode: SelectedDraftNode | null;
    onNodeSelect: (node: SelectedDraftNode) => void;
}

export function DraftFolderTree({ drafts, selectedNode, onNodeSelect }: DraftFolderTreeProps) {
    const theme = useTheme();
    const { data: userBars, isLoading: loadingBars } = useBars();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();

    const bars = userBars || [];
    const isLoading = loadingBars || loadingDropdowns;

    if (isLoading) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center">
                <ActivityIndicator size="small" color={theme.color8?.get() as string} />
                <Text color="$color11" fontSize={12} marginTop="$2">Loading drafts tree...</Text>
            </YStack>
        );
    }

    // 1. Group drafts by bar_id
    const draftsByBar: Record<string, any[]> = {};
    const personalDrafts: any[] = [];

    drafts.forEach((draft) => {
        const barId = draft.bar_id || "personal";
        if (barId === "personal") {
            personalDrafts.push(draft);
        } else {
            if (!draftsByBar[barId]) {
                draftsByBar[barId] = [];
            }
            draftsByBar[barId].push(draft);
        }
    });

    // 2. Identify referenced/standalone drafts
    const referencedDrinks = new Set<string>();
    const referencedIngredients = new Set<string>();

    drafts.forEach((d: any) => {
        if (d.entity_type === "menu" && d.draft_data?.selections) {
            Object.values(d.draft_data.selections).forEach((ids: any) => {
                if (Array.isArray(ids)) {
                    ids.forEach(id => referencedDrinks.add(id));
                }
            });
        }
        if ((d.entity_type === "cocktail" || d.entity_type === "ingredient") && d.draft_data?.recipeItems) {
            d.draft_data.recipeItems.forEach((r: any) => {
                if (r.ingredient_id) referencedIngredients.add(r.ingredient_id);
            });
        }
    });

    return (
        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
            <YStack gap="$1.5" padding="$3">
                {/* Personal Drafts (Virtual Bar Node) */}
                {(personalDrafts.length > 0) && (
                    <BarDraftNode 
                        id="personal"
                        name="Personal Drafts"
                        drafts={personalDrafts}
                        referencedDrinks={referencedDrinks}
                        referencedIngredients={referencedIngredients}
                        allDrafts={drafts}
                        dropdowns={dropdowns}
                        selectedNode={selectedNode}
                        onNodeSelect={onNodeSelect}
                        isPersonal={true}
                    />
                )}

                {/* Active Bars with Drafts */}
                {bars.map((barMapping: any) => {
                    const bar = barMapping.bars;
                    if (!bar) return null;
                    const barId = barMapping.bar_id;
                    const barDrafts = draftsByBar[barId] || [];

                    if (barDrafts.length === 0) return null; // Only show bars that have drafts

                    const barName = (Array.isArray(bar) ? bar[0]?.name : (bar as any)?.name) || "Unknown Bar";

                    return (
                        <BarDraftNode 
                            key={barId}
                            id={barId}
                            name={barName}
                            drafts={barDrafts}
                            referencedDrinks={referencedDrinks}
                            referencedIngredients={referencedIngredients}
                            allDrafts={drafts}
                            dropdowns={dropdowns}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    );
                })}
            </YStack>
        </ScrollView>
    );
}

/* ==========================================================================
   Bar Draft Node
   ========================================================================== */
interface BarDraftNodeProps {
    id: string;
    name: string;
    drafts: any[];
    referencedDrinks: Set<string>;
    referencedIngredients: Set<string>;
    allDrafts: any[];
    dropdowns: any;
    selectedNode: SelectedDraftNode | null;
    onNodeSelect: (node: SelectedDraftNode) => void;
    isPersonal?: boolean;
}

function BarDraftNode({ 
    id, 
    name, 
    drafts, 
    referencedDrinks, 
    referencedIngredients, 
    allDrafts,
    dropdowns,
    selectedNode, 
    onNodeSelect, 
    isPersonal = false 
}: BarDraftNodeProps) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(true);

    const menuDrafts = drafts.filter((d: any) => d.entity_type === "menu");
    const drinkDrafts = drafts.filter((d: any) => 
        (d.entity_type === "cocktail" || d.entity_type === "beer" || d.entity_type === "wine") &&
        !referencedDrinks.has(d.entity_type === "cocktail" ? d.id : `${d.entity_type}-${d.id}`)
    );
    const ingredientDrafts = drafts.filter((d: any) => 
        d.entity_type === "ingredient" && !referencedIngredients.has(d.id)
    );

    return (
        <YStack>
            <XStack 
                alignItems="center" 
                paddingVertical="$2" 
                paddingHorizontal="$2"
                borderRadius={6}
                gap="$2"
                hoverStyle={{ backgroundColor: "rgba(255,255,255,0.03)" }}
            >
                <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.chevronTouch}>
                    <IconSymbol 
                        name={expanded ? "chevron.down" : "chevron.right"} 
                        size={12} 
                        color={theme.color11?.get() as string} 
                    />
                </TouchableOpacity>

                <XStack alignItems="center" gap="$2" style={styles.contentTouch}>
                    <IconSymbol 
                        name={isPersonal ? "person.circle.fill" : "building.2.fill"} 
                        size={16} 
                        color={theme.color11?.get() as string} 
                    />
                    <Text fontSize={13} fontWeight="bold" color="$color">
                        {name}
                    </Text>
                </XStack>
            </XStack>

            {expanded && (
                <YStack style={styles.childContainer}>
                    {/* Menu Drafts */}
                    {menuDrafts.map((menuDraft) => (
                        <MenuDraftTreeNode 
                            key={menuDraft.id}
                            menuDraft={menuDraft}
                            allDrafts={allDrafts}
                            dropdowns={dropdowns}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    ))}

                    {/* Standalone Drinks */}
                    {drinkDrafts.map((drinkDraft) => (
                        <DrinkDraftTreeNode 
                            key={drinkDraft.id}
                            drinkDraft={drinkDraft}
                            allDrafts={allDrafts}
                            dropdowns={dropdowns}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    ))}

                    {/* Standalone Ingredients */}
                    {ingredientDrafts.map((ingDraft) => (
                        <IngredientDraftTreeNode 
                            key={ingDraft.id}
                            ingredientDraft={ingDraft}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    ))}
                </YStack>
            )}
        </YStack>
    );
}

/* ==========================================================================
   Menu Draft Node
   ========================================================================== */
interface MenuDraftTreeNodeProps {
    menuDraft: any;
    allDrafts: any[];
    dropdowns: any;
    selectedNode: SelectedDraftNode | null;
    onNodeSelect: (node: SelectedDraftNode) => void;
}

function MenuDraftTreeNode({ menuDraft, allDrafts, dropdowns, selectedNode, onNodeSelect }: MenuDraftTreeNodeProps) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);

    const isSelected = selectedNode?.type === "menu_draft" && selectedNode?.id === menuDraft.id;
    const progressInfo = calculateDraftProgress(menuDraft, allDrafts, dropdowns);

    const data = menuDraft.draft_data || {};
    const name = data.name || data.menuName || "Untitled Menu";

    // Resolve template sections and selections
    const templateId = data.selectedTemplateId;
    const sections = dropdowns?.templateSections
        ?.filter((s: any) => s.template_id === templateId)
        ?.sort((a: any, b: any) => a.sort_order - b.sort_order) || [];

    const selections = data.selections || {};

    const hasDrinks = Object.values(selections).some((ids: any) => Array.isArray(ids) && ids.length > 0);

    return (
        <YStack>
            <XStack 
                alignItems="center" 
                paddingVertical="$1.5" 
                paddingHorizontal="$2"
                borderRadius={6}
                backgroundColor={isSelected ? "rgba(0, 122, 255, 0.08)" : "transparent"}
                gap="$2"
                hoverStyle={{ backgroundColor: "rgba(255,255,255,0.03)" }}
            >
                {hasDrinks ? (
                    <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.chevronTouch}>
                        <IconSymbol 
                            name={expanded ? "chevron.down" : "chevron.right"} 
                            size={11} 
                            color={theme.color11?.get() as string} 
                        />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 14 }} />
                )}

                <TouchableOpacity 
                    onPress={() => onNodeSelect({ type: "menu_draft", id: menuDraft.id, name })} 
                    style={styles.contentTouch}
                >
                    <XStack alignItems="center" justifyContent="space-between" flex={1}>
                        <XStack alignItems="center" gap="$2">
                            <IconSymbol 
                                name="folder.fill" 
                                size={15} 
                                color={isSelected ? theme.color8?.get() as string : "#E5A93B"} 
                            />
                            <Text fontSize={13} color={isSelected ? "$color8" : "$color"}>
                                {name}
                            </Text>
                        </XStack>
                        <Text fontSize={10} color={progressInfo.color} fontWeight="bold">
                            {progressInfo.percentage}%
                        </Text>
                    </XStack>
                </TouchableOpacity>
            </XStack>

            {expanded && hasDrinks && (
                <YStack style={styles.childContainer}>
                    {sections.map((section: any) => {
                        const drinkIds = selections[section.id] || [];
                        if (drinkIds.length === 0) return null;

                        return (
                            <YStack key={section.id}>
                                <XStack alignItems="center" gap="$2" paddingLeft="$2" paddingVertical="$1">
                                    <IconSymbol name="tag.fill" size={10} color={theme.color11?.get() as string} style={{ opacity: 0.5 }} />
                                    <Text fontSize={10} fontWeight="700" color="$color11" textTransform="uppercase" letterSpacing={0.5}>
                                        {section.name}
                                    </Text>
                                </XStack>
                                <YStack style={styles.childContainer}>
                                    {drinkIds.map((drinkId: string) => {
                                        let cleanId = drinkId;
                                        let cleanType = "cocktail";
                                        if (drinkId.startsWith("beer-")) {
                                            cleanId = drinkId.replace("beer-", "");
                                            cleanType = "beer";
                                        } else if (drinkId.startsWith("wine-")) {
                                            cleanId = drinkId.replace("wine-", "");
                                            cleanType = "wine";
                                        }

                                        const draftDrink = allDrafts.find((d: any) => d.id === cleanId && d.entity_type === cleanType);

                                        if (draftDrink) {
                                            return (
                                                <DrinkDraftTreeNode 
                                                    key={drinkId}
                                                    drinkDraft={draftDrink}
                                                    allDrafts={allDrafts}
                                                    dropdowns={dropdowns}
                                                    selectedNode={selectedNode}
                                                    onNodeSelect={onNodeSelect}
                                                />
                                            );
                                        } else {
                                            // Published drink
                                            const publishedName = drinkId.startsWith("beer-") 
                                                ? "Published Beer" 
                                                : drinkId.startsWith("wine-") 
                                                    ? "Published Wine" 
                                                    : "Published Cocktail";

                                            return (
                                                <PublishedDrinkTreeNode 
                                                    key={drinkId}
                                                    id={drinkId}
                                                    name={publishedName}
                                                    allDrafts={allDrafts}
                                                    dropdowns={dropdowns}
                                                    selectedNode={selectedNode}
                                                    onNodeSelect={onNodeSelect}
                                                />
                                            );
                                        }
                                    })}
                                </YStack>
                            </YStack>
                        );
                    })}
                </YStack>
            )}
        </YStack>
    );
}

/* ==========================================================================
   Drink Draft Node
   ========================================================================== */
interface DrinkDraftTreeNodeProps {
    drinkDraft: any;
    allDrafts: any[];
    dropdowns: any;
    selectedNode: SelectedDraftNode | null;
    onNodeSelect: (node: SelectedDraftNode) => void;
}

function DrinkDraftTreeNode({ drinkDraft, allDrafts, dropdowns, selectedNode, onNodeSelect }: DrinkDraftTreeNodeProps) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);

    const isSelected = selectedNode?.type === "drink_draft" && selectedNode?.id === drinkDraft.id;
    const progressInfo = calculateDraftProgress(drinkDraft, allDrafts, dropdowns);

    const data = drinkDraft.draft_data || {};
    const name = data.name || `Untitled ${capitalize(drinkDraft.entity_type)}`;

    const recipeItems = data.recipeItems || [];
    const hasIngredients = recipeItems.length > 0;

    const getIcon = () => {
        if (drinkDraft.entity_type === "beer") return "mug.fill";
        if (drinkDraft.entity_type === "wine") return "wineglass.fill";
        return "wineglass";
    };

    return (
        <YStack>
            <XStack 
                alignItems="center" 
                paddingVertical="$1" 
                paddingHorizontal="$2"
                borderRadius={6}
                backgroundColor={isSelected ? "rgba(0, 122, 255, 0.08)" : "transparent"}
                gap="$2"
                hoverStyle={{ backgroundColor: "rgba(255,255,255,0.03)" }}
            >
                {hasIngredients ? (
                    <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.chevronTouch}>
                        <IconSymbol 
                            name={expanded ? "chevron.down" : "chevron.right"} 
                            size={10} 
                            color={theme.color11?.get() as string} 
                        />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 14 }} />
                )}

                <TouchableOpacity 
                    onPress={() => onNodeSelect({ type: "drink_draft", id: drinkDraft.id, name })} 
                    style={styles.contentTouch}
                >
                    <XStack alignItems="center" justifyContent="space-between" flex={1}>
                        <XStack alignItems="center" gap="$2">
                            <IconSymbol name={getIcon() as any} size={13} color={isSelected ? theme.color8?.get() as string : theme.color11?.get() as string} />
                            <Text fontSize={13} color={isSelected ? "$color8" : "$color"}>
                                {name}
                            </Text>
                        </XStack>
                        <Text fontSize={10} color={progressInfo.color} fontWeight="bold">
                            {progressInfo.percentage}%
                        </Text>
                    </XStack>
                </TouchableOpacity>
            </XStack>

            {expanded && hasIngredients && (
                <YStack style={styles.childContainer}>
                    {recipeItems.map((recipe: any, index: number) => {
                        const ingId = recipe.ingredient_id;
                        if (!ingId) return null;

                        const draftIng = allDrafts.find((d: any) => d.id === ingId && d.entity_type === "ingredient");

                        if (draftIng) {
                            return (
                                <IngredientDraftTreeNode 
                                    key={index}
                                    ingredientDraft={draftIng}
                                    selectedNode={selectedNode}
                                    onNodeSelect={onNodeSelect}
                                />
                            );
                        } else {
                            // Published ingredient
                            return (
                                <PublishedIngredientTreeNode 
                                    key={index}
                                    id={ingId}
                                    name={recipe.name || "Published Ingredient"}
                                    selectedNode={selectedNode}
                                    onNodeSelect={onNodeSelect}
                                />
                            );
                        }
                    })}
                </YStack>
            )}
        </YStack>
    );
}

/* ==========================================================================
   Published Drink Node
   ========================================================================== */
interface PublishedDrinkTreeNodeProps {
    id: string;
    name: string;
    allDrafts: any[];
    dropdowns: any;
    selectedNode: SelectedDraftNode | null;
    onNodeSelect: (node: SelectedDraftNode) => void;
}

function PublishedDrinkTreeNode({ id, name, allDrafts, dropdowns, selectedNode, onNodeSelect }: PublishedDrinkTreeNodeProps) {
    const theme = useTheme();
    const isSelected = selectedNode?.type === "published_drink" && selectedNode?.id === id;

    const getIcon = () => {
        if (id.startsWith("beer-")) return "mug.fill";
        if (id.startsWith("wine-")) return "wineglass.fill";
        return "wineglass";
    };

    return (
        <XStack 
            alignItems="center" 
            paddingVertical="$1" 
            paddingHorizontal="$2"
            borderRadius={6}
            backgroundColor={isSelected ? "rgba(0, 122, 255, 0.08)" : "transparent"}
            gap="$2"
            hoverStyle={{ backgroundColor: "rgba(255,255,255,0.03)" }}
        >
            <View style={{ width: 14 }} />

            <TouchableOpacity 
                onPress={() => onNodeSelect({ type: "published_drink", id, name })} 
                style={styles.contentTouch}
            >
                <XStack alignItems="center" gap="$2">
                    <IconSymbol name={getIcon() as any} size={13} color={isSelected ? theme.color8?.get() as string : theme.color11?.get() as string} style={{ opacity: 0.6 }} />
                    <Text fontSize={13} color={isSelected ? "$color8" : "$color"} style={{ opacity: 0.8 }}>
                        {name}
                    </Text>
                </XStack>
            </TouchableOpacity>
        </XStack>
    );
}

/* ==========================================================================
   Ingredient Draft Node
   ========================================================================== */
interface IngredientDraftTreeNodeProps {
    ingredientDraft: any;
    selectedNode: SelectedDraftNode | null;
    onNodeSelect: (node: SelectedDraftNode) => void;
}

function IngredientDraftTreeNode({ ingredientDraft, selectedNode, onNodeSelect }: IngredientDraftTreeNodeProps) {
    const theme = useTheme();
    const isSelected = selectedNode?.type === "ingredient_draft" && selectedNode?.id === ingredientDraft.id;

    const data = ingredientDraft.draft_data || {};
    const name = data.name || "Untitled Ingredient";

    return (
        <XStack 
            alignItems="center" 
            paddingVertical="$1" 
            paddingHorizontal="$2"
            borderRadius={6}
            backgroundColor={isSelected ? "rgba(0, 122, 255, 0.08)" : "transparent"}
            gap="$2"
            hoverStyle={{ backgroundColor: "rgba(255,255,255,0.03)" }}
        >
            <View style={{ width: 14 }} />

            <TouchableOpacity 
                onPress={() => onNodeSelect({ type: "ingredient_draft", id: ingredientDraft.id, name })} 
                style={styles.contentTouch}
            >
                <XStack alignItems="center" gap="$2">
                    <IconSymbol 
                        name="drop.fill" 
                        size={12} 
                        color={isSelected ? theme.color8?.get() as string : theme.color11?.get() as string} 
                    />
                    <Text fontSize={13} color={isSelected ? "$color8" : "$color"}>
                        {name}
                    </Text>
                </XStack>
            </TouchableOpacity>
        </XStack>
    );
}

/* ==========================================================================
   Published Ingredient Node
   ========================================================================== */
interface PublishedIngredientTreeNodeProps {
    id: string;
    name: string;
    selectedNode: SelectedDraftNode | null;
    onNodeSelect: (node: SelectedDraftNode) => void;
}

function PublishedIngredientTreeNode({ id, name, selectedNode, onNodeSelect }: PublishedIngredientTreeNodeProps) {
    const theme = useTheme();
    const isSelected = selectedNode?.type === "published_ingredient" && selectedNode?.id === id;

    return (
        <XStack 
            alignItems="center" 
            paddingVertical="$1" 
            paddingHorizontal="$2"
            borderRadius={6}
            backgroundColor={isSelected ? "rgba(0, 122, 255, 0.08)" : "transparent"}
            gap="$2"
            hoverStyle={{ backgroundColor: "rgba(255,255,255,0.03)" }}
        >
            <View style={{ width: 14 }} />

            <TouchableOpacity 
                onPress={() => onNodeSelect({ type: "published_ingredient", id, name })} 
                style={styles.contentTouch}
            >
                <XStack alignItems="center" gap="$2">
                    <IconSymbol 
                        name="drop.fill" 
                        size={12} 
                        color={isSelected ? theme.color8?.get() as string : theme.color11?.get() as string} 
                        style={{ opacity: 0.6 }}
                    />
                    <Text fontSize={13} color={isSelected ? "$color8" : "$color"} style={{ opacity: 0.8 }}>
                        {name}
                    </Text>
                </XStack>
            </TouchableOpacity>
        </XStack>
    );
}

const styles = StyleSheet.create({
    chevronTouch: {
        width: 14,
        height: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    contentTouch: {
        flex: 1,
        paddingVertical: 4,
    },
    childContainer: {
        paddingLeft: 12,
        borderLeftWidth: 1,
        borderLeftColor: "rgba(255, 255, 255, 0.05)",
        marginLeft: 8,
        marginTop: 2,
        marginBottom: 2,
    },
});
