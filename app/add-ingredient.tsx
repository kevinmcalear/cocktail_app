import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
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
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useDropdowns } from "@/hooks/useDropdowns";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Text, YStack, useTheme } from "tamagui";

interface RecipeItem {
    id?: string;
    ingredient_id: string;
    name: string;
    ml: string;
    dash: string;
    amount: string;
}

export default function AddIngredientScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [saving, setSaving] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    // Recipe State
    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);
    const [ingredientSearch, setIngredientSearch] = useState("");

    const theme = useTheme();
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['80%'], []);

    const handlePresentModalPress = useCallback(() => {
        bottomSheetModalRef.current?.present();
    }, []);

    const handleDismissModalPress = useCallback(() => {
        bottomSheetModalRef.current?.dismiss();
    }, []);

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

    const queryClient = useQueryClient();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();
    const allIngredients = dropdowns?.ingredients || [];

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return;
        }
        setSaving(true);
        try {
            // 1. Create Ingredient
            const { data: ingredient, error: ingredientError } = await supabase
                .from('ingredients')
                .insert({
                    name: name.trim(),
                    description: description.trim() || null,
                    // We can also set is_batch if desired, or leave it to be inferred/default
                    // is_batch: recipeItems.length > 0 
                })
                .select()
                .single();

            if (ingredientError || !ingredient) throw ingredientError;

            const ingredientId = ingredient.id;

            // 2. Save Recipes (if any)
            if (recipeItems.length > 0) {
                const recipeInserts = recipeItems.map(item => ({
                    parent_ingredient_id: ingredientId, // This links the recipe to this ingredient
                    ingredient_id: item.ingredient_id,
                    ingredient_ml: parseFloat(item.ml) || null,
                    ingredient_dash: parseFloat(item.dash) || null,
                    ingredient_amount: parseFloat(item.amount) || null,
                }));

                const { error: recipeError } = await supabase
                    .from('recipes')
                    .insert(recipeInserts);

                if (recipeError) throw recipeError;
            }

            queryClient.invalidateQueries({ queryKey: ['ingredients'] });
            // Since we use the 'dropdowns' query for lists, we might need to invalidate that too,
            // or just rely on 'ingredients' if that's what other screens use. 
            // `useDropdowns` uses `['dropdowns']` key. `useIngredients` uses `['ingredients']`. Let's invalidate both to be safe.
            queryClient.invalidateQueries({ queryKey: ['dropdowns'] });

            Alert.alert("Success", "Ingredient created!", [
                { text: "OK", onPress: () => router.back() }
            ]);

        } catch (error: any) {
            console.error("Creation error:", error);
            Alert.alert("Error", error.message || "Failed to create ingredient.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <YStack style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="chevron.left" size={24} color={theme.color?.get() as string} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.color?.get() as string }}>New Ingredient</Text>
                <TouchableOpacity 
                    onPress={handleSave} 
                    disabled={saving} 
                    style={[styles.headerBtn, { width: 'auto', paddingHorizontal: 10 }]}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color={theme.color8?.get() as string} />
                    ) : (
                        <Text style={{ color: theme.color8?.get() as string, fontWeight: 'bold', fontSize: 16 }}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                
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
                        <TouchableOpacity onPress={handlePresentModalPress}>
                            <Text style={[styles.addText, { color: theme.color8?.get() as string }]}>+ Add</Text>
                        </TouchableOpacity>
                    </View>

                    {recipeItems.length === 0 && (
                        <Text style={styles.helperText}>
                            Add ingredients here if this is a pre-batched item (e.g. syrups, infusions). 
                            Leave empty for raw ingredients.
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
                ref={bottomSheetModalRef}
                index={0}
                snapPoints={snapPoints}
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: theme.background?.get() as string }}
                handleIndicatorStyle={{ backgroundColor: theme.borderColor?.get() as string }}
            >
                <BottomSheetView style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: theme.color?.get() as string }]}>Select Ingredient</Text>
                        <TouchableOpacity onPress={handleDismissModalPress}>
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
                        data={allIngredients.filter((i: any) => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))}
                        keyExtractor={item => item.id}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.ingredientOption}
                                onPress={() => {
                                    setRecipeItems([...recipeItems, { ingredient_id: item.id, name: item.name, ml: "", dash: "", amount: "" }]);
                                    handleDismissModalPress();
                                    setIngredientSearch("");
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
