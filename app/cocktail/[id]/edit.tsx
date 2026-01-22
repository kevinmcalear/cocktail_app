import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
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
    TouchableWithoutFeedback, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { supabase } from "@/lib/supabase";
import { DatabaseCocktail } from "@/types/types";

interface RecipeItem {
    id?: string;
    ingredient_id: string;
    name: string;
    ml: string;
    dash: string;
    amount: string;
}

export default function EditCocktailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();

    const [loading, setLoading] = useState(true);
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

    // Dropdown Data
    const [methods, setMethods] = useState<{ id: string, name: string }[]>([]);
    const [glassware, setGlassware] = useState<{ id: string, name: string }[]>([]);
    const [families, setFamilies] = useState<{ id: string, name: string }[]>([]);

    // Recipe State
    const [allIngredients, setAllIngredients] = useState<{ id: string, name: string }[]>([]);
    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);
    const [ingredientSearch, setIngredientSearch] = useState("");

    const [localImages, setLocalImages] = useState<{ id?: string, url: string, isNew?: boolean }[]>([]);


    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch dropdown options & ingredients
            const [methodsRes, glasswareRes, familiesRes, ingredientsRes] = await Promise.all([
                supabase.from('methods').select('*').order('name'),
                supabase.from('glassware').select('*').order('name'),
                supabase.from('families').select('*').order('name'),
                supabase.from('ingredients').select('*').order('name')
            ]);

            if (methodsRes.data) setMethods(methodsRes.data);
            if (glasswareRes.data) setGlassware(glasswareRes.data);
            if (familiesRes.data) setFamilies(familiesRes.data);
            if (ingredientsRes.data) setAllIngredients(ingredientsRes.data);

            // Fetch Cocktail Data
            const { data, error } = await supabase
                .from('cocktails')
                .select(`
                    *,
                    cocktail_images (
                        sort_order,
                        images (
                            id,
                            url
                        )
                    ),
                    recipes (
                        id,
                        ingredient_id,
                        ingredient_ml,
                        ingredient_dash,
                        ingredient_amount,
                        ingredients ( name )
                    )
                `)

                .eq('id', id)
                .single();

            if (error) throw error;

            if (data) {
                const c = data as any; // Cast to any to handle join comfortably or upgrade type
                setName(c.name || "");
                setDescription(c.description || "");
                setOrigin(c.origin || "");
                setGarnish(c.garnish || "");
                setNotes(c.notes || "");
                setSpec(c.spec || "");

                setMethodId(c.method_id);
                setGlasswareId(c.glassware_id);
                setFamilyId(c.family_id);

                // Populate existing images
                if (c.cocktail_images) {
                    const sortedImages = c.cocktail_images.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
                    const fetchedImages = sortedImages.map((ci: any) => ({
                        id: ci.images.id,
                        url: ci.images.url,
                        isNew: false
                    }));
                    setLocalImages(fetchedImages);
                }

                if (c.recipes) {
                    const mappedRecipes = c.recipes.map((r: any) => ({
                        id: r.id,
                        ingredient_id: r.ingredient_id,
                        name: r.ingredients?.name || "Unknown",
                        ml: r.ingredient_ml?.toString() || "",
                        dash: r.ingredient_dash?.toString() || "",
                        amount: r.ingredient_amount?.toString() || ""
                    }));
                    setRecipeItems(mappedRecipes);
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            Alert.alert("Error", "Failed to load cocktail details");
        } finally {
            setLoading(false);
        }
    };

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
            // allowsMultipleSelection: true, // EXPO 50+ feature if desired, keep simple for now
        });

        if (!result.canceled) {
            // Add to local state
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
            const fileName = `cocktails/${id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

            // Read file as base64
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64',
            });

            // Convert to ArrayBuffer
            const arrayBuffer = decode(base64);

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('drinks')
                .upload(fileName, arrayBuffer, {
                    contentType: `image/${ext}`,
                    upsert: false
                });

            if (uploadError) {
                console.error("Storage upload error:", uploadError);
                return null;
            }

            const { data: publicUrlData } = supabase.storage
                .from('drinks')
                .getPublicUrl(fileName);

            const publicUrl = publicUrlData.publicUrl;

            // 2. Insert into 'images' table
            const { data: imgData, error: imgError } = await supabase
                .from('images')
                .insert({ url: publicUrl })
                .select()
                .single();

            if (imgError || !imgData) {
                console.error("Image record creation error:", imgError);
                return null;
            }

            // Return the new image ID (linking happens in batch later)
            return imgData.id;

        } catch (error) {
            console.error("Image upload flow exception:", error);
            return null;
        }
    };

    const handleSave = async () => {
        if (!name?.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return;
        }

        setSaving(true);
        try {
            // 1. Handle Images (Upload new, then Sync links)
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

            // Sync cocktail_images (Delete removed, Upsert current with order)
            
            // Fetch existing links to know what to delete
            const { data: existingLinks } = await supabase
                .from('cocktail_images')
                .select('image_id')
                .eq('cocktail_id', id);

            const existingIds = existingLinks?.map(l => l.image_id) || [];
            const idsToDelete = existingIds.filter(eid => !finalImageIds.includes(eid));

            if (idsToDelete.length > 0) {
                 await supabase
                    .from('cocktail_images')
                    .delete()
                    .eq('cocktail_id', id)
                    .in('image_id', idsToDelete);
            }

            // Upsert with new order
            for (let i = 0; i < finalImageIds.length; i++) {
                await supabase
                    .from('cocktail_images')
                    .upsert({
                        cocktail_id: id, 
                        image_id: finalImageIds[i],
                        sort_order: i
                    }, { onConflict: 'cocktail_id,image_id' });
            }

            const updates: Partial<DatabaseCocktail> = {
                name,
                description,
                origin: origin || null,
                garnish: garnish || null,
                notes: notes || null,
                spec: spec || null,
                method_id: methodId,
                glassware_id: glasswareId,
                family_id: familyId,
            };

            const { error } = await supabase
                .from('cocktails')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            // Save Recipes
            // 1. Delete removed
            const keptIds = recipeItems.map(r => r.id).filter(Boolean);
            if (keptIds.length > 0) {
                await supabase.from('recipes').delete().eq('cocktail_id', id).not('id', 'in', `(${keptIds.join(',')})`);
            } else {
                await supabase.from('recipes').delete().eq('cocktail_id', id);
            }

            // 2. Upsert
            for (const item of recipeItems) {
                const payload = {
                    cocktail_id: id,
                    ingredient_id: item.ingredient_id,
                    ingredient_ml: parseFloat(item.ml) || null,
                    ingredient_dash: parseFloat(item.dash) || null,
                    ingredient_amount: parseFloat(item.amount) || null,
                };

                if (item.id) {
                    await supabase.from('recipes').update(payload).eq('id', item.id);
                } else {
                    await supabase.from('recipes').insert(payload);
                }
            }

            if (error) throw error;

            Alert.alert("Success", "Cocktail updated!", [
                { text: "OK", onPress: () => router.back() }
            ]);

        } catch (error) {
            console.error("Update error:", error);
            Alert.alert("Error", "Failed to update cocktail.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <ThemedView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.dark.tint} />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <GlassView style={[styles.header, { paddingTop: insets.top + 10 }]} intensity={80}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle">Edit Cocktail</ThemedText>
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
            </GlassView>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>

                {/* Image List */}
                <SortableImageList 
                    images={localImages}
                    onReorder={setLocalImages}
                    onRemove={(index) => {
                        const newImages = localImages.filter((_, i) => i !== index);
                        setLocalImages(newImages);
                    }}
                    onAdd={pickImage}
                />

                {/* Text Fields */}
                <View style={styles.section}>
                    <ThemedText style={styles.label}>Name *</ThemedText>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor="#666"
                    />
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

                {/* Dropdowns (Simulated with horizontal scroll for now) */}
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

                {/* Ingredients Section */}
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
                            <View style={styles.recipeInputs}>
                                <View style={styles.inputGroup}>
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
                                    <ThemedText style={styles.unitText}>ml</ThemedText>
                                </View>
                                <View style={styles.inputGroup}>
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
                                    <ThemedText style={styles.unitText}>ds</ThemedText>
                                </View>
                                <View style={styles.inputGroup}>
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
                                    <ThemedText style={styles.unitText}>#</ThemedText>
                                </View>
                                <TouchableOpacity onPress={() => {
                                    const newItems = recipeItems.filter((_, i) => i !== index);
                                    setRecipeItems(newItems);
                                }}>
                                    <IconSymbol name="trash" size={20} color="#ff4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>

                {/* More Details */}
                <View style={styles.section}>
                    <ThemedText style={styles.label}>Origin</ThemedText>
                    <TextInput
                        style={styles.input}
                        value={origin}
                        onChangeText={setOrigin}
                        placeholderTextColor="#666"
                    />
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Garnish</ThemedText>
                    <TextInput
                        style={styles.input}
                        value={garnish}
                        onChangeText={setGarnish}
                        placeholderTextColor="#666"
                    />
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Notes</ThemedText>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        placeholderTextColor="#666"
                    />
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Spec</ThemedText>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={spec}
                        onChangeText={setSpec}
                        multiline
                        placeholderTextColor="#666"
                    />
                </View>


            </ScrollView>

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
                                    data={allIngredients.filter(i => 
                                        i.name.toLowerCase().includes(ingredientSearch.toLowerCase())
                                    )}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.ingredientOption}
                                            onPress={() => {
                                                setRecipeItems([...recipeItems, {
                                                    ingredient_id: item.id,
                                                    name: item.name,
                                                    ml: "",
                                                    dash: "",
                                                    amount: ""
                                                }]);
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
    imagePicker: {
        width: '100%',
        height: 300,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#1A1A1A',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 10,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        alignItems: 'center',
        gap: 10
    },
    editIconBadge: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagesSection: {
        gap: 12,
    },
    imageList: {
        gap: 12,
        paddingRight: 20
    },
    addImageBtn: {
        width: 100,
        height: 125,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        gap: 8
    },
    addImageText: {
        fontSize: 14,
        color: '#888'
    },
    imageThumbContainer: {
        width: 100,
        height: 125,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative'
    },
    imageThumb: {
        width: '100%',
        height: '100%'
    },
    newBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.dark.tint
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
    saveButton: {
        backgroundColor: Colors.dark.tint,
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 20,
    },
    saveButtonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    addText: {
        color: Colors.dark.tint,
        fontWeight: 'bold',
    },
    recipeRow: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    recipeName: {
        fontSize: 16,
        marginBottom: 8,
        fontWeight: '600',
    },
    recipeInputs: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 8,
        paddingHorizontal: 8,
        flex: 1,
    },
    smallInput: {
        flex: 1,
        color: '#fff',
        paddingVertical: 8,
        fontSize: 14,
    },
    unitText: {
        color: '#666',
        fontSize: 12,
        marginLeft: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.dark.background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '70%',
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    searchInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 12,
        borderRadius: 10,
        color: '#fff',
        marginBottom: 20,
    },
    ingredientOption: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    ingredientText: {
        fontSize: 16,
    }
});
