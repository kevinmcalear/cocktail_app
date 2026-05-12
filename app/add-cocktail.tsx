import { SearchBar } from "@/components/SearchBar";
import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetView, BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter, useLocalSearchParams, useNavigation } from "expo-router";
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

import { CustomIcon } from "@/components/ui/CustomIcons";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useBars } from "@/hooks/useBars";
import { useDrafts } from "@/hooks/useDrafts";
import { useDropdowns } from "@/hooks/useDropdowns";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label, Text, TextArea, XStack, YStack, useTheme, Select, Adapt, Sheet, Accordion } from "tamagui";
import { BarAssignmentAccordion } from "@/components/BarAssignmentAccordion";

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

export default function AddCocktailScreen() {
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

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [origin, setOrigin] = useState("");
    const [garnish, setGarnish] = useState("");
    const [notes, setNotes] = useState("");
    const [spec, setSpec] = useState("");

    const { barId: initialBarId, draftId } = useLocalSearchParams<{ barId?: string, draftId?: string }>();
    const { drafts, saveDraft, deleteDraft, isFetching } = useDrafts();
    
    // Add local state for the active draft ID so newly created drafts are tracked
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId || null);
    
    // Checkbox/Selection State (IDs)
    const [methodId, setMethodId] = useState<string | null>(null);
    const [glasswareId, setGlasswareId] = useState<string | null>(null);
    const [familyId, setFamilyId] = useState<string | null>(null);
    const [iceId, setIceId] = useState<string | null>(null);

    // Bar Assignment and Overrides
    const [barId, setBarId] = useState<string | null>(initialBarId || null);
    const [overrideVisibility, setOverrideVisibility] = useState<string | null>(null);
    const [overrideGeneric, setOverrideGeneric] = useState<string | null>(null);
    const [overrideSpecific, setOverrideSpecific] = useState<string | null>(null);
    const [overrideMeasurement, setOverrideMeasurement] = useState<string | null>(null);
    const [overridePrep, setOverridePrep] = useState<string | null>(null);


    // Recipe State
    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);
    const [ingredientSearch, setIngredientSearch] = useState("");

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

    const handleSaveDraft = async () => {
        try {
            setSaving(true);
            const draftData = {
                name, description, origin, notes, methodId, glasswareId, familyId, iceId, barId,
                recipeItems, localImages, overrideVisibility, overrideGeneric, overrideSpecific,
                overrideMeasurement, overridePrep
            };
            const result = await saveDraft({ id: currentDraftId || undefined, entityType: 'cocktail', draftData });
            
            // If this was a new draft, save the ID so subsequent clicks update the same draft
            if (!currentDraftId && result && result.id) {
                setCurrentDraftId(result.id);
                // Also update the URL params silently so refreshing doesn't lose it
                router.setParams({ draftId: result.id });
            }
            
            if (Platform.OS === 'web') {
                window.alert("Draft saved successfully!");
            } else {
                Alert.alert("Success", "Draft saved successfully!");
            }
            setNeedsCleanMark(true); // Mark clean after saving
        } catch (error) {
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
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            const isDirty = currentStateStr !== cleanStateStrRef.current;
            if (!isDirty) {
                return;
            }

            // Always prevent the navigation to show our custom modal
            e.preventDefault();
            pendingNavigationActionRef.current = e.data.action;
            setShowExitModal(true);
        });

        return unsubscribe;
    }, [navigation, currentStateStr]);

    const confirmExit = async (shouldSave: boolean) => {
        setShowExitModal(false);
        if (shouldSave) {
            await handleSaveDraft();
        }
        if (pendingNavigationActionRef.current) {
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
            const newImages = result.assets.map(asset => ({
                id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                url: asset.uri,
            }));
            setLocalImages(prev => [...prev, ...newImages]);
        }
    };



    const uploadImage = async (uri: string, cocktailId: string): Promise<string | null> => {
        try {
            const ext = uri.substring(uri.lastIndexOf('.') + 1);
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

    const handleSave = async () => {
        if (!name.trim()) {
            if (Platform.OS === 'web') {
                window.alert("Missing Info: Name is required.");
            } else {
                Alert.alert("Missing Info", "Name is required.");
            }
            return;
        }
        setSaving(true);
        try {
            // 1. Create Cocktail
            const { data: cocktail, error: cocktailError } = await supabase
                .from('items')
                .insert({
                    name,
                    description,
                    origin: origin || null,
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

            for (const item of recipeItems) {
                await supabase.from('recipes').insert({
                    recipe_item_id: cocktailId,
                    ingredient_item_id: item.ingredient_id,
                    amount: parseFloat(item.amount) || null,
                    unit: item.unit || null,
                    preparation_notes: item.preparation_notes || null,
                    is_optional: item.is_optional || false,
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
            
            if (draftId) {
                await deleteDraft(draftId);
            }
            // If assigned to a bar, also invalidate that bar's cache
            if (barId) {
                queryClient.invalidateQueries({ queryKey: ['bar', barId] });
            }

            if (Platform.OS === 'web') {
                window.alert("Success: Cocktail created!");
                cleanStateStrRef.current = currentStateStr; // Prevent beforeRemove block
                router.back();
            } else {
                Alert.alert("Success", "Cocktail created!", [
                    { text: "OK", onPress: () => {
                        cleanStateStrRef.current = currentStateStr;
                        router.back();
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


    return (
        <BottomSheetModalProvider>
        <YStack style={styles.container} backgroundColor="$background">
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Header */}
            <XStack
                paddingTop={Platform.OS === 'ios' ? 20 : insets.top + 20}
                paddingHorizontal="$4"
                paddingBottom="$4"
                alignItems="center"
                justifyContent="space-between"
                zIndex={10}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="chevron.left" size={24} color={theme.color?.get() as string} />
                </TouchableOpacity>
                <Text fontSize="$5" fontWeight="bold">New Cocktail</Text>
                <XStack gap="$2" alignItems="center">
                    <Button 
                        onPress={handleSaveDraft} 
                        disabled={saving}
                        size="$3"
                        chromeless
                    >
                        <Text color="$color11" fontWeight="500">Save Draft</Text>
                    </Button>
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
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                
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
                        onChangeText={setName}
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
                                <Button
                                    key={m.id}
                                    size="$3"
                                    borderRadius="$10"
                                    backgroundColor={methodId === m.id ? theme.color8?.get() as string : "$backgroundStrong"}
                                    borderColor={methodId === m.id ? theme.color8?.get() as string : "$borderColor"}
                                    borderWidth={1}
                                    onPress={() => setMethodId(m.id)}
                                >
                                    <XStack gap="$2" alignItems="center">
                                        <CustomIcon name={m.name} size={16} color={methodId === m.id ? theme.backgroundStrong?.get() as string : theme.color?.get() as string} />
                                        <Text color={methodId === m.id ? theme.backgroundStrong?.get() as string : theme.color?.get() as string} fontWeight={methodId === m.id ? "bold" : "normal"}>{m.name}</Text>
                                    </XStack>
                                </Button>
                            ))}
                        </XStack>
                    </ScrollView>
                </YStack>

                <YStack gap="$2">
                    <Label color="$color11">Glassware</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <XStack gap="$2">
                            {glassware.map(g => (
                                <Button
                                    key={g.id}
                                    size="$3"
                                    borderRadius="$10"
                                    backgroundColor={glasswareId === g.id ? theme.color8?.get() as string : "$backgroundStrong"}
                                    borderColor={glasswareId === g.id ? theme.color8?.get() as string : "$borderColor"}
                                    borderWidth={1}
                                    onPress={() => setGlasswareId(g.id)}
                                >
                                    <XStack gap="$2" alignItems="center">
                                        <CustomIcon name={g.name} size={16} color={glasswareId === g.id ? theme.backgroundStrong?.get() as string : theme.color?.get() as string} />
                                        <Text color={glasswareId === g.id ? theme.backgroundStrong?.get() as string : theme.color?.get() as string} fontWeight={glasswareId === g.id ? "bold" : "normal"}>{g.name}</Text>
                                    </XStack>
                                </Button>
                            ))}
                        </XStack>
                    </ScrollView>
                </YStack>

                <YStack gap="$2">
                    <Label color="$color11">Family</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <XStack gap="$2">
                            {families.map(f => (
                                <Button
                                    key={f.id}
                                    size="$3"
                                    borderRadius="$10"
                                    backgroundColor={familyId === f.id ? theme.color8?.get() as string : "$backgroundStrong"}
                                    borderColor={familyId === f.id ? theme.color8?.get() as string : "$borderColor"}
                                    borderWidth={1}
                                    onPress={() => setFamilyId(f.id)}
                                >
                                    <XStack gap="$2" alignItems="center">
                                        <CustomIcon name={f.name} size={16} color={familyId === f.id ? theme.backgroundStrong?.get() as string : theme.color?.get() as string} />
                                        <Text color={familyId === f.id ? theme.backgroundStrong?.get() as string : theme.color?.get() as string} fontWeight={familyId === f.id ? "bold" : "normal"}>{f.name}</Text>
                                    </XStack>
                                </Button>
                            ))}
                        </XStack>
                    </ScrollView>
                </YStack>

                <YStack gap="$2">
                    <Label color="$color11">Ice</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <XStack gap="$2">
                            {iceTypes.map(i => (
                                <Button
                                    key={i.id}
                                    size="$3"
                                    borderRadius="$10"
                                    backgroundColor={iceId === i.id ? theme.color8?.get() as string : "$backgroundStrong"}
                                    borderColor={iceId === i.id ? theme.color8?.get() as string : "$borderColor"}
                                    borderWidth={1}
                                    onPress={() => setIceId(iceId === i.id ? null : i.id)}
                                >
                                    <XStack gap="$2" alignItems="center">
                                        <CustomIcon name={i.name} size={16} color={iceId === i.id ? theme.backgroundStrong?.get() as string : theme.color?.get() as string} />
                                        <Text color={iceId === i.id ? theme.backgroundStrong?.get() as string : theme.color?.get() as string} fontWeight={iceId === i.id ? "bold" : "normal"}>{i.name}</Text>
                                    </XStack>
                                </Button>
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

                    {recipeItems.map((item, index) => (
                        <View key={index} style={styles.recipeRow}>
                            <Text style={styles.recipeName}>{item.name}</Text>
                            <View style={[styles.recipeInputs, { flexWrap: 'wrap', justifyContent: 'flex-end', flex: 2, gap: 4 }]}>
                                <Input
                                    size="$2"
                                    width={60}
                                    placeholder="1.5"
                                    keyboardType="numeric"
                                    backgroundColor="$backgroundStrong"
                                    borderColor="$borderColor"
                                    value={item.amount}
                                    onChangeText={(v) => {
                                        const newItems = [...recipeItems];
                                        newItems[index].amount = v;
                                        setRecipeItems(newItems);
                                    }}
                                />
                                <Input
                                    size="$2"
                                    width={60}
                                    placeholder="oz"
                                    backgroundColor="$backgroundStrong"
                                    borderColor="$borderColor"
                                    value={item.unit}
                                    onChangeText={(v) => {
                                        const newItems = [...recipeItems];
                                        newItems[index].unit = v;
                                        setRecipeItems(newItems);
                                    }}
                                />
                                <TouchableOpacity onPress={() => setRecipeItems(recipeItems.filter((_, i) => i !== index))}>
                                    <IconSymbol name="trash" size={20} color="#ff4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Extra Details */}
                <YStack gap="$2">
                    <Label color="$color11">Origin</Label>
                    <Input 
                        value={origin} 
                        onChangeText={setOrigin} 
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

            </ScrollView>
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
                                data={allIngredients.filter(i => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))}
                                keyExtractor={item => item.id}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[styles.ingredientOption, { borderBottomColor: theme.borderColor?.get() as string }]}
                                        onPress={() => {
                                            setRecipeItems([...recipeItems, { ingredient_id: item.id, name: item.name, amount: "", unit: "", preparation_notes: "", is_optional: false }]);
                                            setShowIngredientPicker(false);
                                        }}
                                    >
                                        <Text color={theme.color?.get() as string} fontSize={16}>{item.name}</Text>
                                    </TouchableOpacity>
                                )}
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
    pillContainer: {
        flexDirection: 'row',
    },
    pill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
    },
    pillText: {
        color: '#ccc',
        fontSize: 14,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    recipeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        borderRadius: 10,
        marginBottom: 8
    },
    recipeName: {
        flex: 1,
        fontSize: 16,
        paddingRight: 8
    },
    recipeInputs: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center'
    },
    smallInput: {
        width: 44,
        borderRadius: 8,
        padding: 8,
        textAlign: 'center',
        justifyContent: 'center',
        fontSize: 14
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
    }

});
