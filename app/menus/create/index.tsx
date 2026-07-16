import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDropdowns } from "@/hooks/useDropdowns";
import { uriToBase64 } from "@/lib/imageBase64";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useNavigation, useLocalSearchParams } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, YStack, XStack, Button } from "tamagui";
import { useDrafts } from "@/hooks/useDrafts";
import { recentEntry, useTrackRecent } from "@/hooks/useTrackRecent";
import { resolveCocktailId, resolveBeerId, resolveWineId, updateMenuDraftsWithPublishedId } from "@/lib/drafts";
import { capitalize } from "@/lib/stringUtils";
import { IconSymbol } from "@/components/ui/icon-symbol";

import { MenuEditorForm } from "@/components/menu/MenuEditorForm";
import type { EditorChromeState } from "@/lib/editorChrome";

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
    onCreateDrinkPress?: (params: {
        query: string;
        barId: string;
        menuDraftId?: string;
        menuSectionId?: string;
    }) => void;
}

export default function CreateMenuWizard({
    isInline,
    draftIdProp,
    menuIdProp,
    barIdProp,
    onClose,
    onSave,
    onChromeState,
    onCreateDrinkPress,
}: CreateMenuWizardProps = {}) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme];
    const isDark = colorScheme === "dark";
    const router = useRouter();
    const navigation = useNavigation();
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
    const [uploadingCover, setUploadingCover] = useState(false);
    const [selections, setSelections] = useState<Record<string, string[]>>({});
    const [saving, setSaving] = useState(false);
    const [barId, setBarId] = useState<string | null>(resolvedBarId);

    const trackedDraft = currentDraftId
        ? drafts.find((d: any) => d.id === currentDraftId)
        : null;
    useTrackRecent(
        !!trackedDraft,
        trackedDraft
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

    const [showExitModal, setShowExitModal] = useState(false);
    const pendingNavigationActionRef = useRef<any>(null);
    const isExitingRef = useRef(false);

    const [draftLoaded, setDraftLoaded] = useState(!activeDraftIdProp && !activeMenuIdProp);
    const [menuLoaded, setMenuLoaded] = useState(!activeMenuIdProp);
    const currentStateStr = JSON.stringify({ selectedTemplateId, menuName, selections, barId, coverUrl });
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

                const { data: drinksData, error: drinksErr } = await supabase
                    .from('menu_drinks')
                    .select('template_section_id, cocktail_id, beer_id, wine_id')
                    .eq('menu_id', activeMenuIdProp);

                if (drinksErr) throw drinksErr;

                const loadedSelections: Record<string, string[]> = {};
                for (const drink of drinksData || []) {
                    const sectionId = drink.template_section_id;
                    if (!sectionId) continue;
                    if (!loadedSelections[sectionId]) loadedSelections[sectionId] = [];

                    if (drink.cocktail_id) {
                        loadedSelections[sectionId].push(drink.cocktail_id);
                    } else if (drink.beer_id) {
                        loadedSelections[sectionId].push(`beer-${drink.beer_id}`);
                    } else if (drink.wine_id) {
                        loadedSelections[sectionId].push(`wine-${drink.wine_id}`);
                    }
                }

                setMenuName(menuData.name || '');
                setSelectedTemplateId(menuData.template_id || null);
                setBarId(menuData.bar_id || null);
                setCoverUrl(menuData.cover_url || null);
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
    }, [currentStateStr, currentDraftId, draftLoaded, selectedTemplateId, menuName, selections, barId, coverUrl, saveDraft, router, isInline]);

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

    const pickCover = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'We need access to your photos.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });
        if (result.canceled || !result.assets?.length) return;

        setUploadingCover(true);
        try {
            const url = await uploadMenuCover(result.assets[0].uri, activeMenuIdProp || null);
            setCoverUrl(url);
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
                bar_id: barId || null,
                cover_url: coverUrl || null,
            };

            let menuId = activeMenuIdProp || null;

            if (activeMenuIdProp) {
                const updatePayload = { ...insertPayload };
                let { error: updateError } = await supabase
                    .from('menus')
                    .update(updatePayload)
                    .eq('id', activeMenuIdProp);

                // ponytail: optional columns may not exist until migrations land
                if (updateError?.code === '42703' && 'cover_url' in updatePayload) {
                    delete updatePayload.cover_url;
                    ({ error: updateError } = await supabase
                        .from('menus')
                        .update(updatePayload)
                        .eq('id', activeMenuIdProp));
                }
                if (updateError?.code === '42703' && 'bar_id' in updatePayload) {
                    delete updatePayload.bar_id;
                    ({ error: updateError } = await supabase
                        .from('menus')
                        .update(updatePayload)
                        .eq('id', activeMenuIdProp));
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

                if (menuError?.code === '42703' && 'cover_url' in insertPayload) {
                    delete insertPayload.cover_url;
                    ({ data: newMenu, error: menuError } = await supabase
                        .from('menus')
                        .insert(insertPayload)
                        .select()
                        .single());
                }
                if (menuError?.code === '42703' && 'bar_id' in insertPayload) {
                    console.warn("bar_id column not found in menus table, retrying insert without bar_id...");
                    delete insertPayload.bar_id;
                    ({ data: newMenu, error: menuError } = await supabase
                        .from('menus')
                        .insert(insertPayload)
                        .select()
                        .single());
                }

                if (menuError || !newMenu) throw menuError;
                menuId = newMenu.id;
            }

            if (!menuId) throw new Error('Failed to resolve menu id');

            // 2. Add Drinks
            let globalSortOrder = 0;
            const drinksToInsert = [];
            
            for (const sec of activeSections) {
                const drinksInSection = selections[sec.id] || [];
                for (const drinkId of drinksInSection) {
                    let cocktail_id = null;
                    let beer_id = null;
                    let wine_id = null;

                    if (drinkId.startsWith('beer-')) {
                        const draftIdPart = drinkId.replace('beer-', '');
                        const isDraftBeer = drafts.some(d => d.id === draftIdPart && d.entity_type === 'beer');
                        if (isDraftBeer) {
                            const resolvedId = await resolveBeerId(draftIdPart, drafts);
                            await updateMenuDraftsWithPublishedId('beer-' + draftIdPart, 'beer-' + resolvedId, drafts, saveDraft);
                            beer_id = resolvedId;
                        } else {
                            beer_id = draftIdPart;
                        }
                    } else if (drinkId.startsWith('wine-')) {
                        const draftIdPart = drinkId.replace('wine-', '');
                        const isDraftWine = drafts.some(d => d.id === draftIdPart && d.entity_type === 'wine');
                        if (isDraftWine) {
                            const resolvedId = await resolveWineId(draftIdPart, drafts);
                            await updateMenuDraftsWithPublishedId('wine-' + draftIdPart, 'wine-' + resolvedId, drafts, saveDraft);
                            wine_id = resolvedId;
                        } else {
                            wine_id = draftIdPart;
                        }
                    } else {
                        const isDraftCocktail = drafts.some(d => d.id === drinkId && d.entity_type === 'cocktail');
                        if (isDraftCocktail) {
                            const resolvedId = await resolveCocktailId(drinkId, drafts);
                            await updateMenuDraftsWithPublishedId(drinkId, resolvedId, drafts, saveDraft);
                            cocktail_id = resolvedId;
                        } else {
                            cocktail_id = drinkId;
                        }
                    }

                    drinksToInsert.push({
                        menu_id: menuId,
                        cocktail_id: cocktail_id || undefined,
                        beer_id: beer_id || undefined,
                        wine_id: wine_id || undefined,
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

            await queryClient.invalidateQueries({ queryKey: ['dropdowns_v2'] });
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
                    paddingBottom="$3"
                    alignItems="center"
                    justifyContent="space-between"
                    backgroundColor={colors.background}
                >
                    <TouchableOpacity onPress={requestClose} style={styles.headerBtn}>
                        <IconSymbol name="chevron.left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text fontSize="$5" fontWeight="bold" color={colors.text}>
                        {activeMenuIdProp ? 'Edit Menu' : 'New Menu'}
                    </Text>
                    <View style={{ width: 40 }} />
                </XStack>
            )}

            <YStack flex={1} backgroundColor={isInline ? '$background' : colors.background}>
                <MenuEditorForm
                    embedded={!!isInline}
                    skipVenueStep={skipVenueStep}
                    barId={barId}
                    onBarIdChange={setBarId}
                    templates={templates}
                    selectedTemplateId={selectedTemplateId}
                    onTemplateSelect={handleTemplateSelect}
                    menuName={menuName}
                    onMenuNameChange={setMenuName}
                    onMenuNameBlur={() => setMenuName(capitalize(menuName))}
                    coverUrl={coverUrl}
                    uploadingCover={uploadingCover}
                    onPickCover={pickCover}
                    onClearCover={() => setCoverUrl(null)}
                    activeSections={activeSections}
                    selections={selections}
                    setSelections={setSelections}
                    menuDraftId={currentDraftId}
                    onInitSections={initSectionsForTemplate}
                    canPublish={isFormComplete()}
                    saving={saving}
                    onPublish={handlePublish}
                    onCreateDrinkPress={onCreateDrinkPress}
                />
            </YStack>

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
