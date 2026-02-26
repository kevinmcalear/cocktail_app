import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet, TouchableOpacity, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSearchBar } from "@/components/BottomSearchBar";
import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useCocktail } from "@/hooks/useCocktails";
import { useDropdowns } from "@/hooks/useDropdowns";
import { supabase } from "@/lib/supabase";
import { DatabaseCocktail } from "@/types/types";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label, Text, TextArea, XStack, YStack, useTheme } from "tamagui";

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

export default function EditCocktailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();

    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();
    const { data: cocktail, isLoading: loadingCocktail } = useCocktail(id as string);

    const methods = dropdowns?.methods || [];
    const glassware = dropdowns?.glassware || [];
    const families = dropdowns?.families || [];
    const iceTypes = dropdowns?.iceTypes || [];
    const allIngredients = dropdowns?.ingredients || [];

    const loading = loadingDropdowns || loadingCocktail;
    const [saving, setSaving] = useState(false);
    const queryClient = useQueryClient();

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [origin, setOrigin] = useState("");
    const [garnish, setGarnish] = useState("");
    const [notes, setNotes] = useState("");
    const [spec, setSpec] = useState("");

    const isLoaded = useRef(false);

    // Checkbox/Selection State (IDs)
    const [methodId, setMethodId] = useState<string | null>(null);
    const [glasswareId, setGlasswareId] = useState<string | null>(null);
    const [familyId, setFamilyId] = useState<string | null>(null);
    const [iceId, setIceId] = useState<string | null>(null);

    // Recipe State
    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const [localImages, setLocalImages] = useState<{ id?: string, url: string, isNew?: boolean }[]>([]);
    
    // Modal States (replacing BottomSheets to prevent crashes and standardize styling)
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);
    const [ingredientSearch, setIngredientSearch] = useState("");
    
    const [addingCategory, setAddingCategory] = useState<{table: 'methods'|'glassware'|'families'|'ice', label: string} | null>(null);
    const [newItemName, setNewItemName] = useState("");

    const handleAddPill = async () => {
        if (!addingCategory || !newItemName.trim()) return;
        
        try {
            const { error } = await supabase.from(addingCategory.table).insert({ name: newItemName.trim() });
            if (error) throw error;
            
            queryClient.invalidateQueries({ queryKey: ['dropdowns'] });
            setAddingCategory(null);
            setNewItemName("");
        } catch (error) {
            console.error("Add item error:", error);
            Alert.alert("Error", "Failed to add new item.");
        }
    };

    const confirmDeletePill = async (type: string, table: string, id: string) => {
        try {
            await supabase.from('cocktails').update({ [type]: null }).eq(type, id);
            
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;
            
            if (type === 'method_id' && methodId === id) setMethodId(null);
            if (type === 'glassware_id' && glasswareId === id) setGlasswareId(null);
            if (type === 'family_id' && familyId === id) setFamilyId(null);
            if (type === 'ice_id' && iceId === id) setIceId(null);

            queryClient.invalidateQueries({ queryKey: ['dropdowns'] });
        } catch (error) {
            console.error("Delete error:", error);
            Alert.alert("Error", "Failed to delete item.");
        }
    };

    const handleDeletePill = async (type: 'method_id' | 'glassware_id' | 'family_id' | 'ice_id', table: 'methods' | 'glassware' | 'families' | 'ice', item: any) => {
        try {
            const { data: affected, error } = await supabase
                .from('cocktails')
                .select('id, name')
                .eq(type, item.id);

            if (error) throw error;

            if (affected && affected.length > 0) {
                const names = affected.map(c => c.name).join(", ");
                Alert.alert(
                    "Warning",
                    `Deleting this item will remove it from ${affected.length} cocktail(s):\n\n${names}\n\nAre you sure you want to delete it?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => confirmDeletePill(type, table, item.id) }
                    ]
                );
            } else {
                Alert.alert(
                    "Confirm Delete",
                    `Are you sure you want to delete "${item.name}"?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => confirmDeletePill(type, table, item.id) }
                    ]
                );
            }
        } catch (error) {
            console.error("Delete check error:", error);
            Alert.alert("Error", "Could not check affected cocktails.");
        }
    };

    useEffect(() => {
        if (cocktail && !isLoaded.current) {
            isLoaded.current = true;
            const c = cocktail as any; // Cast to any to handle join comfortably or upgrade type
            setName(c.name || "");
            setDescription(c.description || "");
            setOrigin(c.origin || "");
            setGarnish(c.garnish_1 || "");
            setNotes(c.notes || "");
            setSpec(c.spec || "");

            setMethodId(c.method_id);
            setGlasswareId(c.glassware_id);
            setFamilyId(c.family_id);
            setIceId(c.ice_id);

            // Populate existing images
            if (c.cocktail_images) {
                const sortedImages = [...c.cocktail_images].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
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
                    bsp: r.ingredient_bsp?.toString() || "",
                    ml: r.ingredient_ml?.toString() || "",
                    dash: r.ingredient_dash?.toString() || "",
                    amount: r.ingredient_amount?.toString() || "",
                    is_top: r.is_top || false
                }));
                setRecipeItems(mappedRecipes);
            }
        }
    }, [cocktail?.id]);

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
            const fileName = `cocktails/${id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

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
        if (!name?.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return;
        }

        setSaving(true);
        try {
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
                garnish_1: garnish || null,
                notes: notes || null,
                spec: spec || null,
                method_id: methodId,
                glassware_id: glasswareId,
                family_id: familyId,
                ice_id: iceId,
            };

            const { error } = await supabase
                .from('cocktails')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            const keptIds = recipeItems.map(r => r.id).filter(Boolean);
            if (keptIds.length > 0) {
                await supabase.from('recipes').delete().eq('cocktail_id', id).not('id', 'in', `(${keptIds.join(',')})`);
            } else {
                await supabase.from('recipes').delete().eq('cocktail_id', id);
            }

            for (const item of recipeItems) {
                const payload = {
                    cocktail_id: id,
                    ingredient_id: item.ingredient_id,
                    ingredient_bsp: parseFloat(item.bsp) || null,
                    ingredient_ml: parseFloat(item.ml) || null,
                    ingredient_dash: parseFloat(item.dash) || null,
                    ingredient_amount: parseFloat(item.amount) || null,
                    is_top: item.is_top || false,
                };

                if (item.id) {
                    await supabase.from('recipes').update(payload).eq('id', item.id);
                } else {
                    await supabase.from('recipes').insert(payload);
                }
            }

            queryClient.invalidateQueries({ queryKey: ['cocktail', id] });
            queryClient.invalidateQueries({ queryKey: ['cocktails'] });

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
            <YStack style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.dark.tint} />
            </YStack>
        );
    }

    return (
        <YStack style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header fixed to top 20px matching Beer and Wine edits exactly */}
            <XStack
                paddingTop={20}
                paddingHorizontal="$4"
                paddingBottom="$4"
                alignItems="center"
                justifyContent="space-between"
                zIndex={10}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="xmark" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text fontSize="$5" fontWeight="bold">Edit Cocktail</Text>
                <Button 
                    onPress={handleSave} 
                    disabled={saving}
                    size="$3"
                    chromeless
                >
                    {saving ? <ActivityIndicator size="small" color={Colors.dark.tint} /> : <Text color={Colors.dark.tint} fontWeight="bold">Save</Text>}
                </Button>
            </XStack>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>

                <SortableImageList 
                    images={localImages}
                    onReorder={setLocalImages}
                    onRemove={(index) => {
                        const newImages = localImages.filter((_, i) => i !== index);
                        setLocalImages(newImages);
                    }}
                    onAdd={pickImage}
                />

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Name *</Label>
                    <Input
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor="$color11"
                        placeholder="e.g. Negroni"
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Description</Label>
                    <TextArea
                        value={description}
                        onChangeText={setDescription}
                        numberOfLines={4}
                        placeholderTextColor="$color11"
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Method</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
                        <XStack gap="$2">
                            {methods.map((m: any) => (
                                <Button
                                    key={m.id}
                                    size="$3"
                                    borderRadius="$10"
                                    backgroundColor={methodId === m.id ? Colors.dark.tint : "rgba(255,255,255,0.05)"}
                                    borderColor={methodId === m.id ? Colors.dark.tint : "rgba(255,255,255,0.1)"}
                                    borderWidth={1}
                                    onPress={() => setMethodId(m.id)}
                                    onLongPress={() => handleDeletePill('method_id', 'methods', m)}
                                >
                                    <Text color={methodId === m.id ? "#000" : Colors.dark.text} fontWeight={methodId === m.id ? "bold" : "normal"}>{m.name}</Text>
                                </Button>
                            ))}
                            <Button size="$3" borderRadius="$10" borderStyle="dashed" backgroundColor="transparent" borderWidth={1} borderColor="rgba(255,255,255,0.2)" onPress={() => setAddingCategory({ table: 'methods', label: 'Method' })}>
                                <Text color={Colors.dark.tint}>+ Add</Text>
                            </Button>
                        </XStack>
                    </ScrollView>
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Glassware</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
                        <XStack gap="$2">
                            {glassware.map((g: any) => (
                                <Button
                                    key={g.id}
                                    size="$3"
                                    borderRadius="$10"
                                    backgroundColor={glasswareId === g.id ? Colors.dark.tint : "rgba(255,255,255,0.05)"}
                                    borderColor={glasswareId === g.id ? Colors.dark.tint : "rgba(255,255,255,0.1)"}
                                    borderWidth={1}
                                    onPress={() => setGlasswareId(g.id)}
                                    onLongPress={() => handleDeletePill('glassware_id', 'glassware', g)}
                                >
                                    <Text color={glasswareId === g.id ? "#000" : Colors.dark.text} fontWeight={glasswareId === g.id ? "bold" : "normal"}>{g.name}</Text>
                                </Button>
                            ))}
                            <Button size="$3" borderRadius="$10" borderStyle="dashed" backgroundColor="transparent" borderWidth={1} borderColor="rgba(255,255,255,0.2)" onPress={() => setAddingCategory({ table: 'glassware', label: 'Glassware' })}>
                                <Text color={Colors.dark.tint}>+ Add</Text>
                            </Button>
                        </XStack>
                    </ScrollView>
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Family</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
                        <XStack gap="$2">
                            {families.map((f: any) => (
                                <Button
                                    key={f.id}
                                    size="$3"
                                    borderRadius="$10"
                                    backgroundColor={familyId === f.id ? Colors.dark.tint : "rgba(255,255,255,0.05)"}
                                    borderColor={familyId === f.id ? Colors.dark.tint : "rgba(255,255,255,0.1)"}
                                    borderWidth={1}
                                    onPress={() => setFamilyId(f.id)}
                                    onLongPress={() => handleDeletePill('family_id', 'families', f)}
                                >
                                    <Text color={familyId === f.id ? "#000" : Colors.dark.text} fontWeight={familyId === f.id ? "bold" : "normal"}>{f.name}</Text>
                                </Button>
                            ))}
                            <Button size="$3" borderRadius="$10" borderStyle="dashed" backgroundColor="transparent" borderWidth={1} borderColor="rgba(255,255,255,0.2)" onPress={() => setAddingCategory({ table: 'families', label: 'Family' })}>
                                <Text color={Colors.dark.tint}>+ Add</Text>
                            </Button>
                        </XStack>
                    </ScrollView>
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Ice</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
                        <XStack gap="$2">
                            {iceTypes.map((i: any) => (
                                <Button
                                    key={i.id}
                                    size="$3"
                                    borderRadius="$10"
                                    backgroundColor={iceId === i.id ? Colors.dark.tint : "rgba(255,255,255,0.05)"}
                                    borderColor={iceId === i.id ? Colors.dark.tint : "rgba(255,255,255,0.1)"}
                                    borderWidth={1}
                                    onPress={() => setIceId(iceId === i.id ? null : i.id)}
                                    onLongPress={() => handleDeletePill('ice_id', 'ice', i)}
                                >
                                    <Text color={iceId === i.id ? "#000" : Colors.dark.text} fontWeight={iceId === i.id ? "bold" : "normal"}>{i.name}</Text>
                                </Button>
                            ))}
                            <Button size="$3" borderRadius="$10" borderStyle="dashed" backgroundColor="transparent" borderWidth={1} borderColor="rgba(255,255,255,0.2)" onPress={() => setAddingCategory({ table: 'ice', label: 'Ice' })}>
                                <Text color={Colors.dark.tint}>+ Add</Text>
                            </Button>
                        </XStack>
                    </ScrollView>
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$2">
                        <Label color="$color11">Ingredients</Label>
                        <TouchableOpacity onPress={() => setShowIngredientPicker(true)}>
                            <Text color={Colors.dark.tint} fontWeight="bold">+ Add</Text>
                        </TouchableOpacity>
                    </XStack>

                    {recipeItems.map((item, index) => (
                        <View key={index} style={styles.recipeRow}>
                            <Text style={styles.recipeName}>{item.name}</Text>
                            <View style={[styles.recipeInputs, { flexWrap: 'wrap', justifyContent: 'flex-end', flex: 2, gap: 4 }]}>
                                <Button
                                    size="$2"
                                    backgroundColor={item.is_top ? Colors.dark.tint : 'rgba(255,255,255,0.05)'}
                                    onPress={() => {
                                        const newItems = [...recipeItems];
                                        newItems[index].is_top = !newItems[index].is_top;
                                        setRecipeItems(newItems);
                                    }}
                                >
                                    <Text color={item.is_top ? '#000' : '#fff'} fontSize={12}>Top</Text>
                                </Button>
                                <View style={styles.inputGroup}>
                                    <Input
                                        size="$2"
                                        width={50}
                                        placeholder="bsp"
                                        keyboardType="numeric"
                                        backgroundColor="rgba(255,255,255,0.05)"
                                        borderColor="rgba(255,255,255,0.1)"
                                        value={item.bsp}
                                        onChangeText={(v) => {
                                            const newItems = [...recipeItems];
                                            newItems[index].bsp = v;
                                            setRecipeItems(newItems);
                                        }}
                                    />
                                    <Text style={styles.unitText}>bs</Text>
                                </View>
                                <View style={styles.inputGroup}>
                                    <Input
                                        size="$2"
                                        width={50}
                                        placeholder="ml"
                                        keyboardType="numeric"
                                        backgroundColor="rgba(255,255,255,0.05)"
                                        borderColor="rgba(255,255,255,0.1)"
                                        value={item.ml}
                                        onChangeText={(v) => {
                                            const newItems = [...recipeItems];
                                            newItems[index].ml = v;
                                            setRecipeItems(newItems);
                                        }}
                                    />
                                    <Text style={styles.unitText}>ml</Text>
                                </View>
                                <View style={styles.inputGroup}>
                                    <Input
                                        size="$2"
                                        width={50}
                                        placeholder="dash"
                                        keyboardType="numeric"
                                        backgroundColor="rgba(255,255,255,0.05)"
                                        borderColor="rgba(255,255,255,0.1)"
                                        value={item.dash}
                                        onChangeText={(v) => {
                                            const newItems = [...recipeItems];
                                            newItems[index].dash = v;
                                            setRecipeItems(newItems);
                                        }}
                                    />
                                    <Text style={styles.unitText}>ds</Text>
                                </View>
                                <View style={styles.inputGroup}>
                                    <Input
                                        size="$2"
                                        width={50}
                                        placeholder="amt"
                                        keyboardType="numeric"
                                        backgroundColor="rgba(255,255,255,0.05)"
                                        borderColor="rgba(255,255,255,0.1)"
                                        value={item.amount}
                                        onChangeText={(v) => {
                                            const newItems = [...recipeItems];
                                            newItems[index].amount = v;
                                            setRecipeItems(newItems);
                                        }}
                                    />
                                    <Text style={styles.unitText}>#</Text>
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
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Origin</Label>
                    <Input 
                        value={origin} 
                        onChangeText={setOrigin} 
                        placeholderTextColor="$color11" 
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Garnish</Label>
                    <Input 
                        value={garnish} 
                        onChangeText={setGarnish} 
                        placeholderTextColor="$color11" 
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Notes</Label>
                    <TextArea 
                        value={notes} 
                        onChangeText={setNotes} 
                        multiline 
                        placeholderTextColor="$color11" 
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Spec</Label>
                    <TextArea 
                        value={spec} 
                        onChangeText={setSpec} 
                        multiline 
                        placeholderTextColor="$color11" 
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

            </ScrollView>

            {/* Native Modal for adding categories avoiding gorhom issues */}
            <Modal
                visible={!!addingCategory}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setAddingCategory(null)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    <View style={styles.modalOverlay}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setAddingCategory(null)} />
                        <View style={[styles.bottomSheetModalContent, { backgroundColor: theme.background?.get() as string }]}>
                            <Text style={[styles.modalTitle, { marginBottom: 16, color: theme.color?.get() as string }]}>Add New {addingCategory?.label}</Text>
                            <Input
                                size="$4"
                                marginBottom="$4"
                                placeholder={`Enter ${addingCategory?.label} name`}
                                backgroundColor="rgba(255,255,255,0.05)"
                                borderColor="rgba(255,255,255,0.1)"
                                value={newItemName}
                                onChangeText={setNewItemName}
                                color="$color"
                                autoFocus
                            />
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                                <TouchableOpacity onPress={() => setAddingCategory(null)} style={{ padding: 12 }}>
                                    <Text style={{ color: theme.color11?.get() as string }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleAddPill} style={{ backgroundColor: theme.color8?.get() as string, padding: 12, borderRadius: 8, paddingHorizontal: 20 }}>
                                    <Text style={{ color: theme.backgroundStrong?.get() as string, fontWeight: 'bold' }}>Add</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Native Modal for adding ingredients avoiding gorhom issues */}
            <Modal
                visible={showIngredientPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowIngredientPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowIngredientPicker(false)} />
                    <View style={[styles.fullSheetModalContent, { backgroundColor: theme.background?.get() as string, paddingBottom: insets.bottom }]}>
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
                            showsVerticalScrollIndicator={false}
                            data={allIngredients.filter((i: any) => 
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
                                            bsp: "",
                                            ml: "",
                                            dash: "",
                                            amount: "",
                                            is_top: false
                                        }]);
                                        setShowIngredientPicker(false);
                                    }}
                                >
                                    <Text style={styles.ingredientText}>{item.name}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
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
        backgroundColor: Colors.dark.background,
    },
    headerBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    recipeRow: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
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
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    unitText: {
        color: '#666',
        fontSize: 12
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    bottomSheetModalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    fullSheetModalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
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
