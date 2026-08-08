import { CurrentMenuList, MenuItem, MenuSection } from "@/components/CurrentMenuList";
import { SearchItem } from "@/components/SearchList";
import { SearchPopover } from "@/components/SearchPopover";
import { NotionCover } from "@/components/menu/NotionCover";
import { TemplatePicker } from "@/components/menu/TemplatePicker";
import { AdaptiveSheetModal } from "@/components/ui/AdaptiveSheetModal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBars } from "@/hooks/useBars";
import { useBeers } from "@/hooks/useBeers";
import { useCocktails } from "@/hooks/useCocktails";
import { useDrafts } from "@/hooks/useDrafts";
import { DROPDOWNS_QUERY_KEY, useDropdowns } from "@/hooks/useDropdowns";
import { useMenuDetails } from "@/hooks/useMenuDetails";
import { useMenuEditor } from "@/hooks/useMenuEditor";
import { useWines } from "@/hooks/useWines";
import { inSelectedContext, PERSONAL_CONTEXT } from "@/lib/barContextFilter";
import { currentForLabel } from "@/lib/currentFromMenus";
import { withDrinkInSection } from "@/lib/menuDrinkAttach";
import { buildMenuDrinkIndex } from "@/lib/menuDrinkIndex";
import {
    itemAllowedInSection,
    normalizeAllowedTypes,
    sectionCommandFilter,
    sectionCommandFilters,
} from "@/lib/sectionAllowedTypes";
import { capitalize, handleCapitalizedChange } from "@/lib/stringUtils";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import {
    creatorCreateHref,
    openDraftInCreator,
    useCreatorNavStore,
} from "@/store/useCreatorNavStore";
import { useMenuEditDropStore } from "@/store/useMenuEditDropStore";
import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, XStack, YStack, useTheme } from "tamagui";

function firstDrinkImageUrl(sections: { data: { image?: any }[] }[] | undefined): string | null {
    for (const section of sections || []) {
        for (const item of section.data) {
            if (typeof item.image === "string" && item.image) return item.image;
            if (item.image?.uri) return item.image.uri as string;
        }
    }
    return null;
}

function toMenuItem(drink: SearchItem): MenuItem {
    const image =
        drink.image?.uri ||
        drink.item_images?.[0]?.images?.url ||
        (typeof drink.image === "string" ? drink.image : undefined);
    const ingredients =
        drink.recipes
            ?.map((r) => (r.ingredient?.name ? capitalize(r.ingredient.name) : ""))
            .filter(Boolean)
            .join(", ") ||
        drink.description ||
        "";
    return {
        id: drink.id,
        name: drink.name,
        description: drink.description || "",
        ingredients,
        price: drink.price || undefined,
        image: image || undefined,
        recipes: drink.recipes,
        isDraft: drink.isDraft,
        draftProgress: drink.draftProgress,
    };
}

export default function MenusScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const queryClient = useQueryClient();
    const { width } = useWindowDimensions();
    const isWide = width >= 768;
    const selectedMenuId = useAppStore((s) => s.selectedMenuId);
    const setSelectedMenuId = useAppStore((s) => s.setSelectedMenuId);
    const requestCreate = useCreatorNavStore((s) => s.requestCreate);
    const pendingMenuDrink = useCreatorNavStore((s) => s.pendingMenuDrink);
    const consumeMenuDrink = useCreatorNavStore((s) => s.consumeMenuDrink);

    const { data: dropdowns, isLoading: loadingMenus, refetch } = useDropdowns();
    const { data: userBars } = useBars();
    const { drafts } = useDrafts();
    const menus = dropdowns?.menus || [];
    const templates = dropdowns?.menuTemplates || [];
    // Always show Edit for menus you can see — RLS enforces writes. (bar_id-null menus broke role lookup.)
    const canEdit = !!selectedMenuId;

    const [actionsOpen, setActionsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [pickingSectionId, setPickingSectionId] = useState<string | null>(null);
    const [togglingCurrent, setTogglingCurrent] = useState(false);

    const editor = useMenuEditor(selectedMenuId, isEditing);

    // ponytail: create-from-picker returns via store (published menu has no draft to patch)
    useEffect(() => {
        if (!pendingMenuDrink || !isEditing || !editor.loaded) return;
        const pending = consumeMenuDrink();
        if (!pending) return;
        editor.setSelections((prev) =>
            withDrinkInSection(prev, pending.sectionId, pending.drinkId, pending.replaceId)
        );
    }, [
        pendingMenuDrink,
        isEditing,
        editor.loaded,
        editor.setSelections,
        consumeMenuDrink,
    ]);

    // ponytail: all contexts so menu venue drinks resolve even if global picker differs
    const { data: cocktailsData } = useCocktails({ allContexts: true });
    const { data: beersData } = useBeers({ allContexts: true });
    const { data: winesData } = useWines({ allContexts: true });

    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

    useEffect(() => {
        if (menus.length === 0) return;
        const stillValid = selectedMenuId && menus.some((m) => m.id === selectedMenuId);
        if (!stillValid) {
            setSelectedMenuId(menus[menus.length - 1].id);
            setIsEditing(false);
        }
    }, [menus, selectedMenuId, setSelectedMenuId]);

    // Leaving a menu cancels edit
    useEffect(() => {
        setIsEditing(false);
    }, [selectedMenuId]);

    const barNameById = useMemo(() => {
        const map = new Map<string, string>();
        for (const ub of userBars || []) {
            const bar = (ub as any).bars;
            if (bar?.id) map.set(bar.id, bar.name);
        }
        return map;
    }, [userBars]);

    const { data: menuDetails, isLoading: loadingDetails } = useMenuDetails(selectedMenuId);
    const selectedMenu = menus.find((m) => m.id === selectedMenuId) ?? null;

    const drinkIndex = useMemo(
        () =>
            buildMenuDrinkIndex({
                drafts,
                cocktails: cocktailsData,
                beers: beersData,
                wines: winesData,
            }),
        [cocktailsData, beersData, winesData, drafts]
    );

    const viewItemsById = useMemo(() => {
        const map = new Map<string, MenuItem>();
        for (const sec of menuDetails?.sections || []) {
            for (const item of sec.data) map.set(item.id, item);
        }
        return map;
    }, [menuDetails?.sections]);

    const editSections: MenuSection[] = useMemo(() => {
        if (!isEditing || !editor.loaded) return [];
        return editor.activeSections.map((sec: any) => ({
            id: sec.id,
            title: sec.name,
            allowedTypes: normalizeAllowedTypes(sec.allowed_types),
            data: (editor.selections[sec.id] || []).map((id) => {
                const fromView = viewItemsById.get(id);
                if (fromView) return fromView;
                const drink = drinkIndex.get(id);
                return drink
                    ? toMenuItem(drink)
                    : { id, name: "Unknown", description: "", ingredients: "" };
            }),
        }));
    }, [
        isEditing,
        editor.loaded,
        editor.activeSections,
        editor.selections,
        drinkIndex,
        viewItemsById,
    ]);

    const pickingAllowedTypes = useMemo(() => {
        if (!pickingSectionId) return normalizeAllowedTypes(null);
        const sec = editor.activeSections.find((s: any) => s.id === pickingSectionId);
        return normalizeAllowedTypes(sec?.allowed_types);
    }, [pickingSectionId, editor.activeSections]);

    // ponytail: ⌘K / picker long-press → drop on any compatible Add tile
    const sectionsRef = useRef(editor.activeSections);
    const selectionsRef = useRef(editor.selections);
    const setSelectionsRef = useRef(editor.setSelections);
    sectionsRef.current = editor.activeSections;
    selectionsRef.current = editor.selections;
    setSelectionsRef.current = editor.setSelections;

    useEffect(() => {
        if (!isEditing || !editor.loaded) return;
        const allowedBySection: Record<string, ReturnType<typeof normalizeAllowedTypes>> = {};
        for (const sec of sectionsRef.current as any[]) {
            allowedBySection[sec.id] = normalizeAllowedTypes(sec.allowed_types);
        }
        useMenuEditDropStore.getState().register({
            allowedBySection,
            tryAdd: (sectionId, item) => {
                const types = allowedBySection[sectionId];
                if (!types || !itemAllowedInSection(item, types)) return 'denied';
                const current = selectionsRef.current[sectionId] || [];
                if (current.includes(item.id)) {
                    Alert.alert('Already Added', 'This drink is already in this section.');
                    return 'duplicate';
                }
                setSelectionsRef.current((prev) => ({
                    ...prev,
                    [sectionId]: [...(prev[sectionId] || []), item.id],
                }));
                return 'ok';
            },
        });
        return () => useMenuEditDropStore.getState().unregister();
    }, [isEditing, editor.loaded, editor.activeSections]);

    const menuContextId = selectedMenu?.bar_id || PERSONAL_CONTEXT;

    const pickerItems = useMemo(() => {
        const ctx = [menuContextId];
        const idx = buildMenuDrinkIndex({
            drafts: drafts.filter((d: any) => inSelectedContext(d.bar_id, ctx)),
            cocktails: (cocktailsData || []).filter((c: any) => inSelectedContext(c.bar_id, ctx)),
            beers: (beersData || []).filter((b: any) => inSelectedContext(b.bar_id, ctx)),
            wines: (winesData || []).filter((w: any) => inSelectedContext(w.bar_id, ctx)),
        });
        return Array.from(idx.values()).filter((d) =>
            itemAllowedInSection(d, pickingAllowedTypes)
        );
    }, [
        menuContextId,
        drafts,
        cocktailsData,
        beersData,
        winesData,
        pickingAllowedTypes,
    ]);

    const viewCoverUrl =
        selectedMenu?.cover_url || firstDrinkImageUrl(menuDetails?.sections) || null;
    const coverUrl = isEditing ? editor.coverUrl || viewCoverUrl : viewCoverUrl;
    const coverPosition = isEditing
        ? editor.coverPosition
        : typeof selectedMenu?.cover_position === "number"
          ? selectedMenu.cover_position
          : 50;
    const venueName = selectedMenu?.bar_id ? barNameById.get(selectedMenu.bar_id) : null;
    const currentLabel = currentForLabel(selectedMenu?.bar_id, venueName);
    const isCurrent = selectedMenu?.is_active === true;

    const toggleCurrent = async () => {
        if (!selectedMenu || togglingCurrent) return;
        setTogglingCurrent(true);
        try {
            const { error } = await supabase
                .from('menus')
                .update({ is_active: !isCurrent })
                .eq('id', selectedMenu.id);
            if (error) throw error;
            await queryClient.invalidateQueries({ queryKey: DROPDOWNS_QUERY_KEY });
            setActionsOpen(false);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Could not update Current status.');
        } finally {
            setTogglingCurrent(false);
        }
    };
    // Keep view values until editor finishes loading — never flash empty
    const displayName = isEditing
        ? editor.menuName || selectedMenu?.name || ""
        : selectedMenu?.name;
    const sections =
        isEditing && editor.loaded ? editSections : menuDetails?.sections || [];
    const templateIdForPicker = isEditing
        ? editor.selectedTemplateId || selectedMenu?.template_id || null
        : null;

    const menuDrafts = useMemo(
        () => drafts.filter((d: any) => d.entity_type === "menu" && !d.isPublished),
        [drafts]
    );

    const startEdit = () => setIsEditing(true);

    const cancelEdit = () => {
        if (editor.isDirty) {
            Alert.alert("Discard changes?", "Your edits will be lost.", [
                { text: "Keep editing", style: "cancel" },
                {
                    text: "Discard",
                    style: "destructive",
                    onPress: () => {
                        editor.discard();
                        setIsEditing(false);
                    },
                },
            ]);
            return;
        }
        editor.discard();
        setIsEditing(false);
    };

    const saveEdit = async () => {
        const ok = await editor.save();
        if (ok) {
            editor.discard();
            setIsEditing(false);
            refetch();
        }
    };

    const headerActions = canEdit ? (
        <XStack alignItems="center" gap="$2">
            {isEditing ? (
                <>
                    <TemplatePicker
                        templates={templates}
                        selectedId={templateIdForPicker}
                        onSelect={editor.setSelectedTemplateId}
                    />
                    <TouchableOpacity onPress={cancelEdit} style={{ padding: 8 }}>
                        <Text color="$color11" fontWeight="600" fontSize={16}>
                            Cancel
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={saveEdit}
                        disabled={editor.saving || !editor.isDirty}
                        style={{ padding: 8, opacity: editor.isDirty ? 1 : 0.4 }}
                    >
                        <Text color={theme.color8?.get() as string} fontWeight="bold" fontSize={16}>
                            {editor.saving ? "Saving…" : "Save"}
                        </Text>
                    </TouchableOpacity>
                </>
            ) : (
                <>
                    {selectedMenu ? (
                        <TouchableOpacity onPress={startEdit} style={{ padding: 8 }}>
                            <Text color={theme.color8?.get() as string} fontWeight="bold" fontSize={16}>
                                Edit
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity onPress={() => setActionsOpen(true)} style={{ padding: 8 }}>
                        <IconSymbol name="ellipsis" size={22} color={theme.color?.get() as string} />
                    </TouchableOpacity>
                </>
            )}
        </XStack>
    ) : null;

    const padH = 15;

    const header = (
        <YStack>
            {coverUrl ? (
                <NotionCover
                    uri={coverUrl}
                    position={coverPosition}
                    maxHeight={isWide ? 280 : 220}
                    editing={isEditing}
                    onPositionChange={
                        isEditing
                            ? (pos) => {
                                  // promote drink-fallback cover into real cover_url on first reposition
                                  if (!editor.coverUrl && viewCoverUrl) editor.setCoverUrl(viewCoverUrl);
                                  editor.setCoverPosition(pos);
                              }
                            : undefined
                    }
                    onChangeCover={isEditing ? editor.pickCover : undefined}
                />
            ) : isEditing ? (
                <Pressable
                    onPress={editor.pickCover}
                    style={[styles.addCover, { maxHeight: isWide ? 280 : 220 }]}
                >
                    {editor.uploadingCover ? (
                        <ActivityIndicator color={theme.color8?.get() as string} />
                    ) : (
                        <Text color="$color11" fontWeight="600">
                            Add cover
                        </Text>
                    )}
                </Pressable>
            ) : (
                <View style={{ height: insets.top }} />
            )}
            <XStack
                paddingHorizontal={padH}
                paddingTop={coverUrl || isEditing ? 24 : insets.top + 24}
                paddingBottom={4}
                alignItems="flex-start"
                justifyContent="space-between"
                gap="$3"
            >
                <YStack flex={1} gap="$1" minWidth={0}>
                    {isEditing ? (
                        <TextInput
                            value={editor.menuName}
                            onChangeText={(val) =>
                                handleCapitalizedChange(val, editor.menuName, editor.setMenuName)
                            }
                            onBlur={() => editor.setMenuName(capitalize(editor.menuName))}
                            placeholder="Menu name"
                            placeholderTextColor={theme.color11?.get() as string}
                            style={{
                                fontSize: isWide ? 40 : 28,
                                lineHeight: isWide ? 46 : 34,
                                fontFamily: "IBMPlexSansItalic",
                                fontStyle: "italic",
                                color: theme.color?.get() as string,
                                padding: 0,
                            }}
                        />
                    ) : (
                        <Text
                            fontSize={isWide ? 40 : 28}
                            lineHeight={isWide ? 46 : 34}
                            fontFamily="IBMPlexSansItalic"
                            fontStyle="italic"
                            color="$color"
                            numberOfLines={2}
                        >
                            {displayName || (loadingMenus ? "Loading…" : "No menus yet")}
                        </Text>
                    )}
                    {isCurrent || venueName ? (
                        <Text fontSize={14} color="$color11" numberOfLines={1}>
                            {isCurrent ? `Current for ${currentLabel}` : venueName}
                        </Text>
                    ) : null}
                    {(loadingDetails || (isEditing && !editor.loaded)) ? (
                        <ActivityIndicator
                            color={theme.color8?.get() as string}
                            style={{ alignSelf: "flex-start", marginTop: 8 }}
                        />
                    ) : null}
                </YStack>
                {headerActions}
            </XStack>
        </YStack>
    );

    if (!loadingMenus && menus.length === 0) {
        return (
            <YStack
                flex={1}
                backgroundColor="$background"
                paddingTop={insets.top + 40}
                paddingHorizontal={24}
                gap="$4"
            >
                <Text fontSize={32} fontFamily="IBMPlexSansItalic" fontStyle="italic" color="$color">
                    Menus
                </Text>
                <Text color="$color11" fontSize={15}>
                    No menus yet. Create one to start building your list.
                </Text>
                {canEdit ? (
                    <TouchableOpacity
                        onPress={() =>
                            router.push(
                                creatorCreateHref(
                                    'menu',
                                    selectedMenu?.bar_id || PERSONAL_CONTEXT
                                ) as any
                            )
                        }
                        style={[styles.primaryBtn, { backgroundColor: theme.color8?.get() as string }]}
                    >
                        <Text
                            color={theme.backgroundStrong?.get() as string}
                            fontWeight="bold"
                            fontSize={16}
                        >
                            New Menu
                        </Text>
                    </TouchableOpacity>
                ) : null}
                {menuDrafts.length > 0 ? (
                    <YStack gap="$2" marginTop="$4">
                        <Text
                            fontSize={11}
                            fontWeight="600"
                            color="$color11"
                            textTransform="uppercase"
                            letterSpacing={0.8}
                        >
                            Drafts
                        </Text>
                        {menuDrafts.map((d: any) => (
                            <Pressable
                                key={d.id}
                                onPress={() =>
                                    openDraftInCreator(d, (href) => router.push(href as any))
                                }
                                style={[
                                    styles.actionRow,
                                    { borderBottomColor: theme.borderColor?.get() as string },
                                ]}
                            >
                                <Text color="$color" fontSize={16} fontWeight="500">
                                    {d.draft_data?.menuName || d.draft_data?.name || "Untitled Menu"}
                                </Text>
                                <Text color="$color11" fontSize={12}>
                                    Draft
                                </Text>
                            </Pressable>
                        ))}
                    </YStack>
                ) : null}
            </YStack>
        );
    }

    return (
        <YStack flex={1} backgroundColor="$background">
            <CurrentMenuList
                sections={sections}
                ListHeaderComponent={header}
                isEditing={isEditing && editor.loaded}
                onRemoveItem={(sectionId, itemId) => {
                    editor.setSelections((prev) => ({
                        ...prev,
                        [sectionId]: (prev[sectionId] || []).filter((id) => id !== itemId),
                    }));
                }}
                onAddToSection={(sectionId) => setPickingSectionId(sectionId)}
            />

            <SearchPopover
                visible={!!pickingSectionId}
                onClose={() => setPickingSectionId(null)}
                initialFilter={sectionCommandFilter(pickingAllowedTypes)}
                filters={sectionCommandFilters(pickingAllowedTypes)}
                lockedContextId={menuContextId}
                items={pickerItems}
                onItemSelect={(drink) => {
                    if (!pickingSectionId) return;
                    if (!itemAllowedInSection(drink, pickingAllowedTypes)) return;
                    const current = editor.selections[pickingSectionId] || [];
                    if (current.includes(drink.id)) {
                        Alert.alert("Already Added", "This drink is already in this section.");
                        return;
                    }
                    editor.setSelections((prev) => ({
                        ...prev,
                        [pickingSectionId]: [...(prev[pickingSectionId] || []), drink.id],
                    }));
                    setPickingSectionId(null);
                }}
                onCreateNew={({ name, type }) => {
                    const sectionId = pickingSectionId;
                    setPickingSectionId(null);
                    if (!sectionId) return;
                    const attach = { menuSectionId: sectionId };
                    requestCreate(type, menuContextId, name, attach);
                    router.push(creatorCreateHref(type, menuContextId, name, attach) as any);
                }}
            />

            <AdaptiveSheetModal visible={actionsOpen} onClose={() => setActionsOpen(false)} title="Menu">
                <YStack paddingHorizontal="$4">
                    <Pressable
                        onPress={() => {
                            setActionsOpen(false);
                            router.push(
                                creatorCreateHref(
                                    'menu',
                                    selectedMenu?.bar_id || PERSONAL_CONTEXT
                                ) as any
                            );
                        }}
                        style={[
                            styles.actionRow,
                            { borderBottomColor: theme.borderColor?.get() as string },
                        ]}
                    >
                        <Text color="$color" fontSize={16} fontWeight="600">
                            New Menu
                        </Text>
                    </Pressable>
                    {selectedMenu ? (
                        <Pressable
                            onPress={() => {
                                setActionsOpen(false);
                                startEdit();
                            }}
                            style={[
                                styles.actionRow,
                                { borderBottomColor: theme.borderColor?.get() as string },
                            ]}
                        >
                            <Text color="$color" fontSize={16} fontWeight="600">
                                Edit Menu
                            </Text>
                        </Pressable>
                    ) : null}
                    {selectedMenu ? (
                        <Pressable
                            onPress={toggleCurrent}
                            disabled={togglingCurrent}
                            style={[
                                styles.actionRow,
                                { borderBottomColor: theme.borderColor?.get() as string },
                            ]}
                        >
                            <Text color="$color" fontSize={16} fontWeight="600">
                                {togglingCurrent
                                    ? 'Updating…'
                                    : isCurrent
                                      ? `Remove from Current (${currentLabel})`
                                      : `Current for ${currentLabel}`}
                            </Text>
                        </Pressable>
                    ) : null}
                </YStack>
            </AdaptiveSheetModal>
        </YStack>
    );
}

const styles = StyleSheet.create({
    addCover: {
        width: "100%",
        aspectRatio: 5 / 2,
        alignItems: "center",
        justifyContent: "center",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(127,127,127,0.3)",
        backgroundColor: "rgba(127,127,127,0.08)",
    },
    actionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 4,
        borderRadius: 8,
    },
    primaryBtn: {
        alignSelf: "flex-start",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 999,
    },
});
