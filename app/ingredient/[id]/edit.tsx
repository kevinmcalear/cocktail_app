import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetView } from "@gorhom/bottom-sheet";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Platform,
    KeyboardAvoidingView
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { GenerateImageButton } from "@/components/GenerateImageButton";
import { SearchBar } from "@/components/SearchBar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useIngredient } from "@/hooks/useIngredients";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Button, Input, Label, Text, TextArea, XStack, YStack, useTheme, View } from "tamagui";
import { CategoryPickerModal } from "@/components/CategoryPickerModal";

interface RecipeItem {
    id?: string; // ID if existing in recipes table
    ingredient_id: string;
    name: string;
    ml: string;
    dash: string;
    amount: string;
}

export default function EditIngredientScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();

    const [saving, setSaving] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [localImages, setLocalImages] = useState<{ id?: string, url: string, isNew?: boolean }[]>([]);

    const [brandMaker, setBrandMaker] = useState("");
    const [abv, setAbv] = useState("");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const categoryPickerRef = useRef<BottomSheetModal>(null);

    // Recipe State
    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);
    const [ingredientSearch, setIngredientSearch] = useState("");

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

    useEffect(() => {
        if (showIngredientPicker) {
            pickerSheetRef.current?.present();
        } else {
            pickerSheetRef.current?.dismiss();
            setIngredientSearch("");
        }
    }, [showIngredientPicker]);

    const queryClient = useQueryClient();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();
    const { data, isLoading: loadingIngredient } = useIngredient(id as string);
    const allIngredients = dropdowns?.ingredients || [];
    
    const loading = loadingDropdowns || loadingIngredient;

    useEffect(() => {
        if (data?.ingredient) {
            setName(data.ingredient.name || "");
            setDescription(data.ingredient.description || "");
            setBrandMaker(data.ingredient.brand_maker || "");
            setAbv(data.ingredient.abv?.toString() || "");

            if (data.ingredient.item_categories) {
                setSelectedCategories(data.ingredient.item_categories.map((ic: any) => ic.category_id));
            }

            // Populate existing images
            if (data.ingredient.item_images) {
                const sortedImages = [...data.ingredient.item_images].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
                const fetchedImages = sortedImages.map((ii: any) => ({
                    id: ii.images?.id,
                    url: ii.images?.url,
                    isNew: false
                })).filter((img: any) => img.url);
                setLocalImages(fetchedImages);
            }
        }
        if (data?.recipe) {
            const items: RecipeItem[] = data.recipe.map((r: any) => ({
                id: r.id,
                ingredient_id: r.ingredient_id || r.id,
                name: r.ingredient?.name || "Unknown",
                ml: r.ingredient_ml?.toString() || "",
                dash: r.ingredient_dash?.toString() || "",
                amount: r.ingredient_amount?.toString() || "",
            }));
            setRecipeItems(items);
        }
    }, [data]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission needed", "We need access to your photos.");
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
                url: asset.uri,
                isNew: true
            }));
            setLocalImages(prev => [...prev, ...newImages]);
        }
    };

    const uploadAndLinkImage = async (uri: string): Promise<string | null> => {
        try {
            const ext = uri.substring(uri.lastIndexOf('.') + 1);
            const fileName = `ingredients/${id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64',
            });
            const arrayBuffer = decode(base64);

            const { error: uploadError } = await supabase.storage
                .from('drinks')
                .upload(fileName, arrayBuffer, {
                    contentType: `image/${ext}`,
                    upsert: false
                });

            if (uploadError) return null;

            const { data: publicUrlData } = supabase.storage
                .from('drinks')
                .getPublicUrl(fileName);

            const { data: imgData, error: imgError } = await supabase
                .from('images')
                .insert({ url: publicUrlData.publicUrl })
                .select()
                .single();

            if (imgError || !imgData) return null;

            return imgData.id;

        } catch (error) {
            console.error("Image upload flow exception:", error);
            return null;
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return;
        }
        setSaving(true);
        try {
            // 0. Handle Images
            const finalImageIds: string[] = [];
            for (const img of localImages) {
                if (img.isNew) {
                    const newId = await uploadAndLinkImage(img.url);
                    if (!newId) throw new Error("Failed to upload image");
                    finalImageIds.push(newId);
                } else if (img.id) {
                    finalImageIds.push(img.id);
                }
            }

            const { data: existingLinks } = await supabase
                .from('item_images')
                .select('image_id')
                .eq('item_id', id);

            const existingIds = existingLinks?.map(l => l.image_id) || [];
            const idsToDelete = existingIds.filter(eid => !finalImageIds.includes(eid));

            if (idsToDelete.length > 0) {
                 await supabase
                    .from('item_images')
                    .delete()
                    .eq('item_id', id)
                    .in('image_id', idsToDelete);
            }

            for (let i = 0; i < finalImageIds.length; i++) {
                await supabase
                    .from('item_images')
                    .upsert({
                        item_id: id, 
                        image_id: finalImageIds[i],
                        sort_order: i
                    }, { onConflict: 'item_id,image_id' });
            }

            // 1. Update Ingredient
            const { error: updateError } = await supabase
                .from('items')
                .update({
                    name: name.trim(),
                    description: description.trim() || null,
                    brand_maker: brandMaker.trim() || null,
                    abv: abv ? parseFloat(abv) : null
                })
                .eq('id', id);

            if (updateError) throw updateError;

            // Sync item_categories
            const { data: existingCatLinks } = await supabase
                .from('item_categories')
                .select('category_id')
                .eq('item_id', id);

            const existingCatIds = existingCatLinks?.map(l => l.category_id) || [];
            const catIdsToDelete = existingCatIds.filter(eid => !selectedCategories.includes(eid));
            const catIdsToAdd = selectedCategories.filter(eid => !existingCatIds.includes(eid));

            if (catIdsToDelete.length > 0) {
                 await supabase
                    .from('item_categories')
                    .delete()
                    .eq('item_id', id)
                    .in('category_id', catIdsToDelete);
            }

            for (const catId of catIdsToAdd) {
                await supabase
                    .from('item_categories')
                    .upsert({
                        item_id: id,
                        category_id: catId,
                        is_primary: true
                    }, { onConflict: 'item_id,category_id' });
            }

            // 2. Update Recipes
            // Strategy: Delete all existing recipe items for this parent and re-insert. 
            // This is simple and effective for this scale. 
            // Alternatively, we could diff, but re-insert is safer for consistency without complex logic.
            
            // Delete old
            const { error: deleteError } = await supabase
                .from('recipes')
                .delete()
                .eq('parent_ingredient_id', id);
            
            if (deleteError) throw deleteError;

            // Insert new
            if (recipeItems.length > 0) {
                const recipeInserts = recipeItems.map(item => ({
                    parent_ingredient_id: id, 
                    ingredient_id: item.ingredient_id,
                    ingredient_ml: parseFloat(item.ml) || null,
                    ingredient_dash: parseFloat(item.dash) || null,
                    ingredient_amount: parseFloat(item.amount) || null,
                }));

                const { error: insertError } = await supabase
                    .from('recipes')
                    .insert(recipeInserts);

                if (insertError) throw insertError;
            }

            queryClient.invalidateQueries({ queryKey: ['ingredient', id] });
            queryClient.invalidateQueries({ queryKey: ['ingredients'] });

            Alert.alert("Success", "Ingredient updated!", [
                { text: "OK", onPress: () => router.back() }
            ]);

        } catch (error: any) {
            console.error("Update error:", error);
            Alert.alert("Error", error.message || "Failed to update ingredient.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
                <ActivityIndicator size="large" color={theme.color8?.get() as string} />
            </YStack>
        );
    }

    return (
        <BottomSheetModalProvider>
        <YStack style={styles.container} backgroundColor="$background">
            <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
            
            <XStack
                paddingTop={Platform.OS === 'ios' ? 20 : insets.top + 20}
                paddingHorizontal="$4"
                paddingBottom="$4"
                alignItems="center"
                justifyContent="space-between"
                zIndex={10}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="xmark" size={24} color={theme.color?.get() as string} />
                </TouchableOpacity>
                <Text fontSize="$5" fontWeight="bold">Edit Ingredient</Text>
                <Button 
                    onPress={handleSave} 
                    disabled={saving}
                    size="$3"
                    chromeless
                >
                    {saving ? <ActivityIndicator size="small" color={theme.color8?.get() as string} /> : <Text color={theme.color8?.get() as string} fontWeight="bold">Save</Text>}
                </Button>
            </XStack>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                    
                    <SortableImageList 
                        images={localImages}
                        onReorder={setLocalImages}
                        onRemove={(index) => {
                            const newImages = localImages.filter((_, i) => i !== index);
                            setLocalImages(newImages);
                        }}
                        onAdd={pickImage}
                        generateComponent={<GenerateImageButton type="ingredient" id={id} name={name} variant="tile" />}
                    />

                    <YStack gap="$2" marginBottom="$4">
                        <Label color="$color11">Name *</Label>
                        <Input
                            value={name}
                            onChangeText={setName}
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
                            onChangeText={setBrandMaker}
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
                            <TouchableOpacity onPress={() => setShowIngredientPicker(true)}>
                                <Text color={theme.color8?.get() as string} fontWeight="bold">+ Add</Text>
                            </TouchableOpacity>
                        </XStack>

                        {recipeItems.length === 0 && (
                            <Text color="$color11" fontSize={14} fontStyle="italic" marginBottom="$2">
                                Add ingredients here if this is a pre-batched item.
                            </Text>
                        )}

                        {recipeItems.map((item, index) => (
                            <XStack key={index} alignItems="center" justifyContent="space-between" backgroundColor="$backgroundStrong" padding="$3" borderRadius="$3" marginBottom="$2">
                                <Text flex={1} color="$color" fontSize={16}>{item.name}</Text>
                                <XStack gap="$2" alignItems="center">
                                    <Input
                                        width={50}
                                        size="$3"
                                        placeholder="ml"
                                        placeholderTextColor="$color11"
                                        keyboardType="numeric"
                                        value={item.ml}
                                        onChangeText={(v) => {
                                            const newItems = [...recipeItems];
                                            newItems[index].ml = v;
                                            setRecipeItems(newItems);
                                        }}
                                        backgroundColor="$background"
                                        borderColor="transparent"
                                        textAlign="center"
                                    />
                                    <Input
                                        width={50}
                                        size="$3"
                                        placeholder="dash"
                                        placeholderTextColor="$color11"
                                        keyboardType="numeric"
                                        value={item.dash}
                                        onChangeText={(v) => {
                                            const newItems = [...recipeItems];
                                            newItems[index].dash = v;
                                            setRecipeItems(newItems);
                                        }}
                                        backgroundColor="$background"
                                        borderColor="transparent"
                                        textAlign="center"
                                    />
                                    <Input
                                        width={50}
                                        size="$3"
                                        placeholder="amt"
                                        placeholderTextColor="$color11"
                                        keyboardType="numeric"
                                        value={item.amount}
                                        onChangeText={(v) => {
                                            const newItems = [...recipeItems];
                                            newItems[index].amount = v;
                                            setRecipeItems(newItems);
                                        }}
                                        backgroundColor="$background"
                                        borderColor="transparent"
                                        textAlign="center"
                                    />
                                    <TouchableOpacity onPress={() => setRecipeItems(recipeItems.filter((_, i) => i !== index))}>
                                        <IconSymbol name="trash" size={20} color={theme.red10?.get() as string || "#ff4444"} />
                                    </TouchableOpacity>
                                </XStack>
                            </XStack>
                        ))}
                    </YStack>

                </ScrollView>
            </KeyboardAvoidingView>

            {/* Ingredient Picker Bottom Sheet */}
            <BottomSheetModal
                ref={pickerSheetRef}
                index={0}
                snapPoints={snapPoints}
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: theme.background?.get() as string }}
                handleIndicatorStyle={{ backgroundColor: theme.borderColor?.get() as string }}
                onDismiss={() => setShowIngredientPicker(false)}
            >
                <BottomSheetView style={{ flex: 1, padding: 24 }}>
                    <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
                        <Text fontSize={20} fontWeight="bold" color="$color">Select Ingredient</Text>
                        <TouchableOpacity onPress={() => setShowIngredientPicker(false)}>
                            <IconSymbol name="xmark" size={24} color={theme.color11?.get() as string} />
                        </TouchableOpacity>
                    </XStack>
                    <SearchBar
                        placeholder="Search ingredients..."
                        value={ingredientSearch}
                        onChangeText={setIngredientSearch}
                        style={{ marginBottom: 16 }}
                    />
                    <FlatList
                        data={allIngredients.filter((i: any) => {
                            if (i.id === id) return false;
                            return i.name.toLowerCase().includes(ingredientSearch.toLowerCase());
                        })}
                        keyExtractor={item => item.id}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                onPress={() => {
                                    setRecipeItems([...recipeItems, { ingredient_id: item.id, name: item.name, ml: "", dash: "", amount: "" }]);
                                    setShowIngredientPicker(false);
                                }}
                            >
                                <Text color="$color11" fontSize={16}>{item.name}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </BottomSheetView>
            </BottomSheetModal>

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
    }
});
