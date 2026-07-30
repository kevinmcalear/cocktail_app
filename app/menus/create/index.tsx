import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBars } from "@/hooks/useBars";
import { useBeers } from "@/hooks/useBeers";
import { useCocktails } from "@/hooks/useCocktails";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useDrafts } from "@/hooks/useDrafts";
import { useWines } from "@/hooks/useWines";
import { uriToBase64 } from "@/lib/imageBase64";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useNavigation, useLocalSearchParams } from "expo-router";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, YStack, XStack, Button } from "tamagui";
import { recentEntry, useTrackRecent } from "@/hooks/useTrackRecent";
import { resolveCocktailId, resolveBeerId, resolveWineId, updateMenuDraftsWithPublishedId } from "@/lib/drafts";
import { buildMenuDrinkIndex } from "@/lib/menuDrinkIndex";
import {
    itemAllowedInSection,
    normalizeAllowedTypes,
    sectionCommandFilter,
    sectionCommandFilters,
} from "@/lib/sectionAllowedTypes";
import { capitalize } from "@/lib/stringUtils";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRecentActivityStore } from "@/store/useRecentActivityStore";
import { useAppStore } from "@/store/useAppStore";
import { creatorCreateHref, useCreatorNavStore } from "@/store/useCreatorNavStore";
import { useMenuEditDropStore } from "@/store/useMenuEditDropStore";
import { inSelectedContext, PERSONAL_CONTEXT } from "@/lib/barContextFilter";
import type { MenuItem, MenuSection } from "@/components/CurrentMenuList";
import { MenuNotionEditor } from "@/components/menu/MenuNotionEditor";
import { SearchItem } from "@/components/SearchList";
import { SearchPopover } from "@/components/SearchPopover";
import type { EditorChromeState } from "@/lib/editorChrome";

function toMenuItem(drink: SearchItem): MenuItem {
    const image =
        drink.image?.uri ||
        drink.item_images?.[0]?.images?.url ||
        (typeof drink.image === 'string' ? drink.image : undefined);
    const ingredients =
        drink.recipes
            ?.map((r) => (r.ingredient?.name ? capitalize(r.ingredient.name) : ''))
            .filter(Boolean)
            .join(', ') ||
        drink.description ||
        '';
    return {
        id: drink.id,
        name: drink.name,
        description: drink.description || '',
        ingredients,
        price: drink.price || undefined,
        image: image || undefined,
        recipes: drink.recipes,
        isDraft: drink.isDraft,
        draftProgress: drink.draftProgress,
    };
}

async function uploadMenuCover(uri: string, menuId?: string | null): Promise<string> {
    const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
    const path = menuId
        ? `menus/${menuId}/${Date.now()}.${safeExt}`
        : `menus/drafts/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const base64 = await uriToBase64(uri);
    const { error } = await supabase.storage.from('drinks').upload(path, decode(base64), {
        contentType: `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
        upsert: false,
    });
    if (error) throw error;
    return supabase.storage.from('drinks').getPublicUrl(path).data.publicUrl;
}

interface CreateMenuWizardProps {
    isInline?: boolean;
    draftIdProp?: string;
    menuIdProp?: string;
    barIdProp?: string;
    onClose?: () => void;
    onSave?: () => void;
    onChromeState?: (state: EditorChromeState | null) => void;
    onOpenDrink?: (drink: SearchItem) => void;
}

export default function CreateMenuWizard({
    isInline,
    draftIdProp,
    menuIdProp,
    barIdProp,
    onClose,
    onSave,
    onChromeState,
    onOpenDrink,
}: CreateMenuWizardProps = {}) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme];
    const isDark = colorScheme === "dark";
    const router = useRouter();
    const navigation = useNavigation();
    const requestCreate = useCreatorNavStore((s) => s.requestCreate);
    const { draftId, menuId, barId: barIdFromParams } = useLocalSearchParams<{ draftId?: string, menuId?: string, barId?: string }>();
    const activeDraftIdProp = draftIdProp !== undefined ? draftIdProp : draftId;
    const activeMenuIdProp = menuIdProp !== undefined ? menuIdProp : menuId;
    const activeBarIdProp = barIdProp !== undefined ? barIdProp : barIdFromParams;
    const resolvedBarId = activeBarIdProp || null;
    const skipVenueStep = !!resolvedBarId && !activeMenuIdProp;
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();

    const { drafts, saveDraft, deleteDraft } = useDrafts();
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(activeDraftIdProp || null);

    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();
    const templates = dropdowns?.menuTemplates || [];
    const allSections = dropdowns?.templateSections || [];

    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [menuName, setMenuName] = useState("");
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    const [coverPosition, setCoverPosition] = useState(50);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [selections, setSelections] = useState<Record<string, string[]>>({});
    const [saving, setSaving] = useState(false);
    const [barId, setBarId] = useState<string | null>(resolvedBarId);
    const [pickingSectionId, setPickingSectionId] = useState<string | null>(null);

    const selectedBarId = useAppStore((s) => s.selectedBarId);
    const { data: userBars } = useBars();
    const { data: cocktailsData } = useCocktails({ allContexts: true });
    const { data: beersData } = useBeers({ allContexts: true });
    const { data: winesData } = useWines({ allContexts: true });

    // Default venue when create isn't pre-bound to a bar
    useEffect(() => {
        if (barId || activeMenuIdProp) return;
        const first = userBars?.[0]?.bar_id;
        const next = resolvedBarId || selectedBarId || first || null;
        if (next && next !== PERSONAL_CONTEXT) setBarId(next);
    }, [barId, activeMenuIdProp, resolvedBarId, selectedBarId, userBars]);

    const [showExitModal, setShowExitModal] = useState(false);
    const pendingNavigationActionRef = useRef<any>(null);
    const isExitingRef = useRef(false);

    const [draftLoaded, setDraftLoaded] = useState(!activeDraftIdProp && !activeMenuIdProp);
    const [menuLoaded, setMenuLoaded] = useState(!activeMenuIdProp);

    const trackedDraft = currentDraftId
        ? drafts.find((d: any) => d.id === currentDraftId)
        : null;
    // Published menu edit → track published id; new menu → track draft once it exists
    useTrackRecent(
        !!(activeMenuIdProp && menuLoaded) || !!trackedDraft,
        activeMenuIdProp && menuLoaded
            ? recentEntry('menu', activeMenuIdProp, menuName || 'Untitled Menu', {
                  href: '/(tabs)/menus',
                  barId: barId ?? null,
                  imageUrl: coverUrl || null,
              })
            : trackedDraft
              ? recentEntry(
                    'menu',
                    trackedDraft.id,
                    trackedDraft.draft_data?.menuName ||
                        trackedDraft.draft_data?.name ||
                        menuName ||
                        'Untitled Menu',
                    {
                        isDraft: true,
                        barId: trackedDraft.bar_id ?? barId ?? null,
                        imageUrl: trackedDraft.draft_data?.coverUrl || coverUrl || null,
                    }
                )
              : null
    );
    const currentStateStr = JSON.stringify({
        selectedTemplateId,
        menuName,
        selections,
        barId,
        coverUrl,
        coverPosition,
    });
    const cleanStateStrRef = useRef<string>(currentStateStr);
    const [needsCleanMark, setNeedsCleanMark] = useState(false);

    useEffect(() => {
        if (needsCleanMark) {
            cleanStateStrRef.current = currentStateStr;
            setNeedsCleanMark(false);
        }
    }, [needsCleanMark, currentStateStr]);

    useEffect(() => {
        if (currentDraftId && !draftLoaded && drafts.length > 0) {
            const draft = drafts.find((d: any) => d.id === currentDraftId);
            if (draft && draft.draft_data) {
                const data = draft.draft_data;
                setSelectedTemplateId(data.selectedTemplateId || null);
                setMenuName(data.menuName || data.name || "");
                setCoverUrl(data.coverUrl || null);
                setCoverPosition(typeof data.coverPosition === 'number' ? data.coverPosition : 50);
                setSelections(data.selections || {});
                setBarId(data.barId || activeBarIdProp || null);
                setDraftLoaded(true);
                setNeedsCleanMark(true);
            }
        }
    }, [currentDraftId, drafts, draftLoaded, activeBarIdProp]);

    useEffect(() => {
        if (!activeMenuIdProp || menuLoaded) return;

        const loadPublishedMenu = async () => {
            try {
                const { data: menuData, error: menuErr } = await supabase
                    .from('menus')
                    .select('*')
                    .eq('id', activeMenuIdProp)
                    .single();

                if (menuErr || !menuData) throw menuErr || new Error('Menu not found');

                // ponytail: prod menu_drinks is item_id only
                const { data: drinksData, error: drinksErr } = await supabase
                    .from('menu_drinks')
                    .select('template_section_id, item_id, item:items!item_id ( id, item_type )')
                    .eq('menu_id', activeMenuIdProp);

                if (drinksErr) throw drinksErr;

                const loadedSelections: Record<string, string[]> = {};
                for (const drink of drinksData || []) {
                    const sectionId = drink.template_section_id;
                    const item = Array.isArray((drink as any).item)
                        ? (drink as any).item[0]
                        : (drink as any).item;
                    if (!sectionId || !item?.id) continue;
                    if (!loadedSelections[sectionId]) loadedSelections[sectionId] = [];
                    if (item.item_type === 'beer') loadedSelections[sectionId].push(`beer-${item.id}`);
                    else if (item.item_type === 'wine') loadedSelections[sectionId].push(`wine-${item.id}`);
                    else loadedSelections[sectionId].push(item.id);
                }

                setMenuName(menuData.name || '');
                setSelectedTemplateId(menuData.template_id || null);
                setBarId(menuData.bar_id || null);
                setCoverUrl(menuData.cover_url || null);
                setCoverPosition(
                    typeof menuData.cover_position === 'number' ? menuData.cover_position : 50
                );
                setSelections(loadedSelections);
                setMenuLoaded(true);
                setDraftLoaded(true);
                setNeedsCleanMark(true);
            } catch (error) {
                console.error('Failed to load published menu:', error);
                Alert.alert('Error', 'Failed to load menu for editing.');
                setMenuLoaded(true);
            }
        };

        loadPublishedMenu();
    }, [activeMenuIdProp, menuLoaded]);

    useEffect(() => {
        if (!draftLoaded) return;
        const isDirty = currentStateStr !== cleanStateStrRef.current;
        if (!isDirty) return;

        const timer = setTimeout(() => {
            const autoSave = async () => {
                try {
                    const draftData = {
                        selectedTemplateId,
                        menuName,
                        name: menuName,
                        selections,
                        barId,
                        coverUrl,
                        coverPosition,
                        hasVenueStep: true,
                    };
                    const result = await saveDraft({ id: currentDraftId || undefined, entityType: 'menu', draftData });
                    if (!currentDraftId && result && result.id) {
                        setCurrentDraftId(result.id);
                        if (!isInline) {
                            router.setParams({ draftId: result.id });
                        }
                    }
                    cleanStateStrRef.current = currentStateStr;
                } catch (error) {
                    console.error("Auto-save menu draft error:", error);
                }
            };
            autoSave();
        }, 1000);

        return () => clearTimeout(timer);
    }, [currentStateStr, currentDraftId, draftLoaded, selectedTemplateId, menuName, selections, barId, coverUrl, coverPosition, saveDraft, router, isInline]);

    const handleSaveDraft = async () => {
        try {
            setSaving(true);
            const draftData = {
                selectedTemplateId,
                menuName,
                name: menuName,
                selections,
                barId,
                coverUrl,
                coverPosition,
                hasVenueStep: true,
            };
            const result = await saveDraft({ id: currentDraftId || undefined, entityType: 'menu', draftData });
            
            if (!currentDraftId && result && result.id) {
                setCurrentDraftId(result.id);
                if (!isInline) {
                    router.setParams({ draftId: result.id });
                }
            }
            
            if (Platform.OS === 'web') {
                window.alert("Draft saved successfully!");
            } else {
                Alert.alert("Success", "Draft saved successfully!");
            }
            setNeedsCleanMark(true);
        } catch (error) {
            console.error("Draft error:", error);
            if (Platform.OS === 'web') {
                window.alert("Failed to save draft.");
            } else {
                Alert.alert("Error", "Failed to save draft.");
            }
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (isInline) return;
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (isExitingRef.current) {
                return;
            }
            const hasProgress = menuName.trim() !== "" || selectedTemplateId !== null || barId !== null || currentStateStr !== cleanStateStrRef.current;
            if (!hasProgress) {
                return;
            }
            e.preventDefault();
            pendingNavigationActionRef.current = e.data.action;
            setShowExitModal(true);
        });

        return unsubscribe;
    }, [navigation, currentStateStr, menuName, selectedTemplateId, barId, isInline]);

    const confirmExit = async (shouldSave: boolean) => {
        setShowExitModal(false);
        if (shouldSave) {
            await handleSaveDraft();
        }
        if (isInline) {
            onClose?.();
        } else if (pendingNavigationActionRef.current) {
            isExitingRef.current = true;
            navigation.dispatch(pendingNavigationActionRef.current);
        }
    };

    // Derived
    const activeSections = allSections
        .filter(s => s.template_id === selectedTemplateId)
        .sort((a, b) => a.sort_order - b.sort_order);

    const initSectionsForTemplate = () => {
        if (!selectedTemplateId) return;
        const missing = activeSections.some((sec) => selections[sec.id] === undefined);
        if (!missing) return;
        const newSelections = { ...selections };
        activeSections.forEach((sec) => {
            if (!newSelections[sec.id]) newSelections[sec.id] = [];
        });
        setSelections(newSelections);
    };

    const handleTemplateSelect = (id: string) => {
        setSelectedTemplateId(id);
    };

    useEffect(() => {
        if (selectedTemplateId) initSectionsForTemplate();
    }, [selectedTemplateId, activeSections.length]);

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

    const displaySections: MenuSection[] = useMemo(
        () =>
            activeSections.map((sec: any) => ({
                id: sec.id,
                title: sec.name,
                allowedTypes: normalizeAllowedTypes(sec.allowed_types),
                data: (selections[sec.id] || []).map((id) => {
                    const drink = drinkIndex.get(id);
                    return drink
                        ? toMenuItem(drink)
                        : { id, name: 'Unknown', description: '', ingredients: '' };
                }),
            })),
        [activeSections, selections, drinkIndex]
    );

    const pickingAllowedTypes = useMemo(() => {
        if (!pickingSectionId) return normalizeAllowedTypes(null);
        const sec = activeSections.find((s: any) => s.id === pickingSectionId);
        return normalizeAllowedTypes(sec?.allowed_types);
    }, [pickingSectionId, activeSections]);

    // ponytail: ⌘K / picker long-press → drop on any compatible Add tile
    const sectionsRef = useRef(activeSections);
    const selectionsRef = useRef(selections);
    sectionsRef.current = activeSections;
    selectionsRef.current = selections;

    useEffect(() => {
        if (!selectedTemplateId || activeSections.length === 0) return;
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
                setSelections((prev) => ({
                    ...prev,
                    [sectionId]: [...(prev[sectionId] || []), item.id],
                }));
                return 'ok';
            },
        });
        return () => useMenuEditDropStore.getState().unregister();
    }, [selectedTemplateId, activeSections]);

    const menuContextId =
        !barId || barId === PERSONAL_CONTEXT ? PERSONAL_CONTEXT : barId;

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

    const venueName = useMemo(() => {
        if (!barId) return null;
        const ub = userBars?.find((b) => b.bar_id === barId);
        const bar = Array.isArray((ub as any)?.bars) ? (ub as any).bars[0] : (ub as any)?.bars;
        return bar?.name || null;
    }, [barId, userBars]);

    const pickCover = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'We need access to your photos.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [5, 2],
            quality: 0.85,
        });
        if (result.canceled || !result.assets?.length) return;

        setUploadingCover(true);
        try {
            const url = await uploadMenuCover(result.assets[0].uri, activeMenuIdProp || null);
            setCoverUrl(url);
            setCoverPosition(50);
        } catch (error) {
            console.error('Menu cover upload error:', error);
            Alert.alert('Error', 'Failed to upload cover image.');
        } finally {
            setUploadingCover(false);
        }
    };

    const isFormComplete = () => {
        if (!skipVenueStep && !barId) return false;
        if (!selectedTemplateId) return false;
        if (!menuName.trim()) return false;
        return activeSections.every((sec) => {
            const count = (selections[sec.id] || []).length;
            return count >= (sec.min_items || 1);
        });
    };

    const isDirty = currentStateStr !== cleanStateStrRef.current;

    const requestClose = () => {
        const hasProgress =
            menuName.trim() !== "" ||
            selectedTemplateId !== null ||
            barId !== null ||
            isDirty;
        if (hasProgress) {
            setShowExitModal(true);
        } else if (isInline) {
            onClose?.();
        } else {
            router.back();
        }
    };

    useEffect(() => {
        if (!isInline || !onChromeState || loadingDropdowns) return;
        onChromeState({
            save: handleSaveDraft,
            cancel: requestClose,
            saving,
            isDirty,
        });
        return () => onChromeState(null);
    }, [isInline, onChromeState, loadingDropdowns, saving, isDirty]);

    const handlePublish = () => {
        const proceed = () => {
            performPublish();
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to publish this menu?")) {
                proceed();
            }
        } else {
            Alert.alert(
                "Publish Menu",
                "Are you sure you want to publish this menu?",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Publish", onPress: proceed }
                ]
            );
        }
    };

    const performPublish = async () => {
        setSaving(true);
        try {
            const insertPayload: any = {
                name: capitalize(menuName),
                template_id: selectedTemplateId,
                is_active: true,
                bar_id: !barId || barId === PERSONAL_CONTEXT ? null : barId,
                cover_url: coverUrl || null,
                cover_position: coverPosition,
            };

            let menuId = activeMenuIdProp || null;

            if (activeMenuIdProp) {
                const updatePayload = { ...insertPayload };
                let { error: updateError } = await supabase
                    .from('menus')
                    .update(updatePayload)
                    .eq('id', activeMenuIdProp);

                // ponytail: optional columns may not exist until migrations land
                for (const col of ['cover_position', 'cover_url', 'bar_id'] as const) {
                    if (updateError?.code === '42703' && col in updatePayload) {
                        delete updatePayload[col];
                        ({ error: updateError } = await supabase
                            .from('menus')
                            .update(updatePayload)
                            .eq('id', activeMenuIdProp));
                    }
                }

                if (updateError) throw updateError;

                const { error: deleteDrinksError } = await supabase
                    .from('menu_drinks')
                    .delete()
                    .eq('menu_id', activeMenuIdProp);

                if (deleteDrinksError) throw deleteDrinksError;
            } else {
                let { data: newMenu, error: menuError } = await supabase
                    .from('menus')
                    .insert(insertPayload)
                    .select()
                    .single();

                for (const col of ['cover_position', 'cover_url', 'bar_id'] as const) {
                    if (menuError?.code === '42703' && col in insertPayload) {
                        delete insertPayload[col];
                        ({ data: newMenu, error: menuError } = await supabase
                            .from('menus')
                            .insert(insertPayload)
                            .select()
                            .single());
                    }
                }

                if (menuError || !newMenu) throw menuError;
                menuId = newMenu.id;
            }

            if (!menuId) throw new Error('Failed to resolve menu id');

            // 2. Add Drinks (item_id — matches prod schema)
            let globalSortOrder = 0;
            const drinksToInsert = [];
            
            for (const sec of activeSections) {
                const drinksInSection = selections[sec.id] || [];
                for (const drinkId of drinksInSection) {
                    let item_id = drinkId.replace(/^(beer|wine)-/, '');

                    if (drinkId.startsWith('beer-')) {
                        const draftIdPart = drinkId.replace('beer-', '');
                        const isDraftBeer = drafts.some(d => d.id === draftIdPart && d.entity_type === 'beer');
                        if (isDraftBeer) {
                            const resolvedId = await resolveBeerId(draftIdPart, drafts);
                            await updateMenuDraftsWithPublishedId('beer-' + draftIdPart, 'beer-' + resolvedId, drafts, saveDraft);
                            item_id = resolvedId;
                        }
                    } else if (drinkId.startsWith('wine-')) {
                        const draftIdPart = drinkId.replace('wine-', '');
                        const isDraftWine = drafts.some(d => d.id === draftIdPart && d.entity_type === 'wine');
                        if (isDraftWine) {
                            const resolvedId = await resolveWineId(draftIdPart, drafts);
                            await updateMenuDraftsWithPublishedId('wine-' + draftIdPart, 'wine-' + resolvedId, drafts, saveDraft);
                            item_id = resolvedId;
                        }
                    } else {
                        const isDraftCocktail = drafts.some(d => d.id === drinkId && d.entity_type === 'cocktail');
                        if (isDraftCocktail) {
                            const resolvedId = await resolveCocktailId(drinkId, drafts);
                            await updateMenuDraftsWithPublishedId(drinkId, resolvedId, drafts, saveDraft);
                            item_id = resolvedId;
                        }
                    }

                    drinksToInsert.push({
                        menu_id: menuId,
                        item_id,
                        template_section_id: sec.id,
                        sort_order: globalSortOrder++
                    });
                }
            }

            if (drinksToInsert.length > 0) {
                const { error: drinksError } = await supabase
                    .from('menu_drinks')
                    .insert(drinksToInsert);
                if (drinksError) throw drinksError;
            }

            if (currentDraftId) {
                await deleteDraft(currentDraftId);
            }

            useRecentActivityStore.getState().push(
                recentEntry('menu', menuId, menuName || 'Untitled Menu', {
                    href: '/(tabs)/menus',
                    barId: barId ?? null,
                    imageUrl: coverUrl || null,
                })
            );

            await queryClient.invalidateQueries({ queryKey: ['dropdowns_v4'] });
            isExitingRef.current = true;
            if (isInline) {
                if (onSave) onSave();
            } else {
                router.back();
            }
        } catch (error) {
            console.error("Save menu error", error);
            Alert.alert("Error", "Failed to publish the menu.");
        } finally {
            setSaving(false);
        }
    };

    const styles = StyleSheet.create({
        headerBtn: {
            width: 40,
            height: 40,
            justifyContent: "center",
            alignItems: "flex-start",
        },
    });

    if (loadingDropdowns) {
        return (
            <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
                <ActivityIndicator size="large" color={colors.tint} />
            </YStack>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: isInline ? undefined : colors.background }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            {!isInline && (
                <XStack
                    paddingTop={Platform.OS === 'ios' ? 20 : insets.top + 20}
                    paddingHorizontal="$4"
                    paddingBottom="$2"
                    alignItems="center"
                    backgroundColor={colors.background}
                >
                    <TouchableOpacity onPress={requestClose} style={styles.headerBtn}>
                        <IconSymbol name="chevron.left" size={24} color={colors.text} />
                    </TouchableOpacity>
                </XStack>
            )}

            <YStack flex={1} backgroundColor={isInline ? '$background' : colors.background}>
                <MenuNotionEditor
                    menuName={menuName}
                    onMenuNameChange={setMenuName}
                    coverUrl={coverUrl}
                    coverPosition={coverPosition}
                    onCoverPositionChange={setCoverPosition}
                    onPickCover={pickCover}
                    uploadingCover={uploadingCover}
                    templates={templates}
                    selectedTemplateId={selectedTemplateId}
                    onTemplateSelect={handleTemplateSelect}
                    sections={displaySections}
                    venueName={venueName}
                    headerRight={
                        <TouchableOpacity
                            onPress={handlePublish}
                            disabled={!isFormComplete() || saving}
                            style={{ padding: 8, opacity: isFormComplete() && !saving ? 1 : 0.35 }}
                        >
                            <Text color={colors.tint} fontWeight="bold" fontSize={16}>
                                {saving ? '…' : 'Publish'}
                            </Text>
                        </TouchableOpacity>
                    }
                    onRemoveItem={(sectionId, itemId) => {
                        setSelections((prev) => ({
                            ...prev,
                            [sectionId]: (prev[sectionId] || []).filter((id) => id !== itemId),
                        }));
                    }}
                    onAddToSection={(sectionId) => setPickingSectionId(sectionId)}
                    onItemPress={
                        onOpenDrink
                            ? (item) => {
                                  const drink = drinkIndex.get(item.id);
                                  if (drink) onOpenDrink(drink);
                              }
                            : undefined
                    }
                />
            </YStack>

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
                    const current = selections[pickingSectionId] || [];
                    if (current.includes(drink.id)) {
                        Alert.alert('Already Added', 'This drink is already in this section.');
                        return;
                    }
                    setSelections((prev) => ({
                        ...prev,
                        [pickingSectionId]: [...(prev[pickingSectionId] || []), drink.id],
                    }));
                    setPickingSectionId(null);
                }}
                onCreateNew={({ name, type }) => {
                    setPickingSectionId(null);
                    requestCreate(type, menuContextId);
                    router.push(creatorCreateHref(type, menuContextId, name) as any);
                }}
            />

            <Modal
                visible={showExitModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowExitModal(false)}
            >
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }]}>
                    <YStack 
                        backgroundColor="$backgroundStrong" 
                        padding="$5" 
                        borderRadius="$4" 
                        width="85%" 
                        maxWidth={400}
                        borderWidth={1}
                        borderColor="$borderColor"
                        gap="$4"
                    >
                        <Text fontSize="$6" fontWeight="bold" color="$color">Unsaved Changes</Text>
                        <Text fontSize="$4" color="$color11">You have unsaved changes. Do you want to save your draft before leaving?</Text>
                        
                        <XStack justifyContent="flex-end" gap="$3" marginTop="$2">
                            <Button size="$3" chromeless onPress={() => setShowExitModal(false)}>
                                <Text color="$color11">Cancel</Text>
                            </Button>
                            <Button size="$3" backgroundColor="#ff4444" onPress={() => confirmExit(false)}>
                                <Text color="white" fontWeight="bold">Discard</Text>
                            </Button>
                            <Button size="$3" backgroundColor={colors.tint} onPress={() => confirmExit(true)}>
                                <Text color={isDark ? "#000" : "#fff"} fontWeight="bold">Save</Text>
                            </Button>
                        </XStack>
                    </YStack>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}
