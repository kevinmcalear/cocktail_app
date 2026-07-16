import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetView, BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { Stack, useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Platform,
    KeyboardAvoidingView,
    Modal
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SearchBar } from "@/components/SearchBar";
import { SortableRecipeList } from "@/components/recipe/SortableRecipeList";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useDrafts } from "@/hooks/useDrafts";
import { recentEntry, useTrackRecent } from "@/hooks/useTrackRecent";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label, Text, TextArea, XStack, YStack, useTheme, View } from "tamagui";
import { CategoryPickerModal } from "@/components/CategoryPickerModal";
import { BarAssignmentAccordion } from "@/components/BarAssignmentAccordion";
import { useAppStore } from "@/store/useAppStore";
import { resolveIngredientId, updateParentDraftsWithPublishedId } from "@/lib/drafts";
import { capitalize, capitalizeAsYouType, handleCapitalizedChange } from "@/lib/stringUtils";
import { calculateDraftProgress } from "@/lib/draftProgress";
import { FormScrollContainer } from "@/components/recipe/FormScrollContainer";

interface RecipeItem {
    id?: string;
    ingredient_id: string;
    name: string;
    amount: string;
    unit: string;
}

interface AddIngredientProps {
    isInline?: boolean;
    draftIdProp?: string;
    barIdProp?: string;
    onClose?: () => void;
    onSave?: () => void;
    onNestedItemPress?: (ingredientId: string) => void;
}

export default function AddIngredientScreen({ isInline, draftIdProp, barIdProp, onClose, onSave, onNestedItemPress }: AddIngredientProps = {}) {
    const router = useRouter();
    const { barId: initialBarId, draftId, name: initialNameParam } = useLocalSearchParams<{ barId?: string, draftId?: string, name?: string }>();
    const activeDraftIdProp = draftIdProp !== undefined ? draftIdProp : draftId;
    const activeBarIdProp = barIdProp !== undefined ? barIdProp : initialBarId;
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const theme = useTheme();

    const [saving, setSaving] = useState(false);
    const queryClient = useQueryClient();

    const { drafts, saveDraft, deleteDraft, isFetching } = useDrafts();
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(activeDraftIdProp || null);

    const [showExitModal, setShowExitModal] = useState(false);
    const pendingNavigationActionRef = useRef<any>(null);
    const isExitingRef = useRef(false);

    // Form State
    const [name, setName] = useState(initialNameParam ? capitalize(initialNameParam) : "");
    const [description, setDescription] = useState("");
    const [brandMaker, setBrandMaker] = useState("");
    const [abv, setAbv] = useState("");

    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const categoryPickerRef = useRef<BottomSheetModal>(null);

    // Bar Assignment and Overrides
    const [barId, setBarId] = useState<string | null>(activeBarIdProp || null);
    const [overrideVisibility, setOverrideVisibility] = useState<string | null>(null);
    const [overrideGeneric, setOverrideGeneric] = useState<string | null>(null);
    const [overrideSpecific, setOverrideSpecific] = useState<string | null>(null);
    const [overrideMeasurement, setOverrideMeasurement] = useState<string | null>(null);
    const [overridePrep, setOverridePrep] = useState<string | null>(null);

    // Recipe State
    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const [ingredientSearch, setIngredientSearch] = useState("");
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['80%'], []);

    const { data: dropdowns } = useDropdowns();
    const allIngredients = dropdowns?.ingredients || [];

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

    const [showIngredientPicker, setShowIngredientPicker] = useState(false);

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
                    unit: "" 
                }];
            });
            setRecentlyCreatedItem(null);
        }
    }, [recentlyCreatedItem, setRecentlyCreatedItem]);

    const handlePresentModalPress = useCallback(() => {
        setShowIngredientPicker(true);
    }, []);

    const handleDismissModalPress = useCallback(() => {
        setShowIngredientPicker(false);
    }, []);

    const draftLoadedRef = useRef<string | null>(null);
    const currentStateStr = JSON.stringify({ name, description, brandMaker, abv, selectedCategories, recipeItems, barId, overrideVisibility, overrideGeneric, overrideSpecific, overrideMeasurement, overridePrep });
    const cleanStateStrRef = useRef<string>(currentStateStr);
    const [needsCleanMark, setNeedsCleanMark] = useState(false);

    const trackedDraft = currentDraftId
        ? drafts.find((d: any) => d.id === currentDraftId)
        : null;
    useTrackRecent(
        !!trackedDraft,
        trackedDraft
            ? recentEntry(
                  'ingredient',
                  trackedDraft.id,
                  trackedDraft.draft_data?.name || name || 'Untitled Ingredient',
                  {
                      isDraft: true,
                      barId: trackedDraft.bar_id ?? barId ?? null,
                  }
              )
            : null
    );

    useEffect(() => {
        if (needsCleanMark) {
            cleanStateStrRef.current = currentStateStr;
            setNeedsCleanMark(false);
        }
    }, [needsCleanMark, currentStateStr]);

    useEffect(() => {
        if (currentDraftId && drafts.length > 0 && draftLoadedRef.current !== currentDraftId) {
            if (isFetching) return;
            
            const draft = drafts.find((d: any) => d.id === currentDraftId);
            if (draft && draft.draft_data) {
                draftLoadedRef.current = currentDraftId;
                const data = draft.draft_data;
                setName(data.name || "");
                setDescription(data.description || "");
                setBrandMaker(data.brandMaker || "");
                setAbv(data.abv || "");
                setSelectedCategories(data.selectedCategories || []);
                setRecipeItems(data.recipeItems || []);
                setBarId(data.barId || initialBarId || null);
                setOverrideVisibility(data.overrideVisibility || null);
                setOverrideGeneric(data.overrideGeneric || null);
                setOverrideSpecific(data.overrideSpecific || null);
                setOverrideMeasurement(data.overrideMeasurement || null);
                setOverridePrep(data.overridePrep || null);
                setNeedsCleanMark(true);
            } else {
                draftLoadedRef.current = currentDraftId;
            }
        }
    }, [currentDraftId, drafts, isFetching]);

    const handleSaveDraft = async (silent = false) => {
        try {
            setSaving(true);
            const draftData = { name, description, brandMaker, abv, selectedCategories, recipeItems, barId, overrideVisibility, overrideGeneric, overrideSpecific, overrideMeasurement, overridePrep };
            const result = await saveDraft({ id: currentDraftId || undefined, entityType: 'ingredient', draftData });
            
            let updatedDraftId = currentDraftId;
            if (!currentDraftId && result && result.id) {
                updatedDraftId = result.id;
                setCurrentDraftId(result.id);
                if (!isInline) {
                    router.setParams({ draftId: result.id });
                }
            }

            // Set recentlyCreatedItem so the parent screen knows about this draft ingredient
            const draftIdToNotify = updatedDraftId || (result && result.id);
            if (draftIdToNotify) {
                setRecentlyCreatedItem({
                    type: 'ingredient',
                    id: draftIdToNotify,
                    name: name.trim() || "Untitled Ingredient Draft"
                });
            }
            
            if (!silent) {
                if (Platform.OS === 'web') {
                    window.alert("Draft saved successfully!");
                } else {
                    Alert.alert("Success", "Draft saved successfully!");
                }
            }
            setNeedsCleanMark(true);
            return draftIdToNotify;
        } catch (error) {
            console.error("Draft error:", error);
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

    const handleSave = () => {
        if (!name.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return;
        }

        const proceed = () => {
            performSave();
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to publish this ingredient?")) {
                proceed();
            }
        } else {
            Alert.alert(
                "Publish Ingredient",
                "Are you sure you want to publish this ingredient?",
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
            // Resolve draft ingredients recursively before publishing this complex ingredient
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

            // 1. Create Ingredient
            const { data: ingredient, error: ingredientError } = await supabase
                .from('items')
                .insert({
                    name: capitalize(name),
                    description: description.trim() || null,
                    item_type: 'ingredient',
                    brand_maker: capitalize(brandMaker) || null,
                    abv: abv ? parseFloat(abv) : null,
                    bar_id: barId || null,
                    override_visibility_level: overrideVisibility ? parseInt(overrideVisibility) : null,
                    override_generic_ingredient_level: overrideGeneric ? parseInt(overrideGeneric) : null,
                    override_specific_brand_level: overrideSpecific ? parseInt(overrideSpecific) : null,
                    override_measurement_level: overrideMeasurement ? parseInt(overrideMeasurement) : null,
                    override_prep_level: overridePrep ? parseInt(overridePrep) : null,
                })
                .select()
                .single();

            if (ingredientError || !ingredient) throw ingredientError;

            const ingredientId = ingredient.id;

            // Categories
            for (const catId of selectedCategories) {
                await supabase
                    .from('item_categories')
                    .upsert({
                        item_id: ingredientId,
                        category_id: catId,
                        is_primary: true
                    }, { onConflict: 'item_id,category_id' });
            }

            if (resolvedRecipeItems.length > 0) {
                const recipeInserts = resolvedRecipeItems.map((item, index) => ({
                    recipe_item_id: ingredientId,
                    ingredient_item_id: item.ingredient_id,
                    amount: parseFloat(item.amount) || null,
                    unit: item.unit || null,
                    sort_order: index,
                }));

                const { error: recipeError } = await supabase
                    .from('recipes')
                    .insert(recipeInserts);

                if (recipeError) throw recipeError;
            }

            queryClient.invalidateQueries({ queryKey: ['ingredients'] });
            await queryClient.invalidateQueries({ queryKey: ['dropdowns_v2'] });
            if (currentDraftId) {
                await updateParentDraftsWithPublishedId(currentDraftId, ingredientId, drafts, saveDraft);
                await deleteDraft(currentDraftId);
            }
            if (barId) {
                queryClient.invalidateQueries({ queryKey: ['bar', barId] });
            }

            setRecentlyCreatedItem({ type: 'ingredient', id: ingredientId, name: name.trim() });

            Alert.alert("Success", "Ingredient created!", [
                { text: "OK", onPress: () => {
                    isExitingRef.current = true;
                    if (isInline) {
                        if (onSave) onSave();
                    } else {
                        router.back();
                    }
                } }
            ]);

        } catch (error: any) {
            console.error("Creation error:", error);
            Alert.alert("Error", error.message || "Failed to create ingredient.");
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
            {!isInline && <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />}
            
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
                <Text fontSize="$5" fontWeight="bold">New Ingredient</Text>
                <XStack gap="$2" alignItems="center">
                    <Button 
                        onPress={handleSave} 
                        disabled={saving}
                        size="$3"
                        chromeless
                    >
                        {saving ? <ActivityIndicator size="small" color={theme.color8?.get() as string} /> : <Text color={theme.color8?.get() as string} fontWeight="bold">Save</Text>}
                    </Button>
                </XStack>
            </XStack>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <FormScrollContainer contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                    
                    <YStack gap="$2" marginBottom="$4">
                        <Label color="$color11">Name *</Label>
                        <Input
                            value={name}
                            onChangeText={(val) => handleCapitalizedChange(val, name, setName)}
                            onBlur={() => setName(capitalize(name))}
                            placeholderTextColor="$color11"
                            placeholder="e.g. Rich Simple Syrup"
                            size="$4"
                            backgroundColor="$backgroundStrong"
                            borderColor="$borderColor"
                            focusStyle={{ borderColor: '$color8' }}
                        />
                    </YStack>

                    <YStack gap="$2" marginBottom="$4">
                        <Label color="$color11">Brand / Maker</Label>
                        <Input
                            value={brandMaker}
                            onChangeText={(val) => handleCapitalizedChange(val, brandMaker, setBrandMaker)}
                            onBlur={() => setBrandMaker(capitalize(brandMaker))}
                            placeholderTextColor="$color11"
                            placeholder="e.g. Campari, Buffalo Trace"
                            size="$4"
                            backgroundColor="$backgroundStrong"
                            borderColor="$borderColor"
                            focusStyle={{ borderColor: '$color8' }}
                        />
                    </YStack>

                    <YStack gap="$2" marginBottom="$4">
                        <Label color="$color11">ABV (%)</Label>
                        <Input
                            value={abv}
                            onChangeText={setAbv}
                            keyboardType="numeric"
                            placeholderTextColor="$color11"
                            placeholder="e.g. 40"
                            size="$4"
                            backgroundColor="$backgroundStrong"
                            borderColor="$borderColor"
                            focusStyle={{ borderColor: '$color8' }}
                        />
                    </YStack>

                    <YStack gap="$2" marginBottom="$4">
                        <XStack justifyContent="space-between" alignItems="center">
                            <Label color="$color11">Spirit Tags</Label>
                            <TouchableOpacity onPress={() => categoryPickerRef.current?.present()}>
                                <Text color={theme.color8?.get() as string} fontWeight="bold">+ Add</Text>
                            </TouchableOpacity>
                        </XStack>
                        <XStack flexWrap="wrap" gap="$2">
                            {selectedCategories.length === 0 ? (
                                <Text color="$color11" fontStyle="italic">No tags selected</Text>
                            ) : (
                                selectedCategories.map(catId => {
                                    const cat = dropdowns?.categories?.find((c: any) => c.id === catId);
                                    if (!cat) return null;
                                    return (
                                        <XStack key={catId} backgroundColor="$backgroundStrong" paddingHorizontal={12} paddingVertical={6} borderRadius={16}>
                                            <Text color="$color">{cat.name}</Text>
                                        </XStack>
                                    );
                                })
                            )}
                        </XStack>
                    </YStack>

                    <YStack gap="$2" marginBottom="$4">
                        <Label color="$color11">Description / Notes</Label>
                        <TextArea
                            value={description}
                            onChangeText={setDescription}
                            numberOfLines={4}
                            placeholderTextColor="$color11"
                            placeholder="Optional description..."
                            size="$4"
                            backgroundColor="$backgroundStrong"
                            borderColor="$borderColor"
                            focusStyle={{ borderColor: '$color8' }}
                        />
                    </YStack>

                    {/* Ingredients / Recipe */}
                    <YStack gap="$2" marginBottom="$4">
                        <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
                            <Label color="$color11">Recipe (for Complex Ingredients)</Label>
                            <TouchableOpacity onPress={handlePresentModalPress}>
                                <Text color={theme.color8?.get() as string} fontWeight="bold">+ Add</Text>
                            </TouchableOpacity>
                        </XStack>

                        {recipeItems.length === 0 && (
                            <Text color="$color11" fontSize={14} fontStyle="italic" marginBottom="$2">
                                Add ingredients here if this is a pre-batched item (e.g. syrups, infusions). 
                                Leave empty for raw ingredients.
                            </Text>
                        )}

                        <SortableRecipeList
                            items={recipeItems}
                            onReorder={setRecipeItems}
                            onUpdateItem={(index, updates) => {
                                const newItems = [...recipeItems];
                                newItems[index] = { ...newItems[index], ...updates };
                                setRecipeItems(newItems);
                            }}
                            onRemove={(index) => setRecipeItems(recipeItems.filter((_, i) => i !== index))}
                            variant="card"
                            onNestedItemPress={onNestedItemPress}
                            drafts={drafts}
                            dropdowns={dropdowns}
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

            {/* Native Modal for adding ingredients avoiding gorhom issues */}
            <Modal
                visible={showIngredientPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={handleDismissModalPress}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    <View style={styles.modalOverlay}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleDismissModalPress} />
                        <View style={[styles.fullSheetModalContent, { backgroundColor: theme.background?.get() as string, paddingBottom: insets.bottom }]}>
                            <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
                                <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
                                    <Text fontSize={20} fontWeight="bold" color="$color">Select Ingredient</Text>
                                    <TouchableOpacity onPress={handleDismissModalPress}>
                                        <IconSymbol name="xmark" size={24} color={theme.color11?.get() as string} />
                                    </TouchableOpacity>
                                </XStack>
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
                                data={mergedIngredients.filter((i: any) => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))}
                                keyExtractor={item => item.id}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                        onPress={() => {
                                            setRecipeItems([...recipeItems, { ingredient_id: item.id, name: capitalize(item.name), amount: "", unit: "" }]);
                                            handleDismissModalPress();
                                            setIngredientSearch("");
                                        }}
                                    >
                                        <XStack gap="$2" alignItems="center">
                                            <Text color="$color" fontSize={16}>{capitalize(item.name)}</Text>
                                            {(() => {
                                                const childDraft = drafts.find((d: any) => d.id === item.id && d.entity_type === 'ingredient');
                                                if (!childDraft) return null;
                                                const childProgress = calculateDraftProgress(childDraft, drafts, dropdowns);
                                                return (
                                                    <View style={[styles.draftBadge, { backgroundColor: childProgress.badgeBg, borderColor: childProgress.color, borderWidth: 1 }]}>
                                                        <Text style={[styles.draftBadgeText, { color: childProgress.badgeText }]}>
                                                            {childProgress.label} ({childProgress.percentage}%)
                                                        </Text>
                                                    </View>
                                                );
                                            })()}
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
                                                handleDismissModalPress();
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

            <CategoryPickerModal 
                ref={categoryPickerRef}
                domains={['spirit']}
                selectedCategoryIds={selectedCategories}
                onToggleCategory={(cat) => {
                    if (selectedCategories.includes(cat.id)) {
                        setSelectedCategories(prev => prev.filter(id => id !== cat.id));
                    } else {
                        setSelectedCategories(prev => [...prev, cat.id]);
                    }
                }}
            />

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
    content: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    headerBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
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
