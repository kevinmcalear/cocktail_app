import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSearchBar } from "@/components/BottomSearchBar";
import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { GenerateImageButton } from "@/components/GenerateImageButton";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useIngredient } from "@/hooks/useIngredients";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Text, YStack, useTheme } from "tamagui";

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

    const [saving, setSaving] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [localImages, setLocalImages] = useState<{ id?: string, url: string, isNew?: boolean }[]>([]);

    // Recipe State
    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);
    const [ingredientSearch, setIngredientSearch] = useState("");

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

            // Populate existing images
            if (data.ingredient.ingredient_images) {
                const sortedImages = [...data.ingredient.ingredient_images].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
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
                .from('ingredient_images')
                .select('image_id')
                .eq('ingredient_id', id);

            const existingIds = existingLinks?.map(l => l.image_id) || [];
            const idsToDelete = existingIds.filter(eid => !finalImageIds.includes(eid));

            if (idsToDelete.length > 0) {
                 await supabase
                    .from('ingredient_images')
                    .delete()
                    .eq('ingredient_id', id)
                    .in('image_id', idsToDelete);
            }

            for (let i = 0; i < finalImageIds.length; i++) {
                await supabase
                    .from('ingredient_images')
                    .upsert({
                        ingredient_id: id, 
                        image_id: finalImageIds[i],
                        sort_order: i
                    }, { onConflict: 'ingredient_id,image_id' });
            }

            // 1. Update Ingredient
            const { error: updateError } = await supabase
                .from('ingredients')
                .update({
                    name: name.trim(),
                    description: description.trim() || null,
                })
                .eq('id', id);

            if (updateError) throw updateError;

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
            <YStack style={styles.container} backgroundColor="$background">
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.dark.tint} />
                </View>
            </YStack>
        );
    }

    return (
        <YStack style={styles.container} backgroundColor="$background">
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20 }}>Edit Ingredient</Text>
                <TouchableOpacity 
                    onPress={handleSave} 
                    disabled={saving} 
                    style={[styles.headerBtn, { width: 'auto', paddingHorizontal: 10 }]}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color={Colors.dark.tint} />
                    ) : (
                        <Text style={{ color: Colors.dark.tint, fontWeight: 'bold', fontSize: 16 }}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

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

                {/* Main Info */}
                <View style={styles.section}>
                    <Text style={styles.label}>Name *</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor="#666"
                        placeholder="e.g. Rich Simple Syrup"
                        autoCapitalize="words"
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={3}
                        placeholderTextColor="#666"
                        placeholder="Optional description..."
                    />
                </View>

                {/* Ingredients / Recipe */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.label}>Recipe (for Complex Ingredients)</Text>
                        <TouchableOpacity onPress={() => setShowIngredientPicker(true)}>
                            <Text style={styles.addText}>+ Add</Text>
                        </TouchableOpacity>
                    </View>

                    {recipeItems.length === 0 && (
                        <Text style={styles.helperText}>
                            Add ingredients here if this is a pre-batched item.
                        </Text>
                    )}

                    {recipeItems.map((item, index) => (
                        <View key={index} style={styles.recipeRow}>
                            <Text style={styles.recipeName}>{item.name}</Text>
                            <View style={styles.recipeInputs}>
                                <TextInput
                                    style={styles.smallInput}
                                    placeholder="ml"
                                    placeholderTextColor="#666"
                                    keyboardType="numeric"
                                    value={item.ml}
                                    onChangeText={(v) => {
                                        const newItems = [...recipeItems];
                                        newItems[index].ml = v;
                                        setRecipeItems(newItems);
                                    }}
                                />
                                <TextInput
                                    style={styles.smallInput}
                                    placeholder="dash"
                                    placeholderTextColor="#666"
                                    keyboardType="numeric"
                                    value={item.dash}
                                    onChangeText={(v) => {
                                        const newItems = [...recipeItems];
                                        newItems[index].dash = v;
                                        setRecipeItems(newItems);
                                    }}
                                />
                                <TextInput
                                    style={styles.smallInput}
                                    placeholder="amt"
                                    placeholderTextColor="#666"
                                    keyboardType="numeric"
                                    value={item.amount}
                                    onChangeText={(v) => {
                                        const newItems = [...recipeItems];
                                        newItems[index].amount = v;
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

            </ScrollView>

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
                <BottomSheetView style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: theme.color?.get() as string }]}>Select Ingredient</Text>
                        <TouchableOpacity onPress={() => setShowIngredientPicker(false)}>
                            <IconSymbol name="xmark" size={24} color={theme.color11?.get() as string} />
                        </TouchableOpacity>
                    </View>
                    <BottomSearchBar
                        placeholder="Search ingredients..."
                        value={ingredientSearch}
                        onChangeText={setIngredientSearch}
                        style={{ marginBottom: 16 }}
                    />
                    <FlatList
                        data={allIngredients.filter((i: any) => {
                            if (i.id === id) return false;
                            return i.name.toLowerCase().includes(ingredientSearch.toLowerCase())
                        })}
                        keyExtractor={item => item.id}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.ingredientOption}
                                onPress={() => {
                                    setRecipeItems([...recipeItems, { ingredient_id: item.id, name: item.name, ml: "", dash: "", amount: "" }]);
                                    setShowIngredientPicker(false);
                                }}
                            >
                                <Text style={styles.ingredientText}>{item.name}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </BottomSheetView>
            </BottomSheetModal>

        </YStack>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
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
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    addText: {
        color: Colors.dark.tint,
        fontWeight: 'bold',
        fontSize: 14,
    },
    helperText: {
        color: '#666',
        fontSize: 14,
        fontStyle: 'italic',
        marginBottom: 8,
    },
    recipeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.02)',
        padding: 10,
        borderRadius: 10,
        marginBottom: 8
    },
    recipeName: {
        flex: 1,
        color: '#fff',
        fontSize: 16
    },
    recipeInputs: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center'
    },
    smallInput: {
        width: 50,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: 8,
        color: '#fff',
        textAlign: 'center',
        fontSize: 14
    },
    modalContent: {
        flex: 1,
        padding: 24,
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
        color: '#fff'
    },
    searchInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 12,
        borderRadius: 12,
        color: '#fff',
        marginBottom: 10
    },
    ingredientOption: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    ingredientText: {
        color: '#ccc',
        fontSize: 16
    }
});
