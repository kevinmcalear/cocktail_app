import React from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, Alert, Platform, useWindowDimensions, PanResponder } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack, YStack, useTheme } from 'tamagui';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { useDrafts } from '@/hooks/useDrafts';
import { useBars } from '@/hooks/useBars';
import { useAuth } from '@/ctx/AuthContext';
import { useDropdowns } from '@/hooks/useDropdowns';
import { calculateDraftProgress } from '@/lib/draftProgress';
import { capitalize } from '@/lib/stringUtils';
import { UniversalCreateButton } from '@/components/UniversalCreateButton';
import { CreatorWorkspace } from '@/components/CreatorWorkspace';
import { CreatorWorkspaceEditor } from '@/components/CreatorWorkspaceEditor';
import { DraftFolderTree, SelectedDraftNode } from '@/components/DraftFolderTree';
import type { SearchItem } from '@/components/SearchList';
import {
    WorkspaceFrame,
    EditingState,
    buildNodeFromItem,
    buildWorkspaceFrame,
    findItemByNode,
    buildNodeFromIngredientId,
    isNavigableIngredient,
} from '@/lib/creatorWorkspaceUtils';
import { useCocktails } from '@/hooks/useCocktails';
import { useBeers } from '@/hooks/useBeers';
import { useWines } from '@/hooks/useWines';
import { useIngredients } from '@/hooks/useIngredients';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EditorChromeState } from '@/lib/editorChrome';
import { useCreatorNavStore } from '@/store/useCreatorNavStore';

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
    // ponytail: on web the explorer lives in WebSidebar; this screen is workspace-only
    const isWebShell = Platform.OS === 'web';

    const storeNode = useCreatorNavStore((s) => s.selectedNode);
    const pendingCreate = useCreatorNavStore((s) => s.pendingCreate);
    const clearPendingCreate = useCreatorNavStore((s) => s.clearPendingCreate);

    const [expandedSections, setExpandedSections] = React.useState<Record<string, Record<string, boolean>>>({});
    const [selectedNode, setSelectedNode] = React.useState<SelectedDraftNode | null>(null);
    const [navigationStack, setNavigationStack] = React.useState<WorkspaceFrame[]>([]);
    const [editorChrome, setEditorChrome] = React.useState<EditorChromeState | null>(null);

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

    const clearWorkspaceIfContains = (id: string) => {
        if (selectedNode?.id === id || navigationStack.some((frame) => frame.node.id === id)) {
            setSelectedNode(null);
            setNavigationStack([]);
        }
    };

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
                
                clearWorkspaceIfContains(id);
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
            openWorkspace(buildNodeFromItem(item));
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

    const openWorkspace = React.useCallback((node: SelectedDraftNode) => {
        if (node.type === 'bar') {
            setSelectedNode(node);
            setNavigationStack([{
                node,
                editing: { mode: 'edit', type: 'bar', barId: node.id, publishedId: node.id },
            }]);
            return;
        }
        const frame = buildWorkspaceFrame(node, allItems);
        if (!frame) return;
        setSelectedNode(node);
        setNavigationStack([frame]);
    }, [allItems]);

    const openCreateWorkspace = (type: EditingState['type'], barId: string) => {
        const nodeType = type === 'menu' ? 'menu_draft' : type === 'ingredient' ? 'ingredient_draft' : 'drink_draft';
        setSelectedNode(null);
        setNavigationStack([{
            node: {
                type: nodeType,
                id: '__new__',
                name: `New ${capitalize(type)}`,
            },
            editing: { mode: 'create', type, barId },
        }]);
    };

    const handleCreateDrinkPress = (params: {
        query: string;
        barId: string;
        menuDraftId?: string;
        menuSectionId?: string;
    }) => {
        setNavigationStack((prev) => [
            ...prev,
            {
                node: {
                    type: 'drink_draft',
                    id: '__new__',
                    name: params.query || 'New Cocktail',
                },
                editing: {
                    mode: 'create',
                    type: 'cocktail',
                    barId: params.barId,
                    menuDraftId: params.menuDraftId,
                    menuSectionId: params.menuSectionId,
                    initialName: params.query,
                },
            },
        ]);
    };

    const handleEditorClose = () => {
        setNavigationStack((prev) => {
            if (prev.length > 1) {
                const newStack = prev.slice(0, -1);
                setSelectedNode(newStack[newStack.length - 1].node);
                return newStack;
            }
            setSelectedNode(null);
            return [];
        });
    };

    const handleSaveComplete = () => {
        setNavigationStack([]);
        setSelectedNode(null);
        queryClient.invalidateQueries();
    };

    const handleNavigateToFrame = (index: number) => {
        setNavigationStack((prev) => {
            const newStack = prev.slice(0, index + 1);
            setSelectedNode(newStack[newStack.length - 1].node);
            return newStack;
        });
    };

    const handleNestedItemPress = (ingredientId: string) => {
        if (!isNavigableIngredient(ingredientId, drafts, publishedIngredients)) return;
        const node = buildNodeFromIngredientId(ingredientId, drafts, publishedIngredients);
        if (!node) return;
        const frame = buildWorkspaceFrame(node, allItems);
        if (!frame) return;
        setNavigationStack((prev) => [...prev, frame]);
        setSelectedNode(node);
    };

    // ponytail: same stack push as nested ingredients — back returns to the menu
    const handleOpenMenuDrink = (drink: SearchItem) => {
        const cleanId = drink.id.replace(/^(beer|wine)-/, '');
        const node: SelectedDraftNode = drink.isDraft
            ? { type: 'drink_draft', id: cleanId, name: drink.name }
            : { type: 'published_drink', id: cleanId, name: drink.name };
        const frame = buildWorkspaceFrame(node, allItems);
        if (!frame) return;
        setNavigationStack((prev) => [...prev, frame]);
        setSelectedNode(node);
    };

    const activeFrame = navigationStack.at(-1) ?? null;
    const activeItem = activeFrame && activeFrame.editing.type !== 'bar'
        ? findItemByNode(activeFrame.node, allItems)
        : null;
    const workspaceMeta = activeFrame?.editing.type === 'bar'
        ? { type: 'bar', name: activeFrame.node.name }
        : activeFrame?.node.id === '__new__'
        ? { type: activeFrame.editing.type, name: activeFrame.node.name }
        : null;

    React.useEffect(() => {
        setEditorChrome(null);
    }, [activeFrame?.node.id, activeFrame?.editing.mode]);

    // Web sidebar drives selection / create into this workspace
    React.useEffect(() => {
        if (!isWebShell || !storeNode || pendingCreate) return;
        if (selectedNode?.id === storeNode.id && selectedNode?.type === storeNode.type) return;
        openWorkspace(storeNode);
    }, [isWebShell, storeNode, pendingCreate, selectedNode?.id, selectedNode?.type, openWorkspace]);

    React.useEffect(() => {
        if (!isWebShell || !pendingCreate) return;
        openCreateWorkspace(pendingCreate.type, pendingCreate.barId);
        clearPendingCreate();
    }, [isWebShell, pendingCreate, clearPendingCreate]);

    // Auto-select first item on large screen when items load (native / non-shell only)
    React.useEffect(() => {
        if (isWebShell) return;
        if (isLargeScreen && allItems.length > 0 && navigationStack.length === 0 && !selectedNode) {
            openWorkspace(buildNodeFromItem(allItems[0]));
        }
    }, [isWebShell, isLargeScreen, allItems.length, navigationStack.length, selectedNode, openWorkspace]);

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

    const handleDeleteDraft = (id: string) => {
        const afterDelete = () => {
            deleteDraft(id);
            clearWorkspaceIfContains(id);
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
            openWorkspace(buildNodeFromItem({ ...draft, isPublished: false }));
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
        const workspace = (
            <YStack flex={1} height="100%">
                {activeFrame ? (
                    <CreatorWorkspace
                        navigationStack={navigationStack}
                        activeItem={activeItem}
                        workspaceMeta={workspaceMeta}
                        drafts={drafts}
                        dropdowns={dropdowns}
                        onNavigateToFrame={handleNavigateToFrame}
                        onDiscard={activeItem ? () => (
                            activeItem.isPublished
                                ? handleDeletePublished(activeItem.id, activeItem.entity_type)
                                : handleDeleteDraft(activeItem.id)
                        ) : undefined}
                        onCancel={editorChrome?.cancel}
                        onSave={editorChrome ? () => void editorChrome.save() : undefined}
                        saving={editorChrome?.saving}
                        isDirty={editorChrome?.isDirty}
                    >
                        <React.Fragment key={`${activeFrame.node.type}-${activeFrame.node.id}-${activeFrame.editing.mode}`}>
                            <CreatorWorkspaceEditor
                                editing={activeFrame.editing}
                                onClose={handleEditorClose}
                                onSave={handleSaveComplete}
                                onNestedItemPress={handleNestedItemPress}
                                onCreateDrinkPress={handleCreateDrinkPress}
                                onOpenDrink={handleOpenMenuDrink}
                                onChromeState={setEditorChrome}
                            />
                        </React.Fragment>
                    </CreatorWorkspace>
                ) : (
                    <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
                        <IconSymbol name="plus.circle" size={48} color={theme.color11?.get() as string} style={{ opacity: 0.3 }} />
                        <Text color="$color11" fontSize={16} fontWeight="500" marginTop="$4" textAlign="center">
                            Select an item from the sidebar to start editing, or create something new.
                        </Text>
                    </YStack>
                )}
            </YStack>
        );

        // Web: explorer is in WebSidebar — workspace fills the content column
        if (isWebShell) {
            return (
                <YStack flex={1} backgroundColor="$background">
                    <Stack.Screen options={{ headerShown: false }} />
                    {workspace}
                </YStack>
            );
        }

        return (
            <XStack flex={1} backgroundColor="$background" style={{ paddingTop: insets.top }}>
                <Stack.Screen options={{ headerShown: false }} />
                
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
                                openWorkspace(node);
                            }}
                            onCreateNode={(type, barId) => {
                                openCreateWorkspace(type, barId);
                            }}
                        />
                    </YStack>
                    <YStack padding="$4" borderTopWidth={1} borderTopColor="$borderColor" width="100%" gap="$3">
                        <UniversalCreateButton variant="button" width="100%" />
                    </YStack>
                </YStack>

                <YStack
                    position="absolute"
                    top={0}
                    left={sidebarWidth - 5}
                    bottom={0}
                    width={10}
                    zIndex={100}
                    alignItems="center"
                    backgroundColor="transparent"
                    {...panResponder.panHandlers}
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

                {workspace}
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
