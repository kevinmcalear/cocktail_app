import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { Text, XStack, YStack, useTheme, ScrollView } from "tamagui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBars } from "@/hooks/useBars";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useMenuDetails } from "@/hooks/useMenuDetails";

export type NodeType = "bar" | "menu" | "drink" | "ingredient";

export interface SelectedNode {
    type: NodeType;
    id: string;
    name: string;
}

interface FolderTreeProps {
    selectedNode: SelectedNode | null;
    onNodeSelect: (node: SelectedNode) => void;
}

export function FolderTree({ selectedNode, onNodeSelect }: FolderTreeProps) {
    const theme = useTheme();
    const { data: userBars, isLoading: loadingBars } = useBars();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();

    const bars = userBars || [];
    const menus = dropdowns?.menus || [];

    const isLoading = loadingBars || loadingDropdowns;

    if (isLoading) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center">
                <ActivityIndicator size="small" color={theme.color8?.get() as string} />
                <Text color="$color11" fontSize={12} marginTop="$2">Loading workspace tree...</Text>
            </YStack>
        );
    }

    // Group menus by bar_id
    const menusByBar: Record<string, typeof menus> = {};
    const unassignedMenus: typeof menus = [];

    menus.forEach((menu: any) => {
        if (menu.bar_id) {
            if (!menusByBar[menu.bar_id]) {
                menusByBar[menu.bar_id] = [];
            }
            menusByBar[menu.bar_id].push(menu);
        } else {
            unassignedMenus.push(menu);
        }
    });

    return (
        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
            <YStack gap="$1.5" padding="$3">
                {/* Active Bars */}
                {bars.map((barMapping: any) => {
                    const bar = barMapping.bars;
                    if (!bar) return null;
                    const barId = barMapping.bar_id;
                    const barMenus = menusByBar[barId] || [];
                    const barName = (Array.isArray(bar) ? bar[0]?.name : (bar as any)?.name) || "Unknown Bar";

                    return (
                        <BarTreeNode 
                            key={barId}
                            id={barId}
                            name={barName}
                            menus={barMenus}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    );
                })}

                {/* Global / Unassigned Menus */}
                {unassignedMenus.length > 0 && (
                    <BarTreeNode 
                        id="global-menus"
                        name="Global Menus"
                        menus={unassignedMenus}
                        selectedNode={selectedNode}
                        onNodeSelect={onNodeSelect}
                        isGlobal={true}
                    />
                )}
            </YStack>
        </ScrollView>
    );
}

/* ==========================================================================
   Bar Node
   ========================================================================== */
interface BarTreeNodeProps {
    id: string;
    name: string;
    menus: any[];
    selectedNode: SelectedNode | null;
    onNodeSelect: (node: SelectedNode) => void;
    isGlobal?: boolean;
}

function BarTreeNode({ id, name, menus, selectedNode, onNodeSelect, isGlobal = false }: BarTreeNodeProps) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(true);

    const isSelected = selectedNode?.type === "bar" && selectedNode?.id === id;

    return (
        <YStack>
            <XStack 
                alignItems="center" 
                paddingVertical="$2" 
                paddingHorizontal="$2"
                borderRadius={6}
                backgroundColor={isSelected ? "rgba(0, 122, 255, 0.08)" : "transparent"}
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

                <TouchableOpacity 
                    onPress={() => onNodeSelect({ type: "bar", id, name })} 
                    style={styles.contentTouch}
                >
                    <XStack alignItems="center" gap="$2">
                        <IconSymbol 
                            name={isGlobal ? "globe" : "building.2.fill"} 
                            size={16} 
                            color={isSelected ? theme.color8?.get() as string : theme.color11?.get() as string} 
                        />
                        <Text fontSize={13} fontWeight="bold" color={isSelected ? "$color8" : "$color"}>
                            {name}
                        </Text>
                    </XStack>
                </TouchableOpacity>
            </XStack>

            {expanded && (
                <YStack style={styles.childContainer}>
                    {menus.length > 0 ? (
                        menus.map((menu) => (
                            <MenuTreeNode 
                                key={menu.id}
                                menu={menu}
                                selectedNode={selectedNode}
                                onNodeSelect={onNodeSelect}
                            />
                        ))
                    ) : (
                        <Text color="$color11" fontSize={11} fontStyle="italic" pl="$6" py="$1">
                            No menus created.
                        </Text>
                    )}
                </YStack>
            )}
        </YStack>
    );
}

/* ==========================================================================
   Menu Node
   ========================================================================== */
interface MenuTreeNodeProps {
    menu: any;
    selectedNode: SelectedNode | null;
    onNodeSelect: (node: SelectedNode) => void;
}

function MenuTreeNode({ menu, selectedNode, onNodeSelect }: MenuTreeNodeProps) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);

    // Lazy load when expanded
    const { data: menuDetails, isLoading } = useMenuDetails(expanded ? menu.id : null);

    const isSelected = selectedNode?.type === "menu" && selectedNode?.id === menu.id;

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
                <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.chevronTouch}>
                    <IconSymbol 
                        name={expanded ? "chevron.down" : "chevron.right"} 
                        size={12} 
                        color={theme.color11?.get() as string} 
                    />
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => onNodeSelect({ type: "menu", id: menu.id, name: menu.name })} 
                    style={styles.contentTouch}
                >
                    <XStack alignItems="center" gap="$2">
                        <IconSymbol 
                            name="folder.fill" 
                            size={15} 
                            color={isSelected ? theme.color8?.get() as string : "#E5A93B"} 
                        />
                        <Text fontSize={13} fontWeight="600" color={isSelected ? "$color8" : "$color"}>
                            {menu.name}
                        </Text>
                    </XStack>
                </TouchableOpacity>
            </XStack>

            {expanded && (
                <YStack style={styles.childContainer}>
                    {isLoading ? (
                        <XStack pl="$6" py="$1" alignItems="center" gap="$2">
                            <ActivityIndicator size="small" color={theme.color11?.get() as string} />
                            <Text color="$color11" fontSize={11}>Loading drinks...</Text>
                        </XStack>
                    ) : menuDetails?.sections && menuDetails.sections.length > 0 ? (
                        menuDetails.sections.map((section: any) => {
                            if (!section.data || section.data.length === 0) return null;
                            return (
                                <SectionTreeNode 
                                    key={section.id}
                                    section={section}
                                    selectedNode={selectedNode}
                                    onNodeSelect={onNodeSelect}
                                />
                            );
                        })
                    ) : (
                        <Text color="$color11" fontSize={11} fontStyle="italic" pl="$6" py="$1">
                            Empty Menu
                        </Text>
                    )}
                </YStack>
            )}
        </YStack>
    );
}

/* ==========================================================================
   Section Node
   ========================================================================== */
interface SectionTreeNodeProps {
    section: any;
    selectedNode: SelectedNode | null;
    onNodeSelect: (node: SelectedNode) => void;
}

function SectionTreeNode({ section, selectedNode, onNodeSelect }: SectionTreeNodeProps) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(true);

    return (
        <YStack>
            <XStack 
                alignItems="center" 
                paddingVertical="$1.5" 
                paddingHorizontal="$2"
                gap="$2"
            >
                <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.chevronTouch}>
                    <IconSymbol 
                        name={expanded ? "chevron.down" : "chevron.right"} 
                        size={11} 
                        color={theme.color11?.get() as string} 
                    />
                </TouchableOpacity>

                <XStack alignItems="center" gap="$2">
                    <IconSymbol name="tag.fill" size={12} color={theme.color11?.get() as string} style={{ opacity: 0.6 }} />
                    <Text fontSize={12} fontWeight="700" color="$color11" textTransform="uppercase" letterSpacing={0.5}>
                        {section.title}
                    </Text>
                </XStack>
            </XStack>

            {expanded && (
                <YStack style={styles.childContainer}>
                    {section.data.map((drink: any) => (
                        <DrinkTreeNode 
                            key={drink.id}
                            drink={drink}
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
   Drink Node
   ========================================================================== */
interface DrinkTreeNodeProps {
    drink: any;
    selectedNode: SelectedNode | null;
    onNodeSelect: (node: SelectedNode) => void;
}

function DrinkTreeNode({ drink, selectedNode, onNodeSelect }: DrinkTreeNodeProps) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);

    const isCocktail = !drink.id.startsWith("beer-") && !drink.id.startsWith("wine-");
    const hasIngredients = isCocktail && drink.recipes && drink.recipes.length > 0;

    const isSelected = selectedNode?.type === "drink" && selectedNode?.id === drink.id;

    const getDrinkIcon = () => {
        if (drink.id.startsWith("beer-")) return "mug.fill";
        if (drink.id.startsWith("wine-")) return "wineglass.fill";
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
                    <View style={{ width: 14 }} /> // Indentation spacer for non-expandable leaf nodes
                )}

                <TouchableOpacity 
                    onPress={() => onNodeSelect({ type: "drink", id: drink.id, name: drink.name })} 
                    style={styles.contentTouch}
                >
                    <XStack alignItems="center" gap="$2">
                        <IconSymbol 
                            name={getDrinkIcon()} 
                            size={14} 
                            color={isSelected ? theme.color8?.get() as string : theme.color11?.get() as string} 
                        />
                        <Text fontSize={13} color={isSelected ? "$color8" : "$color"}>
                            {drink.name}
                        </Text>
                    </XStack>
                </TouchableOpacity>
            </XStack>

            {expanded && hasIngredients && (
                <YStack style={styles.childContainer}>
                    {drink.recipes.map((recipe: any, index: number) => {
                        const ing = recipe.ingredient;
                        if (!ing) return null;
                        
                        const ingId = ing.id || recipe.display_ingredient_id || recipe.ingredient_item_id;

                        return (
                            <IngredientTreeNode 
                                key={index}
                                id={ingId}
                                name={ing.name}
                                selectedNode={selectedNode}
                                onNodeSelect={onNodeSelect}
                            />
                        );
                    })}
                </YStack>
            )}
        </YStack>
    );
}

/* ==========================================================================
   Ingredient Node
   ========================================================================== */
interface IngredientTreeNodeProps {
    id: string;
    name: string;
    selectedNode: SelectedNode | null;
    onNodeSelect: (node: SelectedNode) => void;
}

function IngredientTreeNode({ id, name, selectedNode, onNodeSelect }: IngredientTreeNodeProps) {
    const theme = useTheme();
    const isSelected = selectedNode?.type === "ingredient" && selectedNode?.id === id;

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
                onPress={() => onNodeSelect({ type: "ingredient", id, name })} 
                style={styles.contentTouch}
            >
                <XStack alignItems="center" gap="$2">
                    <IconSymbol 
                        name="drop.fill" 
                        size={12} 
                        color={isSelected ? theme.color8?.get() as string : theme.color11?.get() as string} 
                        style={{ opacity: 0.8 }}
                    />
                    <Text fontSize={13} color={isSelected ? "$color8" : "$color"}>
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
