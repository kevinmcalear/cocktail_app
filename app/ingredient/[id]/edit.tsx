import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useIngredient } from "@/hooks/useIngredients";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Text, YStack } from "tamagui";

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

    // Recipe State
    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);
    const [ingredientSearch, setIngredientSearch] = useState("");

    const queryClient = useQueryClient();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();
    const { data, isLoading: loadingIngredient } = useIngredient(id as string);
    const allIngredients = dropdowns?.ingredients || [];
    
    const loading = loadingDropdowns || loadingIngredient;

    useEffect(() => {
        if (data?.ingredient) {
            setName(data.ingredient.name || "");
            setDescription(data.ingredient.description || "");
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

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return;
        }
        setSaving(true);
        try {
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
                                    <Text style={styles.modalTitle}>Select Ingredient</Text>
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
                                    data={allIngredients.filter((i: any) => {
                                        // Filter out itself to prevent cyclic recursion if possible
                                        if (i.id === id) return false;
                                        return i.name.toLowerCase().includes(ingredientSearch.toLowerCase())
                                    })}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.ingredientOption}
                                            onPress={() => {
                                                setRecipeItems([...recipeItems, { ingredient_id: item.id, name: item.name, ml: "", dash: "", amount: "" }]);
                                                setShowIngredientPicker(false);
                                                setIngredientSearch("");
                                            }}
                                        >
                                            <Text style={styles.ingredientText}>{item.name}</Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

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
