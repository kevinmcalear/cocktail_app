import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Text, XStack, YStack, useTheme, ScrollView } from "tamagui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { CustomIcon } from "@/components/ui/CustomIcons";
import { useBars } from "@/hooks/useBars";
import { useDropdowns } from "@/hooks/useDropdowns";
import { calculateDraftProgress } from "@/lib/draftProgress";
import { capitalize } from "@/lib/stringUtils";
import { useMenuDetails } from "@/hooks/useMenuDetails";
import { useRouter } from "expo-router";

const DRAFT_AMBER = "#E5A93B";

function DraftProgressBadge({ percentage }: { percentage: number }) {
    return (
        <Text fontSize={10} color={DRAFT_AMBER} fontWeight="bold" marginLeft="$1">
            {percentage}%
        </Text>
    );
}

type TreeTheme = ReturnType<typeof useTheme>;

function treeItemIconColor(isSelected: boolean, theme: TreeTheme, isUnpublished: boolean) {
    if (isSelected) return theme.color8?.get() as string;
    return isUnpublished ? DRAFT_AMBER : (theme.color11?.get() as string);
}

function getGlasswareIconName(glasswareId: string | null | undefined, dropdowns: any): string | null {
    if (!glasswareId) return null;
    return dropdowns?.glassware?.find((g: any) => g.id === glasswareId)?.name ?? null;
}

function MenuTreeIcon({
    isSelected,
    isUnpublished,
    theme,
    size = 15,
}: {
    isSelected: boolean;
    isUnpublished: boolean;
    theme: TreeTheme;
    size?: number;
}) {
    return (
        <CustomIcon
            name="TabMenus"
            size={size}
            color={treeItemIconColor(isSelected, theme, isUnpublished)}
        />
    );
}

function DrinkTreeIcon({
    entityType,
    drinkId,
    glasswareId,
    dropdowns,
    isSelected,
    isUnpublished = false,
    theme,
    size = 13,
}: {
    entityType?: string;
    drinkId?: string;
    glasswareId?: string | null;
    dropdowns: any;
    isSelected: boolean;
    isUnpublished?: boolean;
    theme: TreeTheme;
    size?: number;
}) {
    const color = treeItemIconColor(isSelected, theme, isUnpublished);

    if (entityType === "beer" || drinkId?.startsWith("beer-")) {
        return <IconSymbol name="mug.fill" size={size} color={color} />;
    }
    if (entityType === "wine" || drinkId?.startsWith("wine-")) {
        return <IconSymbol name="wineglass.fill" size={size} color={color} />;
    }

    const glasswareName = getGlasswareIconName(glasswareId, dropdowns);
    return <CustomIcon name={glasswareName || "TabDrinks"} size={size} color={color} />;
}

export type DraftNodeType = 
    | "bar" 
    | "folder" 
    | "menu_draft" 
    | "drink_draft" 
    | "ingredient_draft" 
    | "published_menu"
    | "published_drink" 
    | "published_ingredient";

export interface SelectedDraftNode {
    type: DraftNodeType;
    id: string;
    name: string;
}

interface DraftFolderTreeProps {
    drafts: any[];
    publishedCocktails?: any[];
    publishedBeers?: any[];
    publishedWines?: any[];
    publishedIngredients?: any[];
    selectedNode: SelectedDraftNode | null;
    onNodeSelect: (node: SelectedDraftNode) => void;
    onCreateNode?: (type: 'cocktail' | 'beer' | 'wine' | 'ingredient' | 'menu', barId: string) => void;
    /** Default "Personal Drafts". Main nav uses "Personal". */
    personalLabel?: string;
    /** Wrap bar nodes under a collapsible Venues section (main web nav). */
    groupBarsUnderVenues?: boolean;
    /** Show Personal even when empty. */
    alwaysShowPersonal?: boolean;
}

function CollapsibleNavSection({
    label,
    icon,
    children,
    defaultExpanded = false,
}: {
    label: string;
    icon: 'person.circle.fill' | 'building.2.fill';
    children: React.ReactNode;
    defaultExpanded?: boolean;
}) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <YStack>
            <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.sectionHeader}>
                <IconSymbol
                    name={expanded ? 'chevron.down' : 'chevron.right'}
                    size={12}
                    color={theme.color11?.get() as string}
                />
                <IconSymbol name={icon} size={15} color={theme.color11?.get() as string} />
                <Text fontSize={12} fontWeight="700" color="$color11" textTransform="uppercase" letterSpacing={0.6}>
                    {label}
                </Text>
            </TouchableOpacity>
            {expanded ? <YStack paddingLeft="$1">{children}</YStack> : null}
        </YStack>
    );
}

export function DraftFolderTree({ 
    drafts, 
    publishedCocktails = [], 
    publishedBeers = [], 
    publishedWines = [], 
    publishedIngredients = [], 
    selectedNode, 
    onNodeSelect,
    onCreateNode,
    personalLabel = 'Personal Drafts',
    groupBarsUnderVenues = false,
    alwaysShowPersonal = false,
}: DraftFolderTreeProps) {
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

    // Gather all published drinks
    const allDrinks = [
        ...publishedCocktails.map(c => ({ id: c.id, name: c.name, type: 'cocktail', recipes: c.recipes, bar_id: c.bar_id, glassware_id: c.glassware_id })),
        ...publishedBeers.map(b => ({ id: `beer-${b.id}`, name: b.name, type: 'beer', recipes: [], bar_id: b.bar_id })),
        ...publishedWines.map(w => ({ id: `wine-${w.id}`, name: w.name, type: 'wine', recipes: [], bar_id: w.bar_id }))
    ];

    // 1. Group drafts and published items by bar_id
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

    const showPersonal =
        alwaysShowPersonal ||
        personalDrafts.length > 0 ||
        (dropdowns?.menus || []).some((m: any) => !m.bar_id || m.bar_id === 'personal') ||
        allDrinks.some((d) => !d.bar_id || d.bar_id === 'personal');

    const personalNode = showPersonal ? (
        <BarDraftNode
            id="personal"
            name={personalLabel}
            drafts={personalDrafts}
            referencedDrinks={referencedDrinks}
            referencedIngredients={referencedIngredients}
            allDrafts={drafts}
            allDrinks={allDrinks}
            publishedCocktails={publishedCocktails}
            publishedBeers={publishedBeers}
            publishedWines={publishedWines}
            publishedIngredients={publishedIngredients}
            dropdowns={dropdowns}
            selectedNode={selectedNode}
            onNodeSelect={onNodeSelect}
            onCreateNode={onCreateNode}
            isPersonal={true}
            embedWithoutHeader={groupBarsUnderVenues}
        />
    ) : null;

    const barNodes = bars.map((barMapping: any) => {
        const bar = barMapping.bars;
        if (!bar) return null;
        const barId = barMapping.bar_id;
        const barDrafts = draftsByBar[barId] || [];

        const barName = (Array.isArray(bar) ? bar[0]?.name : (bar as any)?.name) || 'Unknown Bar';
        const logoUrl = (Array.isArray(bar) ? bar[0]?.logo_url : (bar as any)?.logo_url) ?? null;

        return (
            <BarDraftNode
                key={barId}
                id={barId}
                name={barName}
                logoUrl={logoUrl}
                drafts={barDrafts}
                referencedDrinks={referencedDrinks}
                referencedIngredients={referencedIngredients}
                allDrafts={drafts}
                allDrinks={allDrinks}
                publishedCocktails={publishedCocktails}
                publishedBeers={publishedBeers}
                publishedWines={publishedWines}
                publishedIngredients={publishedIngredients}
                dropdowns={dropdowns}
                selectedNode={selectedNode}
                onNodeSelect={onNodeSelect}
                onCreateNode={onCreateNode}
            />
        );
    });

    return (
        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
            <YStack gap="$1.5" padding="$3">
                {groupBarsUnderVenues ? (
                    <>
                        {personalNode ? (
                            <CollapsibleNavSection label="Personal" icon="person.circle.fill">
                                {personalNode}
                            </CollapsibleNavSection>
                        ) : null}
                        <CollapsibleNavSection label="Venues" icon="building.2.fill">
                            {barNodes}
                        </CollapsibleNavSection>
                    </>
                ) : (
                    <>
                        {personalNode}
                        {barNodes}
                    </>
                )}
            </YStack>
        </ScrollView>
    );
}

interface BarDraftNodeProps {
    id: string;
    name: string;
    logoUrl?: string | null;
    drafts: any[];
    referencedDrinks: Set<string>;
    referencedIngredients: Set<string>;
    allDrafts: any[];
    allDrinks: any[];
    publishedCocktails: any[];
    publishedBeers: any[];
    publishedWines: any[];
    publishedIngredients: any[];
    dropdowns: any;
    selectedNode: SelectedDraftNode | null;
    onNodeSelect: (node: SelectedDraftNode) => void;
    onCreateNode?: (type: 'cocktail' | 'beer' | 'wine' | 'ingredient' | 'menu', barId: string) => void;
    isPersonal?: boolean;
    /** Skip the bar row — render Menus/Items only (used under a Personal section header). */
    embedWithoutHeader?: boolean;
}

interface CategoryFolderNodeProps {
    label: string;
    children: React.ReactNode;
    count: number;
    onAddPress?: () => void;
    options?: { label: string; icon: string; onPress: () => void }[];
    customIcon?: string;
}

function CategoryFolderNode({ label, children, count, onAddPress, options, customIcon }: CategoryFolderNodeProps) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    const handleAddClick = (e: any) => {
        e?.stopPropagation();
        if (options && options.length > 0) {
            setShowDropdown(!showDropdown);
        } else if (onAddPress) {
            onAddPress();
        }
    };

    return (
        <YStack>
            {/* Hover and dropdown container */}
            <YStack
                position="relative"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => {
                    setIsHovered(false);
                    setShowDropdown(false);
                }}
            >
                <XStack 
                    alignItems="center" 
                    paddingVertical="$1.5" 
                    paddingHorizontal="$2"
                    borderRadius={6}
                    gap="$2"
                    hoverStyle={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                    justifyContent="space-between"
                >
                    <TouchableOpacity onPress={() => setExpanded(!expanded)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={styles.chevronTouch}>
                            <IconSymbol 
                                name={expanded ? "chevron.down" : "chevron.right"} 
                                size={12} 
                                color={theme.color11?.get() as string} 
                            />
                        </View>

                        <XStack alignItems="center" gap="$2" style={styles.contentTouch}>
                            {customIcon ? (
                                <CustomIcon
                                    name={customIcon}
                                    size={14}
                                    color={theme.color8?.get() as string}
                                />
                            ) : (
                                <IconSymbol
                                    name="folder.fill"
                                    size={14}
                                    color={theme.color8?.get() as string}
                                />
                            )}
                            <Text fontSize={13} fontWeight="600" color="$color">
                                {label} ({count})
                            </Text>
                        </XStack>
                    </TouchableOpacity>

                    {isHovered && (onAddPress || (options && options.length > 0)) && (
                        <TouchableOpacity 
                            onPress={handleAddClick}
                            style={{ padding: 4, borderRadius: 4, backgroundColor: showDropdown ? 'rgba(255,255,255,0.1)' : 'transparent' }}
                        >
                            <IconSymbol 
                                name="plus" 
                                size={14} 
                                color={theme.color8?.get() as string} 
                            />
                        </TouchableOpacity>
                    )}
                </XStack>

                {showDropdown && options && options.length > 0 && (
                    <YStack
                        position="absolute"
                        top={30}
                        right={10}
                        backgroundColor="$backgroundStrong"
                        borderRadius={6}
                        borderWidth={1}
                        borderColor="$borderColor"
                        padding="$1.5"
                        gap="$1.5"
                        zIndex={9999}
                        style={{
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 3.84,
                            elevation: 5,
                        }}
                    >
                        {options.map(opt => (
                            <TouchableOpacity 
                                key={opt.label} 
                                onPress={(e) => {
                                    e?.stopPropagation();
                                    setShowDropdown(false);
                                    opt.onPress();
                                }}
                            >
                                <XStack 
                                    paddingHorizontal="$2.5" 
                                    paddingVertical="$1.5" 
                                    gap="$2.5" 
                                    alignItems="center" 
                                    hoverStyle={{ backgroundColor: 'rgba(255,255,255,0.05)' }} 
                                    borderRadius={4}
                                >
                                    <IconSymbol name={opt.icon as any} size={12} color={theme.color11?.get() as string} />
                                    <Text fontSize={11} fontWeight="500" color="$color">{opt.label}</Text>
                                </XStack>
                            </TouchableOpacity>
                        ))}
                    </YStack>
                )}
            </YStack>

            {expanded && (
                <YStack style={styles.childContainer}>
                    {children}
                </YStack>
            )}
        </YStack>
    );
}

function BarDraftNode({ 
    id, 
    name, 
    logoUrl,
    drafts, 
    referencedDrinks, 
    referencedIngredients, 
    allDrafts,
    allDrinks,
    publishedCocktails,
    publishedBeers,
    publishedWines,
    publishedIngredients,
    dropdowns,
    selectedNode, 
    onNodeSelect, 
    onCreateNode,
    isPersonal = false,
    embedWithoutHeader = false,
}: BarDraftNodeProps) {
    const theme = useTheme();
    const router = useRouter();
    const [expanded, setExpanded] = useState(embedWithoutHeader);

    const isSelected = !isPersonal && selectedNode?.type === "bar" && selectedNode?.id === id;

    const isMatchBar = (itemBarId: string | null) => {
        const normalized = itemBarId || 'personal';
        return normalized === id;
    };

    // 1. Menus
    const menuDrafts = drafts.filter((d: any) => d.entity_type === "menu");
    const barPublishedMenus = (dropdowns?.menus || []).filter((m: any) => isMatchBar(m.bar_id));
    const menusCount = menuDrafts.length + barPublishedMenus.length;

    // 2. Items (Cocktails, Beers, Wines, Ingredients)
    const cocktailDrafts = drafts.filter((d: any) => 
        d.entity_type === "cocktail" && !referencedDrinks.has(d.id)
    );
    const barPublishedCocktails = allDrinks.filter((d: any) => 
        isMatchBar(d.bar_id) && d.type === "cocktail" && !referencedDrinks.has(d.id)
    );

    const beerDrafts = drafts.filter((d: any) => 
        d.entity_type === "beer" && !referencedDrinks.has(`beer-${d.id}`)
    );
    const barPublishedBeers = allDrinks.filter((d: any) => 
        isMatchBar(d.bar_id) && d.type === "beer" && !referencedDrinks.has(d.id)
    );

    const wineDrafts = drafts.filter((d: any) => 
        d.entity_type === "wine" && !referencedDrinks.has(`wine-${d.id}`)
    );
    const barPublishedWines = allDrinks.filter((d: any) => 
        isMatchBar(d.bar_id) && d.type === "wine" && !referencedDrinks.has(d.id)
    );

    const ingredientDrafts = drafts.filter((d: any) => 
        d.entity_type === "ingredient" && !referencedIngredients.has(d.id)
    );
    const barPublishedIngredients = (publishedIngredients || []).filter((i: any) => 
        isMatchBar(i.bar_id) && !referencedIngredients.has(i.id)
    );
    const itemsCount = cocktailDrafts.length + barPublishedCocktails.length +
                       beerDrafts.length + barPublishedBeers.length +
                       wineDrafts.length + barPublishedWines.length +
                       ingredientDrafts.length + barPublishedIngredients.length;

    const handleCreate = (type: 'cocktail' | 'beer' | 'wine' | 'ingredient' | 'menu') => {
        const barQueryId = id === 'personal' ? '' : id;
        if (onCreateNode) {
            onCreateNode(type, barQueryId);
        } else {
            let route = '';
            switch(type) {
                case 'cocktail': route = `/add-cocktail?barId=${barQueryId}`; break;
                case 'beer': route = `/add-beer?barId=${barQueryId}`; break;
                case 'wine': route = `/add-wine?barId=${barQueryId}`; break;
                case 'ingredient': route = `/add-ingredient?barId=${barQueryId}`; break;
                case 'menu': route = `/menus/create?barId=${barQueryId}`; break;
            }
            router.push(route as any);
        }
    };

    const itemOptions = [
        { 
            label: "Add Cocktail", 
            icon: "wineglass" as const, 
            onPress: () => handleCreate('cocktail')
        },
        { 
            label: "Add Beer", 
            icon: "mug.fill" as const, 
            onPress: () => handleCreate('beer')
        },
        { 
            label: "Add Wine", 
            icon: "wineglass.fill" as const, 
            onPress: () => handleCreate('wine')
        },
        { 
            label: "Add Ingredient", 
            icon: "flask" as const, 
            onPress: () => handleCreate('ingredient')
        },
    ];

    const showMenus = menusCount > 0 || embedWithoutHeader;
    const showItems = itemsCount > 0 || embedWithoutHeader;

    const folders = (
        <>
            {showMenus && (
                <CategoryFolderNode
                    label="Menus"
                    count={menusCount}
                    customIcon="TabMenus"
                    onAddPress={() => handleCreate('menu')}
                >
                    {menuDrafts.map((menuDraft) => (
                        <MenuDraftTreeNode
                            key={menuDraft.id}
                            menuDraft={menuDraft}
                            allDrafts={allDrafts}
                            allDrinks={allDrinks}
                            dropdowns={dropdowns}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    ))}
                    {barPublishedMenus.map((menu: any) => (
                        <PublishedMenuTreeNode
                            key={menu.id}
                            menu={menu}
                            allDrinks={allDrinks}
                            allDrafts={allDrafts}
                            dropdowns={dropdowns}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    ))}
                </CategoryFolderNode>
            )}

            {showItems && (
                <CategoryFolderNode label="Items" count={itemsCount} options={itemOptions}>
                    {cocktailDrafts.map((drinkDraft) => (
                        <DrinkDraftTreeNode
                            key={drinkDraft.id}
                            drinkDraft={drinkDraft}
                            allDrafts={allDrafts}
                            dropdowns={dropdowns}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    ))}
                    {barPublishedCocktails.map((drink: any) => (
                        <PublishedDrinkTreeNode
                            key={drink.id}
                            id={drink.id}
                            name={drink.name}
                            recipes={drink.recipes || []}
                            allDrafts={allDrafts}
                            allDrinks={allDrinks}
                            dropdowns={dropdowns}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    ))}
                    {beerDrafts.map((drinkDraft) => (
                        <DrinkDraftTreeNode
                            key={drinkDraft.id}
                            drinkDraft={drinkDraft}
                            allDrafts={allDrafts}
                            dropdowns={dropdowns}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    ))}
                    {barPublishedBeers.map((drink: any) => (
                        <PublishedDrinkTreeNode
                            key={drink.id}
                            id={drink.id}
                            name={drink.name}
                            recipes={drink.recipes || []}
                            allDrafts={allDrafts}
                            allDrinks={allDrinks}
                            dropdowns={dropdowns}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    ))}
                    {wineDrafts.map((drinkDraft) => (
                        <DrinkDraftTreeNode
                            key={drinkDraft.id}
                            drinkDraft={drinkDraft}
                            allDrafts={allDrafts}
                            dropdowns={dropdowns}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    ))}
                    {barPublishedWines.map((drink: any) => (
                        <PublishedDrinkTreeNode
                            key={drink.id}
                            id={drink.id}
                            name={drink.name}
                            recipes={drink.recipes || []}
                            allDrafts={allDrafts}
                            allDrinks={allDrinks}
                            dropdowns={dropdowns}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    ))}
                    {ingredientDrafts.map((ingDraft) => (
                        <IngredientDraftTreeNode
                            key={ingDraft.id}
                            ingredientDraft={ingDraft}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    ))}
                    {barPublishedIngredients.map((ing: any) => (
                        <PublishedIngredientTreeNode
                            key={ing.id}
                            id={ing.id}
                            name={ing.name}
                            selectedNode={selectedNode}
                            onNodeSelect={onNodeSelect}
                        />
                    ))}
                </CategoryFolderNode>
            )}
        </>
    );

    if (embedWithoutHeader) {
        return <YStack>{folders}</YStack>;
    }

    return (
        <YStack>
            <XStack
                alignItems="center"
                paddingVertical="$2"
                paddingHorizontal="$2"
                borderRadius={6}
                backgroundColor={isSelected ? 'rgba(0, 122, 255, 0.08)' : 'transparent'}
                gap="$2"
                hoverStyle={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
            >
                <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.chevronTouch}>
                    <IconSymbol
                        name={expanded ? 'chevron.down' : 'chevron.right'}
                        size={12}
                        color={theme.color11?.get() as string}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => {
                        if (!isPersonal) {
                            onNodeSelect({ type: 'bar', id, name });
                        }
                    }}
                    disabled={isPersonal}
                    style={styles.contentTouch}
                >
                    <XStack alignItems="center" gap="$2">
                        {logoUrl ? (
                            <Image source={{ uri: logoUrl }} cacheKey={logoUrl} style={styles.barLogo} contentFit="cover" />
                        ) : (
                            <IconSymbol
                                name={isPersonal ? 'person.circle.fill' : 'building.2.fill'}
                                size={16}
                                color={isSelected ? (theme.color8?.get() as string) : (theme.color11?.get() as string)}
                            />
                        )}
                        <Text fontSize={13} fontWeight="bold" color={isSelected ? '$color8' : '$color'}>
                            {name}
                        </Text>
                    </XStack>
                </TouchableOpacity>
            </XStack>

            {expanded ? <YStack style={styles.childContainer}>{folders}</YStack> : null}
        </YStack>
    );
}

/* ==========================================================================
   Menu Draft Node
   ========================================================================== */
interface MenuDraftTreeNodeProps {
    menuDraft: any;
    allDrafts: any[];
    allDrinks: any[];
    dropdowns: any;
    selectedNode: SelectedDraftNode | null;
    onNodeSelect: (node: SelectedDraftNode) => void;
}

function MenuDraftTreeNode({ menuDraft, allDrafts, allDrinks, dropdowns, selectedNode, onNodeSelect }: MenuDraftTreeNodeProps) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);

    const isSelected = selectedNode?.type === "menu_draft" && selectedNode?.id === menuDraft.id;
    const { percentage } = calculateDraftProgress(menuDraft, allDrafts, dropdowns);

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
                    <XStack alignItems="center" gap="$2">
                        <MenuTreeIcon isSelected={isSelected} isUnpublished theme={theme} />
                        <Text fontSize={13} color={isSelected ? "$color8" : "$color"}>
                            {name}
                        </Text>
                        <DraftProgressBadge percentage={percentage} />
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
                                            const publishedDrink = allDrinks.find(d => d.id === drinkId);
                                            const publishedName = publishedDrink ? publishedDrink.name : (
                                                drinkId.startsWith("beer-") 
                                                    ? "Published Beer" 
                                                    : drinkId.startsWith("wine-") 
                                                        ? "Published Wine" 
                                                        : "Published Cocktail"
                                            );

                                            return (
                                                <PublishedDrinkTreeNode 
                                                    key={drinkId}
                                                    id={drinkId}
                                                    name={publishedName}
                                                    recipes={publishedDrink?.recipes || []}
                                                    allDrafts={allDrafts}
                                                    allDrinks={allDrinks}
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
    const { percentage } = calculateDraftProgress(drinkDraft, allDrafts, dropdowns);

    const data = drinkDraft.draft_data || {};
    const name = data.name || `Untitled ${capitalize(drinkDraft.entity_type)}`;

    const recipeItems = data.recipeItems || [];
    const hasIngredients = recipeItems.length > 0;

    const glasswareId = data.glasswareId || data.glassware_id || null;

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
                    <XStack alignItems="center" gap="$2">
                        <DrinkTreeIcon
                            entityType={drinkDraft.entity_type}
                            glasswareId={glasswareId}
                            dropdowns={dropdowns}
                            isSelected={isSelected}
                            isUnpublished
                            theme={theme}
                        />
                        <Text fontSize={13} color={isSelected ? "$color8" : "$color"}>
                            {name}
                        </Text>
                        <DraftProgressBadge percentage={percentage} />
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
    recipes: any[];
    allDrafts: any[];
    allDrinks: any[];
    dropdowns: any;
    selectedNode: SelectedDraftNode | null;
    onNodeSelect: (node: SelectedDraftNode) => void;
}

function PublishedDrinkTreeNode({ id, name, recipes, allDrafts, allDrinks, dropdowns, selectedNode, onNodeSelect }: PublishedDrinkTreeNodeProps) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);
    const isSelected = selectedNode?.type === "published_drink" && selectedNode?.id === id;

    const hasIngredients = recipes && recipes.length > 0;
    const glasswareId = allDrinks.find((d) => d.id === id)?.glassware_id ?? null;

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
                    onPress={() => onNodeSelect({ type: "published_drink", id, name })} 
                    style={styles.contentTouch}
                >
                    <XStack alignItems="center" gap="$2">
                        <DrinkTreeIcon
                            drinkId={id}
                            glasswareId={glasswareId}
                            dropdowns={dropdowns}
                            isSelected={isSelected}
                            theme={theme}
                        />
                        <Text fontSize={13} color={isSelected ? "$color8" : "$color"}>
                            {name}
                        </Text>
                    </XStack>
                </TouchableOpacity>
            </XStack>

            {expanded && hasIngredients && (
                <YStack style={styles.childContainer}>
                    {recipes.map((recipe: any, index: number) => {
                        const ingId = recipe.display_ingredient_id || recipe.ingredient_item_id;
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
                            return (
                                <PublishedIngredientTreeNode 
                                    key={index}
                                    id={ingId}
                                    name={recipe.ingredient?.name || recipe.name || "Published Ingredient"}
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
                        color={treeItemIconColor(isSelected, theme, true)} 
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
   Published Menu Node
   ========================================================================== */
interface PublishedMenuTreeNodeProps {
    menu: any;
    allDrinks: any[];
    allDrafts: any[];
    dropdowns: any;
    selectedNode: SelectedDraftNode | null;
    onNodeSelect: (node: SelectedDraftNode) => void;
}

function PublishedMenuTreeNode({ menu, allDrinks, allDrafts, dropdowns, selectedNode, onNodeSelect }: PublishedMenuTreeNodeProps) {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);

    const { data: menuDetails, isLoading } = useMenuDetails(expanded ? menu.id : null);
    const isSelected = selectedNode?.type === "published_menu" && selectedNode?.id === menu.id;

    const templateId = menu.template_id;
    const sections = dropdowns?.templateSections
        ?.filter((s: any) => s.template_id === templateId)
        ?.sort((a: any, b: any) => a.sort_order - b.sort_order) || [];

    const selections = menuDetails?.sections?.reduce((acc: any, sec: any) => {
        acc[sec.id] = sec.data?.map((item: any) => {
            if (item.item_type === 'beer') return `beer-${item.id}`;
            if (item.item_type === 'wine') return `wine-${item.id}`;
            return item.id;
        }) || [];
        return acc;
    }, {}) || {};

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
                {isLoading ? (
                    <ActivityIndicator size="small" color={theme.color11?.get() as string} style={{ marginRight: 2 }} />
                ) : hasDrinks || sections.length > 0 ? (
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
                    onPress={() => onNodeSelect({ type: "published_menu", id: menu.id, name: menu.name })} 
                    style={styles.contentTouch}
                >
                    <XStack alignItems="center" gap="$2">
                        <MenuTreeIcon isSelected={isSelected} isUnpublished={false} theme={theme} />
                        <Text fontSize={13} color={isSelected ? "$color8" : "$color"}>
                            {menu.name}
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
                                            const publishedDrink = allDrinks.find(d => d.id === drinkId);
                                            const publishedName = publishedDrink ? publishedDrink.name : (
                                                drinkId.startsWith("beer-") 
                                                    ? "Published Beer" 
                                                    : drinkId.startsWith("wine-") 
                                                        ? "Published Wine" 
                                                        : "Published Cocktail"
                                            );

                                            return (
                                                <PublishedDrinkTreeNode 
                                                    key={drinkId}
                                                    id={drinkId}
                                                    name={publishedName}
                                                    recipes={publishedDrink?.recipes || []}
                                                    allDrafts={allDrafts}
                                                    allDrinks={allDrinks}
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

const styles = StyleSheet.create({
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 8,
    },
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
    barLogo: {
        width: 16,
        height: 16,
        borderRadius: 4,
    },
});
