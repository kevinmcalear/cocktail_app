import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useDropdowns } from "@/hooks/useDropdowns";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

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
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle">New Ingredient</ThemedText>
                <TouchableOpacity 
                    onPress={handleSave} 
                    disabled={saving} 
                    style={[styles.headerBtn, { width: 'auto', paddingHorizontal: 10 }]}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color={Colors.dark.tint} />
                    ) : (
                        <ThemedText style={{ color: Colors.dark.tint, fontWeight: 'bold', fontSize: 16 }}>Save</ThemedText>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                
                {/* Main Info */}
                <View style={styles.section}>
                    <ThemedText style={styles.label}>Name *</ThemedText>
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
                    <ThemedText style={styles.label}>Description</ThemedText>
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
                        <ThemedText style={styles.label}>Recipe (for Complex Ingredients)</ThemedText>
                        <TouchableOpacity onPress={() => setShowIngredientPicker(true)}>
                            <ThemedText style={styles.addText}>+ Add</ThemedText>
                        </TouchableOpacity>
                    </View>

                    {recipeItems.length === 0 && (
                        <ThemedText style={styles.helperText}>
                            Add ingredients here if this is a pre-batched item (e.g. syrups, infusions). 
                            Leave empty for raw ingredients.
                        </ThemedText>
                    )}

                    {recipeItems.map((item, index) => (
                        <View key={index} style={styles.recipeRow}>
                            <ThemedText style={styles.recipeName}>{item.name}</ThemedText>
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

            {/* Ingredient Picker Modal */}
            <Modal
                visible={showIngredientPicker}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowIngredientPicker(false)}
            >
                <TouchableWithoutFeedback onPress={() => setShowIngredientPicker(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalContent}>
                                <View style={styles.modalHeader}>
                                    <ThemedText style={styles.modalTitle}>Select Ingredient</ThemedText>
                                    <TouchableOpacity onPress={() => setShowIngredientPicker(false)}>
                                        <IconSymbol name="xmark" size={24} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search ingredients..."
                                    placeholderTextColor="#666"
                                    value={ingredientSearch}
                                    onChangeText={setIngredientSearch}
                                    autoFocus
                                />
                                <FlatList
                                    data={allIngredients.filter((i: any) => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.ingredientOption}
                                            onPress={() => {
                                                // Prevent adding itself? (Not possible since we are creating new, so no ID yet)
                                                setRecipeItems([...recipeItems, { ingredient_id: item.id, name: item.name, ml: "", dash: "", amount: "" }]);
                                                setShowIngredientPicker(false);
                                                setIngredientSearch("");
                                            }}
                                        >
                                            <ThemedText style={styles.ingredientText}>{item.name}</ThemedText>
                                        </TouchableOpacity>
                                    )}
                                />
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        padding: 20
    },
    modalContent: {
        backgroundColor: '#1E1E1E',
        borderRadius: 20,
        padding: 20,
        height: '80%'
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
