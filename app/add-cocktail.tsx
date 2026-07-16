import { SearchBar } from "@/components/SearchBar";
import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { SortableRecipeList } from "@/components/recipe/SortableRecipeList";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetView, BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Redirect, useLocalSearchParams, useRouter, useNavigation, Stack } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    TouchableOpacity, View,
    Platform,
    KeyboardAvoidingView,
    Modal
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SpecPillButton } from "@/components/SpecPillButton";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useBars } from "@/hooks/useBars";
import { useDrafts } from "@/hooks/useDrafts";
import { useDropdowns } from "@/hooks/useDropdowns";
import { recentEntry, useTrackRecent } from "@/hooks/useTrackRecent";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { capitalize, capitalizeAsYouType, handleCapitalizedChange } from "@/lib/stringUtils";
import { Button, Input, Label, Text, TextArea, XStack, YStack, useTheme, Select, Adapt, Sheet, Accordion } from "tamagui";
import { FormScrollContainer } from "@/components/recipe/FormScrollContainer";
import { BarAssignmentAccordion } from "@/components/BarAssignmentAccordion";
import { useAppStore } from "@/store/useAppStore";
import { resolveIngredientId, updateParentDraftsWithPublishedId, updateMenuDraftsWithPublishedId } from "@/lib/drafts";
import { CocktailDraftInlineEditor } from "@/components/cocktail/CocktailDraftInlineEditor";

interface RecipeItem {
    id?: string;
    ingredient_id: string;
    name: string;
    amount: string;
    unit: string;
    preparation_notes: string;
    is_optional: boolean;
}

interface Menu {
    id: string;
    name: string;
}

interface AddCocktailProps {
    isInline?: boolean;
    draftIdProp?: string;
    barIdProp?: string;
    menuDraftIdProp?: string;
    menuSectionIdProp?: string;
    initialNameProp?: string;
    onClose?: () => void;
    onSave?: () => void;
    onNestedItemPress?: (ingredientId: string) => void;
    onChromeState?: (state: import("@/lib/editorChrome").EditorChromeState | null) => void;
}

export default function AddCocktailScreen({
    isInline,
    draftIdProp,
    barIdProp,
    menuDraftIdProp,
    menuSectionIdProp,
    initialNameProp,
    onClose,
    onSave,
    onNestedItemPress,
    onChromeState,
}: AddCocktailProps = {}) {
    if (isInline) {
        return (
            <CocktailDraftInlineEditor
                draftId={draftIdProp}
                barId={barIdProp}
                menuDraftId={menuDraftIdProp}
                menuSectionId={menuSectionIdProp}
                initialName={initialNameProp}
                onClose={onClose}
                onSave={onSave}
                onNestedItemPress={onNestedItemPress}
                onChromeState={onChromeState}
            />
        );
    }

    const router = useRouter();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    const queryClient = useQueryClient();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();
    const { data: userBars } = useBars();

    const methods = dropdowns?.methods || [];
    const glassware = dropdowns?.glassware || [];
    const families = dropdowns?.families || [];
    const iceTypes = dropdowns?.iceTypes || [];
    const allIngredients = dropdowns?.ingredients || [];
    const menus = dropdowns?.menus || [];

    const [saving, setSaving] = useState(false);
    
    // Exit Modal State
    const [showExitModal, setShowExitModal] = useState(false);
    const pendingNavigationActionRef = useRef<any>(null);
    const isExitingRef = useRef(false);

    const { barId: initialBarId, draftId, name: initialNameParam, menuDraftId, menuSectionId } = useLocalSearchParams<{ barId?: string, draftId?: string, name?: string, menuDraftId?: string, menuSectionId?: string }>();
    const activeDraftIdProp = draftIdProp !== undefined ? draftIdProp : draftId;
    const activeBarIdProp = barIdProp !== undefined ? barIdProp : initialBarId;
    const activeMenuDraftId = menuDraftIdProp !== undefined ? menuDraftIdProp : menuDraftId;
    const activeMenuSectionId = menuSectionIdProp !== undefined ? menuSectionIdProp : menuSectionId;
    const activeInitialName = initialNameProp !== undefined ? initialNameProp : initialNameParam;

    const { drafts, saveDraft, deleteDraft, isFetching } = useDrafts();

    const mergedIngredients = useMemo(() => {
        const published = (dropdowns?.ingredients || []).map((i: any) => ({
            id: i.id,
            name: i.name
        }));

        const draftIngredients = drafts
            .filter((d: any) => d.entity_type === 'ingredient')
            .map((d: any) => ({
                id: d.id,
                name: d.draft_data?.name || "Untitled Ingredient Draft"
            }));

        const combined = [...draftIngredients, ...published];
        const seen = new Set();
        return combined.filter((i: any) => {
            if (seen.has(i.id)) return false;
            seen.add(i.id);
            return true;
        });
    }, [dropdowns?.ingredients, drafts]);

    // Form State
    const [name, setName] = useState(activeInitialName ? capitalize(activeInitialName) : "");
    const [description, setDescription] = useState("");
    const [origin, setOrigin] = useState("");
    const [garnish, setGarnish] = useState("");
    const [notes, setNotes] = useState("");
    const [spec, setSpec] = useState("");
    
    // Add local state for the active draft ID so newly created drafts are tracked
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(activeDraftIdProp || null);

    // Checkbox/Selection State (IDs)
    const [methodId, setMethodId] = useState<string | null>(null);
    const [glasswareId, setGlasswareId] = useState<string | null>(null);
    const [familyId, setFamilyId] = useState<string | null>(null);
    const [iceId, setIceId] = useState<string | null>(null);

    // Bar Assignment and Overrides
    const [barId, setBarId] = useState<string | null>(activeBarIdProp || null);
    const [overrideVisibility, setOverrideVisibility] = useState<string | null>(null);
    const [overrideGeneric, setOverrideGeneric] = useState<string | null>(null);
    const [overrideSpecific, setOverrideSpecific] = useState<string | null>(null);
    const [overrideMeasurement, setOverrideMeasurement] = useState<string | null>(null);
    const [overridePrep, setOverridePrep] = useState<string | null>(null);


    // Recipe State
    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);
    const [ingredientSearch, setIngredientSearch] = useState("");

    const trackedDraft = currentDraftId
        ? drafts.find((d: any) => d.id === currentDraftId)
        : null;
    useTrackRecent(
        !!trackedDraft,
        trackedDraft
            ? recentEntry(
                  'cocktail',
                  trackedDraft.id,
                  trackedDraft.draft_data?.name || name || 'Untitled Cocktail',
                  {
                      isDraft: true,
                      imageUrl: trackedDraft.draft_data?.localImages?.[0]?.url,
                      barId: trackedDraft.bar_id ?? barId ?? null,
                  }
              )
            : null
    );

    const { recentlyCreatedItem, setRecentlyCreatedItem } = useAppStore();

    useEffect(() => {
        if (recentlyCreatedItem?.type === 'ingredient') {
            setRecipeItems(prev => {
                if (prev.some(item => item.ingredient_id === recentlyCreatedItem.id)) {
                    return prev;
                }
                return [...prev, { 
                    ingredient_id: recentlyCreatedItem.id, 
                    name: recentlyCreatedItem.name, 
                    amount: "", 
                    unit: "", 
                    preparation_notes: "", 
                    is_optional: false 
                }];
            });
            setRecentlyCreatedItem(null);
        }
    }, [recentlyCreatedItem, setRecentlyCreatedItem]);

    // Image State (Local only for creation)
    const [localImages, setLocalImages] = useState<{ id: string, url: string }[]>([]);

    const theme = useTheme();
    const pickerSheetRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['80%'], []);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
            />
        ),
        []
    );

    const draftLoadedRef = useRef<string | null>(null);
    const loading = loadingDropdowns || (!!currentDraftId && draftLoadedRef.current !== currentDraftId);

    const currentStateStr = JSON.stringify({ name, description, origin, notes, methodId, glasswareId, familyId, iceId, barId, recipeItems, localImages, overrideVisibility, overrideGeneric, overrideSpecific, overrideMeasurement, overridePrep });
    const cleanStateStrRef = useRef<string>(currentStateStr);
    const [needsCleanMark, setNeedsCleanMark] = useState(false);

    useEffect(() => {
        if (needsCleanMark) {
            cleanStateStrRef.current = currentStateStr;
            setNeedsCleanMark(false);
        }
    }, [needsCleanMark, currentStateStr]);

    useEffect(() => {
        if (currentDraftId && drafts.length > 0 && draftLoadedRef.current !== currentDraftId) {
            // Wait for React Query to finish fetching fresh background data
            if (isFetching) return;
            
            const draft = drafts.find((d: any) => d.id === currentDraftId);
            if (draft && draft.draft_data) {
                draftLoadedRef.current = currentDraftId;
                const data = draft.draft_data;
                setName(data.name || "");
                setDescription(data.description || "");
                setOrigin(data.origin || "");
                setNotes(data.notes || "");
                setMethodId(data.methodId || null);
                setGlasswareId(data.glasswareId || null);
                setFamilyId(data.familyId || null);
                setIceId(data.iceId || null);
                setBarId(data.barId || initialBarId || null);
                setRecipeItems(data.recipeItems || []);
                setLocalImages(data.localImages || []);
                setOverrideVisibility(data.overrideVisibility || null);
                setOverrideGeneric(data.overrideGeneric || null);
                setOverrideSpecific(data.overrideSpecific || null);
                setOverrideMeasurement(data.overrideMeasurement || null);
                setOverridePrep(data.overridePrep || null);
                setNeedsCleanMark(true); // Mark clean after loading from DB
            } else {
                // If draft isn't found even after fetch completes, unblock UI
                draftLoadedRef.current = currentDraftId;
            }
        }
    }, [currentDraftId, drafts, isFetching]);

    const handleSaveDraft = async (silent = false) => {
        try {
            setSaving(true);
            const draftData = {
                name, description, origin, notes, methodId, glasswareId, familyId, iceId, barId,
                recipeItems, localImages, overrideVisibility, overrideGeneric, overrideSpecific,
                overrideMeasurement, overridePrep
            };
            const result = await saveDraft({ id: currentDraftId || undefined, entityType: 'cocktail', draftData });
            
            let updatedDraftId = currentDraftId;
            // If this was a new draft, save the ID so subsequent clicks update the same draft
            if (!currentDraftId && result && result.id) {
                updatedDraftId = result.id;
                setCurrentDraftId(result.id);
                // Also update the URL params silently so refreshing doesn't lose it
                if (!isInline) {
                    router.setParams({ draftId: result.id });
                }
            }

            if (activeMenuDraftId && activeMenuSectionId && result && result.id) {
                const menuDraft = drafts.find((d: any) => d.id === activeMenuDraftId);
                if (menuDraft) {
                    const selections = { ...(menuDraft.draft_data?.selections || {}) };
                    const currentSectionDrinks = selections[activeMenuSectionId] || [];
                    if (!currentSectionDrinks.includes(result.id)) {
                        selections[activeMenuSectionId] = [...currentSectionDrinks, result.id];
                        const updatedDraftData = {
                            ...menuDraft.draft_data,
                            selections
                        };
                        await saveDraft({
                            id: menuDraft.id,
                            entityType: 'menu',
                            draftData: updatedDraftData
                        });
                    }
                }
                setRecentlyCreatedItem({ type: 'cocktail', id: result.id, name: name || "Untitled Cocktail Draft" });
            }
            
            if (!silent) {
                if (Platform.OS === 'web') {
                    window.alert("Draft saved successfully!");
                } else {
                    Alert.alert("Success", "Draft saved successfully!");
                }
            }
            setNeedsCleanMark(true); // Mark clean after saving
            return updatedDraftId;
        } catch (error) {
            if (!silent) {
                if (Platform.OS === 'web') {
                    window.alert("Failed to save draft.");
                } else {
                    Alert.alert("Error", "Failed to save draft.");
                }
            }
            return null;
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
            const hasProgress = name.trim() !== "" || currentDraftId !== null || currentStateStr !== cleanStateStrRef.current;
            if (!hasProgress) {
                return;
            }

            // Always prevent the navigation to show our custom modal
            e.preventDefault();
            pendingNavigationActionRef.current = e.data.action;
            setShowExitModal(true);
        });

        return unsubscribe;
    }, [navigation, currentStateStr, name, currentDraftId, isInline]);

    const confirmExit = async (shouldSave: boolean) => {
        setShowExitModal(false);
        if (shouldSave) {
            await handleSaveDraft();
        }
        if (isInline) {
            if (onClose) onClose();
        } else if (pendingNavigationActionRef.current) {
            isExitingRef.current = true;
            navigation.dispatch(pendingNavigationActionRef.current);
        }
    };

    useEffect(() => {
        if (showIngredientPicker) {
            pickerSheetRef.current?.present();
        } else {
            pickerSheetRef.current?.dismiss();
            setIngredientSearch("");
        }
    }, [showIngredientPicker]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            if (Platform.OS === 'web') {
                window.alert("Permission needed: We need access to your photos.");
            } else {
                Alert.alert("Permission needed", "We need access to your photos.");
            }
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.8,
        });

        if (!result.canceled) {
            setSaving(true);
            try {
                const newImages: { id: string, url: string }[] = [];
                for (const asset of result.assets) {
                    const ext = asset.uri.substring(asset.uri.lastIndexOf('.') + 1) || 'jpg';
                    const fileName = `drafts/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
                    const arrayBuffer = decode(base64);

                    const { error: uploadError } = await supabase.storage
                        .from('drinks')
                        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: false });

                    if (!uploadError) {
                        const { data: publicUrlData } = supabase.storage.from('drinks').getPublicUrl(fileName);
                        
                        const { data: imgData, error: imgError } = await supabase
                            .from('images')
                            .insert({ url: publicUrlData.publicUrl })
                            .select()
                            .single();
                            
                        if (!imgError && imgData) {
                            newImages.push({
                                id: imgData.id,
                                url: publicUrlData.publicUrl,
                            });
                        }
                    }
                }
                setLocalImages(prev => [...prev, ...newImages]);
            } catch (error) {
                console.error("Error uploading drafted image", error);
                if (Platform.OS === 'web') {
                    window.alert("Error uploading image");
                } else {
                    Alert.alert("Error", "Failed to upload image");
                }
            } finally {
                setSaving(false);
            }
        }
    };



    const uploadImage = async (uri: string, cocktailId: string): Promise<string | null> => {
        try {
            if (uri.startsWith('http')) {
                const { data: imgData, error: imgError } = await supabase
                    .from('images')
                    .select('id')
                    .eq('url', uri)
                    .limit(1)
                    .single();
                if (imgData && !imgError) return imgData.id;
                
                const { data: newImgData, error: newImgError } = await supabase
                    .from('images')
                    .insert({ url: uri })
                    .select()
                    .single();
                if (!newImgError && newImgData) return newImgData.id;
                return null;
            }

            const ext = uri.substring(uri.lastIndexOf('.') + 1) || 'jpg';
            const fileName = `cocktails/${cocktailId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
            const arrayBuffer = decode(base64);

            const { error: uploadError } = await supabase.storage
                .from('drinks')
                .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: false });

            if (uploadError) return null;

            const { data: publicUrlData } = supabase.storage.from('drinks').getPublicUrl(fileName);
            
            const { data: imgData, error: imgError } = await supabase
                .from('images')
                .insert({ url: publicUrlData.publicUrl })
                .select()
                .single();

            if (imgError || !imgData) return null;
            return imgData.id;
        } catch (error) {
            console.error("Image upload exception:", error);
            return null;
        }
    };

    const handleSave = () => {
        if (!name.trim()) {
            if (Platform.OS === 'web') {
                window.alert("Missing Info: Name is required.");
            } else {
                Alert.alert("Missing Info", "Name is required.");
            }
            return;
        }

        const proceed = () => {
            performSave();
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to publish this cocktail?")) {
                proceed();
            }
        } else {
            Alert.alert(
                "Publish Cocktail",
                "Are you sure you want to publish this cocktail?",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Publish", onPress: proceed }
                ]
            );
        }
    };

    const performSave = async () => {
        setSaving(true);
        try {
            // Resolve draft ingredients recursively before publishing the cocktail
            const resolvedRecipeItems = [];
            for (const item of recipeItems) {
                const resolvedId = await resolveIngredientId(item.ingredient_id, drafts);
                if (resolvedId !== item.ingredient_id) {
                    await updateParentDraftsWithPublishedId(item.ingredient_id, resolvedId, drafts, saveDraft);
                }
                resolvedRecipeItems.push({
                    ...item,
                    ingredient_id: resolvedId
                });
            }

            // 1. Create Cocktail
            const { data: cocktail, error: cocktailError } = await supabase
                .from('items')
                .insert({
                    name: capitalize(name),
                    description,
                    origin: capitalize(origin) || null,
                    notes: notes || null,
                    glassware_id: glasswareId,
                    family_id: familyId,
                    ice_id: iceId,
                    item_type: 'cocktail',
                    bar_id: barId || null,
                    override_visibility_level: overrideVisibility ? parseInt(overrideVisibility) : null,
                    override_generic_ingredient_level: overrideGeneric ? parseInt(overrideGeneric) : null,
                    override_specific_brand_level: overrideSpecific ? parseInt(overrideSpecific) : null,
                    override_measurement_level: overrideMeasurement ? parseInt(overrideMeasurement) : null,
                    override_prep_level: overridePrep ? parseInt(overridePrep) : null,
                })
                .select()
                .single();

            if (cocktailError || !cocktail) throw cocktailError;

            const cocktailId = cocktail.id;

            for (let i = 0; i < localImages.length; i++) {
                const imgId = await uploadImage(localImages[i].url, cocktailId);
                if (imgId) {
                    await supabase.from('item_images').insert({
                        item_id: cocktailId,
                        image_id: imgId,
                        sort_order: i
                    });
                }
            }

            for (const [index, item] of resolvedRecipeItems.entries()) {
                await supabase.from('recipes').insert({
                    recipe_item_id: cocktailId,
                    ingredient_item_id: item.ingredient_id,
                    amount: parseFloat(item.amount) || null,
                    unit: item.unit || null,
                    preparation_notes: item.preparation_notes || null,
                    is_optional: item.is_optional || false,
                    sort_order: index,
                });
            }

            if (methodId) {
                await supabase.from('item_methods').insert({
                    item_id: cocktailId,
                    method_item_id: methodId,
                    sort_order: 0
                });
            }



            queryClient.invalidateQueries({ queryKey: ['cocktails'] });
            await queryClient.invalidateQueries({ queryKey: ['dropdowns_v2'] });
            
            const activeDraftId = currentDraftId || draftId;
            if (activeMenuDraftId && activeMenuSectionId) {
                const menuDraft = drafts.find((d: any) => d.id === activeMenuDraftId);
                if (menuDraft) {
                    const selections = { ...(menuDraft.draft_data?.selections || {}) };
                    const currentSectionDrinks = selections[activeMenuSectionId] || [];
                    let updatedSectionDrinks = [...currentSectionDrinks];
                    if (activeDraftId) {
                        updatedSectionDrinks = updatedSectionDrinks.filter(id => id !== activeDraftId);
                    }
                    if (!updatedSectionDrinks.includes(cocktailId)) {
                        updatedSectionDrinks.push(cocktailId);
                    }
                    selections[activeMenuSectionId] = updatedSectionDrinks;
                    const updatedDraftData = {
                        ...menuDraft.draft_data,
                        selections
                    };
                    await saveDraft({
                        id: menuDraft.id,
                        entityType: 'menu',
                        draftData: updatedDraftData
                    });
                }
            }

            if (activeDraftId) {
                await updateMenuDraftsWithPublishedId(activeDraftId, cocktailId, drafts, saveDraft);
                await deleteDraft(activeDraftId);
            }
            // If assigned to a bar, also invalidate that bar's cache
            if (barId) {
                queryClient.invalidateQueries({ queryKey: ['bar', barId] });
            }

            setRecentlyCreatedItem({ type: 'cocktail', id: cocktailId, name: name });

            if (Platform.OS === 'web') {
                window.alert("Success: Cocktail created!");
                isExitingRef.current = true;
                if (isInline) {
                    if (onSave) onSave();
                } else {
                    router.back();
                }
            } else {
                Alert.alert("Success", "Cocktail created!", [
                    { text: "OK", onPress: () => {
                        isExitingRef.current = true;
                        if (isInline) {
                            if (onSave) onSave();
                        } else {
                            router.back();
                        }
                    }}
                ]);
            }

        } catch (error) {
            console.error("Creation error:", error);
            if (Platform.OS === 'web') {
                window.alert("Error: Failed to create cocktail.");
            } else {
                Alert.alert("Error", "Failed to create cocktail.");
            }
        } finally {
            setSaving(false);
        }
    };

    const isItemDraft = (ingredientId: string) => {
        return drafts.some((d: any) => d.id === ingredientId && d.entity_type === 'ingredient');
    };

    return (
        <BottomSheetModalProvider>
        <YStack style={styles.container} backgroundColor="$background">
            {!isInline && <Stack.Screen options={{ headerShown: false }} />}
            
            {/* Header */}
            <XStack
                paddingTop={isInline ? 10 : (Platform.OS === 'ios' ? 20 : insets.top + 20)}
                paddingHorizontal="$4"
                paddingBottom="$4"
                alignItems="center"
                justifyContent="space-between"
                zIndex={10}
            >
                <TouchableOpacity 
                    onPress={() => {
                        if (isInline) {
                            const hasProgress = name.trim() !== "" || currentDraftId !== null || currentStateStr !== cleanStateStrRef.current;
                            if (hasProgress) {
                                setShowExitModal(true);
                            } else {
                                if (onClose) onClose();
                            }
                        } else {
                            router.back();
                        }
                    }} 
                    style={styles.headerBtn}
                >
                    <IconSymbol name="chevron.left" size={24} color={theme.color?.get() as string} />
                </TouchableOpacity>
                <Text fontSize="$5" fontWeight="bold">New Cocktail</Text>
                <XStack gap="$2" alignItems="center">
                    <Button 
                        onPress={handleSave} 
                        disabled={saving}
                        size="$3"
                        chromeless
                    >
                        {saving ? <ActivityIndicator size="small" color={theme.color8?.get() as string} /> : <Text color={theme.color8?.get() as string} fontWeight="bold">Publish</Text>}
                    </Button>
                </XStack>
            </XStack>

            {loading ? (
                <YStack flex={1} justifyContent="center" alignItems="center">
                    <ActivityIndicator size="large" color={theme.color8?.get() as string} />
                </YStack>
            ) : (
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
            <FormScrollContainer contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                
                {/* Image List */}
                <SortableImageList 
                    images={localImages}
                    onReorder={(newOrder) => {
                        const typedOrder = newOrder.map(item => ({
                            id: item.id || `recovered-${Date.now()}-${Math.random()}`,
                            url: item.url
                        }));
                        setLocalImages(typedOrder);
                    }}
                    onRemove={(index) => setLocalImages(prev => prev.filter((_, i) => i !== index))}
                    onAdd={pickImage}
                />

                {/* Main Info */}
                <YStack gap="$2">
                    <Label color="$color11">Name *</Label>
                    <Input
                        value={name}
                        onChangeText={(val) => handleCapitalizedChange(val, name, setName)}
                        onBlur={() => setName(capitalize(name))}
                        placeholderTextColor="$color11"
                        placeholder="e.g. Negroni"
                        size="$4"
                        backgroundColor="$backgroundStrong"
                        borderColor="$borderColor"
                        focusStyle={{ borderColor: '$color8' }}
                    />
                </YStack>

                <YStack gap="$2">
                    <Label color="$color11">Description</Label>
                    <TextArea
                        value={description}
                        onChangeText={setDescription}
                        numberOfLines={4}
                        placeholderTextColor="$color11"
                        size="$4"
                        backgroundColor="$backgroundStrong"
                        borderColor="$borderColor"
                        focusStyle={{ borderColor: '$color8' }}
                    />
                </YStack>

                {/* Drink Specs Dropdowns */}
                <YStack gap="$2">
                    <Label color="$color11">Method</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <XStack gap="$2">
                            {methods.map(m => (
                                <SpecPillButton
                                    key={m.id}
                                    name={m.name}
                                    selected={methodId === m.id}
                                    onPress={() => setMethodId(m.id)}
                                />
                            ))}
                        </XStack>
                    </ScrollView>
                </YStack>

                <YStack gap="$2">
                    <Label color="$color11">Glassware</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <XStack gap="$2">
                            {glassware.map(g => (
                                <SpecPillButton
                                    key={g.id}
                                    name={g.name}
                                    selected={glasswareId === g.id}
                                    onPress={() => setGlasswareId(g.id)}
                                />
                            ))}
                        </XStack>
                    </ScrollView>
                </YStack>

                <YStack gap="$2">
                    <Label color="$color11">Family</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <XStack gap="$2">
                            {families.map(f => (
                                <SpecPillButton
                                    key={f.id}
                                    name={f.name}
                                    selected={familyId === f.id}
                                    onPress={() => setFamilyId(f.id)}
                                />
                            ))}
                        </XStack>
                    </ScrollView>
                </YStack>

                <YStack gap="$2">
                    <Label color="$color11">Ice</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <XStack gap="$2">
                            {iceTypes.map(i => (
                                <SpecPillButton
                                    key={i.id}
                                    name={i.name}
                                    selected={iceId === i.id}
                                    onPress={() => setIceId(iceId === i.id ? null : i.id)}
                                />
                            ))}
                        </XStack>
                    </ScrollView>
                </YStack>

                {/* Ingredients */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.label}>Ingredients</Text>
                        <TouchableOpacity onPress={() => setShowIngredientPicker(true)}>
                            <Text color="$color8" fontWeight="bold">+ Add</Text>
                        </TouchableOpacity>
                    </View>

                    <SortableRecipeList
                        items={recipeItems}
                        onReorder={setRecipeItems}
                        onUpdateItem={(index, updates) => {
                            const newItems = [...recipeItems];
                            newItems[index] = { ...newItems[index], ...updates };
                            setRecipeItems(newItems);
                        }}
                        onRemove={(index) => setRecipeItems(recipeItems.filter((_, i) => i !== index))}
                        variant="row"
                        onNestedItemPress={onNestedItemPress}
                        drafts={drafts}
                        dropdowns={dropdowns}
                    />
                </View>

                {/* Extra Details */}
                <YStack gap="$2">
                    <Label color="$color11">Origin</Label>
                    <Input 
                        value={origin} 
                        onChangeText={(val) => handleCapitalizedChange(val, origin, setOrigin)} 
                        onBlur={() => setOrigin(capitalize(origin))}
                        placeholderTextColor="$color11" 
                        size="$4"
                        backgroundColor="$backgroundStrong"
                        borderColor="$borderColor"
                        focusStyle={{ borderColor: '$color8' }}
                    />
                </YStack>



                <YStack gap="$2">
                    <Label color="$color11">Notes</Label>
                    <TextArea 
                        value={notes} 
                        onChangeText={setNotes} 
                        multiline 
                        placeholderTextColor="$color11" 
                        size="$4"
                        backgroundColor="$backgroundStrong"
                        borderColor="$borderColor"
                        focusStyle={{ borderColor: '$color8' }}
                    />
                </YStack>



                <BarAssignmentAccordion
                    barId={barId} setBarId={setBarId}
                    overrideVisibility={overrideVisibility} setOverrideVisibility={setOverrideVisibility}
                    overrideGeneric={overrideGeneric} setOverrideGeneric={setOverrideGeneric}
                    overrideSpecific={overrideSpecific} setOverrideSpecific={setOverrideSpecific}
                    overrideMeasurement={overrideMeasurement} setOverrideMeasurement={setOverrideMeasurement}
                    overridePrep={overridePrep} setOverridePrep={setOverridePrep}
                />

            </FormScrollContainer>
            </KeyboardAvoidingView>
            )}

            {/* Native Modal for adding ingredients avoiding gorhom issues */}
            <Modal
                visible={showIngredientPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowIngredientPicker(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    <View style={styles.modalOverlay}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowIngredientPicker(false)} />
                        <View style={[styles.fullSheetModalContent, { backgroundColor: theme.background?.get() as string, paddingBottom: insets.bottom }]}>
                            <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
                                <View style={styles.modalHeader}>
                                    <Text fontSize={14} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600">Select Ingredient</Text>
                                    <TouchableOpacity onPress={() => setShowIngredientPicker(false)}>
                                        <IconSymbol name="xmark" size={20} color={theme.color11?.get() as string} />
                                    </TouchableOpacity>
                                </View>
                                <SearchBar
                                    placeholder="Search ingredients..."
                                    value={ingredientSearch}
                                    onChangeText={setIngredientSearch}
                                    style={{ marginBottom: 16 }}
                                />
                            </View>
                            <FlatList
                                style={{ flex: 1 }}
                                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
                                data={mergedIngredients.filter(i => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))}
                                keyExtractor={item => item.id}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[styles.ingredientOption, { borderBottomColor: theme.borderColor?.get() as string }]}
                                        onPress={() => {
                                            setRecipeItems([...recipeItems, { ingredient_id: item.id, name: capitalize(item.name), amount: "", unit: "", preparation_notes: "", is_optional: false }]);
                                            setShowIngredientPicker(false);
                                        }}
                                    >
                                        <XStack gap="$2" alignItems="center">
                                            <Text color={theme.color?.get() as string} fontSize={16}>{capitalize(item.name)}</Text>
                                            {isItemDraft(item.id) && (
                                                <View style={styles.draftBadge}>
                                                    <Text style={styles.draftBadgeText}>Draft</Text>
                                                </View>
                                            )}
                                        </XStack>
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <YStack padding="$4" alignItems="center" gap="$4" marginTop="$8">
                                        <IconSymbol name="magnifyingglass" size={48} color={theme.color11?.get() as string} />
                                        <Text color="$color11" textAlign="center" fontSize={16} fontWeight="bold">No results found</Text>
                                        <Button 
                                            marginTop="$4" 
                                            backgroundColor="$color5" 
                                            pressStyle={{ scale: 0.97 }}
                                            onPress={async () => {
                                                setShowIngredientPicker(false);
                                                await handleSaveDraft(true);
                                                router.push({
                                                    pathname: "/add-ingredient",
                                                    params: { 
                                                        name: ingredientSearch,
                                                        barId: barId || ""
                                                    }
                                                });
                                            }}
                                        >
                                            <Text color="$color" fontWeight="600">
                                                Create ingredient
                                            </Text>
                                        </Button>
                                    </YStack>
                                }
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Custom Exit Modal for handling browser back and dirty states safely */}
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
                            <Button size="$3" backgroundColor={theme.color8?.get() as string} onPress={() => confirmExit(true)}>
                                <Text color={theme.backgroundStrong?.get() as string} fontWeight="bold">Save</Text>
                            </Button>
                        </XStack>
                    </YStack>
                </View>
            </Modal>

        </YStack>
        </BottomSheetModalProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        zIndex: 10,
    },
    headerBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 20,
        gap: 24,
    },
    section: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#888',
        marginLeft: 4,
    },
    input: {
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        borderWidth: 1,
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    selectButton: {
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    searchInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 10
    },
    ingredientOption: {
        padding: 16,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    fullSheetModalContent: {
        borderTopLeftRadius: 48,
        borderTopRightRadius: 48,
        borderCurve: 'continuous',
        height: '80%'
    },
    draftBadge: {
        backgroundColor: 'rgba(255, 165, 0, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 165, 0, 0.4)',
    },
    draftBadgeText: {
        color: '#ffa500',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    }

});
