import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
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
    bsp: string;
    ml: string;
    dash: string;
    amount: string;
    is_top: boolean;
}

interface Menu {
    id: string;
    name: string;
}

export default function AddCocktailScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const queryClient = useQueryClient();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();

    const methods = dropdowns?.methods || [];
    const glassware = dropdowns?.glassware || [];
    const families = dropdowns?.families || [];
    const iceTypes = dropdowns?.iceTypes || [];
    const allIngredients = dropdowns?.ingredients || [];
    const menus = dropdowns?.menus || [];

    const loading = loadingDropdowns;
    const [saving, setSaving] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [origin, setOrigin] = useState("");
    const [garnish, setGarnish] = useState("");
    const [notes, setNotes] = useState("");
    const [spec, setSpec] = useState("");

    // Checkbox/Selection State (IDs)
    const [methodId, setMethodId] = useState<string | null>(null);
    const [glasswareId, setGlasswareId] = useState<string | null>(null);
    const [familyId, setFamilyId] = useState<string | null>(null);
    const [iceId, setIceId] = useState<string | null>(null);

    // Menu State
    const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
    const [showMenuPicker, setShowMenuPicker] = useState(false);
    const [newMenuName, setNewMenuName] = useState("");

    // Recipe State
    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);
    const [ingredientSearch, setIngredientSearch] = useState("");

    // Image State (Local only for creation)
    const [localImages, setLocalImages] = useState<{ id: string, url: string }[]>([]);

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
                id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                url: asset.uri,
            }));
            setLocalImages(prev => [...prev, ...newImages]);
        }
    };

    const createMenu = async () => {
        if (!newMenuName.trim()) return;
        try {
            const { data, error } = await supabase
                .from('menus')
                .insert({ name: newMenuName, is_active: true })
                .select()
                .single();
            
            if (error) throw error;
            if (data) {
                queryClient.invalidateQueries({ queryKey: ['dropdowns'] });
                setSelectedMenuId(data.id);
                setNewMenuName("");
                setShowMenuPicker(false); // Close picker after creating and selecting
                Alert.alert("Menu Created", `"${data.name}" has been created and selected.`);
            }
        } catch (e) {
            Alert.alert("Error", "Failed to create menu");
            console.error(e);
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
            Alert.alert("Missing Info", "Name is required.");
            return;
        }
        setSaving(true);
        try {
            // 1. Create Cocktail
            const { data: cocktail, error: cocktailError } = await supabase
                .from('cocktails')
                .insert({
                    name,
                    description,
                    origin: origin || null,
                    garnish_1: garnish || null,
                    notes: notes || null,
                    spec: spec || null,
                    method_id: methodId,
                    glassware_id: glasswareId,
                    family_id: familyId,
                    ice_id: iceId,
                })
                .select()
                .single();

            if (cocktailError || !cocktail) throw cocktailError;

            const cocktailId = cocktail.id;

            // 2. Upload & Link Images
            for (let i = 0; i < localImages.length; i++) {
                const imgId = await uploadImage(localImages[i].url, cocktailId);
                if (imgId) {
                    await supabase.from('cocktail_images').insert({
                        cocktail_id: cocktailId,
                        image_id: imgId,
                        sort_order: i
                    });
                }
            }

            // 3. Save Recipes
            for (const item of recipeItems) {
                await supabase.from('recipes').insert({
                    cocktail_id: cocktailId,
                    ingredient_id: item.ingredient_id,
                    ingredient_bsp: parseFloat(item.bsp) || null,
                    ingredient_ml: parseFloat(item.ml) || null,
                    ingredient_dash: parseFloat(item.dash) || null,
                    ingredient_amount: parseFloat(item.amount) || null,
                    is_top: item.is_top || false,
                });
            }

            // 4. Associate with Menu (if selected)
            if (selectedMenuId) {
                // Get current max sort_order for this menu to append at end
                const { data: maxSort } = await supabase
                    .from('menu_drinks')
                    .select('sort_order')
                    .eq('menu_id', selectedMenuId)
                    .order('sort_order', { ascending: false })
                    .limit(1)
                    .single();
                
                const nextSortOrder = (maxSort?.sort_order ?? -1) + 1;

                await supabase.from('menu_drinks').insert({
                    menu_id: selectedMenuId,
                    cocktail_id: cocktailId,
                    sort_order: nextSortOrder
                });
            }

            Alert.alert("Success", "Cocktail created!", [
                { text: "OK", onPress: () => router.back() }
            ]);

        } catch (error) {
            console.error("Creation error:", error);
            Alert.alert("Error", "Failed to create cocktail.");
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
                <ThemedText type="subtitle">New Cocktail</ThemedText>
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

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.dark.tint} />
                </View>
            ) : (
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
                <View style={styles.section}>
                    <ThemedText style={styles.label}>Name *</ThemedText>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor="#666"
                        placeholder="e.g. Negroni"
                    />
                </View>

                {/* Menu Selection */}
                <View style={styles.section}>
                    <ThemedText style={styles.label}>Add to Menu</ThemedText>
                    <TouchableOpacity 
                        style={styles.selectButton} 
                        onPress={() => setShowMenuPicker(true)}
                    >
                        <ThemedText style={{ color: selectedMenuId ? '#fff' : '#666' }}>
                            {selectedMenuId ? menus.find(m => m.id === selectedMenuId)?.name : "Select Menu (Optional)"}
                        </ThemedText>
                        <IconSymbol name="chevron.down" size={20} color="#666" />
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Description</ThemedText>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={4}
                        placeholderTextColor="#666"
                    />
                </View>

                {/* Drink Specs Dropdowns */}
                <View style={styles.section}>
                    <ThemedText style={styles.label}>Method</ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillContainer}>
                        {methods.map(m => (
                            <TouchableOpacity
                                key={m.id}
                                style={[styles.pill, methodId === m.id && styles.pillActive]}
                                onPress={() => setMethodId(m.id)}
                            >
                                <ThemedText style={[styles.pillText, methodId === m.id && styles.pillTextActive]}>{m.name}</ThemedText>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Glassware</ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillContainer}>
                        {glassware.map(g => (
                            <TouchableOpacity
                                key={g.id}
                                style={[styles.pill, glasswareId === g.id && styles.pillActive]}
                                onPress={() => setGlasswareId(g.id)}
                            >
                                <ThemedText style={[styles.pillText, glasswareId === g.id && styles.pillTextActive]}>{g.name}</ThemedText>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Family</ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillContainer}>
                        {families.map(f => (
                            <TouchableOpacity
                                key={f.id}
                                style={[styles.pill, familyId === f.id && styles.pillActive]}
                                onPress={() => setFamilyId(f.id)}
                            >
                                <ThemedText style={[styles.pillText, familyId === f.id && styles.pillTextActive]}>{f.name}</ThemedText>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Ice</ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillContainer}>
                        {iceTypes.map(i => (
                            <TouchableOpacity
                                key={i.id}
                                style={[styles.pill, iceId === i.id && styles.pillActive]}
                                onPress={() => setIceId(iceId === i.id ? null : i.id)}
                            >
                                <ThemedText style={[styles.pillText, iceId === i.id && styles.pillTextActive]}>{i.name}</ThemedText>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Ingredients */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <ThemedText style={styles.label}>Ingredients</ThemedText>
                        <TouchableOpacity onPress={() => setShowIngredientPicker(true)}>
                            <ThemedText style={styles.addText}>+ Add</ThemedText>
                        </TouchableOpacity>
                    </View>

                    {recipeItems.map((item, index) => (
                        <View key={index} style={styles.recipeRow}>
                            <ThemedText style={styles.recipeName}>{item.name}</ThemedText>
                            <View style={[styles.recipeInputs, { flexWrap: 'wrap', justifyContent: 'flex-end', flex: 2 }]}>
                                <TouchableOpacity
                                    style={[styles.smallInput, { backgroundColor: item.is_top ? Colors.dark.tint : 'rgba(255,255,255,0.05)' }]}
                                    onPress={() => {
                                        const newItems = [...recipeItems];
                                        newItems[index].is_top = !newItems[index].is_top;
                                        setRecipeItems(newItems);
                                    }}
                                >
                                    <ThemedText style={{ color: item.is_top ? '#000' : '#fff', textAlign: 'center', fontSize: 12 }}>Top</ThemedText>
                                </TouchableOpacity>
                                <TextInput
                                    style={styles.smallInput}
                                    placeholder="bsp"
                                    placeholderTextColor="#666"
                                    keyboardType="numeric"
                                    value={item.bsp}
                                    onChangeText={(v) => {
                                        const newItems = [...recipeItems];
                                        newItems[index].bsp = v;
                                        setRecipeItems(newItems);
                                    }}
                                />
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

                {/* Extra Details */}
                <View style={styles.section}>
                    <ThemedText style={styles.label}>Origin</ThemedText>
                    <TextInput style={styles.input} value={origin} onChangeText={setOrigin} placeholderTextColor="#666" />
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Garnish</ThemedText>
                    <TextInput style={styles.input} value={garnish} onChangeText={setGarnish} placeholderTextColor="#666" />
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Notes</ThemedText>
                    <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes} multiline placeholderTextColor="#666" />
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Spec</ThemedText>
                    <TextInput style={[styles.input, styles.textArea]} value={spec} onChangeText={setSpec} multiline placeholderTextColor="#666" />
                </View>

            </ScrollView>
            )}

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
                                />
                                <FlatList
                                    data={allIngredients.filter(i => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.ingredientOption}
                                            onPress={() => {
                                                setRecipeItems([...recipeItems, { ingredient_id: item.id, name: item.name, bsp: "", ml: "", dash: "", amount: "", is_top: false }]);
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

            {/* Menu Picker Modal */}
            <Modal
                visible={showMenuPicker}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowMenuPicker(false)}
            >
                <TouchableWithoutFeedback onPress={() => setShowMenuPicker(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={[styles.modalContent, { maxHeight: '60%' }]}>
                                <View style={styles.modalHeader}>
                                    <ThemedText style={styles.modalTitle}>Select Menu</ThemedText>
                                    <TouchableOpacity onPress={() => setShowMenuPicker(false)}>
                                        <IconSymbol name="xmark" size={24} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                                
                                {/* Create New Menu Component */}
                                <View style={styles.createMenuRow}>
                                    <TextInput 
                                        style={[styles.input, { flex: 1, padding: 12 }]}
                                        placeholder="New Menu Name"
                                        placeholderTextColor="#666"
                                        value={newMenuName}
                                        onChangeText={setNewMenuName}
                                    />
                                    <TouchableOpacity style={styles.createBtn} onPress={createMenu}>
                                        <IconSymbol name="plus" size={20} color="#000" />
                                    </TouchableOpacity>
                                </View>

                                <FlatList
                                    data={menus}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={[styles.ingredientOption, item.id === selectedMenuId && { backgroundColor: 'rgba(230, 126, 34, 0.2)' }]}
                                            onPress={() => {
                                                setSelectedMenuId(item.id);
                                                setShowMenuPicker(false);
                                            }}
                                        >
                                            <ThemedText style={[styles.ingredientText, item.id === selectedMenuId && { color: Colors.dark.tint }]}>{item.name}</ThemedText>
                                            {item.id === selectedMenuId && <IconSymbol name="checkmark" size={16} color={Colors.dark.tint} />}
                                        </TouchableOpacity>
                                    )}
                                />
                                <TouchableOpacity style={styles.clearSelectionBtn} onPress={() => { setSelectedMenuId(null); setShowMenuPicker(false); }}>
                                    <ThemedText style={{color: '#ff4444'}}>Clear Selection</ThemedText>
                                </TouchableOpacity>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        minHeight: 100,
        textAlignVertical: 'top',
    },
    selectButton: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    pillContainer: {
        flexDirection: 'row',
    },
    pill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    pillActive: {
        backgroundColor: Colors.dark.tint,
        borderColor: Colors.dark.tint,
    },
    pillText: {
        color: '#ccc',
        fontSize: 14,
    },
    pillTextActive: {
        color: '#000',
        fontWeight: 'bold',
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
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: 8,
        color: '#fff',
        textAlign: 'center',
        justifyContent: 'center',
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
    },
    createMenuRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20
    },
    createBtn: {
        backgroundColor: Colors.dark.tint,
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    clearSelectionBtn: {
        padding: 16,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        marginTop: 10
    }
});
