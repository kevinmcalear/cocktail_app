import React from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, Alert, Platform, useWindowDimensions, PanResponder } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack, YStack, useTheme, Button, Card } from 'tamagui';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { useDrafts } from '@/hooks/useDrafts';
import { useBars } from '@/hooks/useBars';
import { useAuth } from '@/ctx/AuthContext';
import { useDropdowns } from '@/hooks/useDropdowns';
import { calculateDraftProgress } from '@/lib/draftProgress';
import { capitalize } from '@/lib/stringUtils';
import { UniversalCreateButton } from '@/components/UniversalCreateButton';
import { DraftPreviewPanel } from '@/components/DraftPreviewPanel';
import { IngredientDetailPanel } from '@/components/IngredientDetailPanel';
import { CocktailDetailPanel } from '@/components/CocktailDetailPanel';
import { DraftFolderTree, SelectedDraftNode } from '@/components/DraftFolderTree';
import { useCocktails } from '@/hooks/useCocktails';
import { useBeers } from '@/hooks/useBeers';
import { useWines } from '@/hooks/useWines';
import { useIngredients } from '@/hooks/useIngredients';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

import AddCocktailScreen from '../add-cocktail';
import EditCocktailScreen from '../cocktail/[id]/edit';
import AddBeerScreen from '../add-beer';
import EditBeerScreen from '../beer/[id]/edit';
import AddWineScreen from '../add-wine';
import EditWineScreen from '../wine/[id]/edit';
import AddIngredientScreen from '../add-ingredient';
import EditIngredientScreen from '../ingredient/[id]/edit';
import CreateMenuWizard from '../menus/create/index';

export default function EditModeDashboard() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { drafts, isLoading: loadingDrafts, deleteDraft } = useDrafts();
    const { data: userBars, isLoading: loadingBars } = useBars();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();

    const { data: publishedCocktails, isLoading: loadingCocktails } = useCocktails({ allContexts: true });
    const { data: publishedBeers, isLoading: loadingBeers } = useBeers({ allContexts: true });
    const { data: publishedWines, isLoading: loadingWines } = useWines({ allContexts: true });
    const { data: publishedIngredients, isLoading: loadingIngredients } = useIngredients({ allContexts: true });

    const isLoading = loadingDrafts || loadingBars || loadingDropdowns || loadingCocktails || loadingBeers || loadingWines || loadingIngredients;

    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 768;

    const [expandedSections, setExpandedSections] = React.useState<Record<string, Record<string, boolean>>>({});
    const [selectedNode, setSelectedNode] = React.useState<SelectedDraftNode | null>(null);
    const [selectedIngredientId, setSelectedIngredientId] = React.useState<string | null>(null);
    const [showThirdColumn, setShowThirdColumn] = React.useState(false);

    interface EditingState {
        mode: 'create' | 'edit';
        type: 'cocktail' | 'beer' | 'wine' | 'ingredient' | 'menu';
        draftId?: string;
        barId?: string;
        publishedId?: string;
    }
    const [editingState, setEditingState] = React.useState<EditingState | null>(null);

    const [sidebarWidth, setSidebarWidth] = React.useState(320);
    const [isDragging, setIsDragging] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const sidebarWidthRef = React.useRef(sidebarWidth);
    const initialWidthRef = React.useRef(sidebarWidth);

    React.useEffect(() => {
        sidebarWidthRef.current = sidebarWidth;
    }, [sidebarWidth]);

    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                setIsDragging(true);
                initialWidthRef.current = sidebarWidthRef.current;
            },
            onPanResponderMove: (evt, gestureState) => {
                const newWidth = initialWidthRef.current + gestureState.dx;
                const minWidth = 200;
                const maxWidth = Math.min(600, width * 0.5);
                if (newWidth >= minWidth && newWidth <= maxWidth) {
                    setSidebarWidth(newWidth);
                } else if (newWidth < minWidth) {
                    setSidebarWidth(minWidth);
                } else if (newWidth > maxWidth) {
                    setSidebarWidth(maxWidth);
                }
            },
            onPanResponderRelease: () => {
                setIsDragging(false);
            },
            onPanResponderTerminate: () => {
                setIsDragging(false);
            }
        })
    ).current;

    const handleMouseDown = (e: any) => {
        if (Platform.OS !== 'web') return;
        e.preventDefault();
        setIsDragging(true);
        const startX = e.clientX;
        const startWidth = sidebarWidthRef.current;

        if (typeof document !== 'undefined') {
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = startWidth + deltaX;
            const minWidth = 200;
            const maxWidth = Math.min(600, width * 0.5);
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                setSidebarWidth(newWidth);
            } else if (newWidth < minWidth) {
                setSidebarWidth(minWidth);
            } else if (newWidth > maxWidth) {
                setSidebarWidth(maxWidth);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            if (typeof document !== 'undefined') {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const mapPublishedItem = (item: any, type: string) => {
        return {
            id: item.id,
            entity_type: type,
            isPublished: true,
            bar_id: item.bar_id || 'personal',
            updated_at: item.updated_at || item.created_at || new Date().toISOString(),
            user_id: item.user_id || null,
            draft_data: {
                name: item.name,
                menuName: item.name,
                description: item.description,
                brandMaker: item.brand_maker,
                recipeItems: item.recipes || [],
                selections: item.selections || {}
            }
        };
    };

    const allItems = [
        ...drafts.map(d => ({ ...d, isPublished: false })),
        ...(dropdowns?.menus || []).map(m => mapPublishedItem(m, 'menu')),
        ...(publishedCocktails || []).map(c => mapPublishedItem(c, 'cocktail')),
        ...(publishedBeers || []).map(b => mapPublishedItem(b, 'beer')),
        ...(publishedWines || []).map(w => mapPublishedItem(w, 'wine')),
        ...(publishedIngredients || []).map(i => mapPublishedItem(i, 'ingredient'))
    ];

    allItems.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const itemsByBar = allItems.reduce((acc: any, item: any) => {
        const barId = item.bar_id || 'personal';
        if (!acc[barId]) acc[barId] = [];
        acc[barId].push(item);
        return acc;
    }, {});

    const handleDeletePublished = async (id: string, entityType: string) => {
        const afterDelete = async () => {
            try {
                if (entityType === 'menu') {
                    const { error } = await supabase.from('menus').delete().eq('id', id);
                    if (error) throw error;
                    queryClient.invalidateQueries({ queryKey: ['dropdowns_v2'] });
                } else {
                    const { error } = await supabase.from('items').delete().eq('id', id);
                    if (error) throw error;
                    if (entityType === 'cocktail') queryClient.invalidateQueries({ queryKey: ['cocktails'] });
                    if (entityType === 'beer') queryClient.invalidateQueries({ queryKey: ['beers'] });
                    if (entityType === 'wine') queryClient.invalidateQueries({ queryKey: ['wines'] });
                    if (entityType === 'ingredient') queryClient.invalidateQueries({ queryKey: ['ingredients'] });
                }
                
                if (selectedNode?.id === id) {
                    setSelectedNode(null);
                    setSelectedIngredientId(null);
                    setShowThirdColumn(false);
                }
            } catch (err: any) {
                console.error("Delete error:", err);
                Alert.alert("Error", `Failed to delete published ${entityType}: ${err.message || err}`);
            }
        };

        const itemName = entityType.toUpperCase();
        if (Platform.OS === 'web') {
            const confirmed = window.confirm(`Are you sure you want to permanently delete this published ${itemName}? This action cannot be undone.`);
            if (confirmed) {
                await afterDelete();
            }
        } else {
            Alert.alert(
                `Delete Published ${entityType}`,
                `Are you sure you want to permanently delete this published ${itemName}? This action cannot be undone.`,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: afterDelete }
                ]
            );
        }
    };

    const handleEditPublished = (item: any) => {
        const id = item.id;
        const cleanId = id.replace("beer-", "").replace("wine-", "");
        
        if (isLargeScreen) {
            setEditingState({
                mode: 'edit',
                type: item.entity_type,
                publishedId: cleanId
            });
            return;
        }

        let route = '';
        switch(item.entity_type) {
            case 'cocktail': route = `/cocktail/${id}/edit`; break;
            case 'ingredient': route = `/ingredient/${id}/edit`; break;
            case 'beer': route = `/beer/${cleanId}/edit`; break;
            case 'wine': route = `/wine/${cleanId}/edit`; break;
            case 'menu': route = `/menus/create?menuId=${id}`; break;
        }
        if (route) {
            router.push(route as any);
        }
    };

    // Auto-select first item on large screen when items load
    React.useEffect(() => {
        if (isLargeScreen && allItems.length > 0 && !selectedNode) {
            const first = allItems[0];
            setSelectedNode({
                type: first.isPublished 
                    ? (first.entity_type === 'menu' ? 'published_menu' : (first.entity_type === 'ingredient' ? 'published_ingredient' : 'published_drink'))
                    : (first.entity_type === 'menu' ? 'menu_draft' : (first.entity_type === 'ingredient' ? 'ingredient_draft' : 'drink_draft')),
                id: first.id,
                name: first.draft_data?.name || first.draft_data?.menuName || `Untitled ${first.entity_type}`
            });
        }
    }, [allItems, isLargeScreen, selectedNode]);

    const getBarName = (barId: string) => {
        if (barId === 'personal') return 'Personal Drafts';
        const bar = userBars?.find((b: any) => b.bar_id === barId);
        const barsObj = bar?.bars;
        if (Array.isArray(barsObj)) {
            return barsObj[0]?.name || 'Unknown Bar';
        }
        return (barsObj as any)?.name || 'Unknown Bar';
    };

    const isSectionExpanded = (
        barId: string,
        sectionKey: string,
        hasMenus: boolean,
        hasItems: boolean
    ) => {
        if (expandedSections[barId]?.[sectionKey] !== undefined) {
            return expandedSections[barId][sectionKey];
        }
        return false; // Collapse by default on first load
    };

    const toggleSection = (
        barId: string,
        sectionKey: string,
        hasMenus: boolean,
        hasItems: boolean
    ) => {
        const currentVal = isSectionExpanded(barId, sectionKey, hasMenus, hasItems);
        setExpandedSections((prev) => ({
            ...prev,
            [barId]: {
                ...(prev[barId] || {}),
                [sectionKey]: !currentVal,
            },
        }));
    };

    const draftsByBar = drafts.reduce((acc: any, draft: any) => {
        const barId = draft.bar_id || 'personal';
        if (!acc[barId]) acc[barId] = [];
        acc[barId].push(draft);
        return acc;
    }, {});


    const handleDeleteDraft = (id: string) => {
        const afterDelete = () => {
            deleteDraft(id);
            if (selectedNode?.id === id) {
                setSelectedNode(null);
                setSelectedIngredientId(null);
                setShowThirdColumn(false);
            }
        };

        if (Platform.OS === 'web') {
            const confirmed = window.confirm("Are you sure you want to discard this draft?");
            if (confirmed) {
                afterDelete();
            }
        } else {
            Alert.alert(
                "Delete Draft",
                "Are you sure you want to discard this draft?",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: afterDelete }
                ]
            );
        }
    };

    const handleResumeDraft = (draft: any) => {
        if (isLargeScreen) {
            setEditingState({
                mode: 'create',
                type: draft.entity_type,
                draftId: draft.id
            });
            return;
        }

        let route = '';
        switch(draft.entity_type) {
            case 'cocktail': route = '/add-cocktail'; break;
            case 'ingredient': route = '/add-ingredient'; break;
            case 'beer': route = '/add-beer'; break;
            case 'wine': route = '/add-wine'; break;
            case 'menu': route = '/menus/create'; break;
        }
        if (route) {
            router.push(`${route}?draftId=${draft.id}` as any);
        }
    };

    const handleLoadRecipeStatus = (hasRecipe: boolean) => {
        if (!hasRecipe) {
            setSelectedIngredientId(null);
            setShowThirdColumn(false);
        } else {
            setShowThirdColumn(true);
        }
    };

    const getIconForType = (type: string) => {
        switch(type) {
            case 'cocktail': return 'TabDrinks';
            case 'ingredient': return 'TabIngredients';
            case 'beer': return 'Beer';
            case 'wine': return 'Wine';
            case 'menu': return 'TabMenus';
            default: return 'TabDrinks';
        }
    };

    if (isLargeScreen) {
        return (
            <XStack flex={1} backgroundColor="$background" style={{ paddingTop: insets.top }}>
                <Stack.Screen options={{ headerShown: false }} />
                
                {/* Column 1: Explorer Tree Sidebar (Left) */}
                <YStack width={sidebarWidth} borderRightWidth={1} borderRightColor="$borderColor" height="100%" backgroundColor="$backgroundStrong">
                    <XStack paddingHorizontal="$4" paddingVertical="$4" alignItems="center" borderBottomWidth={1} borderBottomColor="$borderColor">
                        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                            <IconSymbol name="chevron.left" size={24} color={theme.color?.get() as string} />
                        </TouchableOpacity>
                        <Text fontSize="$5" fontWeight="bold" marginLeft="$2">Creator Hub</Text>
                    </XStack>
                    <YStack flex={1} minHeight={0}>
                        <DraftFolderTree 
                            drafts={drafts}
                            publishedCocktails={publishedCocktails || []}
                            publishedBeers={publishedBeers || []}
                            publishedWines={publishedWines || []}
                            publishedIngredients={publishedIngredients || []}
                            selectedNode={selectedNode}
                            onNodeSelect={(node) => {
                                setSelectedNode(node);
                                setSelectedIngredientId(null);
                                setShowThirdColumn(false);
                                setEditingState(null);
                            }}
                            onCreateNode={(type, barId) => {
                                setEditingState({
                                    mode: 'create',
                                    type,
                                    barId
                                });
                            }}
                        />
                    </YStack>
                    <YStack padding="$4" borderTopWidth={1} borderTopColor="$borderColor" width="100%" gap="$3">
                        <UniversalCreateButton variant="button" width="100%" />
                    </YStack>
                </YStack>

                {/* Drag Handle */}
                <YStack
                    position="absolute"
                    top={0}
                    left={sidebarWidth - 5}
                    bottom={0}
                    width={10}
                    zIndex={100}
                    alignItems="center"
                    backgroundColor="transparent"
                    {...(Platform.OS === 'web' ? { onMouseDown: handleMouseDown } : panResponder.panHandlers)}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    style={{ cursor: 'col-resize' } as any}
                    hoverStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.03)'
                    }}
                >
                    <YStack
                        width={2}
                        height="100%"
                        backgroundColor={(isDragging || isHovered) ? "$color" : "transparent"}
                        opacity={isDragging ? 0.8 : 0.4}
                    />
                </YStack>

                {/* Column 2: Selected Details Panel (Middle) */}
                <YStack flex={1} height="100%">
                    {editingState ? (() => {
                        const handleClose = () => {
                            setEditingState(null);
                        };
                        const handleSaveComplete = () => {
                            setEditingState(null);
                            queryClient.invalidateQueries();
                        };

                        switch (editingState.type) {
                            case 'cocktail':
                                if (editingState.mode === 'edit') {
                                    return (
                                        <EditCocktailScreen 
                                            isInline 
                                            idProp={editingState.publishedId} 
                                            onClose={handleClose} 
                                            onSave={handleSaveComplete} 
                                        />
                                    );
                                } else {
                                    return (
                                        <AddCocktailScreen 
                                            isInline 
                                            draftIdProp={editingState.draftId} 
                                            barIdProp={editingState.barId} 
                                            onClose={handleClose} 
                                            onSave={handleSaveComplete} 
                                        />
                                    );
                                }
                            case 'beer':
                                if (editingState.mode === 'edit') {
                                    return (
                                        <EditBeerScreen 
                                            isInline 
                                            idProp={editingState.publishedId} 
                                            onClose={handleClose} 
                                            onSave={handleSaveComplete} 
                                        />
                                    );
                                } else {
                                    return (
                                        <AddBeerScreen 
                                            isInline 
                                            draftIdProp={editingState.draftId} 
                                            barIdProp={editingState.barId} 
                                            onClose={handleClose} 
                                            onSave={handleSaveComplete} 
                                        />
                                    );
                                }
                            case 'wine':
                                if (editingState.mode === 'edit') {
                                    return (
                                        <EditWineScreen 
                                            isInline 
                                            idProp={editingState.publishedId} 
                                            onClose={handleClose} 
                                            onSave={handleSaveComplete} 
                                        />
                                    );
                                } else {
                                    return (
                                        <AddWineScreen 
                                            isInline 
                                            draftIdProp={editingState.draftId} 
                                            barIdProp={editingState.barId} 
                                            onClose={handleClose} 
                                            onSave={handleSaveComplete} 
                                        />
                                    );
                                }
                            case 'ingredient':
                                if (editingState.mode === 'edit') {
                                    return (
                                        <EditIngredientScreen 
                                            isInline 
                                            idProp={editingState.publishedId} 
                                            onClose={handleClose} 
                                            onSave={handleSaveComplete} 
                                        />
                                    );
                                } else {
                                    return (
                                        <AddIngredientScreen 
                                            isInline 
                                            draftIdProp={editingState.draftId} 
                                            barIdProp={editingState.barId} 
                                            onClose={handleClose} 
                                            onSave={handleSaveComplete} 
                                        />
                                    );
                                }
                            case 'menu':
                                return (
                                    <CreateMenuWizard 
                                        isInline 
                                        draftIdProp={editingState.draftId} 
                                        barIdProp={editingState.barId} 
                                        onClose={handleClose} 
                                        onSave={handleSaveComplete} 
                                    />
                                );
                            default:
                                return null;
                        }
                    })() : (
                        <>
                            {(selectedNode?.type === "menu_draft" || selectedNode?.type === "drink_draft" || selectedNode?.type === "ingredient_draft" ||
                              selectedNode?.type === "published_drink" || selectedNode?.type === "published_ingredient" || selectedNode?.type === "published_menu") && (() => {
                                const activeItem = allItems.find(item => {
                                    if (selectedNode.type.startsWith("published_")) {
                                        return item.isPublished && item.id === selectedNode.id;
                                    } else {
                                        return !item.isPublished && item.id === selectedNode.id;
                                    }
                                });
                                return activeItem ? (
                                    <DraftPreviewPanel 
                                        draft={activeItem}
                                        onIngredientPress={(ingredientId) => {
                                            setSelectedIngredientId(ingredientId);
                                            // Check if it's a draft ingredient that has recipe items
                                            const childDraft = drafts.find(d => d.id === ingredientId && d.entity_type === 'ingredient');
                                            if (childDraft) {
                                                setShowThirdColumn(childDraft.draft_data?.recipeItems?.length > 0);
                                            } else {
                                                const publishedIng = publishedIngredients?.find(i => i.id === ingredientId);
                                                setShowThirdColumn(!!publishedIng?.recipes?.length || (publishedIng?.item_type === 'ingredient'));
                                            }
                                        }}
                                        selectedIngredientId={selectedIngredientId}
                                        onResume={() => activeItem.isPublished ? handleEditPublished(activeItem) : handleResumeDraft(activeItem)}
                                        onDiscard={() => activeItem.isPublished ? handleDeletePublished(activeItem.id, activeItem.entity_type) : handleDeleteDraft(activeItem.id)}
                                    />
                                ) : null;
                            })()}

                            {!selectedNode && (
                                <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
                                    <IconSymbol name="plus.circle" size={48} color={theme.color11?.get() as string} style={{ opacity: 0.3 }} />
                                    <Text color="$color11" fontSize={16} fontWeight="500" marginTop="$4">
                                        Select a draft or drink to view preview.
                                    </Text>
                                </YStack>
                            )}
                        </>
                    )}
                </YStack>

                {/* Column 3: Batch Spec / Dependency Details Panel (Right) */}
                {!editingState && selectedIngredientId && (
                    <YStack width={360} height="100%" borderLeftWidth={1} borderLeftColor="$borderColor">
                        {(() => {
                            const draftIngredient = drafts.find(d => d.id === selectedIngredientId && d.entity_type === 'ingredient');
                            if (draftIngredient) {
                                return (
                                    <DraftPreviewPanel 
                                        draft={draftIngredient}
                                        onResume={() => handleResumeDraft(draftIngredient)}
                                        onDiscard={() => handleDeleteDraft(draftIngredient.id)}
                                    />
                                );
                            } else {
                                const publishedIng = publishedIngredients?.find(i => i.id === selectedIngredientId);
                                if (publishedIng) {
                                    const mapped = mapPublishedItem(publishedIng, 'ingredient');
                                    return (
                                        <DraftPreviewPanel 
                                            draft={mapped}
                                            onResume={() => handleEditPublished(mapped)}
                                            onDiscard={() => handleDeletePublished(mapped.id, 'ingredient')}
                                        />
                                    );
                                }
                                return null;
                            }
                        })()}
                    </YStack>
                )}
            </XStack>
        );
    }

    return (
        <YStack flex={1} backgroundColor="$background">
            <Stack.Screen options={{ headerShown: false }} />
            
            <XStack
                paddingTop={insets.top + 20}
                paddingHorizontal="$4"
                paddingBottom="$4"
                alignItems="center"
                zIndex={10}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="chevron.left" size={24} color={theme.color?.get() as string} />
                </TouchableOpacity>
                <Text fontSize="$5" fontWeight="bold" marginLeft="$2">Creator Hub</Text>
            </XStack>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                
                {/* Workspace Items Section */}
                <YStack gap="$4" marginBottom="$6">
                    <Text fontSize={14} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600">
                        Workspace Items
                    </Text>
                    {isLoading ? (
                        <Text color="$color11">Loading workspace items...</Text>
                    ) : allItems.length === 0 ? (
                        <Text color="$color11">No items in workspace.</Text>
                    ) : (
                        Object.keys(itemsByBar).map((barId) => {
                            const barItems = itemsByBar[barId] || [];
                            const menus = barItems.filter((d: any) => d.entity_type === 'menu');
                            const items = barItems.filter((d: any) => d.entity_type === 'ingredient' || d.entity_type === 'beer' || d.entity_type === 'wine' || d.entity_type === 'cocktail');

                            const hasMenus = menus.length > 0;
                            const hasItems = items.length > 0;

                            const sections = [
                                { key: 'menu', label: 'Menus', icon: 'TabMenus', items: menus },
                                { key: 'item', label: 'Items', icon: 'TabIngredients', items: items }
                            ].filter(s => s.items.length > 0);

                            return (
                                <YStack key={barId} gap="$3" width="100%" marginBottom="$4">
                                    <Text fontSize={12} color="$color11" fontWeight="bold">
                                        {getBarName(barId)}
                                    </Text>
                                    <YStack gap="$2.5" width="100%">
                                        {sections.map((section) => {
                                            const expanded = isSectionExpanded(barId, section.key, hasMenus, hasItems);
                                            return (
                                                <YStack key={section.key} width="100%" gap="$2.5">
                                                    <TouchableOpacity
                                                        onPress={() => toggleSection(barId, section.key, hasMenus, hasItems)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <XStack
                                                            paddingVertical="$2"
                                                            alignItems="center"
                                                            gap="$2.5"
                                                        >
                                                            <CustomIcon name={section.icon} size={20} color={theme.color?.get() as string} />
                                                            <Text fontSize={14} fontWeight="600" color="$color">
                                                                {section.label} ({section.items.length})
                                                            </Text>
                                                            <IconSymbol
                                                                name={expanded ? "chevron.down" : "chevron.right"}
                                                                size={18}
                                                                color={theme.color11?.get() as string}
                                                            />
                                                        </XStack>
                                                    </TouchableOpacity>

                                                    {expanded && (
                                                        <XStack flexWrap="wrap" gap="$3" width="100%" marginTop="$1" paddingLeft="$1">
                                                            {section.items.map((draft: any) => {
                                                                const date = new Date(draft.updated_at);
                                                                const dateString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                                const authorName = draft.isPublished 
                                                                    ? "Published"
                                                                    : (draft.user_id === user?.id 
                                                                        ? "You" 
                                                                        : (draft.draft_data?.last_editor_email || "Another Member"));
                                                                
                                                                const progressInfo = calculateDraftProgress(draft, drafts, dropdowns);
                                                                const infoString = draft.isPublished 
                                                                    ? `Published • ${dateString}` 
                                                                    : `Edited by ${authorName} • ${dateString}`;

                                                                return (
                                                                    <YStack
                                                                        key={draft.id}
                                                                        backgroundColor="$backgroundStrong"
                                                                        borderRadius="$4"
                                                                        borderWidth={1.5}
                                                                        borderColor={progressInfo.color}
                                                                        padding="$3"
                                                                        gap="$3"
                                                                        width="100%"
                                                                        $gtSm={{ width: '48.5%' }}
                                                                        $gtMd={{ width: '32%' }}
                                                                        $gtLg={{ width: '23.8%' }}
                                                                    >
                                                                        <XStack alignItems="center" justifyContent="space-between" width="100%">
                                                                            <TouchableOpacity 
                                                                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} 
                                                                                onPress={() => draft.isPublished ? handleEditPublished(draft) : handleResumeDraft(draft)}
                                                                            >
                                                                                <View style={styles.iconContainer}>
                                                                                    <CustomIcon name={getIconForType(draft.entity_type)} size={24} color={theme.color?.get() as string} />
                                                                                </View>
                                                                                <YStack marginLeft="$3" flex={1} gap="$1">
                                                                                    <XStack alignItems="center" gap="$2" flexWrap="wrap">
                                                                                        <Text fontSize={16} fontWeight="bold" color="$color" numberOfLines={1} style={{ flexShrink: 1 }}>
                                                                                            {draft.draft_data?.name || draft.draft_data?.menuName || `Untitled ${draft.entity_type}`}
                                                                                        </Text>
                                                                                        {draft.isPublished ? (
                                                                                            <IconSymbol name="checkmark" size={14} color="#34C759" />
                                                                                        ) : (
                                                                                            <View style={[styles.statusBadge, { backgroundColor: progressInfo.badgeBg, borderColor: progressInfo.color, borderWidth: 1 }]}>
                                                                                                <Text style={[styles.statusBadgeText, { color: progressInfo.badgeText }]}>
                                                                                                    {progressInfo.label}
                                                                                                </Text>
                                                                                            </View>
                                                                                        )}
                                                                                    </XStack>
                                                                                </YStack>
                                                                            </TouchableOpacity>
                                                                            <TouchableOpacity 
                                                                                onPress={() => draft.isPublished ? handleDeletePublished(draft.id, draft.entity_type) : handleDeleteDraft(draft.id)} 
                                                                                style={{ padding: 8 }}
                                                                            >
                                                                                <IconSymbol name="trash" size={20} color="#ff4444" />
                                                                            </TouchableOpacity>
                                                                        </XStack>

                                                                        {/* Visual Progress Bar */}
                                                                        <YStack width="100%" gap="$1">
                                                                            <View style={styles.progressBarTrack}>
                                                                                <View style={[styles.progressBarFill, { width: `${progressInfo.percentage}%`, backgroundColor: progressInfo.color }]} />
                                                                            </View>
                                                                            <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap">
                                                                                {draft.isPublished ? (
                                                                                    <IconSymbol name="checkmark" size={12} color="#34C759" />
                                                                                ) : (
                                                                                    <Text fontSize={10} color="$color11" fontWeight="600">
                                                                                        {`${progressInfo.percentage}% complete`}
                                                                                    </Text>
                                                                                )}
                                                                                <Text fontSize={10} color="$color11" style={{ flexShrink: 1, textAlign: 'right', marginLeft: 8 }} numberOfLines={1}>
                                                                                    {infoString}
                                                                                </Text>
                                                                            </XStack>
                                                                        </YStack>

                                                                        {/* Child Draft Sub-dependencies */}
                                                                        {progressInfo.innerDrafts && progressInfo.innerDrafts.length > 0 && (
                                                                            <YStack gap="$2" borderTopWidth={1} borderTopColor="rgba(255, 255, 255, 0.08)" paddingTop="$2.5">
                                                                                <Text fontSize={9} color="$color11" fontWeight="bold" letterSpacing={0.5} textTransform="uppercase">
                                                                                    Contains Draft Dependencies:
                                                                                </Text>
                                                                                <YStack gap="$1.5">
                                                                                    {progressInfo.innerDrafts.map((childDraft: any) => {
                                                                                        const childProgress = calculateDraftProgress(childDraft, drafts, dropdowns);
                                                                                        return (
                                                                                            <TouchableOpacity
                                                                                                key={childDraft.id}
                                                                                                onPress={() => handleResumeDraft(childDraft)}
                                                                                                style={{
                                                                                                    flexDirection: 'row',
                                                                                                    alignItems: 'center',
                                                                                                    justifyContent: 'space-between',
                                                                                                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                                                                                                    paddingVertical: 6,
                                                                                                    paddingHorizontal: 8,
                                                                                                    borderRadius: 6,
                                                                                                }}
                                                                                                activeOpacity={0.7}
                                                                                            >
                                                                                                <XStack alignItems="center" gap="$2" flex={1}>
                                                                                                    <CustomIcon
                                                                                                        name={getIconForType(childDraft.entity_type)}
                                                                                                        size={14}
                                                                                                        color={theme.color11?.get() as string}
                                                                                                    />
                                                                                                    <Text fontSize={12} color="$color" fontWeight="500" numberOfLines={1} style={{ flex: 1 }}>
                                                                                                        {capitalize(childDraft.draft_data?.name || `Untitled ${childDraft.entity_type}`)}
                                                                                                    </Text>
                                                                                                </XStack>
                                                                                                <View
                                                                                                    style={{
                                                                                                        backgroundColor: childProgress.badgeBg,
                                                                                                        borderColor: childProgress.color,
                                                                                                        borderWidth: 1,
                                                                                                        borderRadius: 4,
                                                                                                        paddingHorizontal: 4,
                                                                                                        paddingVertical: 1,
                                                                                                        marginLeft: 6,
                                                                                                    }}
                                                                                                >
                                                                                                    <Text
                                                                                                        style={{
                                                                                                            color: childProgress.badgeText,
                                                                                                            fontSize: 8,
                                                                                                            fontWeight: 'bold',
                                                                                                        }}
                                                                                                    >
                                                                                                        {childProgress.percentage}%
                                                                                                    </Text>
                                                                                                </View>
                                                                                            </TouchableOpacity>
                                                                                        );
                                                                                    })}
                                                                                </YStack>
                                                                            </YStack>
                                                                        )}
                                                                    </YStack>
                                                                );
                                                            })}
                                                        </XStack>
                                                    )}
                                                </YStack>
                                            );
                                        })}
                                    </YStack>
                                </YStack>
                            );
                        })
                    )}
                </YStack>

                {/* Create New Section */}
                <YStack gap="$3">
                    <Text fontSize={14} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600">
                        Create New
                    </Text>
                    <UniversalCreateButton variant="button" />
                </YStack>

            </ScrollView>
        </YStack>
    );
}

const styles = StyleSheet.create({
    headerBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    content: {
        padding: 20,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    progressBarTrack: {
        height: 4,
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    }
});
