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

import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { GenerateImageButton } from "@/components/GenerateImageButton";
import { SearchBar } from "@/components/SearchBar";
import { CustomIcon } from "@/components/ui/CustomIcons";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useBars } from "@/hooks/useBars";
import { useCocktail } from "@/hooks/useCocktails";
import { useDropdowns } from "@/hooks/useDropdowns";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label, Text, TextArea, XStack, YStack, useTheme, Select, Adapt, Sheet, Accordion } from "tamagui";

interface RecipeItem {
    id?: string;
    ingredient_id: string;
    name: string;
    amount: string;
    unit: string;
    preparation_notes: string;
    is_optional: boolean;
}

export default function EditCocktailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();

    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();
    const { data: cocktail, isLoading: loadingCocktail } = useCocktail(id as string);
    const { data: userBars } = useBars();

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
    const [notes, setNotes] = useState("");
    const [spec, setSpec] = useState("");

    const isLoaded = useRef(false);

    // Checkbox/Selection State (IDs)
    const [methodId, setMethodId] = useState<string | null>(null);
    const [glasswareId, setGlasswareId] = useState<string | null>(null);
    const [familyId, setFamilyId] = useState<string | null>(null);
    const [iceId, setIceId] = useState<string | null>(null);

    // Bar Assignment and Overrides
    const [barId, setBarId] = useState<string | null>(null);
    const [overrideVisibility, setOverrideVisibility] = useState<string | null>(null);
    const [overrideGeneric, setOverrideGeneric] = useState<string | null>(null);
    const [overrideSpecific, setOverrideSpecific] = useState<string | null>(null);
    const [overrideMeasurement, setOverrideMeasurement] = useState<string | null>(null);
    const [overridePrep, setOverridePrep] = useState<string | null>(null);

    // Recipe State
    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const [localImages, setLocalImages] = useState<{ id?: string, url: string, isNew?: boolean }[]>([]);
    
    // Modal States (replacing BottomSheets to prevent crashes and standardize styling)
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);
    const [ingredientSearch, setIngredientSearch] = useState("");
    
    const [addingCategory, setAddingCategory] = useState<{type: 'method'|'glassware'|'family'|'ice', label: string} | null>(null);
    const [newItemName, setNewItemName] = useState("");

    const handleAddPill = async () => {
        if (!addingCategory || !newItemName.trim()) return;
        
        try {
            const { error } = await supabase.from('items').insert({ 
                name: newItemName.trim(), 
                item_type: addingCategory.type 
            });
            if (error) throw error;
            
            queryClient.invalidateQueries({ queryKey: ['dropdowns'] });
            setAddingCategory(null);
            setNewItemName("");
        } catch (error) {
            console.error("Add item error:", error);
            Alert.alert("Error", "Failed to add new item.");
        }
    };

    const confirmDeletePill = async (field: string, id: string) => {
        try {
            // Nullify this field on all items that used this category
            await supabase.from('items').update({ [field]: null }).eq(field, id);
            
            // Delete the category itself
            const { error } = await supabase.from('items').delete().eq('id', id);
            if (error) throw error;
            
            if (field === 'method_id' && methodId === id) setMethodId(null);
            if (field === 'glassware_id' && glasswareId === id) setGlasswareId(null);
            if (field === 'family_id' && familyId === id) setFamilyId(null);
            if (field === 'ice_id' && iceId === id) setIceId(null);

            queryClient.invalidateQueries({ queryKey: ['dropdowns'] });
        } catch (error) {
            console.error("Delete error:", error);
            Alert.alert("Error", "Failed to delete item.");
        }
    };

    const handleDeletePill = async (field: 'method_id' | 'glassware_id' | 'family_id' | 'ice_id', item: any) => {
        try {
            const { data: affected, error } = await supabase
                .from('items')
                .select('id, name')
                .eq(field, item.id)
                .eq('item_type', 'cocktail');

            if (error) throw error;

            if (affected && affected.length > 0) {
                const names = affected.map((c: any) => c.name).join(", ");
                Alert.alert(
                    "Warning",
                    `Deleting this item will remove it from ${affected.length} cocktail(s):\n\n${names}\n\nAre you sure you want to delete it?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => confirmDeletePill(field, item.id) }
                    ]
                );
            } else {
                Alert.alert(
                    "Confirm Delete",
                    `Are you sure you want to delete "${item.name}"?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => confirmDeletePill(field, item.id) }
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
            setNotes(c.notes || "");
            setSpec(c.spec || "");

            setMethodId(c.method_id);
            setGlasswareId(c.glassware_id);
            setFamilyId(c.family_id);
            setIceId(c.ice_id);

            // Populate existing images
            if (c.item_images) {
                const sortedImages = [...c.item_images].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
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
                    bsp: "", // Deprecated
                    ml: "", // Deprecated
                    dash: "", // Deprecated
                    amount: r.amount?.toString() || "",
                    unit: r.unit || "",
                    preparation_notes: r.preparation_notes || "",
                    is_optional: r.is_optional || false,
                    is_top: false // Deprecated
                }));
                setRecipeItems(mappedRecipes);
            }

            // Fetch admin fields since app_item_presentation omits them for security
            supabase.from('items').select('bar_id, override_visibility_level, override_generic_ingredient_level, override_specific_brand_level, override_measurement_level, override_prep_level').eq('id', id).single().then(({ data }) => {
                if (data) {
                    setBarId(data.bar_id);
                    setOverrideVisibility(data.override_visibility_level?.toString() || null);
                    setOverrideGeneric(data.override_generic_ingredient_level?.toString() || null);
                    setOverrideSpecific(data.override_specific_brand_level?.toString() || null);
                    setOverrideMeasurement(data.override_measurement_level?.toString() || null);
                    setOverridePrep(data.override_prep_level?.toString() || null);
                }
            });
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

            const updates: any = {
                name,
                description,
                origin: origin || null,
                notes: notes || null,
                spec: spec || null,
                method_id: methodId,
                glassware_id: glasswareId,
                family_id: familyId,
                ice_id: iceId,
                bar_id: barId || null,
                override_visibility_level: overrideVisibility ? parseInt(overrideVisibility) : null,
                override_generic_ingredient_level: overrideGeneric ? parseInt(overrideGeneric) : null,
                override_specific_brand_level: overrideSpecific ? parseInt(overrideSpecific) : null,
                override_measurement_level: overrideMeasurement ? parseInt(overrideMeasurement) : null,
                override_prep_level: overridePrep ? parseInt(overridePrep) : null,
            };

            const { error } = await supabase
                .from('items')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            const keptIds = recipeItems.map(r => r.id).filter(Boolean);
            if (keptIds.length > 0) {
                await supabase.from('recipes').delete().eq('recipe_item_id', id).not('id', 'in', `(${keptIds.join(',')})`);
            } else {
                await supabase.from('recipes').delete().eq('recipe_item_id', id);
            }

            for (const item of recipeItems) {
                const payload = {
                    recipe_item_id: id,
                    ingredient_item_id: item.ingredient_id,
                    amount: parseFloat(item.amount) || null,
                    unit: item.unit || null,
                    preparation_notes: item.preparation_notes || null,
                    is_optional: item.is_optional || false,
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
                <ActivityIndicator size="large" color={theme.color?.get() as string} />
            </YStack>
        );
    }

    return (
        <YStack style={styles.container} backgroundColor="$background">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header fixed to top 20px matching Beer and Wine edits exactly */}
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
                <Text fontSize="$5" fontWeight="bold">Edit Cocktail</Text>
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
                    generateComponent={<GenerateImageButton type="cocktail" id={id as string} variant="tile" />}
                />

                <YStack gap="$2" marginBottom="$4">
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

                <YStack gap="$2" marginBottom="$4">
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

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Method</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
                        <XStack gap="$2">
                            {methods.map((m: any) => (
                                <Button
                                    key={m.id}
                                    size="$3"
                                    borderRadius="$10"
                                    backgroundColor={methodId === m.id ? theme.color8?.get() as string : "$backgroundStrong"}
                                    borderColor={methodId === m.id ? theme.color8?.get() as string : "$borderColor"}
                                    borderWidth={1}
                                    onPress={() => setMethodId(m.id)}
                                    onLongPress={() => handleDeletePill('method_id', m)}
                                >
                                    <XStack gap="$2" alignItems="center">
                                        <CustomIcon name={m.name} size={16} color={theme.color?.get() as string} />
                                        <Text color={theme.color?.get() as string} fontWeight={methodId === m.id ? "bold" : "normal"}>{m.name}</Text>
                                    </XStack>
                                </Button>
                            ))}
                            <Button size="$3" borderRadius="$10" borderStyle="dashed" backgroundColor="transparent" borderWidth={1} borderColor="rgba(255,255,255,0.2)" onPress={() => setAddingCategory({ type: 'method', label: 'Method' })}>
                                <Text color={theme.color8?.get() as string}>+ Add</Text>
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
                                    backgroundColor={glasswareId === g.id ? theme.color8?.get() as string : "$backgroundStrong"}
                                    borderColor={glasswareId === g.id ? theme.color8?.get() as string : "$borderColor"}
                                    borderWidth={1}
                                    onPress={() => setGlasswareId(g.id)}
                                    onLongPress={() => handleDeletePill('glassware_id', g)}
                                >
                                    <XStack gap="$2" alignItems="center">
                                        <CustomIcon name={g.name} size={16} color={theme.color?.get() as string} />
                                        <Text color={theme.color?.get() as string} fontWeight={glasswareId === g.id ? "bold" : "normal"}>{g.name}</Text>
                                    </XStack>
                                </Button>
                            ))}
                            <Button size="$3" borderRadius="$10" borderStyle="dashed" backgroundColor="transparent" borderWidth={1} borderColor="rgba(255,255,255,0.2)" onPress={() => setAddingCategory({ type: 'glassware', label: 'Glassware' })}>
                                <Text color={theme.color8?.get() as string}>+ Add</Text>
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
                                    backgroundColor={familyId === f.id ? theme.color8?.get() as string : "$backgroundStrong"}
                                    borderColor={familyId === f.id ? theme.color8?.get() as string : "$borderColor"}
                                    borderWidth={1}
                                    onPress={() => setFamilyId(f.id)}
                                    onLongPress={() => handleDeletePill('family_id', f)}
                                >
                                    <XStack gap="$2" alignItems="center">
                                        <CustomIcon name={f.name} size={16} color={theme.color?.get() as string} />
                                        <Text color={theme.color?.get() as string} fontWeight={familyId === f.id ? "bold" : "normal"}>{f.name}</Text>
                                    </XStack>
                                </Button>
                            ))}
                            <Button size="$3" borderRadius="$10" borderStyle="dashed" backgroundColor="transparent" borderWidth={1} borderColor="rgba(255,255,255,0.2)" onPress={() => setAddingCategory({ type: 'family', label: 'Family' })}>
                                <Text color={theme.color8?.get() as string}>+ Add</Text>
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
                                    backgroundColor={iceId === i.id ? theme.color8?.get() as string : "$backgroundStrong"}
                                    borderColor={iceId === i.id ? theme.color8?.get() as string : "$borderColor"}
                                    borderWidth={1}
                                    onPress={() => setIceId(iceId === i.id ? null : i.id)}
                                    onLongPress={() => handleDeletePill('ice_id', i)}
                                >
                                    <XStack gap="$2" alignItems="center">
                                        <CustomIcon name={i.name} size={16} color={theme.color?.get() as string} />
                                        <Text color={theme.color?.get() as string} fontWeight={iceId === i.id ? "bold" : "normal"}>{i.name}</Text>
                                    </XStack>
                                </Button>
                            ))}
                            <Button size="$3" borderRadius="$10" borderStyle="dashed" backgroundColor="transparent" borderWidth={1} borderColor="rgba(255,255,255,0.2)" onPress={() => setAddingCategory({ type: 'ice', label: 'Ice' })}>
                                <Text color={theme.color8?.get() as string}>+ Add</Text>
                            </Button>
                        </XStack>
                    </ScrollView>
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$2">
                        <Label color="$color11">Ingredients</Label>
                        <TouchableOpacity onPress={() => setShowIngredientPicker(true)}>
                            <Text color={theme.color8?.get() as string} fontWeight="bold">+ Add</Text>
                        </TouchableOpacity>
                    </XStack>

                    {recipeItems.map((item, index) => (
                        <View key={index} style={styles.recipeRow}>
                            <Text style={styles.recipeName}>{item.name}</Text>
                            <View style={[styles.recipeInputs, { flexWrap: 'wrap', justifyContent: 'flex-end', flex: 2, gap: 4 }]}>
                                <View style={styles.inputGroup}>
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
                                </View>
                                <View style={styles.inputGroup}>
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
                        backgroundColor="$backgroundStrong"
                        borderColor="$borderColor"
                        focusStyle={{ borderColor: '$color8' }}
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
                        backgroundColor="$backgroundStrong"
                        borderColor="$borderColor"
                        focusStyle={{ borderColor: '$color8' }}
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
                        backgroundColor="$backgroundStrong"
                        borderColor="$borderColor"
                        focusStyle={{ borderColor: '$color8' }}
                    />
                </YStack>

                <Accordion overflow="hidden" width="100%" type="multiple" backgroundColor="transparent" marginBottom="$6">
                    <Accordion.Item value="a1" borderRadius="$4" borderColor="$borderColor" borderWidth={1} backgroundColor="$backgroundStrong">
                        <Accordion.Trigger flexDirection="row" justifyContent="space-between" padding="$3" backgroundColor="$backgroundStrong">
                            {({ open }) => (
                                <>
                                    <XStack gap="$2" alignItems="center">
                                        <IconSymbol name="lock.shield.fill" size={18} color={theme.color11?.get() as string} />
                                        <Text color="$color" fontWeight="bold">Bar Assignment & Access</Text>
                                    </XStack>
                                    <IconSymbol name={open ? "chevron.up" : "chevron.down"} size={16} color={theme.color11?.get() as string} />
                                </>
                            )}
                        </Accordion.Trigger>
                        <Accordion.HeightAnimator animation="medium">
                            <Accordion.Content animation="medium" exitStyle={{ opacity: 0 }} padding="$3" borderTopWidth={1} borderColor="$borderColor">
                                <YStack gap="$3">
                                    <YStack gap="$1">
                                        <Label color="$color11">Assign to Bar (Global if empty)</Label>
                                        <Select value={barId || 'global'} onValueChange={(val) => setBarId(val === 'global' ? null : val)} disablePreventBodyScroll>
                                            <Select.Trigger backgroundColor="$background" borderColor="$borderColor">
                                                <Select.Value placeholder="Select Bar" color="$color" />
                                            </Select.Trigger>
                                            <Adapt when="sm" reaches="sm">
                                                <Sheet modal dismissOnSnapToBottom><Sheet.Frame><Sheet.ScrollView><Adapt.Contents /></Sheet.ScrollView></Sheet.Frame><Sheet.Overlay /></Sheet>
                                            </Adapt>
                                            <Select.Content zIndex={200000}>
                                                <Select.Viewport minWidth={200}>
                                                    <Select.Group>
                                                        <Select.Item index={0} value="global"><Select.ItemText>Global / Public</Select.ItemText></Select.Item>
                                                        {userBars?.map((b: any, i: number) => (
                                                            <Select.Item key={b.bar_id} index={i+1} value={b.bar_id}><Select.ItemText>{b.bars?.name}</Select.ItemText></Select.Item>
                                                        ))}
                                                    </Select.Group>
                                                </Select.Viewport>
                                            </Select.Content>
                                        </Select>
                                    </YStack>
                                    
                                    <Text fontSize={12} color="$color11" marginTop="$2" marginBottom="$1">Leave empty to use the Bar's default rules.</Text>
                                    
                                    {['Visibility', 'Generic Ingredient', 'Specific Brand', 'Measurement', 'Prep'].map((field, idx) => {
                                        const val = [overrideVisibility, overrideGeneric, overrideSpecific, overrideMeasurement, overridePrep][idx];
                                        const setVal = [setOverrideVisibility, setOverrideGeneric, setOverrideSpecific, setOverrideMeasurement, setOverridePrep][idx];
                                        return (
                                            <XStack key={field} justifyContent="space-between" alignItems="center">
                                                <Label color="$color11" flex={1}>{field} Level</Label>
                                                <Select value={val || 'default'} onValueChange={(v) => setVal(v === 'default' ? null : v)} disablePreventBodyScroll>
                                                    <Select.Trigger width={160} backgroundColor="$background" borderColor="$borderColor" size="$3">
                                                        <Select.Value placeholder="Bar Default" color="$color" />
                                                    </Select.Trigger>
                                                    <Adapt when="sm" reaches="sm"><Sheet modal dismissOnSnapToBottom><Sheet.Frame><Sheet.ScrollView><Adapt.Contents /></Sheet.ScrollView></Sheet.Frame><Sheet.Overlay /></Sheet></Adapt>
                                                    <Select.Content zIndex={200000}>
                                                        <Select.Viewport minWidth={200}>
                                                            <Select.Group>
                                                                <Select.Item index={0} value="default"><Select.ItemText>Bar Default</Select.ItemText></Select.Item>
                                                                <Select.Item index={1} value="10"><Select.ItemText>Guest (10)</Select.ItemText></Select.Item>
                                                                <Select.Item index={2} value="20"><Select.ItemText>Trainee (20)</Select.ItemText></Select.Item>
                                                                <Select.Item index={3} value="30"><Select.ItemText>Bartender (30)</Select.ItemText></Select.Item>
                                                                <Select.Item index={4} value="40"><Select.ItemText>Admin (40)</Select.ItemText></Select.Item>
                                                            </Select.Group>
                                                        </Select.Viewport>
                                                    </Select.Content>
                                                </Select>
                                            </XStack>
                                        );
                                    })}
                                </YStack>
                            </Accordion.Content>
                        </Accordion.HeightAnimator>
                    </Accordion.Item>
                </Accordion>

            </ScrollView>
            </KeyboardAvoidingView>

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
                                backgroundColor="$backgroundStrong"
                                borderColor="$borderColor"
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
                            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
                            showsVerticalScrollIndicator={false}
                            data={allIngredients.filter((i: any) => 
                                i.name.toLowerCase().includes(ingredientSearch.toLowerCase())
                            )}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.ingredientOption, { borderBottomColor: theme.borderColor?.get() as string }]}
                                    onPress={() => {
                                        setRecipeItems([...recipeItems, {
                                            ingredient_id: item.id,
                                            name: item.name,
                                            amount: "",
                                            unit: "",
                                            preparation_notes: "",
                                            is_optional: false
                                        }]);
                                        setShowIngredientPicker(false);
                                    }}
                                >
                                    <Text color={theme.color?.get() as string} fontSize={16}>{item.name}</Text>
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
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
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
        borderTopLeftRadius: 48,
        borderTopRightRadius: 48,
        borderCurve: 'continuous',
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
    },
    ingredientOption: {
        padding: 16,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    }
});
